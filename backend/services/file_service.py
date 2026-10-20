"""Secure file upload and storage service for inspection evidence."""

import os
import io
import uuid
import hashlib
from typing import Tuple, Dict, Any, Optional
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError

from flask import current_app
from backend.extensions import db
from backend.models.inspection_image import InspectionImage, ImageProcessingState

# Map of Pillow image format strings to canonical MIME types and extensions
SUPPORTED_FORMATS = {
    "JPEG": {"mime": "image/jpeg", "ext": "jpg"},
    "PNG": {"mime": "image/png", "ext": "png"},
    "WEBP": {"mime": "image/webp", "ext": "webp"},
}


class FileValidationError(Exception):
    """Custom exception for file validation failures."""
    pass


def get_upload_base_dir() -> str:
    """Get absolute path to base upload directory, ensuring it exists."""
    upload_dir = current_app.config.get("UPLOAD_DIR", "uploads")
    if not os.path.isabs(upload_dir):
        # Resolve relative to project root
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        upload_dir = os.path.join(base_dir, upload_dir)
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def validate_and_process_image_bytes(
    file_bytes: bytes,
    original_filename: str,
    max_size_bytes: int,
) -> Tuple[str, str, int, str]:
    """Validate image bytes for integrity, format, and size.

    Returns:
        Tuple of (canonical_mime_type, file_extension, file_size, sha256_hash)
    Raises:
        FileValidationError if validation fails.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise FileValidationError("File is empty (0 bytes)")

    file_size = len(file_bytes)
    if file_size > max_size_bytes:
        max_mb = max_size_bytes / (1024 * 1024)
        raise FileValidationError(f"File size exceeds maximum allowed limit of {max_mb:.1f} MB")

    # Compute SHA-256 hash of original exact bytes
    sha256_hash = hashlib.sha256(file_bytes).hexdigest()

    # Deep inspection with Pillow
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            format_name = (img.format or "").upper()
            if format_name not in SUPPORTED_FORMATS:
                allowed = ", ".join(SUPPORTED_FORMATS.keys())
                raise FileValidationError(
                    f"Unsupported image format '{format_name}'. Allowed formats: {allowed}"
                )
            # Verify image integrity (detects corrupt chunks, truncated files)
            img.verify()
    except UnidentifiedImageError:
        raise FileValidationError("File is not a valid or readable image")
    except Exception as e:
        if isinstance(e, FileValidationError):
            raise
        raise FileValidationError(f"Image integrity verification failed: {str(e)}")

    canonical_info = SUPPORTED_FORMATS[format_name]
    return canonical_info["mime"], canonical_info["ext"], file_size, sha256_hash


def save_inspection_image(
    inspection_id: int,
    user_id: int,
    file_storage,
    sample_type: Optional[str] = None,
) -> Tuple[Optional[InspectionImage], Optional[Dict[str, Any]]]:
    """Safely validate, persist, and record an inspection image.

    Args:
        inspection_id: Target inspection ID.
        user_id: ID of the uploading user.
        file_storage: Werkzeug FileStorage object from request.files.
        sample_type: Optional sample type categorization.

    Returns:
        (InspectionImage, None) on success, or (None, error_dict) on failure.
    """
    raw_filename = getattr(file_storage, "filename", "") or "unnamed_image"
    safe_orig_name = secure_filename(os.path.basename(raw_filename)) or "evidence_image.jpg"

    max_size_bytes = current_app.config.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)

    try:
        # Read exact bytes
        file_bytes = file_storage.read()
        mime_type, ext, file_size, sha256_hash = validate_and_process_image_bytes(
            file_bytes=file_bytes,
            original_filename=safe_orig_name,
            max_size_bytes=max_size_bytes,
        )
    except FileValidationError as fve:
        return None, {
            "filename": safe_orig_name,
            "error": str(fve),
            "status": "rejected",
        }
    except Exception as e:
        return None, {
            "filename": safe_orig_name,
            "error": f"Failed to process file: {str(e)}",
            "status": "rejected",
        }

    # Generate server-controlled UUID storage path (never user filename)
    storage_uuid = uuid.uuid4().hex
    relative_path = os.path.join("inspections", str(inspection_id), f"{storage_uuid}.{ext}")
    base_dir = get_upload_base_dir()
    absolute_target_path = os.path.join(base_dir, relative_path)

    # Security check: verify path traversal is impossible
    if not os.path.abspath(absolute_target_path).startswith(os.path.abspath(base_dir)):
        return None, {
            "filename": safe_orig_name,
            "error": "Security check failed: Invalid storage target",
            "status": "rejected",
        }

    # Ensure target directory exists
    os.makedirs(os.path.dirname(absolute_target_path), exist_ok=True)

    # Write file bytes to disk safely
    try:
        with open(absolute_target_path, "wb") as f:
            f.write(file_bytes)
    except Exception as io_err:
        return None, {
            "filename": safe_orig_name,
            "error": f"Filesystem write failed: {str(io_err)}",
            "status": "failed",
        }

    # Create and persist database record
    try:
        image_record = InspectionImage(
            inspection_id=inspection_id,
            storage_path=relative_path,
            original_filename=safe_orig_name,
            content_type=mime_type,
            file_size=file_size,
            file_hash=sha256_hash,
            sample_type=sample_type,
            uploaded_by_id=user_id,
            processing_state=ImageProcessingState.UPLOADED.value,
        )
        db.session.add(image_record)
        db.session.flush()
        return image_record, None
    except Exception as db_err:
        # Cleanup written file if DB record creation fails
        if os.path.exists(absolute_target_path):
            try:
                os.remove(absolute_target_path)
            except OSError:
                pass
        return None, {
            "filename": safe_orig_name,
            "error": f"Database transaction failed: {str(db_err)}",
            "status": "failed",
        }


def get_image_file_path(image: InspectionImage) -> Optional[str]:
    """Resolve validated absolute filesystem path for an InspectionImage."""
    if not image or not image.storage_path:
        return None
    base_dir = get_upload_base_dir()
    absolute_path = os.path.join(base_dir, image.storage_path)
    # Check traversal and existence
    if not os.path.abspath(absolute_path).startswith(os.path.abspath(base_dir)):
        return None
    if not os.path.isfile(absolute_path):
        return None
    return absolute_path
