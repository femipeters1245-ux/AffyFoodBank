// frontend/src/services/api.ts
import axios from 'axios';
import {
  AuthResponse,
  Product,
  Package,
  Wallet,
  WalletTransaction,
  SavingsPlan,
  User,
} from '../types';

const API_BASE = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Bearer token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('affy_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Intercept 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid/expired
      localStorage.removeItem('affy_token');
      localStorage.removeItem('affy_user');
      // Dispatch custom event to notify AuthContext
      window.dispatchEvent(new Event('affy_auth_expired'));
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return res.data;
  },
  register: async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ user: User }> => {
    const res = await apiClient.post<{ user: User }>('/auth/register', data);
    return res.data;
  },
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('affy_token');
      localStorage.removeItem('affy_user');
    }
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/me');
    return res.data;
  },
};

export const productsApi = {
  list: async (params?: { category?: string; search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<Product[]>('/products', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Product>(`/products/${id}`);
    return res.data;
  },
};

export const packagesApi = {
  list: async () => {
    const res = await apiClient.get<Package[]>('/packages');
    return res.data;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Package>(`/packages/${id}`);
    return res.data;
  },
};

export const walletApi = {
  getWallet: async (): Promise<Wallet> => {
    const res = await apiClient.get<Wallet>('/wallet');
    return res.data;
  },
  listTransactions: async (): Promise<WalletTransaction[]> => {
    const res = await apiClient.get<WalletTransaction[]>('/wallet/transactions');
    return res.data;
  },
  deposit: async (data: {
    amountCents: number;
    paymentReference: string;
    description?: string;
  }): Promise<Wallet> => {
    const res = await apiClient.post<Wallet>('/wallet/deposit', data);
    return res.data;
  },
  withdraw: async (data: {
    amountCents: number;
    description?: string;
  }): Promise<Wallet> => {
    const res = await apiClient.post<Wallet>('/wallet/withdraw', data);
    return res.data;
  },
  allocate: async (data: {
    savingsPlanId: string;
    amountCents: number;
  }): Promise<Wallet> => {
    const res = await apiClient.post<Wallet>('/wallet/allocate', data);
    return res.data;
  },
  release: async (data: {
    savingsPlanId: string;
    amountCents: number;
  }): Promise<Wallet> => {
    const res = await apiClient.post<Wallet>('/wallet/release', data);
    return res.data;
  },
};

export const savingsApi = {
  list: async (): Promise<SavingsPlan[]> => {
    const res = await apiClient.get<SavingsPlan[]>('/savings');
    return res.data;
  },
  getById: async (id: string): Promise<SavingsPlan> => {
    const res = await apiClient.get<SavingsPlan>(`/savings/${id}`);
    return res.data;
  },
  create: async (data: {
    name: string;
    description?: string;
    targetAmountCents: number;
    targetDate: string;
    items?: Array<{ productId: string; quantity: number; unitId: string }>;
  }): Promise<SavingsPlan> => {
    const res = await apiClient.post<SavingsPlan>('/savings', data);
    return res.data;
  },
  cancel: async (id: string): Promise<SavingsPlan> => {
    const res = await apiClient.delete<SavingsPlan>(`/savings/${id}`);
    return res.data;
  },
};
