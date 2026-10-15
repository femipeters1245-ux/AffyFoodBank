// frontend/src/pages/MarketplacePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { formatNaira } from '../utils/format';
import { useCart } from '../context/CartContext';
import { AffyLogo } from '../components/AffyLogo';
import { supabaseProducts, SupabaseProduct } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map Supabase flat product to our shared Product type */
function mapSupabaseProduct(p: SupabaseProduct): Product {
  const inv = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    sku: p.sku,
    priceCents: p.price_cents,
    currency: p.currency,
    imageUrl: p.image_url,
    unitId: p.unit_id,
    categoryId: p.category_id,
    isActive: p.is_active,
    unit: p.unit
      ? { id: p.unit.id, name: p.unit.name, symbol: p.unit.symbol }
      : null,
    category: p.category
      ? { id: p.category.id, name: p.category.name, isActive: p.category.is_active }
      : null,
    inventory: inv
      ? {
          id: inv.id,
          productId: inv.product_id,
          quantity: inv.quantity,
          lowStockThreshold: inv.low_stock_threshold,
        }
      : null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MarketplacePage: React.FC = () => {
  const { items, addToCart, updateQuantity, setIsCartOpen, totalItems, totalAmountCents } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Derive category list dynamically from loaded products
  const categories = [
    'All Items',
    ...Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean) as string[])).sort(),
  ];

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseProducts.list();
      setProducts(data.map(mapSupabaseProduct));
    } catch (err: any) {
      console.error('[Marketplace] Failed to load products:', err);
      setError('Unable to load products. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

      {/* Hero Showcase */}
      <section className="bg-gradient-to-br from-brand-950 via-affy-dark to-brand-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden border border-brand-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold text-brand-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Authentic Market Prices • Delivered to Your Doorstep</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Fresh Raw Foodstuff at Market Price, Delivered to Your Doorstep
            </h1>

            <p className="text-sm sm:text-base text-brand-100/90 leading-relaxed font-normal">
              We sell verified agrarian staples at genuine wholesale market prices and deliver them straight to your doorstep with speed and care. No market crowds, no middleman markups, just fresh quality foodstuff brought directly to your home.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-white/10 max-w-md mx-auto lg:mx-0">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">Market Price</div>
                <div className="text-xs text-brand-200/80">Direct Farm Rates</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">100%</div>
                <div className="text-xs text-brand-200/80">Standardized Scales</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">Doorstep</div>
                <div className="text-xs text-brand-200/80">Direct Home Delivery</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-inner max-w-sm">
            <AffyLogo variant="dark" size="xl" className="scale-110 drop-shadow-2xl" />
            <p className="mt-4 text-center text-xs text-brand-200 font-medium">
              Nigeria's #1 Bulk Foodstuff &amp; Disciplined Food Banking Platform
            </p>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rice, beans, garri, yam, palm oil..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
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
          <span>
            {loading ? (
              'Loading products from Supabase…'
            ) : (
              `Showing ${filteredProducts.length} certified food item${filteredProducts.length !== 1 ? 's' : ''}`
            )}
          </span>
          <span className="hidden sm:inline">Daily farm wholesale index updated</span>
        </div>
      </section>

      {/* Loading State */}
      {loading && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-slate-200 rounded-lg w-3/4" />
                <div className="h-3 bg-slate-100 rounded-lg w-full" />
                <div className="h-3 bg-slate-100 rounded-lg w-2/3" />
                <div className="h-6 bg-slate-200 rounded-lg w-1/2 mt-4" />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="text-center py-16 bg-white rounded-3xl border border-rose-200 space-y-3">
          <span className="text-4xl">⚠️</span>
          <h3 className="text-base font-bold text-slate-800">Failed to load products</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
          <button
            onClick={loadProducts}
            className="mt-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const inStock = product.inventory ? product.inventory.quantity > 0 : true;
            const cartItem = items.find((i) => i.product.id === product.id);

            return (
              <div
                key={product.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:border-brand-300"
              >
                {/* Product Image */}
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
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-white border border-brand-300 hover:bg-brand-50 text-brand-800 font-bold text-xs shadow-2xs hover:border-brand-400 transition-all flex items-center justify-center space-x-1.5"
                    >
                      <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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
      )}

      {!loading && !error && filteredProducts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3">
          <span className="text-4xl">🌾</span>
          <h3 className="text-base font-bold text-slate-800">No foodstuffs found</h3>
          <p className="text-xs text-slate-500">
            Try adjusting your search terms or select "All Items".
          </p>
        </div>
      )}

      {/* Floating Cart Quick Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 right-6 z-40 animate-slideUp">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center space-x-3 bg-brand-700 hover:bg-brand-800 text-white px-5 py-3.5 rounded-full shadow-2xl hover:shadow-brand-900/40 border border-brand-500/50 transition-all group scale-100 hover:scale-105"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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

      {/* Trust Callout */}
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
