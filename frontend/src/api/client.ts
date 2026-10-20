import axios from 'axios';
import type { AuthResponse, HealthStatus, User, Product, Batch, Inspection, InspectionImage } from '../types';

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
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
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
  register: async (data: { name: string; email: string; password: string; role?: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/register', data);
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
  }): Promise<{ inspections: Inspection[]; total: number; page: number; per_page: number; total_pages: number }> => {
    const res = await api.get('/inspections', { params });
    return res.data;
  },
  get: async (id: number): Promise<{ inspection: Inspection }> => {
    const res = await api.get<{ inspection: Inspection }>(`/inspections/${id}`);
    return res.data;
  },
  create: async (data: {
    product_id: number;
    batch_id: number;
    sample_reference?: string;
    sample_type?: string;
    observations?: string;
  }): Promise<{ inspection: Inspection; message: string }> => {
    const res = await api.post<{ inspection: Inspection; message: string }>('/inspections', data);
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
};

export default api;
