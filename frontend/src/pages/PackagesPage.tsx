// frontend/src/pages/PackagesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatNaira } from '../utils/format';
import { supabasePackages } from '../lib/supabase';
import { useCart } from '../context/CartContext';

export interface DisplayBundleItem {
  name: string;
  displayName?: string;
  quantity: number | string;
  amountNaira?: number;
  amountCents?: number;
  unitName?: string;
  missingFromInventory?: boolean;
  unavailableFromInventory?: boolean;
  priceDiscrepancy?: boolean;
  inventoryPriceNaira?: number;
  allocatedPriceNaira?: number;
}

export interface DisplayPackage {
  id: string;
  name: string;
  badge: string;
  description: string;
  priceCents: number;
  originalPriceCents: number;
  savingsPercentage: number;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  items: DisplayBundleItem[];
  missingItems?: string[];
  unavailableItems?: string[];
  priceDiscrepancies?: Array<{
    item: string;
    inventoryPriceNaira: number;
    allocatedPriceNaira: number;
    message: string;
  }>;
  bestFor: string;
  imageUrl?: string;
}

const BUNDLE_IMAGES: Record<string, string> = {
  'Affy Student Essentials': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
  'Affy Solo Living Package': 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=800&q=80',
  'Affy Family & Kids Package': 'https://images.unsplash.com/photo-1607349913338-fca6f7429606?auto=format&fit=crop&w=800&q=80',
  'Affy Party Cooking Starter': 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=800&q=80',
};

export const FEATURED_PACKAGES: DisplayPackage[] = [
  {
    id: '8556e5fd-1440-4874-b2b8-b9d2a1157159',
    name: 'Affy Student Essentials',
    badge: 'Budget Student Essential',
    description: 'An affordable mix of staples and quick meals.',
    priceCents: 1153000, // ₦11,530.00
    originalPriceCents: 1350000, // ₦13,500.00
    savingsPercentage: 15,
    status: 'ACTIVE',
    imageUrl: BUNDLE_IMAGES['Affy Student Essentials'],
    items: [
      { name: 'Rice', quantity: 1, amountNaira: 2000, unitName: 'Derica' },
      { name: 'Garri', quantity: 2, amountNaira: 800, unitName: 'Derica' },
      { name: 'Beans', quantity: 1, amountNaira: 2200, unitName: 'Derica' },
      { name: 'Spaghetti', quantity: 2, amountNaira: 1900, unitName: 'Pack' },
      { name: 'Noodles', quantity: 5, amountNaira: 1850, unitName: 'Pack' },
      { name: 'Egg', displayName: 'Eggs', quantity: 6, amountNaira: 1500, unitName: 'Piece' },
      { name: 'Maggi', quantity: 1, amountNaira: 350, unitName: 'Pack' },
      { name: 'Salt', quantity: 1, amountNaira: 250, unitName: 'Pack' },
      { name: 'Sachet Tomato', quantity: 4, amountNaira: 680, unitName: 'Sachet' },
    ],
    bestFor: 'Students & singles needing reliable weekly staple groceries',
  },
  {
    id: '1ed4a86e-a795-47b4-a68c-68947f4c6da4',
    name: 'Affy Solo Living Package',
    badge: 'Solo Living',
    description: 'For bachelors and spinsters who want variety for everyday cooking.',
    priceCents: 1807000, // ₦18,070
    originalPriceCents: 2350000, // ₦23,500
    savingsPercentage: 15,
    status: 'ACTIVE',
    imageUrl: BUNDLE_IMAGES['Affy Solo Living Package'],
    items: [
      { name: 'Rice', quantity: 2, amountNaira: 4000, unitName: 'Derica' },
      { name: 'Garri', quantity: 2, amountNaira: 800, unitName: 'Derica' },
      { name: 'Beans', quantity: 1, amountNaira: 2200, unitName: 'Derica' },
      { name: 'Spaghetti', quantity: 3, amountNaira: 2850, unitName: 'Pack' },
      { name: 'Noodles', quantity: 5, amountNaira: 1850, unitName: 'Pack' },
      { name: 'Egg', displayName: 'Eggs', quantity: 10, amountNaira: 2500, unitName: 'Piece' },
      { name: 'Butter', quantity: 1, amountNaira: 1500, unitName: 'Pack' },
      { name: 'Maggi', quantity: 2, amountNaira: 700, unitName: 'Pack' },
      { name: 'Salt', quantity: 1, amountNaira: 250, unitName: 'Pack' },
      { name: 'Curry', quantity: 2, amountNaira: 200, unitName: 'Sachet' },
      { name: 'Thyme', quantity: 2, amountNaira: 200, unitName: 'Sachet' },
      { name: 'Sachet Tomato', quantity: 6, amountNaira: 1020, unitName: 'Sachet' },
    ],
    bestFor: 'Bachelors and spinsters who want variety for everyday cooking',
  },
  {
    id: '450521bd-6cd8-40ca-9831-f495ad82df5b',
    name: 'Affy Family & Kids Package',
    badge: 'Family & Breakfast',
    description: 'Household staples with breakfast options for the children.',
    priceCents: 4480000, // ₦44,800
    originalPriceCents: 5800000, // ₦58,000
    savingsPercentage: 13,
    status: 'ACTIVE',
    imageUrl: BUNDLE_IMAGES['Affy Family & Kids Package'],
    items: [
      { name: 'Rice', quantity: 5, amountNaira: 10000, unitName: 'Derica' },
      { name: 'Garri', quantity: 3, amountNaira: 1200, unitName: 'Derica' },
      { name: 'Beans', quantity: 3, amountNaira: 6600, unitName: 'Derica' },
      { name: 'Spaghetti', quantity: 5, amountNaira: 4750, unitName: 'Pack' },
      { name: 'Noodles', quantity: 10, amountNaira: 3700, unitName: 'Pack' },
      { name: 'Egg', displayName: 'Eggs', quantity: 30, amountNaira: 7500, unitName: 'Piece' },
      { name: 'Butter', quantity: 2, amountNaira: 3000, unitName: 'Pack' },
      { name: 'Maggi', quantity: 3, amountNaira: 1050, unitName: 'Pack' },
      { name: 'Salt', quantity: 2, amountNaira: 500, unitName: 'Pack' },
      { name: 'Curry', quantity: 3, amountNaira: 300, unitName: 'Sachet' },
      { name: 'Thyme', quantity: 3, amountNaira: 300, unitName: 'Sachet' },
      { name: 'Sachet Tomato', quantity: 10, amountNaira: 1700, unitName: 'Sachet' },
      { name: 'Semo', quantity: 2, amountNaira: 3100, unitName: 'Pack' },
      { name: 'Milo Ordinary', displayName: 'Milo', quantity: 10, amountNaira: 1800, unitName: 'Sachet' },
    ],
    bestFor: 'Household staples with breakfast options for the children',
  },
  {
    id: 'd3f0df28-b8e6-4e1c-8c4e-375a0ab9f2e4',
    name: 'Affy Party Cooking Starter',
    badge: 'Party Starter',
    description: 'A base package for a rice-and-spaghetti party menu.',
    priceCents: 3140000, // ₦31,400.00
    originalPriceCents: 3600000, // ₦36,000.00
    savingsPercentage: 13,
    status: 'ACTIVE',
    imageUrl: BUNDLE_IMAGES['Affy Party Cooking Starter'],
    items: [
      { name: 'Rice', quantity: 10, amountNaira: 20000, unitName: 'Derica' },
      { name: 'Spaghetti', quantity: 5, amountNaira: 4750, unitName: 'Pack' },
      { name: 'Maggi', quantity: 5, amountNaira: 1750, unitName: 'Pack' },
      { name: 'Salt', quantity: 2, amountNaira: 500, unitName: 'Pack' },
      { name: 'Curry', quantity: 5, amountNaira: 500, unitName: 'Sachet' },
      { name: 'Thyme', quantity: 5, amountNaira: 500, unitName: 'Sachet' },
      { name: 'Sachet Tomato', quantity: 20, amountNaira: 3400, unitName: 'Sachet' },
    ],
    bestFor: 'A base package for a rice-and-spaghetti party menu',
  },
];

export const PackagesPage: React.FC = () => {
  const [packagesList, setPackagesList] = useState<DisplayPackage[]>(FEATURED_PACKAGES);
  const [orderedPkg, setOrderedPkg] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const { addToCart, setIsCartOpen } = useCart();

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadPackages = useCallback(async () => {
    try {
      const data = await supabasePackages.list();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: DisplayPackage[] = data.map((pkg: any) => ({
          id: pkg.id,
          name: pkg.name,
          badge: pkg.badge || 'Curated Bundle',
          description: pkg.description || 'Nutrient-rich balanced foodstuffs direct from verified farms.',
          priceCents: Number(pkg.priceCents || pkg.price_cents || 2500000),
          originalPriceCents: Number(pkg.originalPriceCents || Math.round(Number(pkg.priceCents || 2500000) * 1.15)),
          savingsPercentage: Number(pkg.savingsPercentage || 14),
          status: pkg.status || 'ACTIVE',
          imageUrl: pkg.imageUrl || BUNDLE_IMAGES[pkg.name] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
          items: (pkg.items || []).map((it: any) => ({
            name: it.product?.name || it.name || 'Food item',
            displayName: it.displayName || it.product?.name || it.name,
            quantity: it.quantity,
            amountNaira: it.amountNaira || (it.amountCents ? it.amountCents / 100 : undefined),
            unitName: it.unit?.name || it.unitName || 'Pack',
            missingFromInventory: it.missingFromInventory,
            unavailableFromInventory: it.unavailableFromInventory,
            priceDiscrepancy: it.priceDiscrepancy,
            inventoryPriceNaira: it.inventoryPriceNaira || (it.inventoryPriceCents ? it.inventoryPriceCents / 100 : undefined),
            allocatedPriceNaira: it.allocatedPriceNaira || (it.allocatedPriceCents ? it.allocatedPriceCents / 100 : undefined),
          })),
          missingItems: pkg.missingItems || [],
          unavailableItems: pkg.unavailableItems || [],
          priceDiscrepancies: pkg.priceDiscrepancies || [],
          bestFor: pkg.bestFor || 'Families and bulk buyers',
        }));
        setPackagesList(mapped);
      }
    } catch {
      // Retain fallback packages
    }
  }, []);

  useEffect(() => {
    loadPackages();

    const handlePackagesUpdate = () => {
      loadPackages();
    };
    window.addEventListener('affy_packages_updated', handlePackagesUpdate);
    window.addEventListener('affy_inventory_updated', handlePackagesUpdate);
    return () => {
      window.removeEventListener('affy_packages_updated', handlePackagesUpdate);
      window.removeEventListener('affy_inventory_updated', handlePackagesUpdate);
    };
  }, [loadPackages]);

  const handleAddToCart = (pkg: DisplayPackage, openDrawer = false) => {
    addToCart(
      {
        id: pkg.id,
        name: pkg.name,
        priceCents: pkg.priceCents,
        currency: 'NGN',
        isActive: true,
        sku: `BUNDLE-${pkg.id}`,
        imageUrl: pkg.imageUrl,
      },
      1
    );
    setOrderedPkg(pkg.name);
    setTimeout(() => setOrderedPkg(null), 3000);
    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-8 sm:pb-16">
      {/* Toast */}
      {orderedPkg && (
        <div className="fixed top-16 sm:top-20 right-3 sm:right-4 z-50 bg-slate-950/90 backdrop-blur-md text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 border border-brand-500/30 animate-slideDown max-w-[90vw]">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            ✓
          </span>
          <span className="truncate">Added &quot;{orderedPkg}&quot; to basket!</span>
          <button
            onClick={() => setIsCartOpen(true)}
            className="text-accent-400 hover:text-white underline font-bold ml-2 text-[11px] whitespace-nowrap flex-shrink-0"
          >
            View
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2 sm:space-y-3 px-1">
        <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200 shadow-2xs">
          Verified Farm Curated Bundles
        </span>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
          Curated Foodstuff Packs &amp; Family Rations
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Save significantly by purchasing pre-curated food bundles structured around genuine Nigerian kitchen meal plans.
          Synchronized directly with verified scale weights and farm inventory.
        </p>
      </div>

      {/* Packages Grid (Single Column on Mobile, 2-Col on md+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {packagesList.map((pkg) => {
          const isDraft = pkg.status === 'DRAFT';
          const isUnavailable = !!(pkg.unavailableItems && pkg.unavailableItems.length > 0);
          const isExpanded = expandedItems[pkg.id] ?? false;

          return (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl sm:rounded-3xl border shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                isDraft ? 'border-amber-200 bg-amber-50/15' : 'border-slate-200/90'
              }`}
            >
              {/* Optional Bundle Header Image */}
              {pkg.imageUrl && (
                <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden bg-slate-100">
                  <img
                    src={pkg.imageUrl}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                    <span className="text-xs font-black bg-brand-600/90 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                      {pkg.badge}
                    </span>
                    <span className="text-xs font-black bg-emerald-600/90 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                      Save {pkg.savingsPercentage}%
                    </span>
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-6 lg:p-7 space-y-4">
                {/* Top badges if image wasn't present */}
                {!pkg.imageUrl && (
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-accent-700 bg-accent-50 border border-accent-200 px-3 py-1 rounded-full">
                        {pkg.badge}
                      </span>
                      {isDraft ? (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                          <span>⏳</span>
                          <span>Draft</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                          <span>✓</span>
                          <span>Verified</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      Save {pkg.savingsPercentage}%
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug">
                    {pkg.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 sm:mt-1.5 leading-relaxed">
                    {pkg.description}
                  </p>
                </div>

                {/* Validation Warnings */}
                {(isDraft || isUnavailable) && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1">
                      <span>⚠️ Validation Notice:</span>
                    </div>
                    {pkg.missingItems && pkg.missingItems.length > 0 && (
                      <p className="text-[11px] text-amber-800">
                        • Items pending inventory stock: <strong>{pkg.missingItems.join(', ')}</strong>.
                      </p>
                    )}
                    {pkg.unavailableItems && pkg.unavailableItems.length > 0 && (
                      <p className="text-[11px] text-orange-800">
                        • Items currently unavailable: <strong>{pkg.unavailableItems.join(', ')}</strong>.
                      </p>
                    )}
                  </div>
                )}

                {/* Items Breakdown with Mobile Toggle */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      What&apos;s Inside:
                    </span>
                    <button
                      onClick={() => toggleExpand(pkg.id)}
                      className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center space-x-1 py-0.5 px-2 rounded-lg bg-brand-50"
                    >
                      <span>{pkg.items.length} items</span>
                      <span>{isExpanded ? '▲ hide' : '▼ show all'}</span>
                    </button>
                  </div>

                  {/* Summary preview list when collapsed */}
                  {!isExpanded && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600">
                      <span className="font-medium">Includes: </span>
                      <span className="font-semibold text-slate-800">
                        {pkg.items.slice(0, 5).map((it) => it.displayName || it.name).join(', ')}
                        {pkg.items.length > 5 ? `, and ${pkg.items.length - 5} more items` : ''}
                      </span>
                    </div>
                  )}

                  {/* Full detailed list when expanded */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 max-h-60 overflow-y-auto">
                      {pkg.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-2 text-xs hover:bg-white transition-colors"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-emerald-600 font-bold text-xs">✓</span>
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {item.displayName || item.name}
                              </span>
                              <span className="text-slate-500 text-[11px] ml-1.5 font-medium">
                                ({item.quantity} {item.unitName || 'x'})
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 font-bold text-slate-900 text-xs">
                            {item.amountNaira !== undefined
                              ? formatNaira(item.amountNaira * 100)
                              : item.amountCents
                              ? formatNaira(item.amountCents)
                              : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-brand-50/60 rounded-xl border border-brand-100 text-xs text-brand-900 flex items-center space-x-2">
                  <span>💡</span>
                  <span className="truncate">Best for: <strong>{pkg.bestFor}</strong></span>
                </div>
              </div>

              {/* Bottom Price & Actions */}
              <div className="p-4 sm:p-6 bg-slate-50/90 border-t border-slate-200 space-y-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-xl sm:text-2xl font-black text-slate-900">
                        {formatNaira(pkg.priceCents)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {formatNaira(pkg.originalPriceCents)}
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-emerald-600 font-semibold">
                      Verified Direct Farm Supply
                    </span>
                  </div>
                </div>

                {/* Responsive 3-Button Action Row */}
                <div className="grid grid-cols-3 gap-2">
                  <Link
                    to="/savings"
                    className="text-center py-2.5 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center truncate"
                  >
                    Save in Plan
                  </Link>

                  <button
                    onClick={() => handleAddToCart(pkg, false)}
                    disabled={isUnavailable}
                    className={`py-2.5 px-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1 truncate ${
                      isUnavailable
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-white border border-brand-300 text-brand-800 hover:bg-brand-50 active:scale-95 shadow-2xs'
                    }`}
                  >
                    <span>+ Basket</span>
                  </button>

                  <button
                    onClick={() => handleAddToCart(pkg, true)}
                    disabled={isUnavailable}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs text-white shadow-xs transition-all flex items-center justify-center space-x-1 truncate active:scale-95 ${
                      isUnavailable
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-brand-600 hover:bg-brand-700'
                    }`}
                  >
                    <span>Buy Now</span>
                    <span className="text-[10px]">➔</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
