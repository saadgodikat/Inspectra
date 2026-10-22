"""Dataset and data loading utilities for Inspectra."""

import csv
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Callable
from PIL import Image
import torch
from torch.utils.data import Dataset
import torchvision.transforms as T

LABEL_TO_IDX = {
    "good": 0,
    "defective": 1,
}

IDX_TO_LABEL = {
    0: "good",
    1: "defective",
}

MULTICLASS_LABEL_TO_IDX = {
    "GOOD": 0,
    "CRACK": 1,
    "DENT": 2,
    "SCRATCH": 3,
    "OTHER_DEFECT": 4,
}

MULTICLASS_IDX_TO_LABEL = {
    0: "GOOD",
    1: "CRACK",
    2: "DENT",
    3: "SCRATCH",
    4: "OTHER_DEFECT",
}

# ImageNet normalization standard
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_transforms(is_train: bool = False, image_size: int = 224) -> Callable:
    """Build standard Torchvision preprocessing pipeline for EfficientNet-B0.

    Args:
        is_train: If True, adds mild geometric augmentations (flips).
        image_size: Target square resolution (default: 224).
    """
    if is_train:
        return T.Compose([
            T.Resize((256, 256), interpolation=T.InterpolationMode.BICUBIC),
            T.CenterCrop(image_size),
            T.RandomHorizontalFlip(p=0.5),
            T.RandomVerticalFlip(p=0.5),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])
    else:
        return T.Compose([
            T.Resize((256, 256), interpolation=T.InterpolationMode.BICUBIC),
            T.CenterCrop(image_size),
            T.ToTensor(),
            T.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])


def load_manifest(
    manifest_path: Path,
    use_primary_only: bool = True,
) -> List[Dict[str, Any]]:
    """Read split manifest CSV and optionally filter to unique primary images.

    Args:
        manifest_path: Path to train.csv, val.csv, test.csv, or manifest.csv.
        use_primary_only: If True, filters out redundant duplicate copies (is_primary == True).

    Returns:
        List of dictionary rows with validated columns.
    """
    manifest_path = Path(manifest_path).resolve()
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest file not found: {manifest_path}")

    records = []
    with open(manifest_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            is_prim_str = str(row.get("is_primary", "True")).strip().lower()
            is_primary = (is_prim_str == "true")

            if use_primary_only and not is_primary:
                continue

            records.append({
                "file_path": row["file_path"],
                "label": row["label"],
                "split": row.get("split", "unknown"),
                "sha256": row.get("sha256", ""),
                "is_duplicate": str(row.get("is_duplicate", "False")).strip().lower() == "true",
                "is_primary": is_primary,
            })

    return records


class CastingManifestDataset(Dataset):
    """PyTorch Dataset loading images based on Inspectra split manifests."""

    def __init__(
        self,
        manifest_path: Path,
        data_dir: Path,
        transform: Optional[Callable] = None,
        use_primary_only: bool = True,
    ):
        self.data_dir = Path(data_dir).resolve()
        self.transform = transform
        self.records = load_manifest(manifest_path, use_primary_only=use_primary_only)

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, str]:
        rec = self.records[idx]
        img_rel_path = rec["file_path"]
        img_full_path = self.data_dir / img_rel_path

        if not img_full_path.exists():
            raise FileNotFoundError(f"Image file does not exist: {img_full_path}")

        with Image.open(img_full_path) as img:
            image = img.convert("RGB")

        if self.transform:
            image = self.transform(image)

        label_idx = LABEL_TO_IDX[rec["label"]]
        return image, label_idx, img_rel_path


class MulticlassManifestDataset(Dataset):
    """PyTorch Dataset loading images for multiclass defect inspection."""

    def __init__(
        self,
        manifest_path: Path,
        repo_root: Optional[Path] = None,
        transform: Optional[Callable] = None,
    ):
        if repo_root is None:
            # ml/src/inspectra_ml/dataset.py -> repo_root is parents[3]
            repo_root = Path(__file__).resolve().parents[3]
        self.repo_root = Path(repo_root).resolve()
        self.transform = transform
        self.records: List[Dict[str, Any]] = []

        with open(manifest_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.records.append(row)

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int, str]:
        rec = self.records[idx]
        img_rel_path = rec["file_path"]
        img_full_path = self.repo_root / img_rel_path

        if not img_full_path.exists():
            raise FileNotFoundError(f"Image file does not exist: {img_full_path}")

        with Image.open(img_full_path) as img:
            image = img.convert("RGB")

        if self.transform:
            image = self.transform(image)

        label_idx = MULTICLASS_LABEL_TO_IDX[rec["label"]]
        return image, label_idx, img_rel_path

