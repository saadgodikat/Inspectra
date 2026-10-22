"""Tests for the synthetic industrial defect dataset audit script."""

import pytest
from pathlib import Path
from PIL import Image

from ml.scripts.inspect_synthetic_dataset import run_audit, DATASET_ROOT, REPORT_PATH


def test_synthetic_dataset_exists_and_audited():
    """Verify that synthetic dataset root exists and contains expected subfolders."""
    assert DATASET_ROOT.exists()
    assert (DATASET_ROOT / "images").is_dir()
    assert (DATASET_ROOT / "labels").is_dir()


def test_audit_runs_and_generates_report():
    """Verify run_audit generates report and covers key data metrics."""
    content = run_audit()
    assert REPORT_PATH.exists()
    assert "Total PNG Images Found" in content
    assert "991" in content
    assert "Defect-Only Dataset" in content
    assert "Absence of Authoritative Class-ID-to-Name Mapping" in content
