"""Inspectra ML core library."""

from inspectra_ml.inference import predict_image, load_model, clear_model_cache
from inspectra_ml.multiclass_inference import (
    predict_multiclass_image,
    load_multiclass_model,
    clear_multiclass_model_cache,
)
from inspectra_ml.dataset import (
    LABEL_TO_IDX,
    IDX_TO_LABEL,
    MULTICLASS_LABEL_TO_IDX,
    MULTICLASS_IDX_TO_LABEL,
)

__version__ = "0.2.0"
__all__ = [
    "predict_image",
    "load_model",
    "clear_model_cache",
    "predict_multiclass_image",
    "load_multiclass_model",
    "clear_multiclass_model_cache",
    "LABEL_TO_IDX",
    "IDX_TO_LABEL",
    "MULTICLASS_LABEL_TO_IDX",
    "MULTICLASS_IDX_TO_LABEL",
]

