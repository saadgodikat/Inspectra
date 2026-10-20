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
  created_at: string;
  updated_at: string;
}
