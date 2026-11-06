// frontend/src/pages/MarketplacePage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Product } from '../types';
import { formatNaira } from '../utils/format';
import { useCart } from '../context/CartContext';
import { AffyLogo } from '../components/AffyLogo';
import { supabaseProducts, SupabaseProduct, INITIAL_FALLBACK_PRODUCTS } from '../lib/supabase';

// ─── Category Icon Mapping ─────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'All Items': '🛒',
  'Grains & Flours': '🌾',
  'Oils & Fats': '🛢️',
  'Provisions & Breakfast': '🍞',
  'Soup Ingredients': '🍲',
  'Tubers & Roots': '🍠',
  'Proteins & Seasoning': '🥩',
  'Vegetables & Fresh Farm': '🥬',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map Supabase flat product to our shared Product type */
function mapSupabaseProduct(p: SupabaseProduct): Product {
  const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    sku: p.sku,
    priceCents: Number(p.price_cents ?? (p as any).priceCents ?? 0),
    currency: p.currency || 'NGN',
    imageUrl: p.image_url ?? (p as any).imageUrl ?? null,
    unitId: p.unit_id ?? (p as any).unitId ?? null,
    categoryId: p.category_id ?? (p as any).categoryId ?? null,
    isActive: p.is_active ?? (p as any).isActive ?? true,
    unit: p.unit
      ? { id: p.unit.id, name: p.unit.name, symbol: p.unit.symbol }
      : null,
    category: p.category
      ? { id: p.category.id, name: p.category.name, isActive: p.category.is_active ?? (p.category as any).isActive ?? true }
      : null,
    inventory: inv
      ? {
          id: inv.id,
          productId: inv.product_id ?? (inv as any).productId,
          quantity: Number(inv.quantity ?? 0),
          lowStockThreshold: Number(inv.low_stock_threshold ?? (inv as any).lowStockThreshold ?? 10),
        }
      : null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MarketplacePage: React.FC = () => {
  const { items, addToCart, updateQuantity, setIsCartOpen } = useCart();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const categoriesRef = useRef<HTMLDivElement>(null);

  // Derive category list dynamically from loaded products, keeping standard categories first
  const STANDARD_CATEGORIES = [
    'All Items',
    'Grains & Flours',
    'Oils & Fats',
    'Provisions & Breakfast',
    'Soup Ingredients',
    'Tubers & Roots',
  ];

  const dbCategories = Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean) as string[])).sort();
  const categories = [
    'All Items',
    ...Array.from(new Set([...STANDARD_CATEGORIES.slice(1), ...dbCategories])),
  ];

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseProducts.list();
      if (data && data.length > 0) {
        setProducts(data.map(mapSupabaseProduct));
      } else {
        setProducts(INITIAL_FALLBACK_PRODUCTS.map(mapSupabaseProduct));
      }
    } catch (err: any) {
      console.warn('[Marketplace] Using verified catalogue fallback:', err.message);
      setProducts(INITIAL_FALLBACK_PRODUCTS.map(mapSupabaseProduct));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();

    const handleInventoryChange = () => {
      loadProducts();
    };
    window.addEventListener('affy_inventory_updated', handleInventoryChange);
    return () => window.removeEventListener('affy_inventory_updated', handleInventoryChange);
  }, [loadProducts]);

  // Handle focus=categories query param
  useEffect(() => {
    if (searchParams.get('focus') === 'categories') {
      setTimeout(() => {
        categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [searchParams]);

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
    const matchesCat = selectedCategory === 'All Items' || p.category?.name === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4 sm:space-y-8 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 sm:top-20 right-3 sm:right-4 z-50 bg-slate-950/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 border border-brand-500/30 animate-slideDown max-w-[90vw]">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            ✓
          </span>
          <span className="truncate">{notification}</span>
          <button
            onClick={() => setIsCartOpen(true)}
            className="text-accent-400 hover:text-white underline font-bold ml-2 text-[11px] whitespace-nowrap flex-shrink-0"
          >
            View
          </button>
        </div>
      )}

      {/* ─── B. Search Bar (Prominent below header) ─── */}
      <section className="relative w-full">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rice, beans, garri, vegetable oil, noodles..."
            className="w-full pl-11 pr-10 py-3 sm:py-3.5 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 shadow-xs transition-all"
            aria-label="Search raw foodstuffs"
          />
          <svg
            className="w-5 h-5 text-brand-600 absolute left-3.5 top-3 sm:top-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-3 sm:top-3.5 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </section>

      {/* ─── C. Promotional Hero Section (Adapted for Mobile & Desktop) ─── */}
      <section className="bg-gradient-to-br from-brand-950 via-affy-dark to-brand-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-10 text-white shadow-xl relative overflow-hidden border border-brand-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 sm:w-80 h-60 sm:h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-52 sm:w-72 h-52 sm:h-72 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-8">
          <div className="space-y-3 sm:space-y-4 max-w-2xl text-left">
            {/* Live Badge */}
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold text-brand-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="truncate">Fresh Raw Foodstuff at Market Price • Doorstep Delivery</span>
            </div>

            {/* Headline */}
            <h1 className="text-xl sm:text-3xl lg:text-5xl font-black tracking-tight leading-snug sm:leading-tight">
              Fresh Raw Foodstuff at Market Price, Delivered to Your Doorstep.
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm lg:text-base text-brand-100/90 leading-relaxed font-normal">
              Direct farm-gate staple foodstuff at wholesale rates. No middleman markup, no market stress, just unadulterated food delivered to your door.
            </p>

            {/* Value Indicators (Mobile 3-column chip row) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2.5 sm:pt-3 border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-2 sm:p-0 sm:bg-transparent">
                <div className="text-xs sm:text-xl lg:text-2xl font-bold text-white">Market Price</div>
                <div className="text-[10px] sm:text-xs text-brand-200/80">Farm-Gate Rates</div>
              </div>
              <div className="bg-white/5 rounded-xl p-2 sm:p-0 sm:bg-transparent">
                <div className="text-xs sm:text-xl lg:text-2xl font-bold text-white">100%</div>
                <div className="text-[10px] sm:text-xs text-brand-200/80">Scale Certified</div>
              </div>
              <div className="bg-white/5 rounded-xl p-2 sm:p-0 sm:bg-transparent">
                <div className="text-xs sm:text-xl lg:text-2xl font-bold text-white">Doorstep</div>
                <div className="text-[10px] sm:text-xs text-brand-200/80">Direct Delivery</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-1 flex flex-wrap gap-2 sm:gap-3">
              <Link
                to="/packages"
                className="inline-flex items-center space-x-1.5 bg-accent-500 hover:bg-accent-600 text-brand-950 font-black text-xs sm:text-sm px-4 py-2 sm:py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                <span>Curated Bundles</span>
                <span className="text-xs">➔</span>
              </Link>
              <Link
                to="/savings"
                className="inline-flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs sm:text-sm px-4 py-2 sm:py-2.5 rounded-xl transition-all"
              >
                <span>Save Towards Food</span>
              </Link>
            </div>
          </div>

          {/* Desktop illustration card (Preserved) */}
          <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-inner max-w-sm">
            <AffyLogo variant="dark" size="xl" className="scale-110 drop-shadow-2xl" />
            <p className="mt-4 text-center text-xs text-brand-200 font-medium">
              Nigeria's #1 Bulk Foodstuff &amp; Disciplined Food Banking Platform
            </p>
          </div>
        </div>
      </section>

      {/* ─── D. Food Categories (Horizontally Scrollable - Item7Go Style) ─── */}
      <section ref={categoriesRef} id="categories-section" className="space-y-2 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-500">
            Categories
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">
            {filteredProducts.length} items
          </span>
        </div>

        {/* Scrollable category pills with icons */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar -mx-1 px-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const icon = CATEGORY_ICONS[cat] || '🥗';
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 active:scale-95 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/25 ring-2 ring-brand-600/30'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:bg-slate-50'
                }`}
                aria-pressed={isSelected}
              >
                <span className="text-sm leading-none">{icon}</span>
                <span>{cat}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Loading State ─── */}
      {loading && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-200" />
              <div className="p-3 sm:p-4 space-y-2">
                <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-100 rounded w-full" />
                <div className="h-5 bg-slate-200 rounded w-1/2 mt-3" />
                <div className="h-8 bg-slate-100 rounded-xl w-full mt-2" />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ─── Error State ─── */}
      {!loading && error && (
        <div className="text-center py-12 sm:py-16 bg-white rounded-2xl sm:rounded-3xl border border-rose-200 space-y-3 p-4">
          <span className="text-3xl sm:text-4xl">⚠️</span>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">Failed to load foodstuff catalogue</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
          <button
            onClick={loadProducts}
            className="mt-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-brand-700 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ─── E. Product Display (Two-Column Product Grid on Mobile) ─── */}
      {!loading && !error && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {filteredProducts.map((product) => {
            const inStock = product.inventory ? product.inventory.quantity > 0 : true;
            const cartItem = items.find((i) => i.product.id === product.id);

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-brand-300 relative"
              >
                {/* 1. Product Image & Badges */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 font-bold text-xs uppercase p-2 text-center">
                      <span className="text-2xl mb-1">🌾</span>
                      <span>Fresh Food</span>
                    </div>
                  )}

                  {/* Category Pill Tag */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className="text-[9px] sm:text-[10px] font-bold text-white bg-slate-950/75 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/20 truncate max-w-[100px] sm:max-w-none">
                      {product.category?.name ?? 'Staple'}
                    </span>
                  </div>

                  {/* 6. Stock Availability Indicator */}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full backdrop-blur-xs shadow-2xs flex items-center space-x-1 ${
                        inStock
                          ? 'bg-emerald-600/90 text-white border border-emerald-400/40'
                          : 'bg-rose-600/90 text-white border border-rose-400/40'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-white' : 'bg-white'} animate-pulse`} />
                      <span className="hidden xs:inline">{inStock ? 'In Stock' : 'Out of Stock'}</span>
                    </span>
                  </div>
                </div>

                {/* 2 & 3. Product Content: Name & Description */}
                <div className="p-2.5 sm:p-4 pb-1 sm:pb-2 flex-1 flex flex-col justify-between">
                  <div>
                    {/* 2. Product Name */}
                    <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-brand-700 transition-colors line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    {/* 3. Short Description */}
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* 4 & 5. Current Selling Price & Measurement Unit */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col xs:flex-row xs:items-baseline justify-between gap-0.5">
                    <span className="text-sm sm:text-base lg:text-lg font-black text-brand-900 tracking-tight leading-none">
                      {formatNaira(product.priceCents)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                      / {product.unit?.name ?? 'unit'}
                    </span>
                  </div>
                </div>

                {/* 7, 8 & 9. Actions: Add to Basket, Save Towards, Buy Now */}
                <div className="p-2 sm:p-3 bg-slate-50/70 border-t border-slate-100 space-y-1.5 sm:space-y-2">
                  {/* 7. Add to Basket / Quantity Stepper */}
                  {cartItem ? (
                    <div className="flex items-center justify-between bg-white border border-brand-200 rounded-xl p-0.5 shadow-2xs">
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 text-sm font-black transition-colors"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <div className="text-[11px] sm:text-xs font-black text-brand-900">
                        {cartItem.quantity} in Basket
                      </div>
                      <button
                        onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white bg-brand-600 hover:bg-brand-700 text-sm font-black transition-colors shadow-2xs"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!inStock}
                      className={`w-full py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl font-bold text-[11px] sm:text-xs shadow-2xs transition-all flex items-center justify-center space-x-1.5 active:scale-95 ${
                        inStock
                          ? 'bg-white border border-brand-300 hover:bg-brand-50 text-brand-800 hover:border-brand-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <span className="truncate">{inStock ? 'Add to Basket' : 'Out of Stock'}</span>
                    </button>
                  )}

                  {/* 8 & 9. Save Towards & Buy Now Options */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* 8. Save Towards Option */}
                    <Link
                      to="/savings"
                      className="text-center text-[10px] sm:text-[11px] font-semibold py-1.5 sm:py-2 px-1 rounded-lg sm:rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors truncate"
                      title="Save towards purchasing this staple"
                    >
                      Save Towards
                    </Link>

                    {/* 9. Buy Now Option */}
                    <button
                      onClick={() => handleBuyNow(product)}
                      disabled={!inStock}
                      className={`text-[10px] sm:text-[11px] font-black py-1.5 sm:py-2 px-1 rounded-lg sm:rounded-xl shadow-2xs transition-all text-center flex items-center justify-center space-x-0.5 active:scale-95 truncate ${
                        inStock
                          ? 'bg-brand-600 hover:bg-brand-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Buy Now</span>
                      <span className="text-[9px]">➔</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Empty Search Result */}
      {!loading && !error && filteredProducts.length === 0 && (
        <div className="text-center py-12 sm:py-16 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 space-y-3 p-4">
          <span className="text-3xl sm:text-4xl">🌾</span>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">No foodstuffs found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or select &quot;All Items&quot;.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('All Items');
            }}
            className="mt-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ─── Trust Callout (Preserved with Mobile Tuning) ─── */}
      <section className="bg-affy-dark text-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 border border-purple-900/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1.5 sm:space-y-2 max-w-xl text-left">
          <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-accent-400">
            Affy Collective Advantage
          </span>
          <h2 className="text-lg sm:text-2xl font-bold">Need Wholesale Foodstuff for Catering or School?</h2>
          <p className="text-xs text-brand-200/90 leading-relaxed">
            Order by truckload or ton. We aggregate farm supplies across Kaduna, Benue, Kebbi, and Niger
            to guarantee consistency and eliminate seasonal inflation spikes.
          </p>
        </div>
        <Link
          to="/packages"
          className="w-full sm:w-auto text-center whitespace-nowrap bg-white text-brand-950 hover:bg-brand-50 px-5 sm:px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
        >
          View Commercial Bundles
        </Link>
      </section>
    </div>
  );
};
