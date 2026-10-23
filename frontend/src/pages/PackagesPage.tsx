import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatNaira } from '../utils/format';
import { packagesApi } from '../services/api';
import { supabasePackages, SupabasePackage } from '../lib/supabase';
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
}

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
    priceCents: 1807000, // ₦18,070 (Sardines removed)
    originalPriceCents: 2350000, // ₦23,500
    savingsPercentage: 15,
    status: 'ACTIVE',
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
    priceCents: 4480000, // ₦44,800 (Golden Morn, Dano Milk removed; Milo at live price ₦180×10=₦1,800)
    originalPriceCents: 5800000, // ₦58,000
    savingsPercentage: 13,
    status: 'ACTIVE',
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
  const { addToCart, setIsCartOpen } = useCart();

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

  const handleOrder = (pkg: DisplayPackage) => {
    addToCart(
      {
        id: pkg.id,
        name: pkg.name,
        priceCents: pkg.priceCents,
        currency: 'NGN',
        isActive: true,
        sku: `BUNDLE-${pkg.id}`,
      },
      1
    );
    setOrderedPkg(pkg.name);
    setTimeout(() => setOrderedPkg(null), 3500);
    setIsCartOpen(true);
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Toast */}
      {orderedPkg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">Added "{orderedPkg}" to basket!</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs uppercase tracking-wider font-extrabold text-brand-700 bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200 shadow-2xs">
          Verified Farm Curated Bundles
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Curated Foodstuff Packs & Family Rations
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Save significantly by purchasing pre-curated food bundles structured around genuine Nigerian kitchen meal plans.
          Synchronized directly with our farm inventory and verified scale measures.
        </p>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {packagesList.map((pkg) => {
          const isDraft = pkg.status === 'DRAFT';
          return (
            <div
              key={pkg.id}
              className={`bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                isDraft ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'
              }`}
            >
              <div className="p-6 sm:p-8 space-y-5">
                {/* Top row */}
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-accent-700 bg-accent-50 border border-accent-200 px-3 py-1 rounded-full">
                      {pkg.badge}
                    </span>
                    {isDraft ? (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                        <span>⏳</span>
                        <span>Pending Validation (Draft)</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                        <span>✓</span>
                        <span>Verified & Published</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    Save {pkg.savingsPercentage}% vs retail
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{pkg.name}</h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{pkg.description}</p>
                </div>

                {/* Validation Warnings (Part 3) */}
                {(isDraft || (pkg.unavailableItems && pkg.unavailableItems.length > 0)) && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1">
                      <span>⚠️ Validation Notice:</span>
                    </div>
                    {pkg.missingItems && pkg.missingItems.length > 0 && (
                      <p className="text-[11px] text-amber-800">
                        • Items pending inventory stock: <strong>{pkg.missingItems.join(', ')}</strong> (bundle amounts preserved).
                      </p>
                    )}
                    {pkg.unavailableItems && pkg.unavailableItems.length > 0 && (
                      <p className="text-[11px] text-orange-800">
                        • Items currently unavailable (out of stock): <strong>{pkg.unavailableItems.join(', ')}</strong>. This bundle cannot be ordered until restocked.
                      </p>
                    )}
                    {pkg.priceDiscrepancies && pkg.priceDiscrepancies.length > 0 && (
                      <div className="text-[11px] text-amber-800">
                        {pkg.priceDiscrepancies.map((d, i) => (
                          <p key={i}>• {d.message}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Items Breakdown Table */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      What's Inside this Pack:
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {pkg.items.length} items included
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                    {pkg.items.map((item, idx) => {
                      const isMissing = item.missingFromInventory;
                      const hasDiscrepancy = item.priceDiscrepancy;

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-white transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {isMissing ? (
                              <span className="text-amber-500 font-bold" title="Pending inventory linkage">⚠️</span>
                            ) : item.unavailableFromInventory ? (
                              <span className="text-orange-500 font-bold" title="Out of stock — unavailable">🚫</span>
                            ) : hasDiscrepancy ? (
                              <span className="text-amber-500 font-bold" title="Price discrepancy pending confirmation">ℹ️</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">✓</span>
                            )}
                            <div className="truncate">
                              <span className="font-semibold text-slate-800">
                                {item.displayName || item.name}
                              </span>
                              <span className="text-slate-500 text-[11px] ml-1.5 font-medium">
                                ({item.quantity} {item.unitName || 'x'})
                              </span>
                              {isMissing && (
                                <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                                  Pending Stock
                                </span>
                              )}
                              {item.unavailableFromInventory && (
                                <span className="ml-1.5 text-[10px] text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded font-semibold">
                                  Out of Stock
                                </span>
                              )}
                              {hasDiscrepancy && (
                                <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-semibold">
                                  ₦{item.allocatedPriceNaira}/unit
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 font-bold text-slate-900">
                            {item.amountNaira !== undefined
                              ? formatNaira(item.amountNaira * 100)
                              : item.amountCents
                              ? formatNaira(item.amountCents)
                              : ''}
                          </div>
                        </div>
                      );
                    })}

                    {/* Total Row */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100 font-black text-xs text-slate-900">
                      <span>Total Bundle Item Value:</span>
                      <span className="text-brand-700 text-sm">{formatNaira(pkg.priceCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-brand-50/50 rounded-xl border border-brand-100 text-xs text-brand-800 flex items-center space-x-2">
                  <span>💡</span>
                  <span>Best for: <strong>{pkg.bestFor}</strong></span>
                </div>
              </div>

              {/* Bottom Price & Action */}
              <div className="p-6 sm:p-8 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-slate-900">
                      {formatNaira(pkg.priceCents)}
                    </span>
                    <span className="text-xs text-slate-400 line-through">
                      {formatNaira(pkg.originalPriceCents)}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">Free door-step delivery in Ilesa</span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <Link
                    to="/savings"
                    className="w-1/2 sm:w-auto text-center px-4 py-3 rounded-xl border border-brand-300 bg-white hover:bg-brand-50 text-brand-700 font-semibold text-xs transition-colors"
                  >
                    Save in Plan
                  </Link>
                  <button
                    onClick={() => handleOrder(pkg)}
                    disabled={!!(pkg.unavailableItems && pkg.unavailableItems.length > 0)}
                    title={pkg.unavailableItems && pkg.unavailableItems.length > 0 ? `Cannot order: ${pkg.unavailableItems.join(', ')} out of stock` : undefined}
                    className={`w-1/2 sm:w-auto px-5 py-3 rounded-xl font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center space-x-1.5 ${
                      pkg.unavailableItems && pkg.unavailableItems.length > 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : isDraft
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-brand-600 hover:bg-brand-700 text-white'
                    }`}
                  >
                    <span>{pkg.unavailableItems && pkg.unavailableItems.length > 0 ? '🚫 Unavailable' : isDraft ? 'Order Bundle (Draft)' : 'Order Bundle'}</span>
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
