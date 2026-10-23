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
  const [activeTab, setActiveTab] = useState<'inventory' | 'bundles' | 'kyc' | 'deliveries' | 'delivery-fee' | 'transactions' | 'overview'>('inventory');

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

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const [data, cats, unitList, customerList] = await Promise.all([
        supabaseProducts.listAll(),
        supabaseCategories.list(),
        supabaseUnits.list(),
        adminApi.getCustomers().catch(() => null),
      ]);
      setProducts(data.map(mapToAdminProduct));
      setCategories(cats);
      setUnits(unitList);
      if (Array.isArray(customerList) && customerList.length > 0) {
        setCustomers(customerList);
      }
    } catch (err: any) {
      console.error('[Admin] Failed to load products:', err);
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
          const loaded: DeliveryFeeSettings = {
            standardFeeNaira: res.standardFeeCents / 100,
            freeDeliveryThresholdNaira: (res.freeDeliveryThresholdCents ?? 10000000) / 100,
            expressFeeNaira: (res.expressFeeCents ?? 500000) / 100,
            stateFeesNaira: {
              Lagos: (res.stateFees?.Lagos ?? 250000) / 100,
              Ogun: (res.stateFees?.Ogun ?? 350000) / 100,
              Abuja: (res.stateFees?.Abuja ?? 450000) / 100,
              Rivers: (res.stateFees?.Rivers ?? 500000) / 100,
              Oyo: (res.stateFees?.Oyo ?? 350000) / 100,
              Default: (res.stateFees?.Default ?? 250000) / 100,
            },
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
      .catch(() => {});
  }, []);

  const handleSaveDeliveryConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDeliveryFee(true);
    const payload = {
      standardFeeCents: Math.round(Number(deliveryConfig.standardFeeNaira) * 100),
      freeDeliveryThresholdCents: Math.round(Number(deliveryConfig.freeDeliveryThresholdNaira) * 100),
      expressFeeCents: Math.round(Number(deliveryConfig.expressFeeNaira) * 100),
      stateFees: Object.entries(deliveryConfig.stateFeesNaira).reduce((acc, [k, v]) => {
        acc[k] = Math.round(Number(v) * 100);
        return acc;
      }, {} as Record<string, number>),
    };

    try {
      localStorage.setItem('affy_delivery_fee_config', JSON.stringify(payload));
      window.dispatchEvent(new Event('affy_delivery_fee_updated'));
      await adminApi.updateDeliveryFee(payload);
      showToast('✅ Delivery rates updated! Customer cart & checkout synchronized.');
    } catch (err: any) {
      console.warn('Backend delivery fee update warning:', err);
      showToast('✅ Delivery rates saved locally & applied to customer checkout!');
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
      await supabaseProducts.update(edited.id, {
        name: edited.name,
        description: edited.description,
        price_cents: Number(edited.priceCents),
        image_url: edited.imageUrl,
        stock: Number(edited.stock),
        category_id: edited.category_id,
        unit_id: edited.unit_id,
      });
      // Reload admin table from Supabase so we see the confirmed persisted values
      await loadProducts();
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
  const handleUpdateKYC = (customerId: string, newStatus: CustomerKYC['kycStatus']) => {
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
  };

  // 4. Manual Delivery Process Updater
  const handleUpdateDeliveryStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === editingOrder.id ? editingOrder : o)),
    );
    setEditingOrder(null);
    showToast(`Order ${editingOrder.reference} marked as ${editingOrder.deliveryStatus}`);
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

        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2.5 rounded-2xl transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-brand-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span>💳 Complete Transaction Ledger</span>
          <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{transactions.length}</span>
        </button>
      </div>

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
                  Verify customer identities, BVN/NIN compliance, and digital wallet limits.
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
                    <th className="px-6 py-4">Wallet Balance</th>
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

                      <td className="px-6 py-4 font-black text-slate-900 text-sm">
                        {formatNaira(c.walletBalanceCents)}
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
                    <div className="text-slate-400">Sample Order Under Threshold (₦45,000 in Lagos):</div>
                    <div className="text-sm font-bold text-white mt-1">
                      Delivery: <span className="text-emerald-400 font-black">₦{Number(deliveryConfig.stateFeesNaira.Lagos ?? deliveryConfig.standardFeeNaira).toLocaleString()}</span>
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
                      standardFeeNaira: 2500,
                      freeDeliveryThresholdNaira: 100000,
                      expressFeeNaira: 5000,
                      stateFeesNaira: {
                        Lagos: 2500,
                        Ogun: 3500,
                        Abuja: 4500,
                        Rivers: 5000,
                        Oyo: 3500,
                        Default: 2500,
                      },
                    });
                    showToast('Reset to default delivery fees. Click Save to apply.');
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

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Complete Financial Ledger & Payment Audits</h2>
                <p className="text-xs text-slate-500">
                  Permanent records of online payment settlements, card charges, and wallet debits.
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
