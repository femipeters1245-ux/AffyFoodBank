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
  sendLoginOtp: async (credentials: {
    email: string;
    password: string;
  }): Promise<{ message: string; email: string; expiresInMinutes: number; previewOtp?: string }> => {
    const res = await apiClient.post('/auth/otp/send-login-otp', credentials);
    return res.data;
  },
  verifyLoginOtp: async (payload: { email: string; otp: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/otp/verify-login-otp', payload);
    return res.data;
  },
  sendSignupOtp: async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ message: string; email: string; expiresInMinutes: number; previewOtp?: string }> => {
    const res = await apiClient.post('/auth/otp/send-signup-otp', data);
    return res.data;
  },
  verifySignupOtp: async (payload: { email: string; otp: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/otp/verify-signup-otp', payload);
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

export const paymentsApi = {
  getConfig: async () => {
    const res = await apiClient.get('/payments/transactpay/config');
    return res.data;
  },
  createTransactPayOrder: async (data: {
    amountNaira: number;
    email: string;
    name?: string;
    phone?: string;
    address?: string;
    items?: any[];
  }) => {
    const res = await apiClient.post('/payments/transactpay/create-order', data);
    return res.data;
  },
  verifyTransactPay: async (reference: string) => {
    const res = await apiClient.post('/payments/transactpay/verify', { reference });
    return res.data;
  },
  getBanks: async (): Promise<{ status: string; banks: Array<{ name: string; code: string; id?: string }> }> => {
    const res = await apiClient.get('/payments/transactpay/banks');
    return res.data;
  },
  createVirtualAccount: async (data: {
    amountNaira?: number;
    customerName?: string;
    email?: string;
  }): Promise<{
    status: string;
    reference: string;
    accountNumber: string;
    bankName: string;
    accountName: string;
    amountNaira?: number | null;
    currency: string;
    instructions: string;
  }> => {
    const res = await apiClient.post('/payments/transactpay/virtual-account', data);
    return res.data;
  },
  initiatePayout: async (data: {
    amountNaira: number;
    accountNumber: string;
    bankCode: string;
    bankName?: string;
    accountName: string;
    customerProfileId?: string;
    description?: string;
  }): Promise<{
    status: string;
    reference: string;
    batchReference?: string;
    amountNaira: number;
    destination: {
      bankName: string;
      accountNumber: string;
      accountName: string;
    };
    message: string;
  }> => {
    const res = await apiClient.post('/payments/transactpay/payout', data);
    return res.data;
  },
};

export const adminApi = {
  getStats: async () => {
    const res = await apiClient.get('/admin/stats');
    return res.data;
  },
  getProducts: async () => {
    const res = await apiClient.get('/admin/products');
    return res.data;
  },
  createProduct: async (data: any) => {
    const res = await apiClient.post('/admin/products', data);
    return res.data;
  },
  updateProduct: async (id: string, data: any) => {
    const res = await apiClient.put(`/admin/products/${id}`, data);
    return res.data;
  },
  getCustomers: async () => {
    const res = await apiClient.get('/admin/customers');
    return res.data;
  },
  updateCustomerKYC: async (id: string, data: any) => {
    const res = await apiClient.patch(`/admin/customers/${id}/kyc`, data);
    return res.data;
  },
  getOrders: async () => {
    const res = await apiClient.get('/admin/orders');
    return res.data;
  },
  updateOrderDelivery: async (id: string, data: any) => {
    const res = await apiClient.patch(`/admin/orders/${id}/delivery`, data);
    return res.data;
  },
  getTransactions: async () => {
    const res = await apiClient.get('/admin/transactions');
    return res.data;
  },
  getDeliveryFee: async () => {
    const res = await apiClient.get('/admin/delivery-fee');
    return res.data;
  },
  updateDeliveryFee: async (data: any) => {
    const res = await apiClient.post('/admin/delivery-fee', data);
    return res.data;
  },
};

export const deliveryApi = {
  getDeliveryFee: async () => {
    const res = await apiClient.get('/delivery-fee');
    return res.data;
  },
};


