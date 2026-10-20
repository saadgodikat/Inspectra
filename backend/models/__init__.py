"""SQLAlchemy domain models — central import point."""

from backend.models.user import User  # noqa: F401
from backend.models.product import Product  # noqa: F401
from backend.models.batch import Batch  # noqa: F401
from backend.models.inspection import Inspection  # noqa: F401
from backend.models.inspection_image import InspectionImage  # noqa: F401
from backend.models.ml_result import MLResult  # noqa: F401
from backend.models.human_review import HumanReview  # noqa: F401
from backend.models.defect import Defect  # noqa: F401
from backend.models.corrective_action import CorrectiveAction  # noqa: F401
from backend.models.corrective_action_evidence import CorrectiveActionEvidence  # noqa: F401
from backend.models.batch_decision import BatchDecision  # noqa: F401
from backend.models.audit_event import AuditEvent  # noqa: F401
from backend.models.genai_report import GenAIReport  # noqa: F401
