// frontend/src/pages/MarketplacePage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { productsApi } from '../services/api';
import { formatNaira } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { AffyLogo } from '../components/AffyLogo';

// Comprehensive Nigerian wholesale raw-foodstuff catalogue with authentic high-res images
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'Premium Royal Stallion Rice (50kg Bag)',
    description: 'Long grain, stone-free parboiled Nigerian processed rice. Clean, stone-free, and cooks fluffy without sogginess.',
    priceCents: 7500000, // ₦75,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i1', productId: 'prod-001', quantity: 140, lowStockThreshold: 20 },
  },
  {
    id: 'prod-002',
    name: 'Sweet Honey Oloyin Beans (50kg Bag)',
    description: 'Naturally sweet, fast-cooking unadulterated Nigerian brown beans direct from Niger and Kaduna State harvest.',
    priceCents: 9800000, // ₦98,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i2', productId: 'prod-002', quantity: 85, lowStockThreshold: 15 },
  },
  {
    id: 'prod-003',
    name: 'Original Ijebu White Garri (Paint Rubber / 4kg)',
    description: 'Crisp, very dry, sand-free with that authentic tangy Ijebu punch. Exceptional for soaking with cold water or eba.',
    priceCents: 450000, // ₦4,500.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1594998893017-36147cbcae05?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u2', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i3', productId: 'prod-003', quantity: 320, lowStockThreshold: 40 },
  },
  {
    id: 'prod-004',
    name: 'Pure Unadulterated Palm Oil (25L Yellow Keg)',
    description: 'Fresh thick red oil directly from Edo State farm mills. Zero chemical dyes, zero water dilution.',
    priceCents: 3800000, // ₦38,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u3', name: '25L Keg', symbol: 'keg' },
    category: { id: 'c2', name: 'Oils & Fats', isActive: true },
    inventory: { id: 'i4', productId: 'prod-004', quantity: 45, lowStockThreshold: 10 },
  },
  {
    id: 'prod-005',
    name: 'Benue Giant White Yam (Set of 5 Huge Tubers)',
    description: 'High-starch, heavy mature Benue tubers. Yields exceptionally smooth, elastic pounded yam and sweet boiled yam.',
    priceCents: 1650000, // ₦16,500.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u4', name: 'Bundle (5 Tubers)', symbol: 'bundle' },
    category: { id: 'c3', name: 'Tubers & Roots', isActive: true },
    inventory: { id: 'i5', productId: 'prod-005', quantity: 90, lowStockThreshold: 15 },
  },
  {
    id: 'prod-006',
    name: 'Hand-Peeled Egusi / Melon Seeds (Paint Rubber)',
    description: 'Machine-sorted, fat, high-oil yield peeled melon seeds for aromatic, rich Nigerian Egusi soup.',
    priceCents: 950000, // ₦9,500.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u2', name: 'Paint Rubber', symbol: 'rubber' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i6', productId: 'prod-006', quantity: 60, lowStockThreshold: 10 },
  },
  {
    id: 'prod-007',
    name: 'Refined Vegetable Cooking Oil (25L Keg)',
    description: 'Pure, triple-filtered cholesterol-free vegetable oil for catering, domestic frying, and stew preparation.',
    priceCents: 5200000, // ₦52,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u3', name: '25L Keg', symbol: 'keg' },
    category: { id: 'c2', name: 'Oils & Fats', isActive: true },
    inventory: { id: 'i7', productId: 'prod-007', quantity: 50, lowStockThreshold: 12 },
  },
  {
    id: 'prod-008',
    name: 'Smoked Catfish & Dried Crayfish Bundle',
    description: 'Kiln-dried Oron crayfish (1kg rubber) combined with 5 large oven-smoked Nigerian catfish.',
    priceCents: 1200000, // ₦12,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u5', name: 'Bundle Pack', symbol: 'pack' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i8', productId: 'prod-008', quantity: 35, lowStockThreshold: 5 },
  },
  {
    id: 'prod-009',
    name: 'Fresh Scotch Bonnet Pepper & Rodo (Wholesale Basket)',
    description: 'Pungent, hot red scotch bonnet peppers direct from farm harvest. Preserved in aerated wholesale baskets.',
    priceCents: 1450000, // ₦14,500.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u6', name: 'Farm Basket', symbol: 'basket' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i9', productId: 'prod-009', quantity: 50, lowStockThreshold: 10 },
  },
  {
    id: 'prod-010',
    name: 'Dry Kano Red Onions (Wholesale 50kg Sack)',
    description: 'Hard, thin-skinned pungent red onions with long storage life. Minimum water retention.',
    priceCents: 4200000, // ₦42,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c4', name: 'Soup Ingredients', isActive: true },
    inventory: { id: 'i10', productId: 'prod-010', quantity: 40, lowStockThreshold: 8 },
  },
  {
    id: 'prod-011',
    name: 'Fresh Cooking Plantain (Stem Bunch / 80 Fingers)',
    description: 'Firm green and semi-ripe plantain bunch from Ondo plantation groves. Ideal for dodo, bole, and plantain flour.',
    priceCents: 1100000, // ₦11,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1603052875302-d376b7c0638a?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u7', name: 'Bunch (80 Fingers)', symbol: 'bunch' },
    category: { id: 'c3', name: 'Tubers & Roots', isActive: true },
    inventory: { id: 'i11', productId: 'prod-011', quantity: 30, lowStockThreshold: 5 },
  },
  {
    id: 'prod-012',
    name: 'Yellow Bendel Cassava Garri (50kg Bag)',
    description: 'Rich, palm oil infused fried yellow garri from Delta State. Smooth texture with high density.',
    priceCents: 4600000, // ₦46,000.00
    currency: 'NGN',
    imageUrl: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=800&q=80',
    isActive: true,
    unit: { id: 'u1', name: '50kg Bag', symbol: 'bag' },
    category: { id: 'c1', name: 'Grains & Flours', isActive: true },
    inventory: { id: 'i12', productId: 'prod-012', quantity: 65, lowStockThreshold: 12 },
  },
];

const CATEGORIES = [
  'All Items',
  'Grains & Flours',
  'Oils & Fats',
  'Tubers & Roots',
  'Soup Ingredients',
];

export const MarketplacePage: React.FC = () => {
  const { user } = useAuth();
  const { items, addToCart, updateQuantity, setIsCartOpen, totalItems, totalAmountCents } = useCart();
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch live products if available, with robust fallback to high-res DEFAULT_PRODUCTS
  useEffect(() => {
    let mounted = true;
    productsApi
      .list()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          // Merge API data with images if missing
          const merged = data.map((apiItem, idx) => {
            const fallback = DEFAULT_PRODUCTS.find((p) => p.name === apiItem.name) ?? DEFAULT_PRODUCTS[idx % DEFAULT_PRODUCTS.length];
            return {
              ...apiItem,
              imageUrl: apiItem.imageUrl || fallback.imageUrl,
            };
          });
          setProducts(merged);
        }
      })
      .catch(() => {
        // Quiet fallback to DEFAULT_PRODUCTS
      });

    return () => {
      mounted = false;
    };
  }, []);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
    showNotification(`Added ${product.name} to basket!`);
  };

  const handleBuyNow = (product: Product) => {
    addToCart(product, 1);
    setIsCartOpen(true);
  };

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'All Items' || p.category?.name === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-slideDown">
          <span className="text-emerald-400 font-bold">✓</span>
          <span>{notification}</span>
          <button
            onClick={() => setIsCartOpen(true)}
            className="text-brand-300 hover:text-white underline font-bold ml-2 text-[11px]"
          >
            View Basket
          </button>
        </div>
      )}

      {/* Hero Showcase with Verified Affy Food Branding */}
      <section className="bg-gradient-to-br from-brand-950 via-affy-dark to-brand-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden border border-brand-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-brand-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Verified Raw Foodstuffs • Powered by TransactPay</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Buy Farm-Fresh Foodstuff at Guaranteed Wholesale Prices
            </h1>

            <p className="text-sm sm:text-base text-brand-100/90 leading-relaxed font-normal">
              Direct aggregation from verified agrarian farms in Benue, Niger, Kaduna, and Kebbi.
              Enjoy transparent digital scales, bulk savings, and secure 1-click checkout with{' '}
              <span className="font-bold text-white underline decoration-accent-400">TransactPay</span>.
            </p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/10 max-w-md mx-auto lg:mx-0">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">30-40%</div>
                <div className="text-xs text-brand-200/80">Cheaper than Retail</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">100%</div>
                <div className="text-xs text-brand-200/80">Standardized Scales</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">Instant</div>
                <div className="text-xs text-brand-200/80">TransactPay Checkout</div>
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
          <span className="hidden sm:inline">Daily farm wholesale index updated</span>
        </div>
      </section>

      {/* Product Grid with Images and Add to Cart */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const inStock = product.inventory ? product.inventory.quantity > 0 : true;
          const cartItem = items.find((i) => i.product.id === product.id);

          return (
            <div
              key={product.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:border-brand-300"
            >
              {/* Product Image Visual */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold text-xs uppercase">
                    Fresh Foodstuff
                  </div>
                )}

                {/* Overlays */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-white bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                    {product.category?.name ?? 'Staple'}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-md shadow-xs ${
                      inStock
                        ? 'bg-emerald-600/90 text-white border border-emerald-400/40'
                        : 'bg-rose-600/90 text-white border border-rose-400/40'
                    }`}
                  >
                    {inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>

              {/* Product Content */}
              <div className="p-5 pb-2 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-brand-700 transition-colors line-clamp-2 leading-snug">
                    {product.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-black text-slate-900 tracking-tight">
                      {formatNaira(product.priceCents)}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1 font-medium">
                      / {product.unit?.name ?? 'unit'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 pt-3 bg-slate-50/70 border-t border-slate-100 space-y-2.5">
                {cartItem ? (
                  /* Item already in basket - show quantity controls */
                  <div className="flex items-center justify-between bg-white border border-brand-200 rounded-2xl p-1 shadow-xs">
                    <button
                      onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 text-base font-black transition-colors"
                    >
                      -
                    </button>
                    <div className="text-xs font-black text-brand-900">
                      {cartItem.quantity} in Basket
                    </div>
                    <button
                      onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-brand-600 hover:bg-brand-700 text-base font-black transition-colors shadow-xs"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  /* Add to Cart button */
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="w-full py-2.5 px-4 rounded-2xl bg-white border border-brand-300 hover:bg-brand-50 text-brand-800 font-bold text-xs shadow-2xs hover:border-brand-400 transition-all flex items-center justify-center space-x-1.5"
                  >
                    <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    <span>Add to Basket</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/savings"
                    className="text-center text-[11px] font-semibold py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                  >
                    Save Towards
                  </Link>

                  <button
                    onClick={() => handleBuyNow(product)}
                    className="text-[11px] font-extrabold py-2 px-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-all text-center flex items-center justify-center space-x-1"
                  >
                    <span>Buy Now</span>
                    <span className="text-[10px]">➔</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3">
          <span className="text-4xl">🌾</span>
          <h3 className="text-base font-bold text-slate-800">No foodstuffs found</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search terms or select "All Items".
          </p>
        </div>
      )}

      {/* Floating Cart Quick Bar when items exist */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-slideUp">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center space-x-3 bg-brand-700 hover:bg-brand-800 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-brand-900/40 border border-brand-500/50 transition-all group scale-100 hover:scale-105"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="absolute -top-2 -right-2 bg-accent-400 text-brand-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            </div>
            <div className="text-left">
              <div className="text-[10px] text-brand-200 font-semibold uppercase tracking-wider">
                View Food Basket
              </div>
              <div className="text-xs font-black">{formatNaira(totalAmountCents)}</div>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs group-hover:translate-x-0.5 transition-transform">
              ➔
            </div>
          </button>
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
            Order by truckload or ton. We aggregate farm supplies across Kaduna, Benue, Kebbi, and Niger
            to guarantee consistency and eliminate seasonal inflation spikes.
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
