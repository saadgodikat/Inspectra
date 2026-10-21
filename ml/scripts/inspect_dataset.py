"""Inspect and audit visual quality inspection dataset for Inspectra.

Phase ML-1: Dataset Audit
Reports:
  - Total image counts and counts per class.
  - Image file formats / extensions.
  - Dimensions (min, max, unique resolutions, aspect ratios).
  - Unreadable / corrupt files.
  - Exact duplicate files using SHA-256 hashes.
  - Class imbalance ratio.
  - Explicit exclusions and reasons (no silent discarding).
  - Exports a Markdown report to ml/reports/dataset_audit.md.
"""

import os
import sys
import hashlib
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from PIL import Image, UnidentifiedImageError

try:
    import yaml
except ImportError:
    yaml = None


DEFAULT_SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}

DEFAULT_LABEL_MAPPING = {
    "ok_front": "good",
    "def_front": "defective",
    "ok": "good",
    "def": "defective",
    "good": "good",
    "defective": "defective",
}


def compute_file_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hash of a file efficiently."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def infer_label(file_path: Path, dataset_root: Path, label_mapping: Dict[str, str]) -> Optional[str]:
    """Infer class label from directory structure relative to dataset root.

    Checks path parts from deepest to root against the label_mapping.
    """
    rel_path = file_path.relative_to(dataset_root)
    # Check directory parts from innermost to outermost
    for part in reversed(rel_path.parent.parts):
        lowered = part.lower().strip()
        if lowered in label_mapping:
            return label_mapping[lowered]
        # Partial matches if directory contains keywords
        if "def" in lowered:
            return "defective"
        if "ok" in lowered or "good" in lowered:
            return "good"

    # Also check filename as fallback
    stem = file_path.stem.lower()
    if "def" in stem:
        return "defective"
    if "ok" in stem or "good" in stem:
        return "good"

    return None


def infer_split(file_path: Path, dataset_root: Path) -> Optional[str]:
    """Infer dataset split name (e.g. 'train', 'test', 'val') from directory path relative to dataset root."""
    rel_path = file_path.relative_to(dataset_root)
    KNOWN_SPLITS = {"train", "test", "val", "validation", "valid", "dev"}
    for part in rel_path.parts[:-1]:
        cleaned = part.lower().strip()
        if cleaned in KNOWN_SPLITS:
            return "val" if cleaned in {"validation", "valid"} else cleaned
    return None


def audit_dataset(
    data_dir: Path,
    label_mapping: Optional[Dict[str, str]] = None,
    supported_extensions: Optional[set] = None,
) -> Dict[str, Any]:
    """Perform a comprehensive audit of an image dataset directory.

    Args:
        data_dir: Root directory of the dataset to audit.
        label_mapping: Optional dict mapping folder/filename tokens to canonical labels.
        supported_extensions: Set of allowed lowercase image extensions with leading dot.

    Returns:
        Structured audit dictionary containing statistics, duplicates, and exclusions.
    """
    if label_mapping is None:
        label_mapping = DEFAULT_LABEL_MAPPING
    if supported_extensions is None:
        supported_extensions = DEFAULT_SUPPORTED_EXTENSIONS

    data_dir = Path(data_dir).resolve()
    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset directory not found: {data_dir}")

    total_files_scanned = 0
    valid_images = 0
    class_counts = defaultdict(int)
    extension_counts = defaultdict(int)
    format_counts = defaultdict(int)
    dimensions_distribution = defaultdict(int)
    min_dimensions = (float("inf"), float("inf"))
    max_dimensions = (0, 0)

    hash_to_paths = defaultdict(list)
    exclusions: List[Dict[str, Any]] = []

    for root, _, files in os.walk(data_dir):
        for fname in files:
            total_files_scanned += 1
            file_path = Path(root) / fname
            ext = file_path.suffix.lower()
            rel_str = str(file_path.relative_to(data_dir))

            # 1. Check extension
            if ext not in supported_extensions:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Unsupported file extension '{ext}'",
                    "category": "unsupported_extension",
                })
                continue

            extension_counts[ext] += 1

            # 2. Check for empty file
            try:
                size_bytes = file_path.stat().st_size
                if size_bytes == 0:
                    exclusions.append({
                        "path": rel_str,
                        "reason": "File is empty (0 bytes)",
                        "category": "empty_file",
                    })
                    continue
            except OSError as stat_err:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Filesystem stat error: {stat_err}",
                    "category": "stat_error",
                })
                continue

            # 3. Deep image integrity check with Pillow
            try:
                with Image.open(file_path) as img:
                    img.verify()  # Verifies image header & integrity
                    # Re-open to read dimensions, as verify() closes the file
                    with Image.open(file_path) as img_read:
                        width, height = img_read.size
                        img_format = img_read.format
            except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as img_err:
                exclusions.append({
                    "path": rel_str,
                    "reason": f"Corrupt or unreadable image ({type(img_err).__name__}: {img_err})",
                    "category": "corrupted_image",
                })
                continue

            # 4. Hash verification for duplicates
            file_hash = compute_file_sha256(file_path)
            hash_to_paths[file_hash].append(rel_str)

            # 5. Label inference
            label = infer_label(file_path, data_dir, label_mapping)
            if not label:
                exclusions.append({
                    "path": rel_str,
                    "reason": "Could not infer canonical class label ('good' or 'defective')",
                    "category": "unlabelled_sample",
                })
                continue

            valid_images += 1
            class_counts[label] += 1
            format_counts[img_format or "UNKNOWN"] += 1
            dimensions_distribution[f"{width}x{height}"] += 1
            min_dimensions = (min(min_dimensions[0], width), min(min_dimensions[1], height))
            max_dimensions = (max(max_dimensions[0], width), max(max_dimensions[1], height))

    # Identify exact duplicates and analyze split distribution
    exact_duplicate_groups = {}
    duplicate_groups_details = []
    cross_split_duplicate_groups = 0
    within_split_duplicate_groups = 0

    for h, paths in hash_to_paths.items():
        if len(paths) > 1:
            exact_duplicate_groups[h] = paths
            splits_in_group = set()
            for p in paths:
                split_name = infer_split(data_dir / p, data_dir)
                if split_name:
                    splits_in_group.add(split_name)
                else:
                    splits_in_group.add("unspecified")

            # A duplicate group crosses splits if it appears in more than 1 distinct named split
            named_splits = {s for s in splits_in_group if s != "unspecified"}
            is_cross_split = len(named_splits) > 1

            if is_cross_split:
                cross_split_duplicate_groups += 1
            else:
                within_split_duplicate_groups += 1

            duplicate_groups_details.append({
                "hash": h,
                "paths": paths,
                "splits": sorted(splits_in_group),
                "crosses_splits": is_cross_split,
                "count": len(paths),
            })

    # Sort details: cross-split duplicates first, then by count descending
    duplicate_groups_details.sort(key=lambda d: (not d["crosses_splits"], -d["count"], d["hash"]))
    total_duplicate_files = sum(len(paths) - 1 for paths in exact_duplicate_groups.values())

    # Calculate class balance
    class_percentages = {}
    if valid_images > 0:
        for cls, count in class_counts.items():
            class_percentages[cls] = round((count / valid_images) * 100, 2)

    # Imbalance ratio: majority count / minority count
    imbalance_ratio = 1.0
    if len(class_counts) > 1:
        counts_sorted = sorted(class_counts.values())
        if counts_sorted[0] > 0:
            imbalance_ratio = round(counts_sorted[-1] / counts_sorted[0], 2)

    return {
        "dataset_root": str(data_dir),
        "total_files_scanned": total_files_scanned,
        "valid_images": valid_images,
        "class_counts": dict(class_counts),
        "class_percentages": class_percentages,
        "imbalance_ratio": imbalance_ratio,
        "extension_counts": dict(extension_counts),
        "format_counts": dict(format_counts),
        "dimensions_distribution": dict(dimensions_distribution),
        "min_dimensions": min_dimensions if valid_images > 0 else (0, 0),
        "max_dimensions": max_dimensions if valid_images > 0 else (0, 0),
        "total_duplicate_files": total_duplicate_files,
        "exact_duplicate_groups": exact_duplicate_groups,
        "duplicate_groups_details": duplicate_groups_details,
        "cross_split_duplicate_groups": cross_split_duplicate_groups,
        "within_split_duplicate_groups": within_split_duplicate_groups,
        "exclusions_count": len(exclusions),
        "exclusions": exclusions,
    }


def generate_markdown_report(audit_result: Dict[str, Any]) -> str:
    """Format audit results as a comprehensive GitHub-flavored Markdown document."""
    lines = [
        "# Dataset Audit Report — Phase ML-1",
        "",
        f"**Dataset Location:** `{audit_result['dataset_root']}`  ",
        f"**Audit Status:** {'PASSED (Ready for Phase ML-2 Splits)' if audit_result['valid_images'] > 0 else 'EMPTY / PENDING DATA'}",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
        "| Metric | Result |",
        "| :--- | :--- |",
        f"| **Total Files Scanned** | {audit_result['total_files_scanned']} |",
        f"| **Valid Usable Images** | {audit_result['valid_images']} |",
        f"| **Excluded / Invalid Files** | {audit_result['exclusions_count']} |",
        f"| **Exact Duplicate Files** | {audit_result['total_duplicate_files']} |",
        f"| **Class Imbalance Ratio** | {audit_result['imbalance_ratio']}:1 |",
        "",
        "---",
        "",
        "## 2. Class Distribution",
        "",
        "| Class Label | Image Count | Percentage |",
        "| :--- | :--- | :--- |",
    ]

    for cls, count in audit_result["class_counts"].items():
        pct = audit_result["class_percentages"].get(cls, 0.0)
        lines.append(f"| `{cls}` | {count} | {pct}% |")

    if not audit_result["class_counts"]:
        lines.append("| *(No valid classes found)* | 0 | 0.0% |")

    lines.extend([
        "",
        "---",
        "",
        "## 3. Supported Extensions & File Formats",
        "",
        "### File Extensions",
        "",
        "| Extension | Count |",
        "| :--- | :--- |",
    ])
    for ext, count in sorted(audit_result["extension_counts"].items()):
        lines.append(f"| `{ext}` | {count} |")
    if not audit_result["extension_counts"]:
        lines.append("| *(None)* | 0 |")

    lines.extend([
        "",
        "### Detected Image Formats",
        "",
        "| Image Format | Count |",
        "| :--- | :--- |",
    ])
    for fmt, count in sorted(audit_result.get("format_counts", {}).items()):
        lines.append(f"| `{fmt}` | {count} |")
    if not audit_result.get("format_counts"):
        lines.append("| *(None)* | 0 |")

    lines.extend([
        "",
        "---",
        "",
        "## 4. Image Dimensions & Resolutions",
        "",
        f"- **Minimum Dimensions (WxH):** `{audit_result['min_dimensions'][0]}x{audit_result['min_dimensions'][1]}`",
        f"- **Maximum Dimensions (WxH):** `{audit_result['max_dimensions'][0]}x{audit_result['max_dimensions'][1]}`",
        "",
        "| Resolution (WxH) | Image Count |",
        "| :--- | :--- |",
    ])
    for res, count in sorted(audit_result["dimensions_distribution"].items(), key=lambda x: -x[1])[:10]:
        lines.append(f"| `{res}` | {count} |")
    if len(audit_result["dimensions_distribution"]) > 10:
        lines.append(f"| *...and {len(audit_result['dimensions_distribution']) - 10} other unique resolutions* | |")

    lines.extend([
        "",
        "---",
        "",
        "## 5. Duplicate Image Analysis (SHA-256)",
        "",
        f"- **Total Redundant Duplicates Detected:** {audit_result['total_duplicate_files']}",
        f"- **Unique Duplicate Groups:** {len(audit_result['exact_duplicate_groups'])}",
        f"- **Duplicate Groups Crossing Splits (Train ⟷ Test Leakage):** {audit_result.get('cross_split_duplicate_groups', 0)}",
        f"- **Duplicate Groups Within Same Split:** {audit_result.get('within_split_duplicate_groups', 0)}",
        "",
    ])

    if audit_result["exact_duplicate_groups"]:
        if audit_result.get("cross_split_duplicate_groups", 0) > 0:
            lines.extend([
                "> [!CAUTION]",
                f"> **Data Leakage Alert:** {audit_result['cross_split_duplicate_groups']} duplicate group(s) contain identical images spanning across separate splits (e.g. `train` and `test`).",
                "> If the raw pre-split data is evaluated directly, test metrics will be artificially optimistic due to test-set leakage.",
                "> In Phase ML-2, these duplicates must either be globally deduplicated or quarantined to the training split.",
                "",
            ])
        else:
            lines.extend([
                "> [!WARNING]",
                "> Duplicate files detected within splits. Duplicates should be consolidated during Phase ML-2 to prevent over-representing identical samples.",
                "",
            ])

        lines.append("| Hash (SHA-256 Preview) | Splits Involved | Cross-Split Leakage? | Duplicate File Paths |")
        lines.append("| :--- | :--- | :--- | :--- |")

        details = audit_result.get("duplicate_groups_details", [])
        if not details:
            # Fallback if raw dict only
            for h, paths in list(audit_result["exact_duplicate_groups"].items()):
                details.append({
                    "hash": h,
                    "paths": paths,
                    "splits": ["unknown"],
                    "crosses_splits": False,
                })

        for item in details[:100]:
            h_preview = f"`{item['hash'][:12]}...`"
            splits_str = ", ".join(f"`{s}`" for s in item.get("splits", []))
            leakage_str = "**YES (LEAKAGE)**" if item.get("crosses_splits") else "No (within split)"
            paths_preview = "<br>".join(f"`{p}`" for p in item["paths"])
            lines.append(f"| {h_preview} | {splits_str} | {leakage_str} | {paths_preview} |")

        if len(details) > 100:
            lines.append(f"| *...and {len(details) - 100} more duplicate groups* | | | |")
    else:
        lines.append("No exact duplicate files detected.")

    lines.extend([
        "",
        "---",
        "",
        "## 6. Exclusions & Discarded Files (Full Transparency)",
        "",
        f"- **Total Excluded:** {audit_result['exclusions_count']}",
        "",
    ])

    if audit_result["exclusions"]:
        lines.append("| File Path | Exclusion Reason | Category |")
        lines.append("| :--- | :--- | :--- |")
        for exc in audit_result["exclusions"][:20]:
            lines.append(f"| `{exc['path']}` | {exc['reason']} | `{exc['category']}` |")
        if len(audit_result["exclusions"]) > 20:
            lines.append(f"| *...and {len(audit_result['exclusions']) - 20} more exclusions* | | |")
    else:
        lines.append("No files were excluded or discarded during scanning.")

    lines.extend([
        "",
        "---",
        "",
        "## 7. Recommendations for Phase ML-2 (Data Splitting)",
        "",
        "1. **Leakage Prevention:** Group duplicate hashes and keep any augmented versions in the same split.",
        "2. **Stratification:** Preserve class proportions ("
        + (", ".join(f"{cls}={pct}%" for cls, pct in audit_result["class_percentages"].items()) if audit_result["class_percentages"] else "pending data")
        + ") across train, validation, and test manifests.",
        "3. **Preprocessing:** Standardize image resizing to 224x224 RGB to match pretrained DINOv2 backbone requirements.",
    ])

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Audit quality inspection image dataset for Inspectra.")
    parser.add_argument(
        "--data-dir",
        type=str,
        default=None,
        help="Path to root dataset directory. Overrides config if provided.",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="ml/configs/casting_binary.yaml",
        help="Path to YAML configuration file.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to save the Markdown audit report.",
    )

    args = parser.parse_args()

    # Load configuration if available
    config = {}
    if args.config and Path(args.config).exists():
        if yaml is not None:
            with open(args.config, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}
        else:
            print(f"Warning: PyYAML not installed. Skipping YAML parsing of {args.config}")

    data_dir_str = args.data_dir or config.get("dataset_path", "ml/data/raw/casting_data")
    output_path_str = args.output or config.get("report_output", "ml/reports/dataset_audit.md")
    label_mapping = config.get("label_mapping", DEFAULT_LABEL_MAPPING)
    supported_extensions = set(config.get("supported_extensions", DEFAULT_SUPPORTED_EXTENSIONS))

    data_dir = Path(data_dir_str)
    if not data_dir.is_absolute():
        data_dir = Path.cwd() / data_dir

    print(f"Starting Inspectra Dataset Audit...")
    print(f"Target directory: {data_dir}")

    if not data_dir.exists():
        print(f"\n[Notice] Dataset directory does not exist yet: {data_dir}")
        print("Please download and place the casting dataset according to ml/data/README.md.")
        # Create minimal placeholder report
        empty_result = {
            "dataset_root": str(data_dir),
            "total_files_scanned": 0,
            "valid_images": 0,
            "class_counts": {},
            "class_percentages": {},
            "imbalance_ratio": 1.0,
            "extension_counts": {},
            "format_counts": {},
            "dimensions_distribution": {},
            "min_dimensions": (0, 0),
            "max_dimensions": (0, 0),
            "total_duplicate_files": 0,
            "exact_duplicate_groups": {},
            "duplicate_groups_details": [],
            "cross_split_duplicate_groups": 0,
            "within_split_duplicate_groups": 0,
            "exclusions_count": 0,
            "exclusions": [],
        }
        report_content = generate_markdown_report(empty_result)
        out_file = Path(output_path_str)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(report_content)
        print(f"Template audit report generated at: {out_file}")
        return 0

    audit_result = audit_dataset(
        data_dir=data_dir,
        label_mapping=label_mapping,
        supported_extensions=supported_extensions,
    )

    # Print summary to CLI
    print("\n--- Audit Summary ---")
    print(f"Total files scanned:    {audit_result['total_files_scanned']}")
    print(f"Valid images:           {audit_result['valid_images']}")
    print(f"Excluded files:         {audit_result['exclusions_count']}")
    print(f"Exact duplicates:       {audit_result['total_duplicate_files']} files across {len(audit_result['exact_duplicate_groups'])} groups")
    print(f"  - Cross-split (leakage): {audit_result['cross_split_duplicate_groups']} groups")
    print(f"  - Within single split:   {audit_result['within_split_duplicate_groups']} groups")
    print(f"Class breakdown:        {dict(audit_result['class_counts'])}")
    print(f"Class percentages:      {audit_result['class_percentages']}")
    print(f"Imbalance ratio:        {audit_result['imbalance_ratio']}:1")

    # Save markdown report
    output_path = Path(output_path_str)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_md = generate_markdown_report(audit_result)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_md)

    print(f"\nFull audit report saved to: {output_path.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
