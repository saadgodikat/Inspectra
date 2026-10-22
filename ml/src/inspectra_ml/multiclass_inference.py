"""Multiclass defect inference service for Inspectra.

Provides:
- predict_multiclass_image(image, ...) accepting file paths, raw bytes, or PIL Image.
- Reconstructs 5-class EfficientNet-B0 and caches weights once per process.
- Strict evaluation preprocessing: 256x256 bicubic resize, 224x224 center crop, ImageNet normalization.
- Softmax probability distribution over 5 classes: GOOD, CRACK, DENT, SCRATCH, OTHER_DEFECT.
- Thread-safe and process-cached.
- Gracefully handles missing checkpoints, corrupt images, and device fallbacks.
"""

import io
import time
from pathlib import Path
from typing import Dict, Any, Union, Optional, Tuple
from PIL import Image, UnidentifiedImageError

import torch
import torch.nn as nn

from inspectra_ml.dataset import (
    get_transforms,
    MULTICLASS_LABEL_TO_IDX,
    MULTICLASS_IDX_TO_LABEL,
)
from inspectra_ml.model import build_classifier

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MULTICLASS_CHECKPOINT_PATH = REPO_ROOT / "ml" / "artifacts" / "multiclass_defect_model.pth"
DEFAULT_MULTICLASS_MODEL_NAME = "efficientnet_b0_multiclass_defect"
DEFAULT_MULTICLASS_MODEL_VERSION = "v1.0.0"

_CACHED_MULTICLASS_MODEL: Optional[nn.Module] = None
_CACHED_MULTICLASS_CHECKPOINT: Optional[str] = None
_CACHED_MULTICLASS_DEVICE: Optional[torch.device] = None
_MULTICLASS_TRANSFORM = None


def get_inference_device() -> torch.device:
    """Select CUDA if available, otherwise CPU."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def clear_multiclass_model_cache() -> None:
    """Clear cached model and preprocessing state."""
    global _CACHED_MULTICLASS_MODEL, _CACHED_MULTICLASS_CHECKPOINT, _CACHED_MULTICLASS_DEVICE, _MULTICLASS_TRANSFORM
    _CACHED_MULTICLASS_MODEL = None
    _CACHED_MULTICLASS_CHECKPOINT = None
    _CACHED_MULTICLASS_DEVICE = None
    _MULTICLASS_TRANSFORM = None


def load_multiclass_model(
    checkpoint_path: Optional[Union[str, Path]] = None,
    device: Optional[torch.device] = None,
    force_reload: bool = False,
) -> Tuple[nn.Module, torch.device]:
    """Load and cache the trained 5-class multiclass model.

    Args:
        checkpoint_path: Path to checkpoint file. Defaults to REPO_ROOT/ml/artifacts/multiclass_defect_model.pth.
        device: Torch device. Defaults to CUDA if available, else CPU.
        force_reload: If True, reloads model ignoring cache.

    Returns:
        (model, device)
    """
    global _CACHED_MULTICLASS_MODEL, _CACHED_MULTICLASS_CHECKPOINT, _CACHED_MULTICLASS_DEVICE, _MULTICLASS_TRANSFORM

    if device is None:
        device = get_inference_device()

    if checkpoint_path is None:
        resolved_ckpt = DEFAULT_MULTICLASS_CHECKPOINT_PATH
    else:
        resolved_ckpt = Path(checkpoint_path)
        if not resolved_ckpt.is_absolute():
            resolved_ckpt = REPO_ROOT / resolved_ckpt

    ckpt_str = str(resolved_ckpt.resolve())

    if (
        not force_reload
        and _CACHED_MULTICLASS_MODEL is not None
        and _CACHED_MULTICLASS_CHECKPOINT == ckpt_str
        and _CACHED_MULTICLASS_DEVICE == device
    ):
        return _CACHED_MULTICLASS_MODEL, _CACHED_MULTICLASS_DEVICE

    if not resolved_ckpt.exists():
        raise FileNotFoundError(f"Multiclass model checkpoint was not found at: {resolved_ckpt}")

    checkpoint = torch.load(resolved_ckpt, map_location=device, weights_only=False)
    if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
        raise ValueError("Checkpoint is missing 'model_state_dict'.")

    num_classes = checkpoint.get("config", {}).get("num_classes", 5)

    model = build_classifier(
        pretrained=False,
        freeze_backbone=True,
        num_classes=num_classes,
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    _CACHED_MULTICLASS_MODEL = model
    _CACHED_MULTICLASS_CHECKPOINT = ckpt_str
    _CACHED_MULTICLASS_DEVICE = device
    _MULTICLASS_TRANSFORM = get_transforms(is_train=False, image_size=224)

    return _CACHED_MULTICLASS_MODEL, _CACHED_MULTICLASS_DEVICE


def predict_multiclass_image(
    image: Union[str, Path, bytes, bytearray, io.BytesIO, Image.Image],
    checkpoint_path: Optional[Union[str, Path]] = None,
    model_name: str = DEFAULT_MULTICLASS_MODEL_NAME,
    model_version: str = DEFAULT_MULTICLASS_MODEL_VERSION,
    device: Optional[torch.device] = None,
) -> Dict[str, Any]:
    """Run 5-class defect classification on an input image.

    Args:
        image: File path (str/Path), raw bytes, stream, or PIL Image.
        checkpoint_path: Optional custom path to model checkpoint.
        model_name: Model identifier.
        model_version: Model version.
        device: Torch device.

    Returns:
        Structured prediction dictionary with fields:
        - status: 'success' or 'failed'
        - predicted_class: 'GOOD' | 'CRACK' | 'DENT' | 'SCRATCH' | 'OTHER_DEFECT' | None
        - probabilities: {class: float} | None
        - confidence: float | None
        - model_name: str
        - model_version: str
        - processing_duration_ms: float
        - error_code: str | None
        - error_details: str | None
    """
    t_start = time.perf_counter()

    # 1. Load model
    try:
        model, model_device = load_multiclass_model(
            checkpoint_path=checkpoint_path, device=device
        )
    except FileNotFoundError:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "probabilities": None,
            "confidence": None,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "error_code": "CHECKPOINT_NOT_FOUND",
            "error_details": "Model checkpoint file was not found or is unreadable.",
        }
    except Exception as e:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "probabilities": None,
            "confidence": None,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "error_code": "INFERENCE_ERROR",
            "error_details": "Failed to initialize multiclass model.",
        }

    # 2. Decode image
    try:
        if isinstance(image, (bytes, bytearray)):
            if len(image) == 0:
                raise ValueError("Image bytes are empty.")
            stream = io.BytesIO(image)
            with Image.open(stream) as img:
                img.verify()
            stream.seek(0)
            pil_img = Image.open(stream).convert("RGB")
        elif isinstance(image, (str, Path)):
            img_path = Path(image)
            if not img_path.exists() or not img_path.is_file():
                raise FileNotFoundError("Image file does not exist.")
            with Image.open(img_path) as img:
                img.verify()
            pil_img = Image.open(img_path).convert("RGB")
        elif isinstance(image, io.BytesIO):
            image.seek(0)
            with Image.open(image) as img:
                img.verify()
            image.seek(0)
            pil_img = Image.open(image).convert("RGB")
        elif isinstance(image, Image.Image):
            pil_img = image.convert("RGB")
        else:
            raise TypeError("Unsupported image input type.")
    except Exception:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "probabilities": None,
            "confidence": None,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "error_code": "INVALID_IMAGE",
            "error_details": "Input image could not be decoded or is corrupt.",
        }

    # 3. Preprocess and Forward Pass
    try:
        global _MULTICLASS_TRANSFORM
        if _MULTICLASS_TRANSFORM is None:
            _MULTICLASS_TRANSFORM = get_transforms(is_train=False, image_size=224)

        input_tensor = _MULTICLASS_TRANSFORM(pil_img).unsqueeze(0).to(model_device)

        with torch.no_grad():
            logits = model(input_tensor)
            probs = torch.softmax(logits, dim=1).squeeze(0).cpu().numpy()

        pred_idx = int(probs.argmax())
        predicted_class = MULTICLASS_IDX_TO_LABEL[pred_idx]
        confidence = round(float(probs[pred_idx]), 4)

        probabilities = {
            MULTICLASS_IDX_TO_LABEL[i]: round(float(probs[i]), 4)
            for i in range(len(MULTICLASS_IDX_TO_LABEL))
        }

        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "success",
            "predicted_class": predicted_class,
            "probabilities": probabilities,
            "confidence": confidence,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "error_code": None,
            "error_details": None,
        }
    except Exception:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "probabilities": None,
            "confidence": None,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "error_code": "INFERENCE_ERROR",
            "error_details": "An error occurred during neural network forward pass.",
        }
