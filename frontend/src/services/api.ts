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
  withCredentials: true,
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
  // Unified 6-digit Resend OTP endpoints
  sendOtp: async (data: {
    email: string;
    purpose?: 'LOGIN' | 'SIGNUP' | string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }): Promise<{ message: string; email: string; expiresInMinutes: number; expiresInSeconds: number; cooldownSeconds: number; verificationTicket?: string }> => {
    const res = await apiClient.post('/auth/send-otp', data);
    return res.data;
  },
  verifyOtp: async (payload: {
    email: string;
    otp: string;
    purpose?: 'LOGIN' | 'SIGNUP' | string;
    verificationTicket?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/verify-otp', payload);
    return res.data;
  },
  getSession: async (): Promise<{ authenticated: boolean; user: User | null; session: any }> => {
    const res = await apiClient.get('/auth/session');
    return res.data;
  },
  login: async (credentials: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return res.data;
  },
  sendLoginOtp: async (credentials: {
    email: string;
    password?: string;
  }): Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string; previewOtp?: string }> => {
    const res = await apiClient.post('/auth/send-otp', { ...credentials, purpose: 'LOGIN' });
    return res.data;
  },
  verifyLoginOtp: async (payload: { email: string; otp: string; verificationTicket?: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/verify-otp', { ...payload, purpose: 'LOGIN' });
    return res.data;
  },
  sendSignupOtp: async (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ message: string; email: string; expiresInMinutes: number; verificationTicket?: string; previewOtp?: string }> => {
    const res = await apiClient.post('/auth/send-otp', { ...data, purpose: 'SIGNUP' });
    return res.data;
  },
  verifySignupOtp: async (payload: {
    email: string;
    otp: string;
    verificationTicket?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/verify-otp', { ...payload, purpose: 'SIGNUP' });
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
  requestPasswordReset: async (email: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/auth/password-reset-request', { email });
    return res.data;
  },
  resetPassword: async (data: { email: string; otp: string; newPassword: string }): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post('/auth/password-reset', data);
    return res.data;
  },
  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/me');
    return res.data;
  },
};

export const productsApi = {
  list: async (params?: { category?: string; search?: string; page?: number; limit?: number }) => {
    const res = await apiClient.get<any>('/products', { params });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Product>(`/products/${id}`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post('/admin/products', data);
    return res.data;
  },
  update: async (id: string, data: any) => {
    const res = await apiClient.put(`/admin/products/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete(`/admin/products/${id}`);
    return res.data;
  },
  restock: async (id: string, amount: number) => {
    const res = await apiClient.post(`/admin/products/${id}/restock`, { amount });
    return res.data;
  },
};

export const packagesApi = {
  list: async () => {
    const res = await apiClient.get<any>('/packages');
    return res.data;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<any>(`/packages/${id}`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post<any>('/packages', data);
    return res.data;
  },
  update: async (id: string, data: any) => {
    const res = await apiClient.put<any>(`/packages/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await apiClient.delete<any>(`/packages/${id}`);
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
    location?: string;
    isExpress?: boolean;
    items?: any[];
    adpOperatorId?: string;
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
  createVirtualAccount: async (data?: {
    amountNaira?: number;
    customerName?: string;
    email?: string;
  }): Promise<{
    status: string;
    reference: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    accountName: string;
    amountNaira?: number | null;
    currency: string;
    instructions: string;
  }> => {
    const res = await apiClient.post('/payments/transactpay/virtual-account', data || {});
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
    // status is now 'pending' — payout is queued, NOT yet finalised
    status: 'pending' | string;
    reference: string;
    batchReference?: string;
    amountNaira: number;
    reservedCents?: number;
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
  nameEnquiry: async (data: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{
    status: string;
    accountName: string;
    accountNumber: string;
    bankCode: string;
    bankName?: string;
  }> => {
    const res = await apiClient.post('/payments/transactpay/name-enquiry', data);
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
  deleteProduct: async (id: string) => {
    const res = await apiClient.delete(`/admin/products/${id}`);
    return res.data;
  },
  restockProduct: async (id: string, amount: number) => {
    const res = await apiClient.post(`/admin/products/${id}/restock`, { amount });
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
  getPackages: async () => {
    const res = await apiClient.get('/admin/packages');
    return res.data;
  },
  updatePackage: async (id: string, data: any) => {
    const res = await apiClient.put(`/admin/packages/${id}`, data);
    return res.data;
  },
  createPackage: async (data: any) => {
    const res = await apiClient.post('/admin/packages', data);
    return res.data;
  },
  deactivatePackage: async (id: string) => {
    const res = await apiClient.delete(`/admin/packages/${id}`);
    return res.data;
  },
  getFundingEvents: async (params?: { status?: string; needsReview?: boolean; limit?: number; offset?: number }) => {
    const res = await apiClient.get('/payments/transactpay/funding-events', { params });
    return res.data;
  },
  reverifyFundingEvent: async (sessionId: string) => {
    const res = await apiClient.post('/payments/transactpay/funding-events/reverify', { sessionId });
    return res.data;
  },
  backfillVirtualAccounts: async (params?: { limit?: number; delayMs?: number }) => {
    const res = await apiClient.post('/payments/transactpay/virtual-account/backfill', params || {});
    return res.data;
  },
  getZones: async () => {
    const res = await apiClient.get('/zones/admin');
    return res.data?.data ?? [];
  },
  createZone: async (data: { name: string; targetAdpCount?: number }) => {
    const res = await apiClient.post('/zones/admin', data);
    return res.data?.data;
  },
  toggleZone: async (id: string, isActive: boolean) => {
    const res = await apiClient.patch(`/zones/admin/${id}/toggle`, { isActive });
    return res.data?.data;
  },
  updateZoneTarget: async (id: string, targetAdpCount: number) => {
    const res = await apiClient.patch(`/zones/admin/${id}/target`, { targetAdpCount });
    return res.data?.data;
  },
  seedZones: async () => {
    const res = await apiClient.post('/zones/admin/seed');
    return res.data;
  },
  // ADP Verification Portal Methods
  listAdpApplications: async (params?: { zoneId?: string; status?: string; search?: string }) => {
    const res = await apiClient.get('/admin/adp/applications', { params });
    return res.data?.data ?? [];
  },
  getAdpApplication: async (id: string) => {
    const res = await apiClient.get(`/admin/adp/applications/${id}`);
    return res.data?.data;
  },
  getAdpDocumentUrl: async (id: string) => {
    const res = await apiClient.get(`/admin/adp/applications/${id}/doc-url`);
    return res.data?.signedUrl;
  },
  verifyAdpTrack: async (id: string, data: { track: 'STUDENT' | 'HOSTEL' | 'PAYMENT'; status: string; notes?: string }) => {
    const res = await apiClient.patch(`/admin/adp/applications/${id}/track`, data);
    return res.data?.data;
  },
  approveAdpOperator: async (id: string, notes?: string) => {
    const res = await apiClient.patch(`/admin/adp/applications/${id}/approve`, { notes });
    return res.data?.data;
  },
  suspendAdpOperator: async (id: string, reason: string) => {
    const res = await apiClient.patch(`/admin/adp/applications/${id}/suspend`, { reason });
    return res.data?.data;
  },
  blockAdpOperator: async (id: string, reason: string) => {
    const res = await apiClient.patch(`/admin/adp/applications/${id}/block`, { reason });
    return res.data?.data;
  },
  // Compensation Rates & Earnings
  listAdpRates: async () => {
    const res = await apiClient.get('/admin/adp/rates');
    return res.data?.data ?? [];
  },
  setAdpRate: async (data: { coverageZoneId?: string | null; ratePerCollectionCents: number }) => {
    const res = await apiClient.post('/admin/adp/rates', data);
    return res.data?.data;
  },
  listAdpEarnings: async (params?: { operatorId?: string; status?: string }) => {
    const res = await apiClient.get('/admin/adp/earnings', { params });
    return res.data?.data ?? [];
  },
  createAdpPayoutBatch: async (data: { operatorId: string; earningIds: string[]; channel?: string }) => {
    const res = await apiClient.post('/admin/adp/payout-batches', data);
    return res.data?.data;
  },
  executeAdpPayoutBatch: async (batchId: string) => {
    const res = await apiClient.post(`/admin/adp/payout-batches/${batchId}/execute`);
    return res.data;
  },
};

export const zonesApi = {
  getActiveZones: async () => {
    const res = await apiClient.get('/zones');
    return res.data?.data ?? [];
  },
  getOperatorsByZone: async (zoneId: string) => {
    const res = await apiClient.get(`/zones/${zoneId}/operators`);
    return res.data?.data ?? [];
  },
};

export interface AdpApplicationPayload {
  coverageZoneId: string;
  fullName: string;
  matricNumber: string;
  institution?: string;
  faculty: string;
  department: string;
  academicLevel: string;
  phone: string;
  email: string;
  studentIdDocPath: string;
  hostelName: string;
  hostelAddress: string;
  closestLandmark?: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  alternativeContact?: string;
}

export const adpApi = {
  getBanks: async () => {
    const res = await apiClient.get('/adp/banks');
    return res.data?.banks ?? [];
  },
  verifyBank: async (accountNumber: string, bankCode: string) => {
    const res = await apiClient.post('/adp/verify-bank', { accountNumber, bankCode });
    return res.data;
  },
  getUploadUrl: async (fileName: string) => {
    const res = await apiClient.get('/adp/upload-url', { params: { fileName } });
    return res.data;
  },
  uploadDocumentDirectly: async (signedUrl: string, file: File) => {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Failed to upload document to secure storage: ${response.statusText}`);
    }
    return true;
  },
  submitApplication: async (payload: AdpApplicationPayload) => {
    const res = await apiClient.post('/adp/apply', payload);
    return res.data;
  },
  getMyApplications: async () => {
    const res = await apiClient.get('/adp/my-applications');
    return res.data?.data ?? [];
  },
  getOperatorDashboard: async () => {
    const res = await apiClient.get('/adp/my/dashboard');
    return res.data?.data;
  },
  requestBankChange: async (payload: { bankName: string; bankCode: string; accountNumber: string; accountName: string }) => {
    const res = await apiClient.post('/adp/my/bank/change-request', payload);
    return res.data;
  },
  confirmCollection: async (orderId: string) => {
    const res = await apiClient.patch(`/adp/my/orders/${orderId}/confirm-collection`);
    return res.data;
  },
};

export const ordersApi = {
  getMyOrders: async () => {
    const res = await apiClient.get('/orders/me');
    return res.data?.orders ?? [];
  },
  trackOrder: async (reference: string) => {
    const res = await apiClient.get(`/orders/track/${reference}`);
    return res.data;
  },
  walletCheckout: async (payload: {
    totalAmountCents: number;
    name?: string;
    phone?: string;
    address?: string;
    location?: string;
    isExpress?: boolean;
    items?: Array<{ productId?: string; name: string; quantity: number; priceCents: number }>;
    adpOperatorId?: string;
  }) => {
    const res = await apiClient.post('/orders/wallet-checkout', payload);
    return res.data;
  },
};

export const deliveryApi = {
  getDeliveryFee: async () => {
    const res = await apiClient.get('/delivery-fee');
    return res.data;
  },
};


