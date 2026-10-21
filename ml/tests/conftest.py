"""Pytest configuration for ML subsystem tests."""

import sys
from pathlib import Path

# Add project root and ml/src to sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

ML_SRC = REPO_ROOT / "ml" / "src"
if ML_SRC.exists() and str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))
