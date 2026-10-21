"""Inspectra ML core library."""

from inspectra_ml.inference import predict_image, load_model, clear_model_cache

__version__ = "0.1.0"
__all__ = ["predict_image", "load_model", "clear_model_cache"]
