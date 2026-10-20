"""Standardised API error responses and exception handlers."""

from flask import jsonify


class APIError(Exception):
    """Base API error with status code and payload."""

    def __init__(self, message: str, status_code: int = 400, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class NotFoundError(APIError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, 404)


class ForbiddenError(APIError):
    def __init__(self, message: str = "You do not have permission to perform this action"):
        super().__init__(message, 403)


class ConflictError(APIError):
    def __init__(self, message: str = "Conflict with current state"):
        super().__init__(message, 409)


class ValidationError(APIError):
    def __init__(self, message: str = "Validation failed", details: dict | None = None):
        super().__init__(message, 422, details)


def register_error_handlers(app):
    """Register global JSON error handlers on the Flask app."""

    @app.errorhandler(APIError)
    def handle_api_error(error):
        response = {"error": error.message}
        if error.details:
            response["details"] = error.details
        return jsonify(response), error.status_code

    @app.errorhandler(404)
    def handle_404(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def handle_405(_):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def handle_413(_):
        return jsonify({"error": "File too large"}), 413

    @app.errorhandler(500)
    def handle_500(_):
        return jsonify({"error": "Internal server error"}), 500
