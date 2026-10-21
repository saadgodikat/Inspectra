"""Inference service module for Inspectra defect detection (Phase ML-5).

Provides a decoupled, robust prediction interface for the backend inspection workflow:
- predict_image(image, ...) accepts file path, raw bytes, or stream.
- Reconstructs EfficientNet-B0 classifier and loads cached checkpoint once per process.
- Strictly uses exact evaluation preprocessing: resize 256x256, center-crop 224x224, ImageNet normalization.
- Computes uncalibrated sigmoid scores and applies the frozen validation threshold (0.38).
- Returns structured prediction dictionary aligned with Flask MLResult schema.
- Gracefully handles missing checkpoints, invalid/corrupt images, and runtime errors.
"""

import io
import time
from pathlib import Path
from typing import Dict, Any, Union, Optional, Tuple
from PIL import Image, UnidentifiedImageError

import torch
import torch.nn as nn

from inspectra_ml.dataset import get_transforms
from inspectra_ml.model import build_classifier

# Default paths and metadata
# Resolves relative to the repository root
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CHECKPOINT_PATH = REPO_ROOT / "ml" / "artifacts" / "best_model.pth"
DEFAULT_MODEL_NAME = "efficientnet_b0_casting_binary"
DEFAULT_MODEL_VERSION = "v1.0.0"
DEFAULT_THRESHOLD = 0.38

# Process-level model cache
_CACHED_MODEL: Optional[nn.Module] = None
_CACHED_CHECKPOINT_PATH: Optional[str] = None
_CACHED_DEVICE: Optional[torch.device] = None
_TRANSFORM = None


def get_inference_device() -> torch.device:
    """Select CUDA if available, otherwise CPU."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def clear_model_cache() -> None:
    """Clear cached model and preprocessing state (useful for tests and reloading)."""
    global _CACHED_MODEL, _CACHED_CHECKPOINT_PATH, _CACHED_DEVICE, _TRANSFORM
    _CACHED_MODEL = None
    _CACHED_CHECKPOINT_PATH = None
    _CACHED_DEVICE = None
    _TRANSFORM = None


def load_model(
    checkpoint_path: Optional[Union[str, Path]] = None,
    device: Optional[torch.device] = None,
    force_reload: bool = False,
) -> Tuple[nn.Module, torch.device]:
    """Load and cache the trained classification model.

    Args:
        checkpoint_path: Path to checkpoint file. Defaults to REPO_ROOT/ml/artifacts/best_model.pth.
        device: Torch device. Defaults to CUDA if available, else CPU.
        force_reload: If True, ignores cached model and reloads.

    Returns:
        (model, device)
    """
    global _CACHED_MODEL, _CACHED_CHECKPOINT_PATH, _CACHED_DEVICE, _TRANSFORM

    if device is None:
        device = get_inference_device()

    if checkpoint_path is None:
        resolved_ckpt = DEFAULT_CHECKPOINT_PATH
    else:
        resolved_ckpt = Path(checkpoint_path)
        if not resolved_ckpt.is_absolute():
            resolved_ckpt = REPO_ROOT / resolved_ckpt

    ckpt_str = str(resolved_ckpt.resolve())

    # Return cached model if path and device match
    if (
        not force_reload
        and _CACHED_MODEL is not None
        and _CACHED_CHECKPOINT_PATH == ckpt_str
        and _CACHED_DEVICE == device
    ):
        return _CACHED_MODEL, _CACHED_DEVICE

    if not resolved_ckpt.exists():
        raise FileNotFoundError("Model checkpoint file was not found.")

    try:
        checkpoint = torch.load(resolved_ckpt, map_location=device, weights_only=False)
    except Exception as e:
        raise ValueError("Model checkpoint could not be decoded.") from e

    if not isinstance(checkpoint, dict) or "model_state_dict" not in checkpoint:
        raise ValueError("Model checkpoint is missing required state dictionary.")

    config = checkpoint.get("config", {})
    num_classes = config.get("num_classes", 1)

    try:
        model = build_classifier(
            pretrained=False,
            freeze_backbone=True,
            num_classes=num_classes,
        ).to(device)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
    except Exception as e:
        raise RuntimeError("Incompatible model architecture or state dictionary weights.") from e

    _CACHED_MODEL = model
    _CACHED_CHECKPOINT_PATH = ckpt_str
    _CACHED_DEVICE = device
    _TRANSFORM = get_transforms(is_train=False, image_size=224)

    return _CACHED_MODEL, _CACHED_DEVICE


def predict_image(
    image: Union[str, Path, bytes, bytearray, io.BytesIO, Image.Image],
    checkpoint_path: Optional[Union[str, Path]] = None,
    threshold: float = DEFAULT_THRESHOLD,
    model_name: str = DEFAULT_MODEL_NAME,
    model_version: str = DEFAULT_MODEL_VERSION,
    device: Optional[torch.device] = None,
) -> Dict[str, Any]:
    """Run defect prediction on an input image.

    Args:
        image: File path (str/Path), raw bytes (bytes/bytearray), file stream (BytesIO),
               or pre-opened PIL Image.
        checkpoint_path: Optional custom path to model checkpoint (.pth).
        threshold: Decision threshold for positive ('defective') class (default: 0.38).
        model_name: Model identifier string.
        model_version: Model version string.
        device: Torch device (defaults to auto-detect CUDA/CPU).

    Returns:
        Structured prediction dictionary with fields:
        - status: 'success' or 'failed'
        - predicted_class: 'good' | 'defective' | None
        - scores: {'good': float, 'defective': float} | None
        - score_type: 'sigmoid_score'
        - model_name: str
        - model_version: str
        - processing_duration_ms: float
        - threshold: float
        - error_code: str | None
        - error_details: str | None
    """
    t_start = time.perf_counter()

    # 1. Load / ensure model is cached
    try:
        model, model_device = load_model(checkpoint_path=checkpoint_path, device=device)
    except FileNotFoundError:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "CHECKPOINT_NOT_FOUND",
            "error_details": "Model checkpoint file was not found or is unreadable.",
        }
    except (ValueError, RuntimeError):
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "INCOMPATIBLE_CHECKPOINT",
            "error_details": "Model checkpoint is corrupt or incompatible with model architecture.",
        }
    except Exception:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "INFERENCE_ERROR",
            "error_details": "Failed to initialize model for inference.",
        }

    # 2. Decode and validate input image
    try:
        if isinstance(image, (bytes, bytearray)):
            if len(image) == 0:
                raise ValueError("Image byte payload is empty.")
            stream = io.BytesIO(image)
            with Image.open(stream) as img:
                img.verify()
            stream.seek(0)
            pil_img = Image.open(stream).convert("RGB")
        elif isinstance(image, (str, Path)):
            img_path = Path(image)
            if not img_path.exists() or not img_path.is_file():
                raise FileNotFoundError("Image file does not exist.")
            if img_path.stat().st_size == 0:
                raise ValueError("Image file is empty.")
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
    except (UnidentifiedImageError, OSError, ValueError, FileNotFoundError, TypeError):
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "INVALID_IMAGE",
            "error_details": "Input image could not be decoded or is corrupt.",
        }
    except Exception:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "INVALID_IMAGE",
            "error_details": "Failed to process image.",
        }

    # 3. Preprocess and run forward pass
    try:
        global _TRANSFORM
        if _TRANSFORM is None:
            _TRANSFORM = get_transforms(is_train=False, image_size=224)

        input_tensor = _TRANSFORM(pil_img).unsqueeze(0).to(model_device)

        with torch.no_grad():
            logit = model(input_tensor)
            prob_defective = float(torch.sigmoid(logit).squeeze().item())

        predicted_class = "defective" if prob_defective >= threshold else "good"
        scores = {
            "good": round(1.0 - prob_defective, 4),
            "defective": round(prob_defective, 4),
        }

        duration_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "status": "success",
            "predicted_class": predicted_class,
            "scores": scores,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": None,
            "error_details": None,
        }
    except Exception:
        duration_ms = (time.perf_counter() - t_start) * 1000.0
        return {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": round(duration_ms, 2),
            "threshold": threshold,
            "error_code": "INFERENCE_ERROR",
            "error_details": "An error occurred during neural network forward pass.",
        }
