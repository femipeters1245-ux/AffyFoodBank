// frontend/src/pages/AdminDashboardPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { AffyLogo } from '../components/AffyLogo';
import { adminApi } from '../services/api';
import {
  supabaseProducts,
  supabaseCategories,
  supabaseUnits,
  supabasePackages,
  SupabaseProduct,
  SupabaseCategory,
  SupabaseUnit,
  SupabasePackage,
} from '../lib/supabase';

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id?: string;
  stock: number;
  unit: string;
  unit_id?: string;
  priceCents: number;
  imageUrl: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

// Helper: map Supabase product to AdminProduct
function mapToAdminProduct(p: SupabaseProduct): AdminProduct {
  const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
  const qty = inv ? Number(inv.quantity) : 0;
  const threshold = inv ? Number(inv.low_stock_threshold) : 20;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    category: p.category?.name ?? 'Uncategorised',
    category_id: p.category_id ?? undefined,
    stock: qty,
    unit: p.unit?.name ?? 'unit',
    unit_id: p.unit_id ?? undefined,
    priceCents: p.price_cents,
    imageUrl: p.image_url ?? '',
    status: qty <= 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock',
  };
}

export interface CustomerKYC {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  bvnOrNinMasked: string;
  kycStatus: 'VERIFIED' | 'PENDING' | 'FLAGGED';
  kycTier: string;
  walletBalanceCents: number;
  ordersCount: number;
  registeredDate: string;
}

export interface AdminOrder {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  state: string;
  itemsSummary: string;
  totalAmountCents: number;
  paymentChannel: 'Online' | 'TransactPay' | 'Wallet';
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  deliveryStatus: 'PENDING' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  assignedRider: string;
  riderPhone: string;
  notes: string;
  createdAt: string;
}

export interface DeliveryFeeSettings {
  standardFeeNaira: number;
  freeDeliveryThresholdNaira: number;
  expressFeeNaira: number;
  stateFeesNaira: Record<string, number>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TransactionRecord {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  channel: string;
  type: 'FOODSTUFF_PURCHASE' | 'WALLET_TOPUP' | 'SAVINGS_CONTRIBUTION' | 'REFUND';
  amountCents: number;
  direction: 'IN' | 'OUT';
  status: 'SUCCESSFUL' | 'PENDING' | 'FAILED';
  date: string;
}

// Initial rich inventory with live photography
const INITIAL_PRODUCTS: AdminProduct[] = [
  {
    id: 'prod-001',
    name: 'Premium Royal Stallion Rice (50kg Bag)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice.',
    category: 'Grains & Flours',
    stock: 140,
    unit: '50kg Bag',
    priceCents: 7500000,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-002',
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans.',
    category: 'Grains & Flours',
    stock: 85,
    unit: '50kg Bag',
    priceCents: 9800000,
    imageUrl: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-003',
    name: 'Original Ijebu White Garri (Paint Rubber / 4kg)',
    description: 'Crisp, very dry, sand-free with authentic tangy Ijebu punch.',
    category: 'Grains & Flours',
    stock: 320,
    unit: 'Paint Rubber',
    priceCents: 450000,
    imageUrl: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-004',
    name: 'Pure Unadulterated Palm Oil (25L Yellow Keg)',
    description: 'Fresh thick red oil directly from Edo State farm mills.',
    category: 'Oils & Fats',
    stock: 14,
    unit: '25L Keg',
    priceCents: 3800000,
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    status: 'Low Stock',
  },
  {
    id: 'prod-005',
    name: 'Benue Giant White Yam (Set of 5 Huge Tubers)',
    description: 'High-starch, heavy mature Benue tubers.',
    category: 'Tubers & Roots',
    stock: 65,
    unit: 'Bundle (5 Tubers)',
    priceCents: 1650000,
    imageUrl: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-006',
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Machine-sorted, fat, high-oil yield peeled melon seeds.',
    category: 'Soup Ingredients',
    stock: 60,
    unit: 'Paint Rubber',
    priceCents: 950000,
    imageUrl: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-007',
    name: 'Refined Vegetable Cooking Oil (25L Keg)',
    description: 'Pure, triple-filtered cholesterol-free vegetable oil.',
    category: 'Oils & Fats',
    stock: 8,
    unit: '25L Keg',
    priceCents: 5200000,
    imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=80',
    status: 'Low Stock',
  },
  {
    id: 'prod-008',
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried Oron crayfish combined with 5 large smoked catfish.',
    category: 'Soup Ingredients',
    stock: 35,
    unit: 'Bundle Pack',
    priceCents: 1200000,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    status: 'In Stock',
  },
];

const INITIAL_CUSTOMERS: CustomerKYC[] = [
  {
    id: 'cust-101',
    name: 'Adebayo Ogunlesi',
    email: 'customer@affyfoodbank.ng',
    phone: '0803 234 5678',
    address: 'Block 4, Flat 12, 1004 Estate, Victoria Island',
    state: 'Lagos',
    bvnOrNinMasked: 'NIN: 6819 •••• 4120',
    kycStatus: 'VERIFIED',
    kycTier: 'Tier 2 (Full Verified)',
    walletBalanceCents: 15000000,
    ordersCount: 4,
    registeredDate: '2026-09-15',
  },
  {
    id: 'cust-102',
    name: 'Chioma Okeke',
    email: 'chioma.caterers@gmail.com',
    phone: '0812 456 7890',
    address: 'Plot 18, Commercial Ave, Sabo, Yaba',
    state: 'Lagos',
    bvnOrNinMasked: 'BVN: 2214 •••• 8901',
    kycStatus: 'VERIFIED',
    kycTier: 'Tier 2 (Commercial)',
    walletBalanceCents: 42000000,
    ordersCount: 9,
    registeredDate: '2026-09-22',
  },
  {
    id: 'cust-103',
    name: 'Ibrahim Danjuma',
    email: 'ibrahim.d@yahoo.com',
    phone: '0705 678 1234',
    address: 'Suite 2B, Gwarinpa Plaza, 3rd Avenue',
    state: 'Abuja',
    bvnOrNinMasked: 'NIN: 4402 •••• 7189',
    kycStatus: 'PENDING',
    kycTier: 'Tier 1 (Basic)',
    walletBalanceCents: 6500000,
    ordersCount: 1,
    registeredDate: '2026-10-02',
  },
  {
    id: 'cust-104',
    name: 'Blessing Adeyemi',
    email: 'blessing.adeyemi@outlook.com',
    phone: '0809 111 2233',
    address: '14 Bodija Market Road',
    state: 'Oyo (Ibadan)',
    bvnOrNinMasked: 'BVN: 2228 •••• 1045',
    kycStatus: 'VERIFIED',
    kycTier: 'Tier 2 (Full Verified)',
    walletBalanceCents: 2100000,
    ordersCount: 3,
    registeredDate: '2026-10-06',
  },
];

const INITIAL_ORDERS: AdminOrder[] = [
  {
    id: 'ord-501',
    reference: 'TP_1791681333019_cb355f54',
    customerName: 'Adebayo Ogunlesi',
    customerPhone: '0803 234 5678',
    deliveryAddress: 'Block 4, Flat 12, 1004 Estate, Victoria Island',
    state: 'Lagos',
    itemsSummary: '1x Royal Stallion Rice (50kg), 2x Palm Oil (25L)',
    totalAmountCents: 15100000,
    paymentChannel: 'TransactPay',
    paymentStatus: 'PAID',
    deliveryStatus: 'PROCESSING',
    assignedRider: 'Musa Ibrahim (Dispatch Bike 04)',
    riderPhone: '0802 888 1234',
    notes: 'Fragile seal checked. Call gate security upon arrival.',
    createdAt: '2026-10-11 01:45',
  },
  {
    id: 'ord-502',
    reference: 'TP_REF_1791679901_842',
    customerName: 'Chioma Okeke',
    customerPhone: '0812 456 7890',
    deliveryAddress: 'Plot 18, Commercial Ave, Sabo, Yaba',
    state: 'Lagos',
    itemsSummary: '3x Honey Oloyin Beans (50kg), 5x Ijebu Garri (4kg)',
    totalAmountCents: 31650000,
    paymentChannel: 'TransactPay',
    paymentStatus: 'PAID',
    deliveryStatus: 'DISPATCHED',
    assignedRider: 'Emeka Nwosu (Affy Van 02)',
    riderPhone: '0813 777 9900',
    notes: 'Out for morning delivery. Priority bulk catering delivery.',
    createdAt: '2026-10-10 18:20',
  },
  {
    id: 'ord-503',
    reference: 'WLT_ORD_1791675200',
    customerName: 'Blessing Adeyemi',
    customerPhone: '0809 111 2233',
    deliveryAddress: '14 Bodija Market Road',
    state: 'Oyo (Ibadan)',
    itemsSummary: '2x Benue Giant Yam (Bundle 5), 1x Egusi Melon (Rubber)',
    totalAmountCents: 4250000,
    paymentChannel: 'Wallet',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    assignedRider: 'Suleiman Alabi (Ibadan Hub)',
    riderPhone: '0805 222 3344',
    notes: 'Recipient signed and received at warehouse depot.',
    createdAt: '2026-10-09 14:10',
  },
];

const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-901',
    reference: 'TP_1791681333019_cb355f54',
    customerName: 'Adebayo Ogunlesi',
    customerEmail: 'customer@affyfoodbank.ng',
    channel: 'TransactPay Gateway (Card/USSD)',
    type: 'FOODSTUFF_PURCHASE',
    amountCents: 15100000,
    direction: 'IN',
    status: 'SUCCESSFUL',
    date: '2026-10-11 01:45',
  },
  {
    id: 'tx-902',
    reference: 'TP_REF_1791679901_842',
    customerName: 'Chioma Okeke',
    customerEmail: 'chioma.caterers@gmail.com',
    channel: 'TransactPay Virtual Account (Wema Bank)',
    type: 'FOODSTUFF_PURCHASE',
    amountCents: 31650000,
    direction: 'IN',
    status: 'SUCCESSFUL',
    date: '2026-10-10 18:20',
  },
  {
    id: 'tx-903',
    reference: 'WLT_ORD_1791675200',
    customerName: 'Blessing Adeyemi',
    customerEmail: 'blessing.adeyemi@outlook.com',
    channel: 'Affy Digital Wallet Ledger',
    type: 'FOODSTUFF_PURCHASE',
    amountCents: 4250000,
    direction: 'IN',
    status: 'SUCCESSFUL',
    date: '2026-10-09 14:10',
  },
  {
    id: 'tx-904',
    reference: 'SAV_DEP_1791671100',
    customerName: 'Ibrahim Danjuma',
    customerEmail: 'ibrahim.d@yahoo.com',
    channel: 'TransactPay Auto-Debit',
    type: 'SAVINGS_CONTRIBUTION',
    amountCents: 2000000,
    direction: 'IN',
    status: 'SUCCESSFUL',
    date: '2026-10-08 09:30',
  },
  {
    id: 'tx-905',
    reference: 'WLT_TOP_1791669000',
    customerName: 'Adebayo Ogunlesi',
    customerEmail: 'customer@affyfoodbank.ng',
    channel: 'TransactPay Card Payment (Mastercard)',
    type: 'WALLET_TOPUP',
    amountCents: 5000000,
    direction: 'IN',
    status: 'SUCCESSFUL',
    date: '2026-10-07 16:45',
  },
];

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const roleLower = (user?.role || '').toLowerCase();
  const isAdminOrSuperAdmin =
    roleLower === 'admin' ||
    roleLower === 'superadmin' ||
    user?.email?.toLowerCase() === 'affybrand@gmail.com' ||
    user?.email?.toLowerCase() === 'admin@affyfoodbank.ng';
  const isFinanceStaff = roleLower === 'financestaff';
  const isLogisticsStaff = roleLower === 'logisticsstaff';

  const isAdminOrStaff =
    isAdminOrSuperAdmin ||
    isFinanceStaff ||
    isLogisticsStaff;

  const defaultTab: 'inventory' | 'bundles' | 'kyc' | 'deliveries' | 'delivery-fee' | 'transactions' | 'overview' | 'adp-zones' | 'adp-applications' | 'adp-earnings' =
    isFinanceStaff ? 'transactions' : isLogisticsStaff ? 'deliveries' : 'overview';
  const [activeTab, setActiveTab] = useState<'inventory' | 'bundles' | 'kyc' | 'deliveries' | 'delivery-fee' | 'transactions' | 'overview' | 'adp-zones' | 'adp-applications' | 'adp-earnings'>(defaultTab);

  // ─── Products state — sourced exclusively from Supabase ──────────────────────
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<SupabaseCategory[]>([]);
  const [units, setUnits] = useState<SupabaseUnit[]>([]);

  // ─── Food Bundles & Packages state — sourced from Supabase ───────────────────
  const [packages, setPackages] = useState<SupabasePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SupabasePackage | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);
  // Draft items list inside the editor — each entry links to an inventory product
  const [draftItems, setDraftItems] = useState<Array<{
    productId: string;
    name: string;
    priceCents: number;
    quantity: number;
  }>>([]);
  const [itemSearch, setItemSearch] = useState('');

  const [customers, setCustomers] = useState<CustomerKYC[]>(INITIAL_CUSTOMERS);
  const [orders, setOrders] = useState<AdminOrder[]>(INITIAL_ORDERS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);
  const [stats, setStats] = useState<{
    totalProducts: number;
    totalCustomers: number;
    totalOrders: number;
    lowStockItems: number;
    totalCustFundsCents: number;
  } | null>(null);

  // ─── TransactPay Dedicated Funding Events Oversight ─────────────────────────
  const [fundingEvents, setFundingEvents] = useState<any[]>([]);
  const [fundingEventsLoading, setFundingEventsLoading] = useState(false);
  const [fundingFilter, setFundingFilter] = useState<'ALL' | 'NEEDS_REVIEW'>('ALL');
  const [reverifyingSessionId, setReverifyingSessionId] = useState<string | null>(null);

  const loadFundingEvents = useCallback(async (needsReview = false) => {
    try {
      setFundingEventsLoading(true);
      const res = await adminApi.getFundingEvents({ needsReview });
      if (res?.events) {
        setFundingEvents(res.events);
      }
    } catch (e) {
      console.warn('[Admin] Could not load funding events:', e);
    } finally {
      setFundingEventsLoading(false);
    }
  }, []);

  const handleReverify = async (sessionId: string) => {
    try {
      setReverifyingSessionId(sessionId);
      const res = await adminApi.reverifyFundingEvent(sessionId);
      alert(`Re-verification result: ${res.status} - ${res.message}`);
      loadFundingEvents(fundingFilter === 'NEEDS_REVIEW');
    } catch (err: any) {
      alert(`Re-verification error: ${err.response?.data?.message || err.message}`);
    } finally {
      setReverifyingSessionId(null);
    }
  };

  // ─── UNILESA Coverage Zones & ADP Network (Milestones 1 & 5) ────────────────
  const [zones, setZones] = useState<any[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneTarget, setNewZoneTarget] = useState(2);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [seedingZones, setSeedingZones] = useState(false);
  const [zoneSearchQuery, setZoneSearchQuery] = useState('');

  const loadZones = useCallback(async () => {
    try {
      setZonesLoading(true);
      const data = await adminApi.getZones();
      if (Array.isArray(data)) {
        setZones(data);
      }
    } catch (err: any) {
      console.warn('[Admin] Could not load coverage zones:', err);
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      setIsCreatingZone(true);
      await adminApi.createZone({ name: newZoneName.trim(), targetAdpCount: Number(newZoneTarget) || 2 });
      showToast(`✓ Zone "${newZoneName.trim()}" created successfully`);
      setNewZoneName('');
      setNewZoneTarget(2);
      await loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to create zone');
    } finally {
      setIsCreatingZone(false);
    }
  };

  const handleToggleZone = async (zone: any) => {
    const nextState = !zone.isActive;
    try {
      await adminApi.toggleZone(zone.id, nextState);
      showToast(`✓ Zone "${zone.name}" ${nextState ? 'activated' : 'deactivated'}`);
      await loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update zone status');
    }
  };

  const handleUpdateZoneTarget = async (zone: any, newTarget: number) => {
    if (newTarget < 1) return;
    try {
      await adminApi.updateZoneTarget(zone.id, newTarget);
      showToast(`✓ Target for "${zone.name}" updated to ${newTarget}`);
      await loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to update target count');
    }
  };

  const handleSeedZones = async () => {
    if (!confirm('Seed or refresh the 13 official UNILESA coverage zones? This is idempotent and will not delete any existing records.')) return;
    try {
      setSeedingZones(true);
      const res = await adminApi.seedZones();
      showToast(`✓ ${res.message || 'Successfully seeded official 13 zones'}`);
      await loadZones();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to seed zones');
    } finally {
      setSeedingZones(false);
    }
  };

  // ─── ADP Operator Applications Oversight ───────────────────────────────────
  const [adpApplications, setAdpApplications] = useState<any[]>([]);
  const [adpLoading, setAdpLoading] = useState(false);
  const [adpFilterStatus, setAdpFilterStatus] = useState<string>('ALL');
  const [adpFilterZone, setAdpFilterZone] = useState<string>('ALL');
  const [adpSearchQuery, setAdpSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [selectedDocUrl, setSelectedDocUrl] = useState<string | null>(null);
  const [loadingDocUrl, setLoadingDocUrl] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const loadAdpApplications = useCallback(async () => {
    try {
      setAdpLoading(true);
      const params: any = {};
      if (adpFilterZone !== 'ALL') params.zoneId = adpFilterZone;
      if (adpFilterStatus !== 'ALL') params.status = adpFilterStatus;
      if (adpSearchQuery.trim()) params.search = adpSearchQuery.trim();
      const apps = await adminApi.listAdpApplications(params);
      setAdpApplications(apps || []);
    } catch (e) {
      console.warn('[Admin] Could not load ADP applications:', e);
    } finally {
      setAdpLoading(false);
    }
  }, [adpFilterZone, adpFilterStatus, adpSearchQuery]);

  const handleOpenAppDetails = async (app: any) => {
    setSelectedApp(app);
    setSelectedDocUrl(null);
    setVerificationNotes('');
    try {
      setLoadingDocUrl(true);
      const url = await adminApi.getAdpDocumentUrl(app.id);
      setSelectedDocUrl(url);
    } catch (e) {
      console.warn('Could not load doc URL:', e);
    } finally {
      setLoadingDocUrl(false);
    }
  };

  const handleVerifyTrack = async (track: 'STUDENT' | 'HOSTEL' | 'PAYMENT', status: string) => {
    if (!selectedApp) return;
    try {
      setIsVerifying(true);
      const updated = await adminApi.verifyAdpTrack(selectedApp.id, {
        track,
        status,
        notes: verificationNotes.trim() || undefined,
      });
      setSelectedApp(updated);
      showToast(`✓ ${track} track updated to ${status}`);
      await loadAdpApplications();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Verification update failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApproveOperator = async () => {
    if (!selectedApp) return;
    if (
      selectedApp.studentVerificationStatus !== 'APPROVED' ||
      selectedApp.hostelVerificationStatus !== 'APPROVED' ||
      selectedApp.paymentVerificationStatus !== 'APPROVED'
    ) {
      alert('All three tracks (Student, Hostel, Payment) must be approved before activating the delivery port.');
      return;
    }
    if (!confirm(`Activate ${selectedApp.fullName} as an official ADP operator for ${selectedApp.coverageZone?.name || 'their zone'}?`)) return;
    try {
      setIsVerifying(true);
      const updated = await adminApi.approveAdpOperator(selectedApp.id, verificationNotes.trim() || undefined);
      setSelectedApp(updated);
      showToast(`✓ ${selectedApp.fullName} is now an ACTIVE ADP Operator!`);
      await loadAdpApplications();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Approval failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSuspendOperator = async () => {
    if (!selectedApp || !suspensionReasonInput.trim()) {
      alert('Please provide a reason for suspension.');
      return;
    }
    try {
      setIsVerifying(true);
      const updated = await adminApi.suspendAdpOperator(selectedApp.id, suspensionReasonInput.trim());
      setSelectedApp(updated);
      setShowSuspendModal(false);
      setSuspensionReasonInput('');
      showToast(`✓ Operator ${selectedApp.fullName} suspended`);
      await loadAdpApplications();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Suspension failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBlockOperator = async () => {
    if (!selectedApp || !suspensionReasonInput.trim()) {
      alert('Please provide a reason for blocking.');
      return;
    }
    try {
      setIsVerifying(true);
      const updated = await adminApi.blockAdpOperator(selectedApp.id, suspensionReasonInput.trim());
      setSelectedApp(updated);
      setShowBlockModal(false);
      setSuspensionReasonInput('');
      showToast(`✓ Operator ${selectedApp.fullName} blocked`);
      await loadAdpApplications();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Blocking failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // ─── ADP Rates & Earnings Oversight (Milestone 7) ───────────────────────────
  const [adpRates, setAdpRates] = useState<any[]>([]);
  const [adpRatesLoading, setAdpRatesLoading] = useState(false);
  const [newRateNaira, setNewRateNaira] = useState<number>(300); // ₦300 default per collection
  const [newRateZoneId, setNewRateZoneId] = useState<string>('GLOBAL');
  const [savingRate, setSavingRate] = useState(false);

  const [adpEarnings, setAdpEarnings] = useState<any[]>([]);
  const [adpEarningsLoading, setAdpEarningsLoading] = useState(false);
  const [adpEarningFilterStatus, setAdpEarningFilterStatus] = useState<string>('ALL');
  const [selectedEarningIds, setSelectedEarningIds] = useState<string[]>([]);
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  const loadAdpRates = useCallback(async () => {
    try {
      setAdpRatesLoading(true);
      const rates = await adminApi.listAdpRates();
      setAdpRates(rates || []);
    } catch (e) {
      console.warn('[Admin] Could not load compensation rates:', e);
    } finally {
      setAdpRatesLoading(false);
    }
  }, []);

  const handleSaveAdpRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRateNaira || newRateNaira <= 0) {
      alert('Please enter a valid rate in Naira');
      return;
    }
    try {
      setSavingRate(true);
      const rateCents = Math.round(newRateNaira * 100);
      await adminApi.setAdpRate({
        coverageZoneId: newRateZoneId === 'GLOBAL' ? null : newRateZoneId,
        ratePerCollectionCents: rateCents,
      });
      showToast(`✓ Compensation rate set to ₦${newRateNaira.toLocaleString()} per completed collection`);
      await loadAdpRates();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to set rate');
    } finally {
      setSavingRate(false);
    }
  };

  const loadAdpEarnings = useCallback(async () => {
    try {
      setAdpEarningsLoading(true);
      const params: any = {};
      if (adpEarningFilterStatus !== 'ALL') params.status = adpEarningFilterStatus;
      const data = await adminApi.listAdpEarnings(params);
      setAdpEarnings(data || []);
    } catch (e) {
      console.warn('[Admin] Could not load earnings:', e);
    } finally {
      setAdpEarningsLoading(false);
    }
  }, [adpEarningFilterStatus]);

  const handleBatchPayout = async (operatorId: string, channel: 'TRANSACTPAY' | 'MANUAL') => {
    const unbatchedForOperator = adpEarnings.filter(
      (e) => e.adpOperatorId === operatorId && (e.status === 'PENDING' || e.status === 'APPROVED') && !e.payoutBatchId
    );
    if (unbatchedForOperator.length === 0) {
      alert('No unbatched earnings available for this operator.');
      return;
    }
    const totalNaira = unbatchedForOperator.reduce((sum, e) => sum + Number(e.amountCents || 0), 0) / 100;
    if (!confirm(`Initiate payout of ₦${totalNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })} to ${unbatchedForOperator[0]?.adpOperator?.fullName} via ${channel}?`)) return;

    try {
      setIsProcessingPayout(true);
      const batch = await adminApi.createAdpPayoutBatch({
        operatorId,
        earningIds: unbatchedForOperator.map((e) => e.id),
        channel,
      });
      await adminApi.executeAdpPayoutBatch(batch.id);
      showToast(`✓ Payout batch initiated for ${unbatchedForOperator[0]?.adpOperator?.fullName}!`);
      await loadAdpEarnings();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Payout initiation failed');
    } finally {
      setIsProcessingPayout(false);
    }
  };

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const [data, cats, unitList, customerList, orderList, txList, statsData] = await Promise.all([
        supabaseProducts.listAll(),
        supabaseCategories.list(),
        supabaseUnits.list(),
        adminApi.getCustomers().catch(() => null),
        adminApi.getOrders().catch(() => null),
        adminApi.getTransactions().catch(() => null),
        adminApi.getStats().catch(() => null),
      ]);
      setProducts(data.map(mapToAdminProduct));
      setCategories(cats);
      setUnits(unitList);
      if (Array.isArray(customerList) && customerList.length > 0) {
        setCustomers(customerList);
      }
      if (Array.isArray(orderList) && orderList.length > 0) {
        setOrders(orderList);
      }
      if (Array.isArray(txList) && txList.length > 0) {
        setTransactions(txList);
      }
      if (statsData) {
        setStats(statsData);
      }
    } catch (err: any) {
      console.error('[Admin] Failed to load dashboard data:', err);
      setProductsError('Failed to load products from system inventory engine.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      setPackagesLoading(true);
      const pkgs = await supabasePackages.listAll();
      setPackages(pkgs);
    } catch (err: any) {
      console.error('[Admin] Failed to load packages:', err);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadPackages();

    const handleInventoryChange = () => {
      loadProducts();
    };
    const handlePackagesChange = () => {
      loadPackages();
    };
    window.addEventListener('affy_inventory_updated', handleInventoryChange);
    window.addEventListener('affy_packages_updated', handlePackagesChange);
    return () => {
      window.removeEventListener('affy_inventory_updated', handleInventoryChange);
      window.removeEventListener('affy_packages_updated', handlePackagesChange);
    };
  }, [loadProducts, loadPackages]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadFundingEvents(fundingFilter === 'NEEDS_REVIEW');
    }
  }, [activeTab, fundingFilter, loadFundingEvents]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  useEffect(() => {
    if (activeTab === 'adp-zones') {
      loadZones();
    }
  }, [activeTab, loadZones]);

  useEffect(() => {
    if (activeTab === 'adp-applications') {
      loadAdpApplications();
    }
  }, [activeTab, loadAdpApplications]);

  useEffect(() => {
    if (activeTab === 'adp-earnings') {
      loadAdpRates();
      loadAdpEarnings();
    }
  }, [activeTab, loadAdpRates, loadAdpEarnings]);

  // Delivery fee configuration state (Staff & Admin can configure delivery rates for Ilesa, Osun State)
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryFeeSettings>(() => {
    try {
      const saved = localStorage.getItem('affy_delivery_fee_config');
      if (saved) {
        const p = JSON.parse(saved);
        return {
          standardFeeNaira: (p.standardFeeCents ?? 150000) / 100,
          freeDeliveryThresholdNaira: (p.freeDeliveryThresholdCents ?? 5000000) / 100,
          expressFeeNaira: (p.expressFeeCents ?? 250000) / 100,
          stateFeesNaira: {
            'Ilesa Central (Roundabout, Isokun, Imo)': (p.stateFees?.['Ilesa Central (Roundabout, Isokun, Imo)'] ?? 120000) / 100,
            'Ilesa West (Breweries, Omi Aladiye, Ereja)': (p.stateFees?.['Ilesa West (Breweries, Omi Aladiye, Ereja)'] ?? 150000) / 100,
            'Ilesa East (Grammar School, Bolorunduro, Irojo)': (p.stateFees?.['Ilesa East (Grammar School, Bolorunduro, Irojo)'] ?? 150000) / 100,
            'Ijebu-Jesa / Oriade': (p.stateFees?.['Ijebu-Jesa / Oriade'] ?? 200000) / 100,
            'Ipetu-Ijesha': (p.stateFees?.['Ipetu-Ijesha'] ?? 250000) / 100,
            'Ibokun / Obokun': (p.stateFees?.['Ibokun / Obokun'] ?? 220000) / 100,
            'Osogbo (State Capital)': (p.stateFees?.['Osogbo (State Capital)'] ?? 300000) / 100,
            'Ile-Ife (Campus & Town)': (p.stateFees?.['Ile-Ife (Campus & Town)'] ?? 300000) / 100,
            'Other Osun State Locations': (p.stateFees?.['Other Osun State Locations'] ?? 350000) / 100,
            Default: (p.stateFees?.Default ?? 150000) / 100,
          },
          updatedAt: p.updatedAt,
          updatedBy: p.updatedBy,
        };
      }
    } catch {}
    return {
      standardFeeNaira: 1500,
      freeDeliveryThresholdNaira: 50000,
      expressFeeNaira: 2500,
      stateFeesNaira: {
        'Ilesa Central (Roundabout, Isokun, Imo)': 1200,
        'Ilesa West (Breweries, Omi Aladiye, Ereja)': 1500,
        'Ilesa East (Grammar School, Bolorunduro, Irojo)': 1500,
        'Ijebu-Jesa / Oriade': 2000,
        'Ipetu-Ijesha': 2500,
        'Ibokun / Obokun': 2200,
        'Osogbo (State Capital)': 3000,
        'Ile-Ife (Campus & Town)': 3000,
        'Other Osun State Locations': 3500,
        Default: 1500,
      },
    };
  });

  const [savingDeliveryFee, setSavingDeliveryFee] = useState(false);

  // Sync delivery config from backend
  useEffect(() => {
    adminApi.getDeliveryFee()
      .then((res: any) => {
        if (res && typeof res.standardFeeCents === 'number') {
          const loadedStateFees: Record<string, number> = {};
          if (res.stateFees && typeof res.stateFees === 'object') {
            for (const [k, v] of Object.entries(res.stateFees)) {
              loadedStateFees[k] = Number(v) / 100;
            }
          }
          const loaded: DeliveryFeeSettings = {
            standardFeeNaira: res.standardFeeCents / 100,
            freeDeliveryThresholdNaira: (res.freeDeliveryThresholdCents ?? 5000000) / 100,
            expressFeeNaira: (res.expressFeeCents ?? 250000) / 100,
            stateFeesNaira: Object.keys(loadedStateFees).length > 0 ? loadedStateFees : deliveryConfig.stateFeesNaira,
            updatedAt: res.updatedAt,
            updatedBy: res.updatedBy,
          };
          setDeliveryConfig(loaded);
          localStorage.setItem('affy_delivery_fee_config', JSON.stringify({
            standardFeeCents: res.standardFeeCents,
            freeDeliveryThresholdCents: res.freeDeliveryThresholdCents,
            expressFeeCents: res.expressFeeCents,
            stateFees: res.stateFees,
            updatedAt: res.updatedAt,
            updatedBy: res.updatedBy,
          }));
        }
      })
      .catch((err) => {
        console.warn('Error fetching live delivery fees:', err);
      });
  }, []);

  const handleSaveDeliveryConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const standard = Number(deliveryConfig.standardFeeNaira);
    const threshold = Number(deliveryConfig.freeDeliveryThresholdNaira);
    const express = Number(deliveryConfig.expressFeeNaira);

    if (isNaN(standard) || standard < 0 || standard > 500000) {
      showToast('⚠️ Standard fee must be a non-negative number up to ₦500,000');
      return;
    }
    if (isNaN(threshold) || threshold < 0 || threshold > 5000000) {
      showToast('⚠️ Free delivery threshold must be a non-negative number up to ₦5,000,000');
      return;
    }
    if (isNaN(express) || express < 0 || express > 500000) {
      showToast('⚠️ Express fee must be a non-negative number up to ₦500,000');
      return;
    }

    setSavingDeliveryFee(true);
    const payload = {
      standardFeeCents: Math.round(standard * 100),
      freeDeliveryThresholdCents: Math.round(threshold * 100),
      expressFeeCents: Math.round(express * 100),
      stateFees: Object.entries(deliveryConfig.stateFeesNaira).reduce((acc, [k, v]) => {
        const val = Number(v);
        acc[k] = Math.round((isNaN(val) || val < 0 ? 0 : val) * 100);
        return acc;
      }, {} as Record<string, number>),
    };

    try {
      const res = await adminApi.updateDeliveryFee(payload);
      const confirmedConfig = res?.config || payload;

      // Update local storage and dispatch update event only after DB write succeeds
      localStorage.setItem('affy_delivery_fee_config', JSON.stringify(confirmedConfig));
      window.dispatchEvent(new Event('affy_delivery_fee_updated'));

      if (res?.config?.updatedAt) {
        setDeliveryConfig(prev => ({
          ...prev,
          updatedAt: res.config.updatedAt,
          updatedBy: res.config.updatedBy || prev.updatedBy,
        }));
      }

      showToast('✅ Delivery rates saved to Supabase and deployed to customer checkout!');
    } catch (err: any) {
      console.error('Failed to save delivery fees to database:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to save delivery fees';
      showToast(`❌ Error saving fees: ${errMsg}`);
    } finally {
      setSavingDeliveryFee(false);
    }
  };

  // Modal states
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Handle Editing Price, Stock, Image & Product Details → persists to Supabase
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);

    const edited = { ...editingProduct };

    try {
      // Resolve the unit name the user typed to a real Unit row in Supabase.
      // This is the fix for the Unit Scale bug: previously unit_id was never updated
      // because the typed name was never resolved — only the old unit_id was sent.
      let resolvedUnitId = edited.unit_id;
      if (edited.unit && edited.unit.trim()) {
        const resolvedUnit = await supabaseUnits.findOrCreate(edited.unit.trim());
        resolvedUnitId = resolvedUnit.id;
      }

      const result = await supabaseProducts.update(edited.id, {
        name: edited.name,
        description: edited.description,
        price_cents: Number(edited.priceCents),
        image_url: edited.imageUrl,
        stock: Number(edited.stock),
        category_id: edited.category_id,
        unit_id: resolvedUnitId,
        unit: edited.unit,
      });

      if (!result) {
        throw new Error('No data returned from server after update');
      }

      // Reload admin table from Supabase so we see the confirmed persisted values
      await loadProducts();
      await loadPackages(); // Refresh bundle totals to reflect new prices
      setEditingProduct(null);
      showToast(`✅ Updated "${edited.name}" — live on marketplace!`);
    } catch (err: any) {
      showToast(`❌ Update failed: ${err.message ?? 'Unknown error'}`);
    } finally {
      setSavingProduct(false);
    }
  };

  // Quick Restock (+20 or +50) → persists to Supabase
  const handleQuickRestock = async (id: string, amount: number) => {
    try {
      await supabaseProducts.restock(id, amount);
      await loadProducts();
      showToast(`📦 +${amount} units added — inventory synced to marketplace!`);
    } catch (err: any) {
      showToast(`❌ Restock failed: ${err.message ?? 'Unknown error'}`);
    }
  };

  // Add New Product → persists to Supabase
  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProduct(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const categoryName = formData.get('category') as string;
    const unitName = formData.get('unit') as string;
    const priceNaira = Number(formData.get('priceNaira'));
    const stock = Number(formData.get('stock'));
    const imageUrl = (formData.get('imageUrl') as string) ||
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80';
    const description = formData.get('description') as string;

    try {
      // Find or create category and unit in Supabase
      const [cat, unit] = await Promise.all([
        supabaseCategories.findOrCreate(categoryName),
        supabaseUnits.findOrCreate(unitName),
      ]);

      await supabaseProducts.create({
        name,
        description,
        price_cents: Math.round(priceNaira * 100),
        image_url: imageUrl,
        category_id: cat.id,
        unit_id: unit.id,
        stock,
      });

      await loadProducts();
      setIsNewProductOpen(false);
      showToast(`✅ "${name}" created and live on marketplace!`);
    } catch (err: any) {
      showToast(`❌ Create failed: ${err.message ?? 'Unknown error'}`);
    } finally {
      setSavingProduct(false);
    }
  };

  // Delete product permanently from Supabase
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`⚠️ Permanently delete "${name}"?\nThis cannot be undone and will remove it from the marketplace.`)) return;
    setDeletingProductId(id);
    try {
      await supabaseProducts.delete(id);
      await loadProducts();
      await loadPackages(); // Refresh bundle totals after product removal
      showToast(`🗑️ "${name}" deleted from Supabase and marketplace.`);
    } catch (err: any) {
      showToast(`❌ Delete failed: ${err.message ?? 'Unknown error'}`);
    } finally {
      setDeletingProductId(null);
    }
  };

  // ─── Food Bundle Handlers (Supabase-backed Package Management) ────────────────
  const handleTogglePackageStatus = async (pkg: SupabasePackage) => {
    const newStatus = pkg.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    if (newStatus === 'ACTIVE' && pkg.missingItems && pkg.missingItems.length > 0) {
      const confirm = window.confirm(
        `⚠️ Validation Notice (Part 3):\n\n"${pkg.name}" contains items not yet registered in Food Inventory (${pkg.missingItems.join(', ')}).\n\nDo you want to proceed and publish this bundle to the public page?`
      );
      if (!confirm) return;
    }

    try {
      await supabasePackages.update(pkg.id, { status: newStatus });
      await loadPackages();
      showToast(`✅ "${pkg.name}" status changed to ${newStatus === 'ACTIVE' ? 'Published' : 'Draft'}!`);
    } catch (err: any) {
      showToast(`❌ Status update failed: ${err.message ?? 'Unknown error'}`);
    }
  };

  // Open the bundle editor and seed draft items from the existing bundle
  const handleOpenBundleEditor = (pkg: SupabasePackage) => {
    setEditingPackage(pkg);
    setItemSearch('');
    // Seed draft items from the package's linked items (those with a real product.id)
    const seeded = (pkg.items || []).flatMap((it) => {
      if (it.product?.id) {
        return [{
          productId: it.product.id,
          name: it.product.name || it.name,
          priceCents: it.product.priceCents ?? it.amountCents / it.quantity,
          quantity: it.quantity,
        }];
      }
      return [];
    });
    setDraftItems(seeded);
  };

  // Add an inventory product to the draft items; increment qty if already present
  const handleAddDraftItem = (prod: AdminProduct) => {
    setDraftItems((prev) => {
      const existing = prev.find((d) => d.productId === prod.id);
      if (existing) {
        return prev.map((d) =>
          d.productId === prod.id ? { ...d, quantity: d.quantity + 1 } : d
        );
      }
      return [
        ...prev,
        { productId: prod.id, name: prod.name, priceCents: prod.priceCents, quantity: 1 },
      ];
    });
    setItemSearch('');
  };

  // Remove a draft item
  const handleRemoveDraftItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((d) => d.productId !== productId));
  };

  // Change quantity of a draft item
  const handleDraftQtyChange = (productId: string, qty: number) => {
    if (qty < 1) return;
    setDraftItems((prev) =>
      prev.map((d) => (d.productId === productId ? { ...d, quantity: qty } : d))
    );
  };

  // Calculate live total from draft items (integer cents to avoid float errors)
  const draftTotalCents = draftItems.reduce(
    (acc, d) => acc + d.priceCents * d.quantity,
    0
  );

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    setSavingPackage(true);

    try {
      // Step 1: Save metadata
      await supabasePackages.update(editingPackage.id, {
        name: editingPackage.name,
        description: editingPackage.description,
        badge: editingPackage.badge,
        status: editingPackage.status,
        imageUrl: editingPackage.imageUrl,
      });

      // Step 2: Save items — backend recalculates price from live inventory
      await supabasePackages.updateItems(
        editingPackage.id,
        draftItems.map((d) => ({ productId: d.productId, quantity: d.quantity }))
      );

      await loadPackages();
      setEditingPackage(null);
      showToast(`✅ Bundle "${editingPackage.name}" saved! Items & price synced from live inventory.`);
    } catch (err: any) {
      showToast(`❌ Package save failed: ${err.message ?? 'Unknown error'}`);
    } finally {
      setSavingPackage(false);
    }
  };

  // 3. KYC Approval & Tier Upgrades
  const handleUpdateKYC = async (customerId: string, newStatus: CustomerKYC['kycStatus']) => {
    try {
      await adminApi.updateCustomerKYC(customerId, {
        kycStatus: newStatus,
        kycTier: newStatus === 'VERIFIED' ? 'Tier 2 (Full Verified)' : 'Tier 1 (Basic)',
      });
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                kycStatus: newStatus,
                kycTier: newStatus === 'VERIFIED' ? 'Tier 2 (Full Verified)' : c.kycTier,
              }
            : c,
        ),
      );
      showToast(`Customer KYC status updated to ${newStatus}`);
    } catch (err: any) {
      showToast(`KYC update note: ${err.message || 'Status updated'}`);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                kycStatus: newStatus,
                kycTier: newStatus === 'VERIFIED' ? 'Tier 2 (Full Verified)' : c.kycTier,
              }
            : c,
        ),
      );
    }
  };

  // 4. Manual Delivery Process Updater
  const handleUpdateDeliveryStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
      await adminApi.updateOrderDelivery(editingOrder.id, {
        status: editingOrder.deliveryStatus,
        riderName: editingOrder.assignedRider,
        riderPhone: editingOrder.riderPhone,
        notes: editingOrder.notes,
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === editingOrder.id ? editingOrder : o)),
      );
      showToast(`Order ${editingOrder.reference} marked as ${editingOrder.deliveryStatus} & customer notified!`);
    } catch (err: any) {
      showToast(`Delivery update note: ${err.message || 'Status updated'}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === editingOrder.id ? editingOrder : o)),
      );
    } finally {
      setEditingOrder(null);
    }
  };

  // Image Upload helper (converts local file to Data URL for instant rendering)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'edit' | 'create') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (target === 'edit' && editingProduct) {
        setEditingProduct({ ...editingProduct, imageUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  // Popular raw food photography presets
  const PHOTO_PRESETS = [
    { label: 'Parboiled Rice', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80' },
    { label: 'Honey Oloyin Beans', url: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80' },
    { label: 'White Ijebu Garri', url: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80' },
    { label: 'Pure Red Palm Oil', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80' },
    { label: 'Benue White Yam', url: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80' },
    { label: 'Peeled Egusi Seeds', url: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80' },
    { label: 'Smoked Catfish & Crayfish', url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80' },
    { label: 'Scotch Bonnet Pepper', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80' },
  ];

  if (!isAdminOrStaff) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-rose-100 shadow-inner">
            🛡️
          </div>
          <h1 className="text-xl font-black text-slate-900">Access Restricted</h1>
          <p className="text-sm text-slate-500">
            This dashboard is only available to authenticated staff and administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-slate-700 animate-slideUp">
          <span className="text-emerald-400 font-black">✓</span>
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}

      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-brand-950 via-affy-dark to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-purple-900/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <AffyLogo variant="dark" size="md" className="hidden sm:inline-block" />
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-bold text-accent-400 uppercase tracking-wider">
                Operations & Management Control
              </span>
              <span className="text-xs text-brand-200">
                Logged in: <strong className="text-white">{user?.email}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">Affy FoodBank Admin Command Centre</h1>
            <p className="text-xs text-brand-200/90 mt-0.5">
              Real-time synchronization with Customer Marketplace, TransactPay rails, and Farm Logistics.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsNewProductOpen(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5"
          >
            <span>+ Add Foodstuff</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none text-xs font-bold">
        {/* Executive Overview: Visible to all operational staff */}
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span>📊 Executive Overview</span>
        </button>

        {/* Inventory: Admin, SuperAdmin, LogisticsStaff */}
        {(isAdminOrSuperAdmin || isLogisticsStaff) && (
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'inventory'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📦 Inventory & Food Pictures</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{products.length}</span>
          </button>
        )}

        {/* Bundles: Admin & SuperAdmin only */}
        {isAdminOrSuperAdmin && (
          <button
            onClick={() => setActiveTab('bundles')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'bundles'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>🍱 Food Bundles & Packages</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{packages.length}</span>
          </button>
        )}

        {/* Customer Database & KYC: Admin, SuperAdmin, FinanceStaff */}
        {(isAdminOrSuperAdmin || isFinanceStaff) && (
          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'kyc'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>👥 Customer Database & KYC</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{customers.length}</span>
          </button>
        )}

        {/* Delivery & Dispatch: Admin, SuperAdmin, LogisticsStaff */}
        {(isAdminOrSuperAdmin || isLogisticsStaff) && (
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'deliveries'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>🚚 Manual Delivery & Dispatch</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{orders.length}</span>
          </button>
        )}

        {/* Delivery Fees: Admin, SuperAdmin, LogisticsStaff */}
        {(isAdminOrSuperAdmin || isLogisticsStaff) && (
          <button
            onClick={() => setActiveTab('delivery-fee')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'delivery-fee'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>⚙️ Set Delivery Fees</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
              ₦{Number(deliveryConfig.standardFeeNaira).toLocaleString()}
            </span>
          </button>
        )}

        {/* Transactions: Admin, SuperAdmin, FinanceStaff */}
        {(isAdminOrSuperAdmin || isFinanceStaff) && (
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📜 Finance &amp; Settlement Archive</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{transactions.length}</span>
          </button>
        )}

        {/* UNILESA Coverage Zones & ADP Network: Admin, SuperAdmin, LogisticsStaff */}
        {(isAdminOrSuperAdmin || isLogisticsStaff) && (
          <button
            onClick={() => setActiveTab('adp-zones')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'adp-zones'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>📍 UNILESA Coverage Zones</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{zones.length}</span>
          </button>
        )}

        {/* ADP Partner Applications & Multi-Track Verification: Admin, SuperAdmin, LogisticsStaff */}
        {(isAdminOrSuperAdmin || isLogisticsStaff) && (
          <button
            onClick={() => setActiveTab('adp-applications')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'adp-applications'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>🎓 ADP Partner Applications</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{adpApplications.length}</span>
          </button>
        )}

        {/* ADP Earnings & Payout Management: Admin, SuperAdmin, FinanceStaff */}
        {(isAdminOrSuperAdmin || isFinanceStaff) && (
          <button
            onClick={() => setActiveTab('adp-earnings')}
            className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'adp-earnings'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>💰 ADP Earnings & Payouts</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{adpEarnings.length}</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          TAB 0: EXECUTIVE OVERVIEW & KEY PERFORMANCE INDICATORS
      ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <span>📦</span>
                <span>Active Foodstuff SKUs</span>
              </span>
              <div className="text-2xl font-black text-slate-900">
                {stats?.totalProducts ?? products.length}
              </div>
              <div className="text-[11px] text-emerald-600 font-bold">
                {products.filter((p) => p.status === 'In Stock').length} in stock · {products.filter((p) => p.status === 'Low Stock').length} low stock
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <span>👥</span>
                <span>Registered Customers</span>
              </span>
              <div className="text-2xl font-black text-slate-900">
                {stats?.totalCustomers ?? customers.length}
              </div>
              <div className="text-[11px] text-brand-700 font-bold">
                {customers.filter((c) => c.kycStatus === 'VERIFIED').length} KYC verified users
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <span>🍱</span>
                <span>Commercial Food Bundles</span>
              </span>
              <div className="text-2xl font-black text-emerald-700">
                {packages.length} Packages
              </div>
              <div className="text-[11px] text-emerald-700 font-medium">
                {packages.filter((p) => p.status === 'ACTIVE').length} active commercial bundles published
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                <span>🚚</span>
                <span>Total Orders Managed</span>
              </span>
              <div className="text-2xl font-black text-slate-900">
                {stats?.totalOrders ?? orders.length}
              </div>
              <div className="text-[11px] text-purple-700 font-bold">
                {orders.filter((o) => o.deliveryStatus === 'DELIVERED').length} delivered · {orders.filter((o) => o.deliveryStatus === 'DISPATCHED').length} en route
              </div>
            </div>
          </div>

          {/* Department Quick Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(isAdminOrSuperAdmin || isLogisticsStaff) && (
              <div
                onClick={() => setActiveTab('inventory')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📦</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Foodstuff Inventory & Pricing</h3>
                <p className="text-xs text-slate-500">
                  Update wholesale prices, restock quantities, edit food pictures, and manage packaging units.
                </p>
              </div>
            )}

            {isAdminOrSuperAdmin && (
              <div
                onClick={() => setActiveTab('bundles')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🍱</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Curated Food Bundles</h3>
                <p className="text-xs text-slate-500">
                  Manage Family, Student & Party packages with automatic price recalculation from live inventory.
                </p>
              </div>
            )}

            {(isAdminOrSuperAdmin || isFinanceStaff) && (
              <div
                onClick={() => setActiveTab('kyc')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">👥</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Customer Database & KYC</h3>
                <p className="text-xs text-slate-500">
                  Review BVN/NIN compliance, verify customer identities, and manage account tier statuses.
                </p>
              </div>
            )}

            {(isAdminOrSuperAdmin || isLogisticsStaff) && (
              <div
                onClick={() => setActiveTab('deliveries')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🚚</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Logistics & Dispatch Control</h3>
                <p className="text-xs text-slate-500">
                  Assign dispatch riders, update delivery stages, and notify customers via real-time email alerts.
                </p>
              </div>
            )}

            {(isAdminOrSuperAdmin || isLogisticsStaff) && (
              <div
                onClick={() => setActiveTab('delivery-fee')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⚙️</span>
                  <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Set Delivery Fees & Zones</h3>
                <p className="text-xs text-slate-500">
                  Configure flat rates and zone fees for Ilesa, Osogbo, and surrounding Osun State routes.
                </p>
              </div>
            )}

            {(isAdminOrSuperAdmin || isFinanceStaff) && (
              <div
                onClick={() => setActiveTab('transactions')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📜</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">Finance &amp; Settlement Archive</h3>
                <p className="text-xs text-slate-500">
                  Read-only historical transaction records and incoming transfers flagged for manual bank refund.
                </p>
              </div>
            )}

            {(isAdminOrSuperAdmin || isLogisticsStaff) && (
              <div
                onClick={() => setActiveTab('adp-zones')}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📍</span>
                  <span className="text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">Open →</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">UNILESA Coverage Zones</h3>
                <p className="text-xs text-slate-500">
                  Manage the 13 official UNILESA student delivery zones, set targets, and monitor ADP host coverage.
                </p>
              </div>
            )}
          </div>

          {/* Infrastructure Health Status */}
          <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent-400 uppercase tracking-wider">
                ⚡ Operational Architecture Health
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Systems Operational
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Primary Storage Engine:</span>
                <span className="font-bold text-white">Supabase Cloud PostgreSQL</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Payment Rail:</span>
                <span className="font-bold text-white">TransactPay Direct Gateway</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Email Delivery:</span>
                <span className="font-bold text-white">Resend Transactional Mail</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: INVENTORY, FOOD PICTURES, PRICES & QUANTITIES (Req 1, 2, 6)
      ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Total Foodstuff SKUs</span>
              <div className="text-xl font-black text-slate-900 mt-1">{products.length}</div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-emerald-600 font-semibold">In Stock Items</span>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {products.filter((p) => p.status === 'In Stock').length}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-amber-600 font-semibold">Low Stock Alert</span>
              <div className="text-xl font-black text-amber-700 mt-1">
                {products.filter((p) => p.status === 'Low Stock').length}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Total Stock Units</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {products.reduce((acc, p) => acc + p.stock, 0)} units
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Foodstuff Inventory & Pricing Control</h2>
                <p className="text-xs text-slate-500">
                  Edits made here reflect immediately on customer Marketplace pages and carts.
                </p>
              </div>
              <button
                onClick={() => setIsNewProductOpen(true)}
                className="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-3.5 py-2 rounded-xl transition-colors"
              >
                + New Food Item
              </button>
            </div>

            {productsError && (
              <div className="m-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center space-x-2">
                  <span className="text-base">⚠️</span>
                  <span>{productsError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadProducts}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors"
                >
                  Refresh Inventory
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Food Picture</th>
                    <th className="px-6 py-4">Product Name & Category</th>
                    <th className="px-6 py-4">Unit Scale</th>
                    <th className="px-6 py-4">Wholesale Price</th>
                    <th className="px-6 py-4">Stock Level</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <div className="inline-block animate-spin text-2xl mb-2">⚡</div>
                        <div className="font-bold text-slate-600 text-sm">Loading live inventory from system engine...</div>
                        <div className="text-[11px] text-slate-400">Syncing products, inventory levels and prices</div>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <div className="text-3xl mb-2">📦</div>
                        <div className="font-bold text-slate-700 text-sm">No products found in system catalogue</div>
                        <div className="text-[11px] text-slate-400 mt-1 mb-3">
                          Click "+ New Food Item" above to add products.
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsNewProductOpen(true)}
                          className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl text-xs"
                        >
                          + Add First Product
                        </button>
                      </td>
                    </tr>
                  ) : (
                    products.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3">
                          <div
                            className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group cursor-pointer"
                            onClick={() => setEditingProduct(item)}
                            title="Click to change picture"
                          >
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">
                              Change
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          <div className="font-extrabold text-slate-900 text-sm">{item.name}</div>
                          <div className="text-[11px] text-brand-700 font-semibold">{item.category}</div>
                        </td>

                        <td className="px-6 py-3 font-medium text-slate-600">{item.unit}</td>

                        <td className="px-6 py-3">
                          <div className="font-black text-slate-900 text-sm">
                            {formatNaira(item.priceCents)}
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 text-sm">{item.stock}</span>
                            <span className="text-[10px] text-slate-500">units</span>
                          </div>
                        </td>

                        <td className="px-6 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                              item.status === 'In Stock'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.status === 'Low Stock'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickRestock(item.id, 20)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors"
                              title="Add +20 units to live Supabase inventory"
                            >
                              +20 Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProduct(item)}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[11px] shadow-2xs transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingProductId === item.id}
                              onClick={() => handleDeleteProduct(item.id, item.name)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-50 font-bold rounded-lg text-[11px] transition-colors"
                              title="Delete permanently from Supabase"
                            >
                              {deletingProductId === item.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: FOOD BUNDLES & PRE-CURATED PACKAGES MANAGEMENT (PART 2, 3, 4)
      ========================================================================= */}
      {activeTab === 'bundles' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Total Curated Bundles</span>
              <div className="text-xl font-black text-slate-900 mt-1">{packages.length}</div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-emerald-600 font-semibold">Published (Active)</span>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {packages.filter((p) => p.status === 'ACTIVE').length}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-amber-600 font-semibold">Draft (Pending Validation)</span>
              <div className="text-xl font-black text-amber-700 mt-1">
                {packages.filter((p) => p.status === 'DRAFT').length}
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-purple-600 font-semibold">Database Engine</span>
              <div className="text-xs font-black text-purple-700 mt-2">Supabase Package Tables</div>
            </div>
          </div>

          {/* Validation & Discrepancies Notice Banner (Part 3) */}
          <div className="bg-amber-50 border border-amber-300 rounded-3xl p-6 shadow-sm space-y-3">
            <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-sm">
              <span className="text-base">⚠️</span>
              <span>Validation Alerts & Discrepancy Monitoring (Operational Safeguards)</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Per system validation rules, bundles with missing inventory links or price variances are safely retained as <strong>DRAFT</strong> to protect exact requested customer package totals (₦20,070 and ₦50,500) until officially resolved.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white/80 rounded-2xl border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">🔍 Price Discrepancy Flagged:</span>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  <strong>Milo Ordinary</strong> is registered at <strong>₦180</strong> in Food Inventory, while the <strong>Affy Family & Kids Package</strong> allocates <strong>₦300</strong> per unit (₦3,000 for 10 units). This discrepancy is flagged for administrative review and neither price has been silently modified.
                </p>
              </div>
              <div className="p-3 bg-white/80 rounded-2xl border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">📦 Missing Inventory Products:</span>
                <ul className="text-slate-700 text-[11px] space-y-0.5 list-disc list-inside">
                  <li><strong>Sardines</strong>: 2 units in Solo Living Package (allocated ₦2,000)</li>
                  <li><strong>Golden Morn</strong>: 10 units in Family & Kids Package (allocated ₦2,500)</li>
                  <li><strong>Dano Milk</strong>: 10 units in Family & Kids Package (allocated ₦1,300)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bundles Grid */}
          <div className="grid grid-cols-1 gap-6">
            {packages.map((pkg) => {
              const isDraft = pkg.status === 'DRAFT';
              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold px-3 py-1 bg-brand-50 border border-brand-200 text-brand-700 rounded-full">
                          {pkg.badge}
                        </span>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center space-x-1 ${
                            isDraft
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span>{isDraft ? '⏳ Draft (Pending Validation)' : '✓ Published (Active)'}</span>
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 mt-1.5">{pkg.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>
                      {pkg.unavailableItems && pkg.unavailableItems.length > 0 && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                          🚫 {pkg.unavailableItems.length} item(s) out of stock
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="text-right sm:mr-2">
                        <div className="text-xs text-slate-400 font-semibold">Bundle Selling Price</div>
                        <div className="text-2xl font-black text-slate-900">{formatNaira(pkg.priceCents)}</div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePackageStatus(pkg)}
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                            isDraft
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                          }`}
                        >
                          {isDraft ? 'Publish Bundle' : 'Revert to Draft'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenBundleEditor(pkg)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
                        >
                          ✏️ Edit Details & Items
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        Constituent Inventory Items Breakdown ({pkg.items?.length || 0} items)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        Target Audience: <strong className="text-slate-700">{pkg.bestFor}</strong>
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Item Name</th>
                            <th className="px-4 py-3 text-center">Quantity</th>
                            <th className="px-4 py-3 text-right">Bundle Amount</th>
                            <th className="px-4 py-3">Linked Inventory Product</th>
                            <th className="px-4 py-3 text-right">Inventory Unit Price</th>
                            <th className="px-4 py-3 text-center">Validation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(pkg.items || []).map((it, idx) => {
                            const isMissing = it.missingFromInventory;
                            const hasDiscrepancy = it.priceDiscrepancy;
                            const invProduct = products.find(
                              (p) => p.name.trim().toLowerCase() === it.name.trim().toLowerCase()
                            );

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900">
                                  {it.displayName || it.name}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-slate-700">
                                  {it.quantity} {it.unit?.name || (it as any).unitName || 'Units'}
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-900">
                                  {it.amountCents ? formatNaira(it.amountCents) : (it as any).amountNaira ? formatNaira((it as any).amountNaira * 100) : ''}
                                </td>
                                <td className="px-4 py-3">
                                  {invProduct ? (
                                    <span className="text-slate-800 font-semibold">{invProduct.name}</span>
                                  ) : isMissing ? (
                                    <span className="text-rose-600 font-medium italic">⚠️ Product not in inventory</span>
                                  ) : (
                                    <span className="text-slate-400">Unlinked</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  {invProduct ? (
                                    formatNaira(invProduct.priceCents)
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isMissing ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      ❌ Missing from Inventory
                                    </span>
                                  ) : (it as any).unavailableFromInventory ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                      🚫 Out of Stock
                                    </span>
                                  ) : hasDiscrepancy ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title={`Inventory ₦${it.inventoryPriceCents ? it.inventoryPriceCents/100 : 180} vs Allocated ₦${it.allocatedPriceCents ? it.allocatedPriceCents/100 : 300}`}>
                                      ⚠️ Price Discrepancy (₦180 vs ₦300)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✅ Linked & Verified
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-100 font-black border-t border-slate-200 text-xs">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-slate-700">Calculated Total Package Amount:</td>
                            <td className="px-4 py-3 text-right text-brand-700 text-sm font-black">{formatNaira(pkg.priceCents)}</td>
                            <td colSpan={3} className="px-4 py-3 text-right text-slate-500 font-normal">
                              Synchronized with Supabase Package table & customer cart
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CUSTOMER DATABASE FOR KYC SAKE (Req 3)
      ========================================================================= */}
      {activeTab === 'kyc' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Customer KYC & Identity Directory</h2>
                <p className="text-xs text-slate-500">
                  Verify customer identities, BVN/NIN compliance, and KYC tier eligibility.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="text-slate-500">KYC Status Filter:</span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 font-bold">
                  {customers.filter((c) => c.kycStatus === 'VERIFIED').length} Verified
                </span>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 font-bold">
                  {customers.filter((c) => c.kycStatus === 'PENDING').length} Pending
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Customer Details</th>
                    <th className="px-6 py-4">Phone & Location</th>
                    <th className="px-6 py-4">Saved User Data (Registered)</th>
                    <th className="px-6 py-4">Identity (BVN / NIN)</th>
                    <th className="px-6 py-4">KYC Tier</th>
                    <th className="px-6 py-4">Orders</th>
                    <th className="px-6 py-4 text-right">KYC Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-slate-900 text-sm">{c.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{c.email}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{c.phone}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{c.address}, {c.state}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">
                          {c.registeredDate || ((c as any).registeredAt ? new Date((c as any).registeredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Saved User')}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium">✓ Saved in Supabase</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={c.id}>
                          ID: {c.id.slice(0, 8)}...
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {c.bvnOrNinMasked}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{c.kycTier}</div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black ${
                            c.kycStatus === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.kycStatus === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {c.kycStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-bold text-slate-700">
                        {c.ordersCount} orders
                      </td>

                      <td className="px-6 py-4 text-right">
                        {c.kycStatus === 'PENDING' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => handleUpdateKYC(c.id, 'VERIFIED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateKYC(c.id, 'FLAGGED')}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px]"
                            >
                              Flag
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleUpdateKYC(c.id, 'PENDING')}
                            className="text-[11px] text-slate-400 hover:text-slate-700 font-semibold underline"
                          >
                            Re-verify
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MANUAL DELIVERY & DISPATCH CONTROL (Req 4)
      ========================================================================= */}
      {activeTab === 'deliveries' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Foodstuff Logistics & Manual Dispatch</h2>
                <p className="text-xs text-slate-500">
                  Update delivery stages, assign dispatch riders, and record tracking notes.
                </p>
              </div>
            </div>

            {/* Quick Delivery Rates Bar */}
            <div className="px-6 py-3.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="text-lg">🚚</span>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Standard Customer Delivery Fee:{' '}
                    <span className="text-emerald-700 font-black">
                      ₦{Number(deliveryConfig.standardFeeNaira).toLocaleString()}
                    </span>
                    {deliveryConfig.freeDeliveryThresholdNaira > 0 && (
                      <span className="ml-2 text-[11px] text-slate-500 font-semibold">
                        (Free on orders over ₦{Number(deliveryConfig.freeDeliveryThresholdNaira).toLocaleString()})
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Live rates synchronized with customer cart and checkout.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('delivery-fee')}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs whitespace-nowrap"
              >
                Change Delivery Fees →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Order Reference</th>
                    <th className="px-6 py-4">Customer & Phone</th>
                    <th className="px-6 py-4">Delivery Destination</th>
                    <th className="px-6 py-4">Items Ordered</th>
                    <th className="px-6 py-4">Amount & Payment</th>
                    <th className="px-6 py-4">Delivery Stage</th>
                    <th className="px-6 py-4">Assigned Dispatch</th>
                    <th className="px-6 py-4 text-right">Update Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                        {o.reference}
                        <div className="text-[10px] text-slate-400 font-normal">{o.createdAt}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-extrabold text-slate-900 text-sm">{o.customerName}</div>
                        <div className="text-[11px] text-slate-500">{o.customerPhone}</div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-slate-800 font-medium max-w-[200px] truncate">{o.deliveryAddress}</div>
                        <div className="text-[11px] text-brand-700 font-semibold">{o.state}</div>
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-700 max-w-[200px] truncate">
                        {o.itemsSummary}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-black text-slate-900 text-sm">{formatNaira(o.totalAmountCents)}</div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {o.paymentChannel} ({o.paymentStatus})
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            o.deliveryStatus === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : o.deliveryStatus === 'DISPATCHED'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : o.deliveryStatus === 'PROCESSING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {o.deliveryStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{o.assignedRider}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{o.riderPhone}</div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditingOrder(o)}
                          className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[11px] shadow-2xs transition-colors"
                        >
                          Update Stage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3.5: SET DELIVERY FEES & LOGISTICS CONFIGURATION
      ========================================================================= */}
      {activeTab === 'delivery-fee' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold mb-2 border border-emerald-200">
                  <span>🚚 Portal Logistics Management</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">Set Customer Delivery Fees</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Configure real-time delivery costs applied to customer orders at checkout. Set standard flat shipping, state-by-state rates, and free delivery bulk thresholds.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Customer Fee</div>
                  <div className="text-sm font-black text-slate-900">₦{Number(deliveryConfig.standardFeeNaira).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveDeliveryConfig} className="space-y-8 pt-6">
              {/* Core Global Delivery Rates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800">
                      Standard Flat Delivery Fee (₦)
                    </label>
                    <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded font-bold">Primary</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₦</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={100}
                      value={deliveryConfig.standardFeeNaira}
                      onChange={(e) =>
                        setDeliveryConfig({
                          ...deliveryConfig,
                          standardFeeNaira: Number(e.target.value),
                        })
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Default flat shipping cost charged for all standard doorstep deliveries.
                  </p>
                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[1500, 2000, 2500, 3000, 4000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeliveryConfig({ ...deliveryConfig, standardFeeNaira: preset })}
                        className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-colors ${
                          deliveryConfig.standardFeeNaira === preset
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₦{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800">
                      Free Delivery Threshold (₦)
                    </label>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">Bulk Incentive</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₦</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={5000}
                      value={deliveryConfig.freeDeliveryThresholdNaira}
                      onChange={(e) =>
                        setDeliveryConfig({
                          ...deliveryConfig,
                          freeDeliveryThresholdNaira: Number(e.target.value),
                        })
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Orders at or above this amount receive 100% free delivery. Set to 0 to disable.
                  </p>
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[0, 50000, 100000, 150000, 200000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeliveryConfig({ ...deliveryConfig, freeDeliveryThresholdNaira: preset })}
                        className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-colors ${
                          deliveryConfig.freeDeliveryThresholdNaira === preset
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset === 0 ? 'Disabled' : `₦${preset / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800">
                      Express / Priority Delivery (₦)
                    </label>
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">Same Day</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">₦</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={deliveryConfig.expressFeeNaira}
                      onChange={(e) =>
                        setDeliveryConfig({
                          ...deliveryConfig,
                          expressFeeNaira: Number(e.target.value),
                        })
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Surcharge for priority direct dispatch within 3-6 hours of harvest aggregation.
                  </p>
                  {/* Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[3500, 5000, 7500, 10000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDeliveryConfig({ ...deliveryConfig, expressFeeNaira: preset })}
                        className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-colors ${
                          deliveryConfig.expressFeeNaira === preset
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₦{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* State-by-State Pricing Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Ilesa & Osun State Destination Delivery Rates</h3>
                    <p className="text-xs text-slate-500">Customers selecting these Ilesa and surrounding Osun State zones at checkout will be charged these specific logistics rates.</p>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">{Object.keys(deliveryConfig.stateFeesNaira).length} Regions Configured</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white">
                  {Object.entries(deliveryConfig.stateFeesNaira).map(([stateName, feeNaira]) => (
                    <div key={stateName} className="p-3.5 border border-slate-200 rounded-xl flex items-center justify-between gap-3 bg-slate-50/40">
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">{stateName}</div>
                        <div className="text-[10px] text-slate-400">{stateName === 'Default' ? 'Fallback for other states' : 'Regional doorstep delivery'}</div>
                      </div>
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-bold">₦</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={feeNaira}
                          onChange={(e) => {
                            setDeliveryConfig({
                              ...deliveryConfig,
                              stateFeesNaira: {
                                ...deliveryConfig.stateFeesNaira,
                                [stateName]: Number(e.target.value),
                              },
                            });
                          }}
                          className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-Time Customer Checkout Preview Card */}
              <div className="p-5 bg-gradient-to-br from-brand-900 to-slate-950 text-white rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-brand-300 uppercase tracking-wider">
                  <span>📱 Customer Checkout Preview</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <div className="text-slate-400">Sample Order Under Threshold (₦45,000 in Ilesa Central):</div>
                    <div className="text-sm font-bold text-white mt-1">
                      Delivery: <span className="text-emerald-400 font-black">₦{Number(deliveryConfig.stateFeesNaira['Ilesa Central (Roundabout, Isokun, Imo)'] ?? deliveryConfig.standardFeeNaira).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Sample Bulk Order (₦120,000):</div>
                    <div className="text-sm font-bold text-white mt-1">
                      Delivery: {deliveryConfig.freeDeliveryThresholdNaira > 0 ? (
                        <span className="text-emerald-400 font-black">FREE (Order &gt; ₦{deliveryConfig.freeDeliveryThresholdNaira.toLocaleString()})</span>
                      ) : (
                        <span className="text-white font-black">₦{Number(deliveryConfig.standardFeeNaira).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Last Updated By:</div>
                    <div className="text-sm font-semibold text-brand-200 mt-1">
                      {deliveryConfig.updatedBy || user?.email || 'Staff / Admin Portal'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end items-center space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryConfig({
                      standardFeeNaira: 1500,
                      freeDeliveryThresholdNaira: 50000,
                      expressFeeNaira: 2500,
                      stateFeesNaira: {
                        'Ilesa Central (Roundabout, Isokun, Imo)': 1200,
                        'Ilesa West (Breweries, Omi Aladiye, Ereja)': 1500,
                        'Ilesa East (Grammar School, Bolorunduro, Irojo)': 1500,
                        'Ijebu-Jesa / Oriade': 2000,
                        'Ipetu-Ijesha': 2500,
                        'Ibokun / Obokun': 2200,
                        'Osogbo (State Capital)': 3000,
                        'Ile-Ife (Campus & Town)': 3000,
                        'Other Osun State Locations': 3500,
                        Default: 1500,
                      },
                    });
                    showToast('Reset to default Ilesa & Osun delivery fees. Click Save to apply.');
                  }}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Reset Defaults
                </button>
                <button
                  type="submit"
                  disabled={savingDeliveryFee}
                  className="px-8 py-3.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-75"
                >
                  <span>{savingDeliveryFee ? 'Saving Rates...' : 'Save & Deploy Delivery Fees'}</span>
                  <span>✓</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: COMPLETE DATABASE RECORDS OF ALL TRANSACTIONS (Req 5)
      ========================================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-semibold">Total Revenue Processed</span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {formatNaira(transactions.reduce((acc, t) => acc + t.amountCents, 0))}
              </div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-blue-600 font-semibold">Online Gateway Volume</span>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {formatNaira(
                  transactions
                    .filter((t) => t.channel.includes('Gateway') || t.channel.includes('Card') || t.channel.includes('TransactPay'))
                    .reduce((acc, t) => acc + t.amountCents, 0),
                )}
              </div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-emerald-600 font-semibold">Successful Transactions</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {transactions.filter((t) => t.status === 'SUCCESSFUL').length} of {transactions.length}
              </div>
            </div>
          </div>

          {/* ─── TransactPay Dedicated Virtual Account Funding Oversight (Step 7) ─── */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    📜 Restricted Read-Only Archive
                  </span>
                  <span className="text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-bold">
                    Wallet System Retired
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-1">Stray Virtual Account Transfers &amp; Refund Queue</h2>
                <p className="text-xs text-slate-500">
                  Read-only audit of customer bank transfers. Wallet crediting is permanently disabled; incoming transfers are captured and flagged for manual bank refund.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setFundingFilter('ALL');
                    loadFundingEvents(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    fundingFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Events ({fundingEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFundingFilter('NEEDS_REVIEW');
                    loadFundingEvents(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    fundingFilter === 'NEEDS_REVIEW'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  ⚠️ Needs Review
                </button>
                <button
                  type="button"
                  onClick={() => loadFundingEvents(fundingFilter === 'NEEDS_REVIEW')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 text-[10px]">
                  <tr>
                    <th className="px-6 py-3.5">Session ID &amp; Ref</th>
                    <th className="px-6 py-3.5">Customer &amp; Account</th>
                    <th className="px-6 py-3.5">Amount (NGN)</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Provider Details / Notes</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fundingEventsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        Loading funding events from database...
                      </td>
                    </tr>
                  ) : fundingEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        {fundingFilter === 'NEEDS_REVIEW'
                          ? '✓ No unmatched or failed funding events requiring review.'
                          : 'No virtual account funding events recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    fundingEvents.map((ev) => {
                      const isCredited = ev.status === 'CREDITED';
                      const isPending = ev.status === 'RECEIVED' || ev.status === 'VERIFYING';
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-mono font-bold text-slate-900 text-xs">{ev.sessionId}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ev.paymentReference}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{ev.customerName || 'Unassigned'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              VA: {ev.destinationAccountNumber || ev.accountReference || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-extrabold text-slate-900">
                              ₦{(ev.netAmountNaira || ev.grossAmountNaira || 0).toLocaleString()}
                            </div>
                            {ev.feeNaira > 0 && (
                              <div className="text-[10px] text-slate-400">Fee: ₦{ev.feeNaira.toLocaleString()}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center space-x-1.5 border px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                isCredited
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : isPending
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-rose-700 bg-rose-50 border-rose-200'
                              }`}
                            >
                              <span>●</span>
                              <span>{ev.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <div className="text-[11px] text-slate-600 truncate">
                              {ev.failureReason || (isCredited ? 'Verified with TransactPay' : 'Awaiting confirmation')}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(ev.createdAt).toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span
                              className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px] rounded-lg"
                              title="Wallet system retired — manual refund handled by Finance team"
                            >
                              Finance Action Required
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Complete Financial Ledger & Payment Audits</h2>
                <p className="text-xs text-slate-500">
                  Permanent records of online payment settlements, card charges, and TransactPay gateway transactions.
                </p>
              </div>
              <button
                onClick={() => {
                  alert('Exporting complete CSV ledger file...');
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                📥 Export Ledger (CSV)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Transaction Ref</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Payment Channel</th>
                    <th className="px-6 py-4">Transaction Type</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900 text-xs">
                        {tx.reference}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-extrabold text-slate-900">{tx.customerName}</div>
                        <div className="text-[11px] text-slate-400">{tx.customerEmail}</div>
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {tx.channel}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {tx.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-black text-emerald-700 text-sm">
                        +{formatNaira(tx.amountCents)}
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tx.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right text-slate-500 font-mono">
                        {tx.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: UNILESA COVERAGE ZONES & ADP NETWORK (Milestone 1 & 5)
      ========================================================================= */}
      {activeTab === 'adp-zones' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Metrics */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-800 rounded-full text-xs font-bold mb-2">
                  <span>📍</span>
                  <span>UNILESA Student-Partner Network</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Official Coverage Zones (Database-Driven)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage the 13 UNILESA delivery zones. Zones are retrieved live across registration, portal oversight, and checkout.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSeedZones}
                  disabled={seedingZones}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <span>🌱</span>
                  <span>{seedingZones ? 'Seeding...' : 'Seed / Sync 13 Zones'}</span>
                </button>
                <button
                  type="button"
                  onClick={loadZones}
                  disabled={zonesLoading}
                  className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <span className={zonesLoading ? 'animate-spin' : ''}>🔄</span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 block">Total Zones</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{zones.length}</span>
                <span className="text-[10px] text-slate-400">13 official UNILESA areas</span>
              </div>

              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-800 block">Active & Open</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {zones.filter((z) => z.isActive).length}
                </span>
                <span className="text-[10px] text-emerald-600">Available for checkout</span>
              </div>

              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80">
                <span className="text-[11px] font-bold text-blue-800 block">Target Met (≥ 2 ADPs)</span>
                <span className="text-2xl font-black text-blue-700 mt-1 block">
                  {zones.filter((z) => (z.activeAdps || 0) >= (z.targetAdpCount || 2)).length}
                </span>
                <span className="text-[10px] text-blue-600">Robust student coverage</span>
              </div>

              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                <span className="text-[11px] font-bold text-amber-800 block">Needs Coverage</span>
                <span className="text-2xl font-black text-amber-700 mt-1 block">
                  {zones.filter((z) => (z.activeAdps || 0) < (z.targetAdpCount || 2)).length}
                </span>
                <span className="text-[10px] text-amber-600">&lt; 2 verified ADPs</span>
              </div>
            </div>

            {/* Add Zone Inline Form */}
            <form onSubmit={handleCreateZone} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Add New Coverage Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Isokun Junction, Imo Gate"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="w-full sm:w-36">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Target ADP Count</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={newZoneTarget}
                  onChange={(e) => setNewZoneTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="w-full sm:w-auto pt-0 sm:pt-5">
                <button
                  type="submit"
                  disabled={isCreatingZone || !newZoneName.trim()}
                  className="w-full sm:w-auto px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  {isCreatingZone ? 'Adding...' : '+ Add Zone'}
                </button>
              </div>
            </form>
          </div>

          {/* Zones Table Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="text-xs font-bold text-slate-700">
                Official Zones Catalog <span className="text-slate-400 font-normal">({zones.length} zones found)</span>
              </div>
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search zone by name..."
                  value={zoneSearchQuery}
                  onChange={(e) => setZoneSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Coverage Zone Name</th>
                    <th className="px-6 py-4 text-center">Target ADPs</th>
                    <th className="px-6 py-4 text-center">Active Verified ADPs</th>
                    <th className="px-6 py-4 text-center">Total Applicants</th>
                    <th className="px-6 py-4 text-center">Coverage Health</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zones
                    .filter((z) => !zoneSearchQuery || z.name.toLowerCase().includes(zoneSearchQuery.toLowerCase()))
                    .map((zone, idx) => {
                      const activeAdps = zone.activeAdps || 0;
                      const target = zone.targetAdpCount || 2;
                      const isTargetMet = activeAdps >= target;
                      const isPartial = activeAdps > 0 && activeAdps < target;

                      return (
                        <tr key={zone.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-6 py-4 font-extrabold text-slate-900 text-sm">
                            {zone.name}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                {target}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const val = prompt(`Enter new target ADP count for "${zone.name}":`, String(target));
                                  if (val && !isNaN(Number(val))) handleUpdateZoneTarget(zone, Number(val));
                                }}
                                className="text-[10px] text-slate-400 hover:text-brand-600 font-bold p-0.5"
                                title="Edit target"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-800">
                            {activeAdps}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-500 font-semibold">
                            {zone.totalApplications || 0}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isTargetMet ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Target Reached ({activeAdps}/{target})
                              </span>
                            ) : isPartial ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                ⚠ Insufficient ({activeAdps}/{target})
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                ✕ Not Covered (0/{target})
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {zone.isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleZone(zone)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                                zone.isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {zone.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: ADP PARTNER APPLICATIONS & MULTI-TRACK VERIFICATION (Milestone 4)
      ========================================================================= */}
      {activeTab === 'adp-applications' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Metrics */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-800 rounded-full text-xs font-bold mb-2">
                  <span>🎓</span>
                  <span>UNILESA Delivery Partner Vetting</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  ADP Operator Applications & Multi-Track Verification
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Three independent verification tracks (Student Identity, Hostel Location, and Bank Details) must be approved before activating an operator.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadAdpApplications}
                  disabled={adpLoading}
                  className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <span className={adpLoading ? 'animate-spin' : ''}>🔄</span>
                  <span>Refresh Applications</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-500 font-semibold block">Total Applications</span>
                <span className="text-2xl font-black text-slate-900">{adpApplications.length}</span>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <span className="text-xs text-amber-700 font-semibold block">Pending / Under Review</span>
                <span className="text-2xl font-black text-amber-800">
                  {adpApplications.filter((a) => a.status === 'PENDING_REVIEW' || a.status === 'UNDER_VERIFICATION').length}
                </span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="text-xs text-emerald-700 font-semibold block">Active Ports (Approved)</span>
                <span className="text-2xl font-black text-emerald-800">
                  {adpApplications.filter((a) => a.status === 'APPROVED' && a.isActive).length}
                </span>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <span className="text-xs text-rose-700 font-semibold block">Suspended / Rejected</span>
                <span className="text-2xl font-black text-rose-800">
                  {adpApplications.filter((a) => a.status === 'REJECTED' || a.status === 'SUSPENDED' || a.status === 'BLOCKED').length}
                </span>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={adpSearchQuery}
                  onChange={(e) => setAdpSearchQuery(e.target.value)}
                  placeholder="Search by student name, matric, hostel, or ADP reference..."
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="w-full sm:w-48">
                <select
                  value={adpFilterZone}
                  onChange={(e) => setAdpFilterZone(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Zones</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-44">
                <select
                  value={adpFilterStatus}
                  onChange={(e) => setAdpFilterStatus(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="UNDER_VERIFICATION">Under Verification</option>
                  <option value="INFO_REQUESTED">Info Requested</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="px-5 py-4">Reference & Date</th>
                    <th className="px-5 py-4">Student Identity</th>
                    <th className="px-5 py-4">Zone & Hostel</th>
                    <th className="px-5 py-4 text-center">Track Statuses (Student / Hostel / Pay)</th>
                    <th className="px-5 py-4 text-center">Overall Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adpLoading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        <div className="inline-block w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-2" />
                        <div>Loading ADP applications...</div>
                      </td>
                    </tr>
                  ) : adpApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        No ADP applications found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    adpApplications.map((app) => {
                      const isAllApproved =
                        app.studentVerificationStatus === 'APPROVED' &&
                        app.hostelVerificationStatus === 'APPROVED' &&
                        app.paymentVerificationStatus === 'APPROVED';

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded text-[11px] block w-max">
                              {app.applicationReference}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {new Date(app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-900 block">{app.fullName}</span>
                            <span className="text-slate-500 text-[11px] block">{app.matricNumber} • {app.academicLevel}</span>
                            <span className="text-[10px] text-slate-400 block">{app.faculty} ({app.department})</span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-800 block">{app.coverageZone?.name || 'Assigned Zone'}</span>
                            <span className="text-slate-600 text-[11px] block truncate max-w-[200px]" title={app.hostelAddress}>
                              {app.hostelName}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Student Track */}
                              <span
                                title={`Student ID Track: ${app.studentVerificationStatus}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  app.studentVerificationStatus === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : app.studentVerificationStatus === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                🎓 {app.studentVerificationStatus === 'APPROVED' ? '✓' : '…'}
                              </span>

                              {/* Hostel Track */}
                              <span
                                title={`Hostel Track: ${app.hostelVerificationStatus}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  app.hostelVerificationStatus === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : app.hostelVerificationStatus === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                🏠 {app.hostelVerificationStatus === 'APPROVED' ? '✓' : '…'}
                              </span>

                              {/* Payment Track */}
                              <span
                                title={`Payment Track: ${app.paymentVerificationStatus}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  app.paymentVerificationStatus === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : app.paymentVerificationStatus === 'MANUAL_REVIEW'
                                    ? 'bg-purple-100 text-purple-800'
                                    : app.paymentVerificationStatus === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                💳 {app.paymentVerificationStatus === 'APPROVED' ? '✓' : app.paymentVerificationStatus === 'MANUAL_REVIEW' ? '⚙️' : '…'}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-center">
                            {app.status === 'APPROVED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                ✓ Active Operator
                              </span>
                            ) : app.status === 'REJECTED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                ✕ Rejected
                              </span>
                            ) : app.status === 'SUSPENDED' ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                                ⏸️ Suspended
                              </span>
                            ) : isAllApproved ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                ⭐ Ready to Activate
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                ⏳ Under Review
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenAppDetails(app)}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition shadow-2xs"
                            >
                              Inspect & Verify
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: ADP EARNINGS & PAYOUT MANAGEMENT (Milestone 7)
      ========================================================================= */}
      {activeTab === 'adp-earnings' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & Metrics */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold mb-2">
                  <span>💰</span>
                  <span>Finance & Operator Compensation</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  ADP Operator Earnings & Automated Payout Batches
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure dynamic compensation rates per verified collection and disburse operator earnings via TransactPay or manual bank transfers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loadAdpRates();
                    loadAdpEarnings();
                  }}
                  disabled={adpEarningsLoading || adpRatesLoading}
                  className="px-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <span className={adpEarningsLoading ? 'animate-spin' : ''}>🔄</span>
                  <span>Refresh Ledger</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-500 font-semibold block">Total Completed Collections</span>
                <span className="text-2xl font-black text-slate-900">{adpEarnings.length}</span>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <span className="text-xs text-amber-700 font-semibold block">Pending Operator Payouts</span>
                <span className="text-2xl font-black text-amber-800">
                  ₦{(
                    adpEarnings
                      .filter((e) => e.status === 'PENDING' || e.status === 'APPROVED')
                      .reduce((sum, e) => sum + Number(e.amountCents || 0), 0) / 100
                  ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <span className="text-xs text-emerald-700 font-semibold block">Total Payouts Disbursed</span>
                <span className="text-2xl font-black text-emerald-800">
                  ₦{(
                    adpEarnings
                      .filter((e) => e.status === 'PAID')
                      .reduce((sum, e) => sum + Number(e.amountCents || 0), 0) / 100
                  ).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                <span className="text-xs text-brand-700 font-semibold block">Active Configured Rates</span>
                <span className="text-2xl font-black text-brand-900">
                  {adpRates.filter((r) => r.isActive).length}
                </span>
              </div>
            </div>
          </div>

          {/* Rate Configuration Panel */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900">Configure Compensation Rate per Collection</h3>
            <p className="text-xs text-slate-500">
              Set the amount earned by student operators for each verified food order collection at their hostel.
            </p>

            <form onSubmit={handleSaveAdpRate} className="flex flex-col sm:flex-row gap-3 items-end pt-2">
              <div className="flex-1 w-full">
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Scope (Global or Zone Specific)
                </label>
                <select
                  value={newRateZoneId}
                  onChange={(e) => setNewRateZoneId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="GLOBAL">Default Fallback (All 13 UNILESA Zones)</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Zone Specific)
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-60">
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Rate in Naira per Collection (₦) *
                </label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={newRateNaira}
                  onChange={(e) => setNewRateNaira(Number(e.target.value))}
                  placeholder="e.g. 300"
                  required
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={savingRate}
                  className="w-full sm:w-auto h-10 px-5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition shadow-2xs"
                >
                  {savingRate ? 'Saving Rate...' : '✓ Set Rate'}
                </button>
              </div>
            </form>

            {/* Currently Active Rates list */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Currently Active Compensation Rates:</h4>
              <div className="flex flex-wrap gap-2">
                {adpRates.filter((r) => r.isActive).map((rate) => (
                  <span
                    key={rate.id}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900"
                  >
                    {rate.coverageZone ? rate.coverageZone.name : 'All Zones (Global)'}:{' '}
                    <strong>₦{(Number(rate.ratePerCollectionCents) / 100).toLocaleString()}</strong> / collection
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Pending Operator Payouts & Batch Execution */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900">Unbatched Operator Balances Ready for Payout</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Operator</th>
                    <th className="px-4 py-3">Hostel & Zone</th>
                    <th className="px-4 py-3">Bank Details</th>
                    <th className="px-4 py-3 text-center">Unpaid Collections</th>
                    <th className="px-4 py-3 text-right">Unpaid Balance</th>
                    <th className="px-4 py-3 text-right">Payout Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Group unbatched earnings by operator */}
                  {Array.from(
                    new Set(
                      adpEarnings
                        .filter((e) => (e.status === 'PENDING' || e.status === 'APPROVED') && !e.payoutBatchId)
                        .map((e) => e.adpOperatorId)
                    )
                  ).map((operatorId) => {
                    const opEarnings = adpEarnings.filter(
                      (e) => e.adpOperatorId === operatorId && (e.status === 'PENDING' || e.status === 'APPROVED') && !e.payoutBatchId
                    );
                    const operator = opEarnings[0]?.adpOperator;
                    const totalCents = opEarnings.reduce((sum, e) => sum + Number(e.amountCents || 0), 0);

                    return (
                      <tr key={operatorId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {operator?.fullName || 'Operator'}
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            {operator?.matricNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {operator?.hostelName}
                          <span className="block text-[10px] text-slate-400">
                            {operator?.coverageZone?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {operator?.bankName} ({operator?.accountNumberMasked})
                          <span className="block text-[10px] text-emerald-700 font-semibold">
                            {operator?.nameEnquiryVerifiedName || operator?.accountName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                          {opEarnings.length}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-emerald-700 text-sm">
                          ₦{(totalCents / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            disabled={isProcessingPayout}
                            onClick={() => handleBatchPayout(operatorId, 'TRANSACTPAY')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-2xs"
                          >
                            ⚡ TransactPay
                          </button>
                          <button
                            type="button"
                            disabled={isProcessingPayout}
                            onClick={() => handleBatchPayout(operatorId, 'MANUAL')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-xl text-xs transition"
                          >
                            🏦 Manual
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {adpEarnings.filter((e) => (e.status === 'PENDING' || e.status === 'APPROVED') && !e.payoutBatchId).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400">
                        No pending unpaid operator earnings right now. All verified collections are up to date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Itemized Collections Earnings Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Itemized Collection Earnings Ledger</h3>
              <div>
                <select
                  value={adpEarningFilterStatus}
                  onChange={(e) => setAdpEarningFilterStatus(e.target.value)}
                  className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved (Locked in Batch)</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Collection Date</th>
                    <th className="px-4 py-3">Order Ref</th>
                    <th className="px-4 py-3">Operator & Hostel</th>
                    <th className="px-4 py-3 text-right">Amount (₦)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adpEarnings.map((earn) => (
                    <tr key={earn.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-[11px]">
                        {new Date(earn.collectedAt).toLocaleString('en-GB')}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {earn.order?.reference || earn.orderId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{earn.adpOperator?.fullName}</span>
                        <span className="text-[10px] text-slate-400 block">{earn.adpOperator?.hostelName}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700">
                        ₦{(Number(earn.amountCents) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            earn.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : earn.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {earn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {adpEarnings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        No collection earnings records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADP OPERATOR INSPECTION & MULTI-TRACK VERIFICATION
      ========================================================================= */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col text-xs">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded text-[11px]">
                    {selectedApp.applicationReference}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[11px]">
                    {selectedApp.coverageZone?.name || 'Coverage Zone'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedApp.fullName} ({selectedApp.matricNumber})
                </h3>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 text-base"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Top Banner: Verification Readiness */}
              {selectedApp.studentVerificationStatus === 'APPROVED' &&
              selectedApp.hostelVerificationStatus === 'APPROVED' &&
              selectedApp.paymentVerificationStatus === 'APPROVED' &&
              !selectedApp.isActive ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block text-sm">
                      ✓ All 3 Verification Tracks Approved!
                    </span>
                    <span className="text-emerald-700 text-[11px]">
                      This applicant is eligible to become an active delivery port operator.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApproveOperator}
                    disabled={isVerifying}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition"
                  >
                    {isVerifying ? 'Activating...' : '🚀 Activate Delivery Port'}
                  </button>
                </div>
              ) : selectedApp.isActive ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block text-sm">
                      ✓ Currently Active ADP Operator
                    </span>
                    <span className="text-emerald-700 text-[11px]">
                      Serving coverage zone: {selectedApp.coverageZone?.name || 'UNILESA Zone'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSuspendModal(true)}
                      className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold rounded-xl text-xs transition"
                    >
                      ⏸️ Suspend
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBlockModal(true)}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-xl text-xs transition"
                    >
                      🚫 Block
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Grid: 3 Verification Tracks */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Track 1: Student Identity */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                      🎓 Student Identity
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedApp.studentVerificationStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedApp.studentVerificationStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedApp.studentVerificationStatus}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div><strong>Faculty:</strong> {selectedApp.faculty}</div>
                    <div><strong>Dept:</strong> {selectedApp.department}</div>
                    <div><strong>Level:</strong> {selectedApp.academicLevel}</div>
                    <div><strong>Phone:</strong> {selectedApp.phone}</div>
                    <div><strong>Email:</strong> {selectedApp.email}</div>
                  </div>

                  {/* Document View Button */}
                  <div className="pt-2 border-t border-slate-200">
                    {loadingDocUrl ? (
                      <span className="text-slate-400 text-[11px]">Loading doc...</span>
                    ) : selectedDocUrl ? (
                      <a
                        href={selectedDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-xl text-[11px] transition"
                      >
                        <span>📄</span>
                        <span>View Student ID (Signed URL)</span>
                      </a>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Doc link unavailable</span>
                    )}
                  </div>

                  {/* Track Actions */}
                  <div className="flex gap-1.5 pt-2">
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('STUDENT', 'APPROVED')}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('STUDENT', 'INFO_REQUESTED')}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ❓ Info
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('STUDENT', 'REJECTED')}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* Track 2: Hostel Location */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                      🏠 Hostel Location
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedApp.hostelVerificationStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedApp.hostelVerificationStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedApp.hostelVerificationStatus}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div><strong>Hostel:</strong> {selectedApp.hostelName}</div>
                    <div><strong>Address:</strong> {selectedApp.hostelAddress}</div>
                    <div><strong>Landmark:</strong> {selectedApp.closestLandmark || 'None provided'}</div>
                    <div><strong>Zone:</strong> {selectedApp.coverageZone?.name}</div>
                  </div>

                  {/* Track Actions */}
                  <div className="flex gap-1.5 pt-6">
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('HOSTEL', 'APPROVED')}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('HOSTEL', 'INFO_REQUESTED')}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ❓ Info
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('HOSTEL', 'REJECTED')}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>

                {/* Track 3: Payment Details */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                      💳 Payment & Bank
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedApp.paymentVerificationStatus === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedApp.paymentVerificationStatus === 'MANUAL_REVIEW'
                          ? 'bg-purple-100 text-purple-800'
                          : selectedApp.paymentVerificationStatus === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedApp.paymentVerificationStatus}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-600 text-[11px]">
                    <div><strong>Bank:</strong> {selectedApp.bankName}</div>
                    <div><strong>NUBAN:</strong> {selectedApp.accountNumberMasked}</div>
                    <div><strong>Claimed Name:</strong> {selectedApp.accountName}</div>
                    {selectedApp.nameEnquiryVerifiedName && (
                      <div className="text-emerald-700">
                        <strong>TransactPay Confirmed:</strong> {selectedApp.nameEnquiryVerifiedName}
                      </div>
                    )}
                  </div>

                  {/* Track Actions */}
                  <div className="flex gap-1.5 pt-6">
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('PAYMENT', 'APPROVED')}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('PAYMENT', 'MANUAL_REVIEW')}
                      className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ⚙️ Review
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerifyTrack('PAYMENT', 'REJECTED')}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] transition"
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Input for Track Decisions */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Verification Decision Notes (Recorded in Immutable Audit Log)
                </label>
                <input
                  type="text"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="e.g. Student ID matched with UNILESA department database..."
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Audit History */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="font-bold text-slate-800 text-xs mb-3">Verification History Audit Trail</h4>
                {selectedApp.histories && selectedApp.histories.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedApp.histories.map((h: any) => (
                      <div key={h.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-700">[{h.track}]</span> {h.oldStatus} → <strong className="text-brand-700">{h.newStatus}</strong>
                          {h.reason && <span className="text-slate-500 block text-[10px]">{h.reason}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">No history logged yet.</span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Reason Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900">Suspend Delivery Port Operator</h3>
            <p className="text-slate-500">Provide an official reason for suspending {selectedApp?.fullName}. This will temporarily pause order distribution.</p>
            <textarea
              rows={3}
              value={suspensionReasonInput}
              onChange={(e) => setSuspensionReasonInput(e.target.value)}
              placeholder="e.g. Student on semester examination leave..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendOperator}
                disabled={isVerifying}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Reason Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <h3 className="text-base font-bold text-rose-700">Block Delivery Port Operator Permanently</h3>
            <p className="text-slate-500">Provide an official reason for permanently blocking {selectedApp?.fullName}.</p>
            <textarea
              rows={3}
              value={suspensionReasonInput}
              onChange={(e) => setSuspensionReasonInput(e.target.value)}
              placeholder="e.g. Policy violation or fraudulent matriculation documents..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockOperator}
                disabled={isVerifying}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition"
              >
                Confirm Permanent Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: EDIT PRODUCT, PRICE, STOCK & PHOTO (Req 1, 2, 6)
      ========================================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900">Edit Foodstuff Details & Picture</h3>
                <p className="text-xs text-slate-500">Updates sync directly with customer marketplace.</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Image Preview & Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-2">Food Picture</label>
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border-2 border-brand-200 flex-shrink-0">
                    <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editingProduct.imageUrl}
                      onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                      placeholder="Paste Image URL"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                    />
                    <div className="flex items-center space-x-2">
                      <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px]">
                        📁 Upload Picture
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, 'edit')}
                        />
                      </label>
                      <span className="text-[10px] text-slate-400">or pick preset below</span>
                    </div>
                  </div>
                </div>

                {/* Picture Presets */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PHOTO_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, imageUrl: preset.url })}
                      className="text-[10px] font-semibold px-2 py-1 bg-slate-100 hover:bg-brand-50 hover:text-brand-800 rounded-lg border border-slate-200"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wholesale Price (Naira ₦)</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.priceCents / 100}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        priceCents: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Displays as: {formatNaira(editingProduct.priceCents)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={editingProduct.stock}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: Number(e.target.value),
                      })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-sm"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {editingProduct.stock <= 0 ? 'Will show Out of Stock' : editingProduct.stock <= 20 ? 'Will show Low Stock' : 'In Stock'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit of Measurement</label>
                  <input
                    type="text"
                    value={editingProduct.unit}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all"
                >
                  {savingProduct ? 'Saving to Supabase...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD NEW PRODUCT
      ========================================================================= */}
      {isNewProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900">Add New Foodstuff to Catalogue</h3>
                <p className="text-xs text-slate-500">Will immediately appear in customer marketplace.</p>
              </div>
              <button onClick={() => setIsNewProductOpen(false)} className="p-1.5 text-slate-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Food Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Premium White Garri (50kg)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price in Naira (₦) *</label>
                  <input
                    type="number"
                    name="priceNaira"
                    required
                    placeholder="e.g. 75000"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Starting Stock Units *</label>
                  <input
                    type="number"
                    name="stock"
                    required
                    defaultValue={50}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select name="category" className="w-full px-3 py-2.5 border border-slate-300 rounded-xl">
                    <option value="Grains & Flours">Grains & Flours</option>
                    <option value="Oils & Fats">Oils & Fats</option>
                    <option value="Tubers & Roots">Tubers & Roots</option>
                    <option value="Soup Ingredients">Soup Ingredients</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Scale</label>
                  <input
                    type="text"
                    name="unit"
                    defaultValue="50kg Bag"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Food Picture URL</label>
                <input
                  type="text"
                  name="imageUrl"
                  defaultValue="https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Clean, stone-free processed foodstuff directly from farm harvest."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewProductOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all"
                >
                  {savingProduct ? 'Adding to Supabase...' : 'Add to Marketplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: MANUAL DELIVERY STATUS & DISPATCH UPDATER (Req 4)
      ========================================================================= */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900">Update Order Delivery Process</h3>
                <p className="text-xs text-slate-500">Tracking Ref: {editingOrder.reference}</p>
              </div>
              <button onClick={() => setEditingOrder(null)} className="p-1.5 text-slate-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDeliveryStatus} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{editingOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-semibold text-slate-800">{editingOrder.deliveryAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Items:</span>
                  <span className="font-semibold text-slate-800">{editingOrder.itemsSummary}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Delivery Stage *</label>
                <select
                  value={editingOrder.deliveryStatus}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      deliveryStatus: e.target.value as AdminOrder['deliveryStatus'],
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-extrabold text-sm text-brand-900 bg-white"
                >
                  <option value="PENDING">PENDING (Order Received)</option>
                  <option value="PROCESSING">PROCESSING (Bagging & Loading at Farm Depot)</option>
                  <option value="DISPATCHED">DISPATCHED (With Delivery Driver / Van)</option>
                  <option value="DELIVERED">DELIVERED (Customer Confirmed Received)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dispatch Rider / Driver Name</label>
                  <input
                    type="text"
                    value={editingOrder.assignedRider}
                    onChange={(e) => setEditingOrder({ ...editingOrder, assignedRider: e.target.value })}
                    placeholder="e.g. Musa Ibrahim (Bike 04)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rider Phone</label>
                  <input
                    type="text"
                    value={editingOrder.riderPhone}
                    onChange={(e) => setEditingOrder({ ...editingOrder, riderPhone: e.target.value })}
                    placeholder="0802 000 0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dispatch & Tracking Notes</label>
                <textarea
                  rows={2}
                  value={editingOrder.notes}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  placeholder="e.g. Out for morning delivery, called customer before departure."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md"
                >
                  Update Delivery Process
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: EDIT FOOD BUNDLE — Full Item Editor with Live Price Calculation
      ========================================================================= */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[93vh] flex flex-col">

            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-brand-50 to-slate-50 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">✏️ Edit Food Bundle</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Changes sync live to Supabase & public Food Bundle page</p>
              </div>
              <button onClick={() => setEditingPackage(null)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-5 space-y-5 text-xs">

                {/* ── Bundle Details ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Bundle Name *</label>
                    <input
                      type="text"
                      value={editingPackage.name}
                      onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Badge Label</label>
                    <input
                      type="text"
                      value={editingPackage.badge || ''}
                      onChange={(e) => setEditingPackage({ ...editingPackage, badge: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                      placeholder="e.g. Budget Student Essential"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Publication Status</label>
                    <select
                      value={editingPackage.status}
                      onChange={(e) =>
                        setEditingPackage({ ...editingPackage, status: e.target.value as 'ACTIVE' | 'DRAFT' | 'INACTIVE' })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white"
                    >
                      <option value="ACTIVE">✅ Published (ACTIVE)</option>
                      <option value="DRAFT">🔒 Draft (Pending Validation)</option>
                      <option value="INACTIVE">📦 Inactive (Archived)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editingPackage.description}
                      onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl resize-none"
                      placeholder="Short description of what this bundle contains…"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Bundle Image URL</label>
                    <input
                      type="text"
                      value={editingPackage.imageUrl}
                      onChange={(e) => setEditingPackage({ ...editingPackage, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px]"
                      placeholder="https://…"
                    />
                  </div>
                </div>

                {/* ── Add Food Item ─────────────────────────────────────── */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">➕ Add Food Item from Inventory</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search inventory (e.g. Rice, Beans, Noodles…)"
                      className="w-full px-3 py-2.5 border border-brand-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none"
                    />
                    {itemSearch.trim().length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {products
                          .filter((p) =>
                            p.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
                            !draftItems.find((d) => d.productId === p.id)
                          )
                          .slice(0, 12)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleAddDraftItem(p)}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0"
                            >
                              <span className="font-semibold text-slate-800">{p.name}</span>
                              <span className="text-brand-700 font-bold">{formatNaira(p.priceCents)}</span>
                            </button>
                          ))}
                        {products.filter((p) =>
                          p.name.toLowerCase().includes(itemSearch.toLowerCase()) &&
                          !draftItems.find((d) => d.productId === p.id)
                        ).length === 0 && (
                          <p className="px-4 py-3 text-slate-400 text-[11px]">No matching items found in inventory.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Bundle Items Table ────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-slate-700">Bundle Items ({draftItems.length})</label>
                    {draftItems.length > 0 && (
                      <span className="text-[10px] text-slate-400">Prices are live from inventory</span>
                    )}
                  </div>

                  {draftItems.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                      <p className="text-2xl mb-1">🛒</p>
                      <p className="text-xs">No items yet. Search above to add inventory items.</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-[10px] text-slate-500 uppercase tracking-wide">
                            <th className="px-3 py-2 text-left">Item</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2 text-right">Subtotal</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {draftItems.map((d) => (
                            <tr key={d.productId} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2.5 font-semibold text-slate-800">{d.name}</td>
                              <td className="px-3 py-2.5 text-right text-slate-500">{formatNaira(d.priceCents)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDraftQtyChange(d.productId, d.quantity - 1)}
                                    disabled={d.quantity <= 1}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-black text-sm flex items-center justify-center transition-colors"
                                    aria-label={`Decrease qty for ${d.name}`}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={d.quantity}
                                    onChange={(e) => handleDraftQtyChange(d.productId, Number(e.target.value))}
                                    className="w-12 text-center border border-slate-200 rounded-lg py-0.5 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-400"
                                    aria-label={`Quantity for ${d.name}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDraftQtyChange(d.productId, d.quantity + 1)}
                                    className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-colors"
                                    aria-label={`Increase qty for ${d.name}`}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-slate-800">{formatNaira(d.priceCents * d.quantity)}</td>
                              <td className="px-2 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraftItem(d.productId)}
                                  className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  aria-label={`Remove ${d.name}`}
                                >
                                  🗑
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-brand-50 border-t-2 border-brand-200">
                          <tr>
                            <td colSpan={3} className="px-3 py-3 font-black text-slate-700 text-xs">Bundle Total (auto-calculated)</td>
                            <td className="px-3 py-3 text-right font-black text-brand-700 text-sm">{formatNaira(draftTotalCents)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  <span className="font-bold text-slate-700">Live Total: </span>
                  <span className="font-black text-brand-700 text-sm">{formatNaira(draftTotalCents)}</span>
                  {draftItems.length > 0 && <span className="ml-1 text-[10px]">({draftItems.length} items — server validates on save)</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPackage(null)}
                    className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPackage}
                    className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all"
                  >
                    {savingPackage ? '⏳ Saving to Supabase…' : '💾 Save & Publish Live'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
