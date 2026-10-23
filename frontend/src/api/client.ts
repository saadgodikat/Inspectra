import axios from 'axios';
import type {
  AuthResponse, HealthStatus, User, Product, Batch, Inspection, InspectionImage,
  ItemsResponse, BulkUploadResult, AnalysisResult, InspectionItem,
  HumanReview, ReviewDecision, Defect, DefectStatus, DefectSeverity,
  CorrectiveAction, ActionStatus, CorrectiveActionEvidence,
  BatchDecision, BatchDecisionContext,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle 401s and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const resp = await axios.post<AuthResponse>('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          const newToken = resp.data.access_token;
          localStorage.setItem('access_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    return res.data;
  },
  switchRole: async (role: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/switch-role', { role });
    return res.data;
  },
  getMe: async (): Promise<{ user: User }> => {
    const res = await api.get<{ user: User }>('/auth/me');
    return res.data;
  },
  getHealth: async (): Promise<HealthStatus> => {
    const res = await api.get<HealthStatus>('/health');
    return res.data;
  },
};

export const productsApi = {
  list: async (params?: { search?: string; category?: string; status?: string }): Promise<{ products: Product[]; count: number }> => {
    const res = await api.get<{ products: Product[]; count: number }>('/products', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ product: Product & { batches: Batch[] } }> => {
    const res = await api.get<{ product: Product & { batches: Batch[] } }>(`/products/${id}`);
    return res.data;
  },
  create: async (data: { product_code: string; name: string; category?: string; description?: string }): Promise<{ product: Product; message: string }> => {
    const res = await api.post<{ product: Product; message: string }>('/products', data);
    return res.data;
  },
  update: async (id: number, data: { product_code?: string; name?: string; category?: string; description?: string }): Promise<{ product: Product; message: string }> => {
    const res = await api.put<{ product: Product; message: string }>(`/products/${id}`, data);
    return res.data;
  },
  archive: async (id: number): Promise<{ product: Product; message: string }> => {
    const res = await api.post<{ product: Product; message: string }>(`/products/${id}/archive`);
    return res.data;
  },
  unarchive: async (id: number): Promise<{ product: Product; message: string }> => {
    const res = await api.post<{ product: Product; message: string }>(`/products/${id}/unarchive`);
    return res.data;
  },
};

export const batchesApi = {
  list: async (params?: { search?: string; product_id?: number; status?: string }): Promise<{ batches: Batch[]; count: number }> => {
    const res = await api.get<{ batches: Batch[]; count: number }>('/batches', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ batch: Batch }> => {
    const res = await api.get<{ batch: Batch }>(`/batches/${id}`);
    return res.data;
  },
  create: async (data: {
    batch_number: string;
    product_id: number;
    production_date?: string;
    quantity?: number;
    production_line?: string;
    supplier?: string;
    status?: string;
  }): Promise<{ batch: Batch; message: string }> => {
    const res = await api.post<{ batch: Batch; message: string }>('/batches', data);
    return res.data;
  },
  update: async (
    id: number,
    data: {
      batch_number?: string;
      production_date?: string | null;
      quantity?: number | null;
      production_line?: string | null;
      supplier?: string | null;
      status?: string;
    }
  ): Promise<{ batch: Batch; message: string }> => {
    const res = await api.put<{ batch: Batch; message: string }>(`/batches/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: string, reason?: string): Promise<{ batch: Batch; message: string }> => {
    const res = await api.post<{ batch: Batch; message: string }>(`/batches/${id}/status`, { status, reason });
    return res.data;
  },
  archive: async (id: number): Promise<{ batch: Batch; message: string }> => {
    const res = await api.post<{ batch: Batch; message: string }>(`/batches/${id}/archive`);
    return res.data;
  },
};

export const inspectionsApi = {
  list: async (params?: {
    product_id?: number;
    batch_id?: number;
    inspector_id?: number;
    status?: string;
    sample_type?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
    reinspection_of_id?: number;
  }): Promise<{ inspections: Inspection[]; total: number; page: number; per_page: number; total_pages: number }> => {
    const res = await api.get('/inspections', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ inspection: Inspection }> => {
    const res = await api.get<{ inspection: Inspection }>(`/inspections/${id}`);
    return res.data;
  },
  create: async (data: {
    product_id?: number;
    batch_id?: number;
    quantity?: number;
    sample_reference?: string;
    sample_type?: string;
    observations?: string;
    reinspection_of_id?: number;
  }): Promise<{ inspection: Inspection; message: string }> => {
    const res = await api.post<{ inspection: Inspection; message: string }>('/inspections', data);
    return res.data;
  },
  createWithBatch: async (data: {
    product_id: number;
    quantity: number;
    production_date?: string;
    production_line?: string;
    supplier?: string;
    sample_reference?: string;
    observations?: string;
  }): Promise<{ batch: Batch; inspection: Inspection; message: string }> => {
    const res = await api.post<{ batch: Batch; inspection: Inspection; message: string }>(
      '/inspections/with-batch',
      data
    );
    return res.data;
  },
  updateDraft: async (
    id: number,
    data: { observations?: string; sample_reference?: string; sample_type?: string }
  ): Promise<{ inspection: Inspection; message: string }> => {
    const res = await api.patch<{ inspection: Inspection; message: string }>(`/inspections/${id}`, data);
    return res.data;
  },
  uploadImages: async (
    id: number,
    files: File[],
    sample_type?: string
  ): Promise<{
    message: string;
    succeeded: InspectionImage[];
    failed: Array<{ filename: string; error: string; status: string }>;
    total_uploaded: number;
    inspection: Inspection;
  }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    if (sample_type) {
      formData.append('sample_type', sample_type);
    }
    const res = await api.post(`/inspections/${id}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  getImageBlobUrl: async (inspectionId: number, imageId: number): Promise<string> => {
    const res = await api.get(`/inspections/${inspectionId}/images/${imageId}`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(res.data);
  },
  getItems: async (inspectionId: number): Promise<ItemsResponse> => {
    const res = await api.get<ItemsResponse>(`/inspections/${inspectionId}/items`);
    return res.data;
  },
  bulkUpload: async (inspectionId: number, files: File[]): Promise<BulkUploadResult> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));
    const res = await api.post<BulkUploadResult>(`/inspections/${inspectionId}/bulk-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  runAnalysis: async (inspectionId: number): Promise<AnalysisResult> => {
    const res = await api.post<AnalysisResult>(`/inspections/${inspectionId}/run-analysis`);
    return res.data;
  },
  overrideItem: async (
    inspectionId: number,
    itemNumber: number,
    decision: 'good' | 'defective',
    comment?: string
  ): Promise<{ message: string; item: InspectionItem }> => {
    const res = await api.patch<{ message: string; item: InspectionItem }>(
      `/inspections/${inspectionId}/items/${itemNumber}/override`,
      { decision, comment }
    );
    return res.data;
  },
};

// ── Reviews ──────────────────────────────────────────────────────────────────
export const reviewsApi = {
  list: async (params?: { inspection_id?: number; reviewer_id?: number; decision?: string; page?: number; per_page?: number }): Promise<{ reviews: HumanReview[]; total: number; page: number; total_pages: number }> => {
    const res = await api.get('/reviews', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ review: HumanReview }> => {
    const res = await api.get<{ review: HumanReview }>(`/reviews/${id}`);
    return res.data;
  },
  create: async (data: {
    inspection_id: number;
    decision: ReviewDecision;
    ml_result_id?: number;
    confirmed_class?: string;
    comments?: string;
    defect_category?: string;
    defect_severity?: DefectSeverity;
    defect_description?: string;
    item_number?: number;
  }): Promise<{ message: string; review: HumanReview; defect?: Defect }> => {
    const res = await api.post('/reviews', data);
    return res.data;
  },
};

// ── Defects ───────────────────────────────────────────────────────────────────
export const defectsApi = {
  list: async (params?: { inspection_id?: number; severity?: string; status?: string; page?: number; per_page?: number }): Promise<{ defects: Defect[]; total: number; page: number; total_pages: number }> => {
    const res = await api.get('/defects', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ defect: Defect }> => {
    const res = await api.get<{ defect: Defect }>(`/defects/${id}`);
    return res.data;
  },
  update: async (id: number, data: { severity?: DefectSeverity; status?: DefectStatus; description?: string }): Promise<{ defect: Defect; message: string }> => {
    const res = await api.patch<{ defect: Defect; message: string }>(`/defects/${id}`, data);
    return res.data;
  },
};

// ── Corrective Actions ────────────────────────────────────────────────────────
export const correctiveActionsApi = {
  list: async (params?: { defect_id?: number; owner_id?: number; status?: string; page?: number; per_page?: number }): Promise<{ corrective_actions: CorrectiveAction[]; total: number; page: number; total_pages: number }> => {
    const res = await api.get('/corrective-actions', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ corrective_action: CorrectiveAction & { evidence: CorrectiveActionEvidence[] } }> => {
    const res = await api.get(`/corrective-actions/${id}`);
    return res.data;
  },
  create: async (data: { defect_id: number; owner_id?: number; target_date?: string; notes?: string }): Promise<{ corrective_action: CorrectiveAction; message: string }> => {
    const res = await api.post('/corrective-actions', data);
    return res.data;
  },
  update: async (id: number, data: { status?: ActionStatus; notes?: string; completion_notes?: string; target_date?: string | null }): Promise<{ corrective_action: CorrectiveAction; message: string }> => {
    const res = await api.patch(`/corrective-actions/${id}`, data);
    return res.data;
  },
  submitEvidence: async (id: number, data: { description?: string; notes?: string; file?: File }): Promise<{ evidence: CorrectiveActionEvidence; message: string }> => {
    const formData = new FormData();
    if (data.description) formData.append('description', data.description);
    if (data.notes) formData.append('notes', data.notes);
    if (data.file) formData.append('file', data.file);
    const res = await api.post(`/corrective-actions/${id}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getEvidenceFileUrl: (actionId: number, evidenceId: number): string => {
    const token = localStorage.getItem('access_token');
    return `/api/corrective-actions/${actionId}/evidence/${evidenceId}/file?token=${token}`;
  },
  getEvidenceBlobUrl: async (actionId: number, evidenceId: number): Promise<string> => {
    const res = await api.get(`/corrective-actions/${actionId}/evidence/${evidenceId}/file`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
  },
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: async (): Promise<{ users: User[] }> => {
    const res = await api.get<{ users: User[] }>('/users');
    return res.data;
  },
  listAssignable: async (): Promise<{ users: User[] }> => {
    const res = await api.get<{ users: User[] }>('/users/assignable');
    return res.data;
  },
};

// ── Batch Decisions ───────────────────────────────────────────────────────────
export const batchDecisionsApi = {
  getContext: async (batchId: number): Promise<{ context: BatchDecisionContext }> => {
    const res = await api.get<{ context: BatchDecisionContext }>(`/batch-decisions/context/${batchId}`);
    return res.data;
  },
  list: async (params?: { batch_id?: number; decision?: string; page?: number; per_page?: number }): Promise<{ batch_decisions: BatchDecision[]; total: number; page: number; total_pages: number }> => {
    const res = await api.get('/batch-decisions', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ batch_decision: BatchDecision }> => {
    const res = await api.get<{ batch_decision: BatchDecision }>(`/batch-decisions/${id}`);
    return res.data;
  },
  create: async (data: {
    batch_id: number;
    decision: 'hold' | 'release';
    reason: string;
    acknowledge_advisories?: boolean;
  }): Promise<{ batch_decision: BatchDecision; batch: Batch; context: BatchDecisionContext; message: string }> => {
    const res = await api.post('/batch-decisions', data);
    return res.data;
  },
};

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatbotCitation {
  type: string;
  id: number;
  label: string;
  href: string;
}

export const chatbotApi = {
  ask: async (messages: ChatbotMessage[]): Promise<{ answer: string; citations: ChatbotCitation[] }> => {
    const res = await api.post<{ answer: string; citations: ChatbotCitation[] }>('/chatbot/ask', { messages });
    return res.data;
  },
};

export interface DashboardStats {
  fpy_percent: number | null;
  fpy_metric?: {
    rate: number | null;
    passed: number;
    reviewed: number;
    formula: string;
  };
  ai_flags?: {
    unreviewed_suggestions: number;
    note: string;
  };
  inspections: {
    total: number;
    by_status: Record<string, number>;
  };
  batches: {
    total: number;
    by_status: Record<string, number>;
    on_hold: number;
    released: number;
    under_inspection: number;
  };
  defects: {
    total: number;
    by_severity: Record<string, number>;
    critical: number;
    high: number;
    note?: string;
  };
  active_products: number;
  recent_inspections: Inspection[];
}

export const dashboardApi = {
  get: async (): Promise<DashboardStats> => {
    const res = await api.get<DashboardStats>('/dashboard');
    return res.data;
  },
};

export default api;
