"""Authenticated project-data chatbot API."""

from flask import Blueprint, jsonify, request

from backend.middleware.errors import ValidationError
from backend.middleware.permissions import require_permission
from backend.services.chatbot_service import answer_project_question

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/chatbot")

MAX_MESSAGES = 12
MAX_MESSAGE_LENGTH = 2000


@chatbot_bp.route("/ask", methods=["POST"])
@require_permission("chatbot.query")
def ask_chatbot(current_user):
    payload = request.get_json(silent=True)
    messages = payload.get("messages") if isinstance(payload, dict) else None
    if not isinstance(messages, list) or not messages or len(messages) > MAX_MESSAGES:
        raise ValidationError(f"Send between 1 and {MAX_MESSAGES} chat messages.")

    validated_messages = []
    for message in messages:
        if (
            not isinstance(message, dict)
            or message.get("role") not in {"user", "assistant"}
            or not isinstance(message.get("content"), str)
            or not message["content"].strip()
            or len(message["content"]) > MAX_MESSAGE_LENGTH
        ):
            raise ValidationError(
                f"Each message must have a user/assistant role and 1–{MAX_MESSAGE_LENGTH} characters."
            )
        validated_messages.append({
            "role": message["role"],
            "content": message["content"].strip(),
        })

    if validated_messages[-1]["role"] != "user":
        raise ValidationError("The latest chat message must be from the user.")

    result = answer_project_question(validated_messages, current_user.role)
    return jsonify(result), 200
