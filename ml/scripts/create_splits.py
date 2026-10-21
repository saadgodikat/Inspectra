"""Leakage-safe, stratified data preparation and split manifest generation.

Phase ML-2: Data Splitting
- Scans dataset directory and computes SHA-256 hashes for all valid images.
- Groups exact duplicates by hash so identical images are never split across train/val/test.
- Applies class-stratified partitioning using a deterministic random seed.
- Generates reproducible split manifests (CSV + JSON) without modifying raw dataset files.
- Generates a comprehensive summary report in ml/reports/splits_summary.md.
"""

import os
import sys
import csv
import json
import random
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Tuple, Optional

# Ensure project root is in sys.path when running as a standalone script
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    import yaml
except ImportError:
    yaml = None

from ml.scripts.inspect_dataset import (
    compute_file_sha256,
    infer_label,
    DEFAULT_LABEL_MAPPING,
    DEFAULT_SUPPORTED_EXTENSIONS,
)


def scan_and_group_by_hash(
    data_dir: Path,
    label_mapping: Optional[Dict[str, str]] = None,
    supported_extensions: Optional[set] = None,
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    """Scan dataset directory, compute SHA-256 hashes, and group files by hash.

    Returns:
        hash_to_group: Dict mapping sha256 -> {"label": str, "paths": List[str]}
        exclusions: List of files excluded (unsupported extension, corrupt, unlabelled)
    """
    if label_mapping is None:
        label_mapping = DEFAULT_LABEL_MAPPING
    if supported_extensions is None:
        supported_extensions = DEFAULT_SUPPORTED_EXTENSIONS

    data_dir = Path(data_dir).resolve()
    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    hash_to_paths = defaultdict(list)
    path_to_label = {}
    exclusions = []

    from PIL import Image, UnidentifiedImageError

    for root, _, files in os.walk(data_dir):
        for fname in files:
            file_path = Path(root) / fname
            rel_str = str(file_path.relative_to(data_dir))
            ext = file_path.suffix.lower()

            if ext not in supported_extensions:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Unsupported extension '{ext}'",
                })
                continue

            try:
                if file_path.stat().st_size == 0:
                    exclusions.append({
                        "path": rel_str,
                        "reason": "Empty file (0 bytes)",
                    })
                    continue
            except OSError as stat_err:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Stat error: {stat_err}",
                })
                continue

            # Check Pillow readability
            try:
                with Image.open(file_path) as img:
                    img.verify()
            except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as img_err:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Corrupt image ({type(img_err).__name__}: {img_err})",
                })
                continue

            # Infer label
            label = infer_label(file_path, data_dir, label_mapping)
            if not label:
                exclusions.append({
                    "path": rel_str,
                    "reason": "Could not infer class label ('good' or 'defective')",
                })
                continue

            # Compute SHA-256
            f_hash = compute_file_sha256(file_path)
            hash_to_paths[f_hash].append(rel_str)
            path_to_label[rel_str] = label

    if not hash_to_paths:
        raise ValueError(f"No valid images found in dataset directory: {data_dir}")

    # Build grouped structure and verify label consistency within duplicate groups
    hash_to_group: Dict[str, Dict[str, Any]] = {}
    for h, paths in hash_to_paths.items():
        labels = {path_to_label[p] for p in paths}
        if len(labels) > 1:
            raise ValueError(
                f"Conflicting labels detected for identical image hash {h[:12]}: {labels} across paths: {paths}"
            )
        hash_to_group[h] = {
            "label": next(iter(labels)),
            "paths": sorted(paths),
            "count": len(paths),
        }

    return hash_to_group, exclusions


def partition_hashes_stratified(
    hash_to_group: Dict[str, Dict[str, Any]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> Dict[str, str]:
    """Partition unique hashes into train, val, and test splits with class stratification.

    All file paths sharing a hash are guaranteed to land in the same split.

    Returns:
        hash_to_split: Dict mapping sha256 -> 'train' | 'val' | 'test'
    """
    total_ratio = train_ratio + val_ratio + test_ratio
    if abs(total_ratio - 1.0) > 1e-5:
        raise ValueError(
            f"Split ratios must sum to 1.0. Given: train={train_ratio}, val={val_ratio}, test={test_ratio} (sum={total_ratio})"
        )

    # Group hashes by class
    class_to_hashes = defaultdict(list)
    for h, info in hash_to_group.items():
        class_to_hashes[info["label"]].append(h)

    hash_to_split: Dict[str, str] = {}
    rng = random.Random(seed)

    for label, hashes in sorted(class_to_hashes.items()):
        # Sort first for deterministic reproducibility across platforms
        hashes = sorted(hashes)
        rng.shuffle(hashes)

        n = len(hashes)
        n_train = int(round(n * train_ratio))
        n_val = int(round(n * val_ratio))
        # Ensure remaining go to test so no hash is dropped
        n_test = n - n_train - n_val

        train_hashes = hashes[:n_train]
        val_hashes = hashes[n_train:n_train + n_val]
        test_hashes = hashes[n_train + n_val:]

        for h in train_hashes:
            hash_to_split[h] = "train"
        for h in val_hashes:
            hash_to_split[h] = "val"
        for h in test_hashes:
            hash_to_split[h] = "test"

    return hash_to_split


def build_manifest_records(
    hash_to_group: Dict[str, Dict[str, Any]],
    hash_to_split: Dict[str, str],
) -> List[Dict[str, Any]]:
    """Build individual file records from grouped hash assignments."""
    records = []

    for h, group in sorted(hash_to_group.items(), key=lambda x: x[1]["paths"][0]):
        split = hash_to_split[h]
        label = group["label"]
        paths = group["paths"]
        is_dup = (len(paths) > 1)

        for idx, p in enumerate(paths):
            records.append({
                "file_path": p,
                "label": label,
                "split": split,
                "sha256": h,
                "is_duplicate": is_dup,
                "duplicate_group_size": len(paths),
                "is_primary": (idx == 0),
            })

    # Sort deterministically by split, label, file_path
    records.sort(key=lambda r: (r["split"], r["label"], r["file_path"]))
    return records


def verify_no_leakage(records: List[Dict[str, Any]]) -> None:
    """Verify that zero identical SHA-256 hashes cross between different splits."""
    hash_to_splits = defaultdict(set)
    for r in records:
        hash_to_splits[r["sha256"]].add(r["split"])

    leaky_groups = {h: splits for h, splits in hash_to_splits.items() if len(splits) > 1}
    if leaky_groups:
        raise AssertionError(
            f"CRITICAL ERROR: Data leakage detected! {len(leaky_groups)} hash(es) cross splits: {leaky_groups}"
        )


def calculate_split_statistics(
    records: List[Dict[str, Any]],
    hash_to_group: Dict[str, Dict[str, Any]],
    train_ratio: float,
    val_ratio: float,
    test_ratio: float,
    seed: int,
) -> Dict[str, Any]:
    """Calculate detailed counts and class distributions across splits."""
    splits = ["train", "val", "test"]
    stats: Dict[str, Any] = {
        "seed": seed,
        "target_ratios": {"train": train_ratio, "val": val_ratio, "test": test_ratio},
        "total_files": len(records),
        "total_unique_hashes": len(hash_to_group),
        "total_duplicate_groups": sum(1 for g in hash_to_group.values() if g["count"] > 1),
        "total_duplicate_redundant_files": sum(g["count"] - 1 for g in hash_to_group.values() if g["count"] > 1),
        "splits": {},
    }

    for sp in splits:
        sp_records = [r for r in records if r["split"] == sp]
        sp_hashes = {r["sha256"] for r in sp_records}
        sp_dups = [r for r in sp_records if r["is_duplicate"]]
        sp_dup_groups = {r["sha256"] for r in sp_dups}

        class_file_counts = defaultdict(int)
        class_hash_counts = defaultdict(int)

        seen_hashes = set()
        for r in sp_records:
            class_file_counts[r["label"]] += 1
            if r["sha256"] not in seen_hashes:
                class_hash_counts[r["label"]] += 1
                seen_hashes.add(r["sha256"])

        stats["splits"][sp] = {
            "total_files": len(sp_records),
            "unique_hashes": len(sp_hashes),
            "file_percentage": round(len(sp_records) / len(records) * 100, 2) if records else 0,
            "hash_percentage": round(len(sp_hashes) / len(hash_to_group) * 100, 2) if hash_to_group else 0,
            "duplicate_files_in_split": len(sp_dups),
            "duplicate_groups_in_split": len(sp_dup_groups),
            "class_file_counts": dict(class_file_counts),
            "class_hash_counts": dict(class_hash_counts),
        }

    return stats


def export_manifests(
    records: List[Dict[str, Any]],
    stats: Dict[str, Any],
    output_dir: Path,
) -> None:
    """Export master manifest, per-split CSVs, and metadata JSON."""
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "file_path",
        "label",
        "split",
        "sha256",
        "is_duplicate",
        "duplicate_group_size",
        "is_primary",
    ]

    # 1. Master manifest
    master_path = output_dir / "manifest.csv"
    with open(master_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    # 2. Individual split CSVs
    for sp in ["train", "val", "test"]:
        sp_records = [r for r in records if r["split"] == sp]
        sp_path = output_dir / f"{sp}.csv"
        with open(sp_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(sp_records)

    # 3. JSON metadata
    json_path = output_dir / "manifest.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)


def generate_markdown_summary(
    stats: Dict[str, Any],
    data_dir: Path,
    output_dir: Path,
) -> str:
    """Generate Markdown summary report for splits."""
    lines = [
        "# Leakage-Safe Dataset Splits Report — Phase ML-2",
        "",
        f"**Dataset Location:** `{data_dir}`  ",
        f"**Manifests Location:** `{output_dir}`  ",
        f"**Random Seed:** `{stats['seed']}`  ",
        f"**Target Ratios:** Train={stats['target_ratios']['train']}, Val={stats['target_ratios']['val']}, Test={stats['target_ratios']['test']}  ",
        f"**Cross-Split Leakage:** **0.0% (VERIFIED ZERO LEAKAGE)**",
        "",
        "---",
        "",
        "## 1. Executive Summary & Duplicate Isolation",
        "",
        "| Metric | Total Count | Percentage |",
        "| :--- | :--- | :--- |",
        f"| **Total Files Manifested** | {stats['total_files']} | 100.0% |",
        f"| **Unique Image Hashes (Content)** | {stats['total_unique_hashes']} | {round(stats['total_unique_hashes'] / stats['total_files'] * 100, 2)}% |",
        f"| **Exact Duplicate Groups** | {stats['total_duplicate_groups']} | — |",
        f"| **Redundant Duplicate Files** | {stats['total_duplicate_redundant_files']} | {round(stats['total_duplicate_redundant_files'] / stats['total_files'] * 100, 2)}% |",
        f"| **Cross-Split Duplicate Groups** | **0** | **0.0% (Leakage Eliminated)** |",
        "",
        "> [!IMPORTANT]",
        "> **Duplicate Grouping Guarantee:** All files sharing an identical SHA-256 hash were grouped together before stratification and assigned to the same split. No image appears in both train and validation/test.",
        "",
        "---",
        "",
        "## 2. Split Partition Breakdown",
        "",
        "| Split | Total Files | Unique Hashes | Split % (Unique) | Defective Hashes | Good Hashes | Defective % | Good % |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for sp in ["train", "val", "test"]:
        sp_data = stats["splits"][sp]
        def_hashes = sp_data["class_hash_counts"].get("defective", 0)
        good_hashes = sp_data["class_hash_counts"].get("good", 0)
        tot_h = sp_data["unique_hashes"]
        def_pct = round(def_hashes / tot_h * 100, 2) if tot_h else 0
        good_pct = round(good_hashes / tot_h * 100, 2) if tot_h else 0

        lines.append(
            f"| `{sp}` | {sp_data['total_files']} | {sp_data['unique_hashes']} | {sp_data['hash_percentage']}% | {def_hashes} | {good_hashes} | {def_pct}% | {good_pct}% |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 3. Duplicate Files Allocation by Split",
        "",
        "| Split | Duplicate Files in Split | Duplicate Groups in Split | Cross-Split Leaks |",
        "| :--- | :--- | :--- | :--- |",
    ])

    for sp in ["train", "val", "test"]:
        sp_data = stats["splits"][sp]
        lines.append(
            f"| `{sp}` | {sp_data['duplicate_files_in_split']} | {sp_data['duplicate_groups_in_split']} | **0** |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 4. Dataset Limitations & Pre-Split Flaws",
        "",
        "1. **Original Kaggle Split Defect:** The author-supplied `train/` and `test/` folders contained 64 identical image pairs in `ok_front/`. Directly training on `train` and testing on `test` would have artificially inflated accuracy and recall for the `good` class due to memorized test samples.",
        "2. **New Manifest Replacement:** Rather than physically deleting or modifying the raw images, the new `ml/data/splits/manifest.csv` assigns files into genuine, non-leaking partitions while preserving raw dataset integrity.",
        "3. **Physical Item Disconnect:** The Kaggle casting dataset does not provide serial numbers or part identifiers to trace multiple photos of the same physical casting. Splitting is grouped strictly by SHA-256 byte identity.",
        "",
        "---",
        "",
        "## 5. Instructions for Phase ML-3 (Model Training)",
        "",
        "Load split manifests directly using pandas or Python's `csv` module:",
        "```python",
        "import pandas as pd",
        "",
        "# Recommended: Train on all train files (or unique primary images):",
        "train_df = pd.read_csv('ml/data/splits/train.csv')",
        "val_df = pd.read_csv('ml/data/splits/val.csv')",
        "test_df = pd.read_csv('ml/data/splits/test.csv')",
        "```",
    ])

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Create leakage-resistant, stratified dataset splits for Inspectra.")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="ml/data/raw/casting_data",
        help="Path to raw dataset directory.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="ml/data/splits",
        help="Path to output split manifests directory.",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="ml/configs/casting_binary.yaml",
        help="Path to YAML config file.",
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.70,
        help="Train split ratio (default: 0.70).",
    )
    parser.add_argument(
        "--val-ratio",
        type=float,
        default=0.15,
        help="Validation split ratio (default: 0.15).",
    )
    parser.add_argument(
        "--test-ratio",
        type=float,
        default=0.15,
        help="Test split ratio (default: 0.15).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic splitting.",
    )
    parser.add_argument(
        "--report",
        type=str,
        default="ml/reports/splits_summary.md",
        help="Path to save the Markdown summary report.",
    )

    args = parser.parse_args()

    # Load YAML config if present
    config = {}
    if args.config and Path(args.config).exists() and yaml is not None:
        with open(args.config, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

    data_dir = Path(args.data_dir or config.get("dataset_path", "ml/data/raw/casting_data"))
    if not data_dir.is_absolute():
        data_dir = Path.cwd() / data_dir

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = Path.cwd() / output_dir

    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = Path.cwd() / report_path

    label_mapping = config.get("label_mapping", DEFAULT_LABEL_MAPPING)
    supported_extensions = set(config.get("supported_extensions", DEFAULT_SUPPORTED_EXTENSIONS))

    print("Starting Inspectra Leakage-Safe Split Generation...")
    print(f"Dataset directory: {data_dir}")
    print(f"Output directory:  {output_dir}")
    print(f"Target ratios:     Train={args.train_ratio}, Val={args.val_ratio}, Test={args.test_ratio}")
    print(f"Random seed:       {args.seed}")

    # 1. Scan and group
    hash_to_group, exclusions = scan_and_group_by_hash(
        data_dir=data_dir,
        label_mapping=label_mapping,
        supported_extensions=supported_extensions,
    )
    total_files = sum(g["count"] for g in hash_to_group.values())
    unique_hashes = len(hash_to_group)
    dup_groups = sum(1 for g in hash_to_group.values() if g["count"] > 1)
    print(f"\nScan complete: {total_files} files, {unique_hashes} unique image hashes.")
    print(f"Duplicate groups detected: {dup_groups} (all members will be locked to the same split)")

    # 2. Partition
    hash_to_split = partition_hashes_stratified(
        hash_to_group=hash_to_group,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )

    # 3. Build records and verify leakage
    records = build_manifest_records(hash_to_group, hash_to_split)
    verify_no_leakage(records)
    print("Verification passed: 0 cross-split hash leaks detected!")

    # 4. Calculate stats and export
    stats = calculate_split_statistics(
        records=records,
        hash_to_group=hash_to_group,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )

    export_manifests(records, stats, output_dir)
    print(f"Manifests successfully exported to: {output_dir}")

    # 5. Export markdown summary
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_content = generate_markdown_summary(stats, data_dir, output_dir)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Summary report written to: {report_path}")

    # CLI breakdown
    print("\n--- Split Summary ---")
    for sp in ["train", "val", "test"]:
        sp_data = stats["splits"][sp]
        print(f"  {sp.upper():5s}: {sp_data['total_files']:5d} files ({sp_data['unique_hashes']:5d} unique hashes) | "
              f"Defective: {sp_data['class_hash_counts'].get('defective', 0):4d}, "
              f"Good: {sp_data['class_hash_counts'].get('good', 0):4d}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
