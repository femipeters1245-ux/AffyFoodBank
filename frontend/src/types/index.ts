// frontend/src/types/index.ts

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  roleId?: string | null;
  role?: string | null;
}

export interface Unit {
  id: string;
  name: string;
  symbol?: string | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Inventory {
  id: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  priceCents: number; // in NGN cents (kobo)
  currency: string;
  unitId?: string | null;
  categoryId?: string | null;
  isActive: boolean;
  unit?: Unit | null;
  category?: Category | null;
  inventory?: Inventory | null;
}

export interface PackageItem {
  id: string;
  packageId: string;
  productId: string;
  quantity: number;
  unitId: string;
  product?: Product;
  unit?: Unit;
}

export interface Package {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  items?: PackageItem[];
}

export interface Wallet {
  id: string;
  customerProfileId: string;
  totalBalanceCents: number;
  allocatedToSavingsCents: number;
  currency: string;
  status: string;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SAVINGS_ALLOCATION'
  | 'SAVINGS_RELEASE'
  | 'PURCHASE'
  | 'REFUND'
  | 'ADJUSTMENT';

export type TransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';

export interface WalletTransaction {
  id: string;
  walletId: string;
  customerId: string;
  reference: string;
  type: TransactionType;
  amountCents: number;
  currency: string;
  direction: 'IN' | 'OUT';
  status: TransactionStatus;
  description?: string | null;
  createdAt: string;
}

export interface SavingsPlanItem {
  id: string;
  savingsPlanId: string;
  productId: string;
  quantity: number;
  unitId: string;
  product?: Product;
  unit?: Unit;
}

export interface SavingsContribution {
  id: string;
  savingsPlanId: string;
  walletTransactionId: string;
  amountCents: number;
  createdAt: string;
}

export interface SavingsPlan {
  id: string;
  customerProfileId: string;
  name: string;
  description?: string | null;
  targetAmountCents: number;
  amountSavedCents: number;
  targetDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'TARGET_REACHED' | 'PURCHASE_CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  items?: SavingsPlanItem[];
  contributions?: SavingsContribution[];
}

export interface AuthResponse {
  token: string;
  refreshToken?: string | null;
  user: User;
}
