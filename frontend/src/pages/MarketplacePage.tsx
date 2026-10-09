import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { productsApi } from '../services/api';
import { formatNaira } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { AffyLogo } from '../components/AffyLogo';

// Realistic Nigerian raw-foodstuff catalogue for instant interactive display
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'Premium Royal Stallion Rice (50kg)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice. Clean and cooks fluffy.',
    priceCents: 7500000, // ₦75,000.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i1', productId: 'prod-001', quantity: 140, lowStockThreshold: 20 },
  },
  {
    id: 'prod-002',
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans directly from Niger State farms.',
    priceCents: 9800000, // ₦98,000.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i2', productId: 'prod-002', quantity: 85, lowStockThreshold: 15 },
  },
  {
    id: 'prod-003',
    name: 'Original Ijebu Garri (Paint Rubber / 4kg)',
    description: 'Extremely dry, crunchy, with the iconic sour tangy Ijebu kick. Guaranteed sand-free.',
    priceCents: 450000, // ₦4,500.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u2', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i3', productId: 'prod-003', quantity: 320, lowStockThreshold: 40 },
  },
  {
    id: 'prod-004',
    name: 'Pure Unadulterated Palm Oil (25L Keg)',
    description: 'Fresh red oil from Edo State palm mills. No artificial red dye or chemical additives.',
    priceCents: 3800000, // ₦38,000.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u3', name: '25L Keg', symbol: 'keg' },
    category: { id: 'c2', name: 'Oils & Fats', isActive: true },
    inventory: { id: 'i4', productId: 'prod-004', quantity: 45, lowStockThreshold: 10 },
  },
  {
    id: 'prod-005',
    name: 'Benue Giant White Yam (Set of 5 Tubers)',
    description: 'Dry, starch-rich tubers of Benue yam, perfect for fluffy pounded yam or boiled yam.',
    priceCents: 1650000, // ₦16,500.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u4', name: 'Bundle (5 Tubers)', symbol: 'bundle' },
    category: { id: 'c3', name: 'Tubers & Roots', isActive: true },
    inventory: { id: 'i5', productId: 'prod-005', quantity: 90, lowStockThreshold: 15 },
  },
  {
    id: 'prod-006',
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Fat, high-oil yield machine-cleaned melon seeds for rich, authentic Nigerian Egusi soup.',
    priceCents: 950000, // ₦9,500.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u2', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i6', productId: 'prod-006', quantity: 60, lowStockThreshold: 10 },
  },
  {
    id: 'prod-007',
    name: 'Refined Vegetable Oil - Grand / Power Oil (25L)',
    description: 'Heart-friendly, cholesterol-free pure vegetable cooking oil for household and industrial catering.',
    priceCents: 5200000, // ₦52,000.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u3', name: '25L Keg', symbol: 'keg' },
    category: { id: 'c2', name: 'Oils & Fats', isActive: true },
    inventory: { id: 'i7', productId: 'prod-007', quantity: 50, lowStockThreshold: 12 },
  },
  {
    id: 'prod-008',
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried aromatic Oron crayfish (1kg) paired with 5 large oven-smoked catfish.',
    priceCents: 1200000, // ₦12,000.00
    currency: 'NGN',
    isActive: true,
    unit: { id: 'u5', name: 'Bundle Pack', symbol: 'pack' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i8', productId: 'prod-008', quantity: 35, lowStockThreshold: 5 },
  },
];

const CATEGORIES = [
  'All Items',
  'Grains & Flours',
  'Tubers & Roots',
  'Oils & Fats',
  'Soup Ingredients',
];

export const MarketplacePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    // Try to fetch from backend API if running
    productsApi
      .list()
      .then((data) => {
        if (data && data.length > 0) {
          setProducts(data);
        }
      })
      .catch(() => {
        // Fall back to curated staples list
      });
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCat =
      selectedCategory === 'All Items' ||
      (p.category && p.category.name === selectedCategory);
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-12 pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* Hero Banner with Affy Brand Dark Theme */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-affy-dark via-brand-900 to-slate-950 text-white shadow-2xl p-8 sm:p-12 lg:p-16 border border-brand-800/40">
        {/* Subtle decorative background patterns matching brand rainbow colors */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-brand-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute right-1/4 -top-12 w-64 h-64 rounded-full bg-affy-pink/20 blur-2xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-64 h-64 rounded-full bg-affy-cyan/15 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-semibold text-brand-200">
              <span className="text-accent-400">🔥</span>
              <span>Hedge Against Food Inflation in Nigeria</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Buy Raw Foodstuff at Farm-Gate Prices. Save Toward Supplies.
            </h1>

            <p className="text-base sm:text-lg text-brand-100/90 leading-relaxed font-light">
              Skip middlemen markup in open markets. Buy bags of Rice, Oloyin Beans, Ijebu Garri, Benue Yam, and Pure Palm Oil directly or lock in today's price with our automated Food Savings plans.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/savings"
                className="bg-accent-500 hover:bg-accent-600 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg hover:shadow-glow-accent transition-all flex items-center space-x-2"
              >
                <span>Start Food Savings Plan</span>
                <span>→</span>
              </Link>
              <Link
                to="/packages"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-medium px-6 py-3.5 rounded-xl transition-all"
              >
                Explore Family Food Bundles
              </Link>
            </div>

            {/* Quick Stats Badges */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-brand-800/80">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">30-40%</div>
                <div className="text-xs text-brand-200/80">Cheaper than Retail</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">100%</div>
                <div className="text-xs text-brand-200/80">Standardized Scales</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">₦0 Extra</div>
                <div className="text-xs text-brand-200/80">Savings Account Fee</div>
              </div>
            </div>
          </div>

          {/* Logo Showcase inside Hero */}
          <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-inner max-w-sm">
            <AffyLogo variant="dark" size="xl" className="scale-110 drop-shadow-2xl" />
            <p className="mt-4 text-center text-xs text-brand-200 font-medium">
              Nigeria's #1 Bulk Foodstuff & Disciplined Food Banking Platform
            </p>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rice, beans, garri, yam, palm oil..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
            />
            <svg
              className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500 flex justify-between items-center px-1">
          <span>Showing {filteredProducts.length} certified food items</span>
          <span>Prices update daily with direct wholesale farm index</span>
        </div>
      </section>

      {/* Product Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const inStock = product.inventory ? product.inventory.quantity > 0 : true;
          return (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-brand-300"
            >
              {/* Product Card Top Visual */}
              <div className="p-5 pb-3">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200/70">
                    {product.category?.name ?? 'Staple'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inStock
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-700 transition-colors line-clamp-2">
                  {product.name}
                </h3>

                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Price & Action */}
              <div className="p-5 pt-3 bg-slate-50/70 border-t border-slate-100 mt-2 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-lg font-extrabold text-slate-900">
                      {formatNaira(product.priceCents)}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1">
                      / {product.unit?.name ?? 'unit'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/savings"
                    className="text-center text-xs font-semibold py-2 px-3 rounded-xl border border-brand-300 bg-white hover:bg-brand-50 text-brand-700 transition-colors"
                  >
                    Save Towards
                  </Link>
                  <button
                    onClick={() =>
                      showNotification(
                        `Added 1 ${product.unit?.name ?? 'unit'} of ${product.name} to order!`,
                      )
                    }
                    className="text-xs font-semibold py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all text-center"
                  >
                    Buy Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 space-y-3">
          <span className="text-4xl">🌾</span>
          <h3 className="text-base font-bold text-slate-800">No foodstuffs found</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search terms or select "All Items".
          </p>
        </div>
      )}

      {/* Trust Callout with Brand Colors */}
      <section className="bg-affy-dark text-white rounded-3xl p-8 sm:p-10 border border-purple-900/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs uppercase tracking-wider font-bold text-accent-400">
            Affy Collective Advantage
          </span>
          <h2 className="text-2xl font-bold">Need Wholesale Foodstuff for Catering or School?</h2>
          <p className="text-xs text-brand-200/90 leading-relaxed">
            Order by truckload or ton. We aggregate farm supplies across Kaduna, Benue, Kebbi, and Niger to guarantee consistency and eliminate seasonal inflation spikes.
          </p>
        </div>
        <Link
          to="/packages"
          className="whitespace-nowrap bg-white text-brand-950 hover:bg-brand-50 px-6 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all"
        >
          View Commercial Bundles
        </Link>
      </section>
    </div>
  );
};
