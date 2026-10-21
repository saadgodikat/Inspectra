"""Metrics and evaluation calculation for binary defect classification."""

from typing import Dict, Any, List, Tuple
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
)


def compute_binary_metrics(
    y_true: List[int],
    y_probs: List[float],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Compute comprehensive binary classification metrics.

    Positive class is 1 ('defective'), negative class is 0 ('good').

    Args:
        y_true: Ground truth binary labels (0 or 1).
        y_probs: Predicted probabilities for the positive class (defective).
        threshold: Decision threshold for positive classification (default: 0.5).

    Returns:
        Dictionary of computed metrics and confusion matrix breakdown.
    """
    y_true_arr = np.array(y_true, dtype=int)
    y_probs_arr = np.array(y_probs, dtype=float)
    y_pred_arr = (y_probs_arr >= threshold).astype(int)

    acc = float(accuracy_score(y_true_arr, y_pred_arr))
    prec = float(precision_score(y_true_arr, y_pred_arr, zero_division=0))
    rec = float(recall_score(y_true_arr, y_pred_arr, zero_division=0))
    f1 = float(f1_score(y_true_arr, y_pred_arr, zero_division=0))

    try:
        auc = float(roc_auc_score(y_true_arr, y_probs_arr))
    except (ValueError, IndexError):
        auc = 0.0

    cm = confusion_matrix(y_true_arr, y_pred_arr, labels=[0, 1])
    # Structure: [[TN, FP], [FN, TP]]
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    return {
        "threshold": threshold,
        "positive_class": "defective (1)",
        "negative_class": "good (0)",
        "total_samples": len(y_true),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(auc, 4),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
        },
    }


def find_optimal_threshold(
    y_true: List[int],
    y_probs: List[float],
    metric: str = "f1",
) -> Tuple[float, Dict[str, Any]]:
    """Search for the decision threshold that maximizes a validation metric (e.g. F1)."""
    thresholds = np.linspace(0.1, 0.9, 81)
    best_thresh = 0.5
    best_score = -1.0
    best_metrics = {}

    for t in thresholds:
        m = compute_binary_metrics(y_true, y_probs, threshold=float(t))
        score = m[metric]
        if score > best_score:
            best_score = score
            best_thresh = float(t)
            best_metrics = m

    return best_thresh, best_metrics
