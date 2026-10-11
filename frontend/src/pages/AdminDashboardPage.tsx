// frontend/src/pages/AdminDashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { AffyLogo } from '../components/AffyLogo';
import { adminApi } from '../services/api';

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  stock: number;
  unit: string;
  priceCents: number;
  imageUrl: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
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
  paymentChannel: 'TransactPay' | 'Wallet';
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  deliveryStatus: 'PENDING' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  assignedRider: string;
  riderPhone: string;
  notes: string;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'inventory' | 'kyc' | 'deliveries' | 'transactions' | 'overview'>('inventory');

  // Shared state with persistence for customer marketplace synchronization
  const [products, setProducts] = useState<AdminProduct[]>(() => {
    try {
      const stored = localStorage.getItem('affy_custom_products');
      return stored ? JSON.parse(stored) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [customers, setCustomers] = useState<CustomerKYC[]>(INITIAL_CUSTOMERS);
  const [orders, setOrders] = useState<AdminOrder[]>(INITIAL_ORDERS);
  const [transactions, setTransactions] = useState<TransactionRecord[]>(INITIAL_TRANSACTIONS);

  // Modal states
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Sync products with localStorage so customer marketplace always sees updates immediately
  const persistProducts = (updated: AdminProduct[]) => {
    setProducts(updated);
    try {
      localStorage.setItem('affy_custom_products', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to sync products to storage', e);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // 1 & 6. Handle Editing Price, Stock, Image & Product Details
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const stockNum = Number(editingProduct.stock);
    const updatedStatus: AdminProduct['status'] =
      stockNum <= 0 ? 'Out of Stock' : stockNum <= 20 ? 'Low Stock' : 'In Stock';

    const updatedItem: AdminProduct = {
      ...editingProduct,
      stock: stockNum,
      status: updatedStatus,
    };

    const updatedList = products.map((p) => (p.id === updatedItem.id ? updatedItem : p));
    persistProducts(updatedList);

    // Call backend API to persist in PostgreSQL if available
    adminApi
      .updateProduct(updatedItem.id, {
        name: updatedItem.name,
        description: updatedItem.description,
        priceCents: updatedItem.priceCents,
        stock: updatedItem.stock,
        imageUrl: updatedItem.imageUrl,
      })
      .catch(() => {});

    setEditingProduct(null);
    showToast(`Updated ${updatedItem.name} (Price: ${formatNaira(updatedItem.priceCents)}, Stock: ${updatedItem.stock})`);
  };

  // Quick Restock (+20 or +50)
  const handleQuickRestock = (id: string, amount: number) => {
    const updatedList = products.map((p) => {
      if (p.id === id) {
        const newStock = p.stock + amount;
        return {
          ...p,
          stock: newStock,
          status: (newStock <= 0 ? 'Out of Stock' : newStock <= 20 ? 'Low Stock' : 'In Stock') as AdminProduct['status'],
        };
      }
      return p;
    });
    persistProducts(updatedList);
    showToast(`Added +${amount} units to stock!`);
  };

  // Add New Product
  const handleCreateProduct = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const unit = formData.get('unit') as string;
    const priceNaira = Number(formData.get('priceNaira'));
    const stock = Number(formData.get('stock'));
    const imageUrl = (formData.get('imageUrl') as string) || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80';
    const description = formData.get('description') as string;

    const newProd: AdminProduct = {
      id: `prod-${Date.now()}`,
      name,
      description,
      category,
      unit,
      priceCents: priceNaira * 100,
      stock,
      imageUrl,
      status: stock <= 0 ? 'Out of Stock' : stock <= 20 ? 'Low Stock' : 'In Stock',
    };

    const updatedList = [newProd, ...products];
    persistProducts(updatedList);
    setIsNewProductOpen(false);
    showToast(`Created new product: ${name}`);
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
                  {products.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group cursor-pointer"
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
                            onClick={() => handleQuickRestock(item.id, 20)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors"
                            title="Add +20 units quickly"
                          >
                            +20 Stock
                          </button>
                          <button
                            onClick={() => setEditingProduct(item)}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-[11px] shadow-2xs transition-colors"
                          >
                            Edit
                          </button>
                        </div>
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
          TAB 2: CUSTOMER DATABASE FOR KYC SAKE (Req 3)
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
              <span className="text-xs text-blue-600 font-semibold">TransactPay Rail Volume</span>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {formatNaira(
                  transactions
                    .filter((t) => t.channel.includes('TransactPay'))
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
                  Permanent records of TransactPay gateway settlements, card charges, and wallet debits.
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
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Changes
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
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md"
                >
                  Add to Marketplace
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
    </div>
  );
};

export default AdminDashboardPage;
