export type UserRole = 'inspector' | 'supervisor' | 'quality_manager';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  message?: string;
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  database: 'connected' | 'disconnected' | 'unknown';
}

export interface Product {
  id: number;
  product_code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  is_active: boolean;
  batch_count?: number;
  inspection_count?: number;
  created_at: string;
  updated_at: string;
}

export type BatchStatus =
  | 'created'
  | 'in_production'
  | 'produced'
  | 'under_inspection'
  | 'on_hold'
  | 'released'
  | 'archived';

export interface Batch {
  id: number;
  batch_number: string;
  product_id: number;
  production_date?: string | null;
  quantity?: number | null;
  status: BatchStatus;
  production_line?: string | null;
  supplier?: string | null;
  product?: {
    id: number;
    product_code: string;
    name: string;
    category?: string | null;
    is_active: boolean;
  };
  inspection_count?: number;
  created_at: string;
  updated_at: string;
}

export type SampleType = 'item' | 'surface' | 'batch_sample';

export type InspectionStatus =
  | 'pending_upload'
  | 'processing'
  | 'pending_review'
  | 'reviewed'
  | 'needs_more_evidence'
  | 'processing_failed';

export interface InspectionImage {
  id: number;
  inspection_id: number;
  original_filename: string;
  content_type: string;
  file_size: number;
  file_hash: string;
  sample_type?: string | null;
  uploaded_by_id: number;
  upload_timestamp: string;
  processing_state: string;
  failure_reason?: string | null;
}

export interface Inspection {
  id: number;
  product_id: number;
  batch_id: number;
  inspector_id: number;
  sample_reference?: string | null;
  sample_type: SampleType;
  observations?: string | null;
  status: InspectionStatus;
  inspection_timestamp: string;
  reinspection_of_id?: number | null;
  image_count: number;
  item_count?: number;
  item_summary?: {
    total: number;
    analyzed: number;
    good: number;
    defective: number;
  };
  confirmed_defects_count?: number;
  product?: {
    id: number;
    product_code: string;
    name: string;
    category?: string | null;
    is_active: boolean;
  };
  batch?: {
    id: number;
    batch_number: string;
    status: string;
    production_date?: string | null;
    quantity?: number | null;
    production_line?: string | null;
    supplier?: string | null;
  };
  inspector?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  images?: InspectionImage[];
  reviews?: HumanReview[];
  defects?: Defect[];
  reinspection_of?: {
    id: number;
    sample_reference?: string | null;
    status: string;
    created_at?: string;
  } | null;
  reinspections?: Array<{
    id: number;
    sample_reference?: string | null;
    status: string;
    created_at?: string;
    inspector_name?: string | null;
  }>;
  created_at: string;
  updated_at: string;
}

export type ItemStatus = 'pending_upload' | 'uploaded' | 'analyzed';
export type OverrideDecision = 'good' | 'defective';

export interface MLResultSummary {
  id: number;
  predicted_class: string;
  model_name: string;
  model_version: string;
  raw_scores: Record<string, number>;
  processing_duration_ms: number;
  status: string;
  created_at: string;
}

export interface InspectionItem {
  id: number;
  inspection_id: number;
  item_number: number;
  status: ItemStatus;
  image_id: number | null;
  ml_result_id: number | null;
  override_decision: OverrideDecision | null;
  override_comment: string | null;
  override_by_id: number | null;
  effective_decision: string | null;
  ml_result?: MLResultSummary;
  image?: {
    id: number;
    original_filename: string;
    content_type: string;
    file_size: number;
    upload_timestamp: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ItemsSummary {
  total: number;
  uploaded: number;
  analyzed: number;
  pending_upload: number;
  good: number;
  defective: number;
}

export interface ItemsResponse {
  inspection_id: number;
  summary: ItemsSummary;
  items: InspectionItem[];
}

export interface BulkUploadResult {
  message: string;
  succeeded: Array<{ item_number: number; image_id: number; filename: string }>;
  errors: Array<{ filename: string; error: string }>;
  total_uploaded: number;
  total_errors: number;
}

export interface AnalysisResult {
  message: string;
  analyzed: number;
  good: number;
  defective: number;
  failed: number;
  pending_upload: number;
  total: number;
}

export type ReviewDecision = 'confirm' | 'correct' | 'no_defect' | 'needs_more_evidence';

export interface HumanReview {
  id: number;
  inspection_id: number;
  ml_result_id?: number | null;
  reviewer_id: number;
  decision: ReviewDecision;
  confirmed_class?: string | null;
  comments?: string | null;
  review_timestamp: string;
  reviewer?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

export type DefectSeverity = 'critical' | 'major' | 'minor' | 'cosmetic' | 'high' | 'medium' | 'low';
export type DefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';

export interface Defect {
  id: number;
  defect_code?: string;
  item_number?: number | null;
  item_tag?: string | null;
  inspection_id: number;
  review_id?: number | null;
  defect_category: string;
  defect_type: string;
  description?: string | null;
  severity: DefectSeverity;
  status: DefectStatus;
  created_by_id: number;
  created_by?: {
    id: number;
    name: string;
    role: string;
  };
  review?: HumanReview;
  corrective_actions?: CorrectiveAction[];
  confidence_score?: number | null;
  location_x?: number | null;
  location_y?: number | null;
  created_at: string;
  updated_at: string;
  inspection?: {
    id: number;
    sample_reference?: string | null;
    product?: { name: string } | null;
    batch?: { batch_number: string } | null;
  };
}

export type ActionStatus = 'open' | 'in_progress' | 'completed' | 'closed' | 'reopened';

export interface CorrectiveActionEvidence {
  id: number;
  corrective_action_id: number;
  submitted_by_id: number;
  file_path?: string | null;
  original_filename?: string | null;
  has_file: boolean;
  description?: string | null;
  notes?: string | null;
  submitted_at: string;
  submitted_by?: {
    id: number;
    name: string;
    email?: string;
    role: string;
  };
}

export interface CorrectiveAction {
  id: number;
  defect_id: number;
  owner_id: number;
  target_date?: string | null;
  notes?: string | null;
  status: ActionStatus;
  completion_notes?: string | null;
  created_at: string;
  updated_at: string;
  owner?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  evidence?: CorrectiveActionEvidence[];
  evidence_count?: number;
  defect?: Defect;
}

export interface BatchDecisionAdvisory {
  code: string;
  message: string;
}

export interface BatchDecisionContext {
  batch_id: number;
  batch_number: string;
  batch_status: string;
  total_inspected: number;
  total_reviewed: number;
  unreviewed_inspections: number;
  total_confirmed_defects: number;
  open_defects: number;
  critical_defects_open: number;
  total_open_actions: number;
  total_items: number;
  analyzed_items: number;
  uploaded_items: number;
  pending_upload_items: number;
  advisories: BatchDecisionAdvisory[];
  release_blocked: boolean;
}

export interface BatchDecision {
  id: number;
  batch_id: number;
  decision: 'hold' | 'release';
  reason: string;
  decided_by_id: number;
  decided_by?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  decision_timestamp: string;
  total_inspected?: number | null;
  total_reviewed?: number | null;
  total_confirmed_defects?: number | null;
  total_open_actions?: number | null;
  advisories_acknowledged: boolean;
  evidence_snapshot?: BatchDecisionContext | null;
}
