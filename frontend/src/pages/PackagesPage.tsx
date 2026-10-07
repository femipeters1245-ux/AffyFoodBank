// frontend/src/pages/PackagesPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatNaira } from '../utils/format';

interface DisplayPackage {
  id: string;
  name: string;
  badge: string;
  description: string;
  priceCents: number;
  originalPriceCents: number;
  savingsPercentage: number;
  items: Array<{ name: string; quantity: string }>;
  bestFor: string;
}

const FEATURED_PACKAGES: DisplayPackage[] = [
  {
    id: 'pkg-1',
    name: 'Family Monthly Nourish Ration',
    badge: 'Most Popular',
    description: 'Comprehensive month-long supply for a family of 4 to 6 people. Never worry about daily market hikes.',
    priceCents: 18500000, // ₦185,000.00
    originalPriceCents: 21500000, // ₦215,000.00
    savingsPercentage: 14,
    items: [
      { name: 'Parboiled Nigerian Rice', quantity: '1 x 50kg Bag' },
      { name: 'Oloyin Sweet Honey Beans', quantity: '1 x 25kg Bag' },
      { name: 'Pure Edo Palm Oil', quantity: '1 x 10L Keg' },
      { name: 'Refined Vegetable Cooking Oil', quantity: '1 x 10L Keg' },
      { name: 'Crunchy Ijebu Garri', quantity: '2 x Paint Rubbers' },
      { name: 'Benue White Yam', quantity: '6 Tubers' },
    ],
    bestFor: 'Households seeking predictability & bulk discounts',
  },
  {
    id: 'pkg-2',
    name: 'Student & Young Professional Survival Pack',
    badge: 'Budget Friendly',
    description: 'Essential staple foodstuff designed for easy storage and daily cooking in apartments or hostels.',
    priceCents: 4200000, // ₦42,000.00
    originalPriceCents: 4900000, // ₦49,000.00
    savingsPercentage: 14,
    items: [
      { name: 'Stone-free Long Grain Rice', quantity: '1 x Paint Rubber (4kg)' },
      { name: 'Ijebu Sour Garri', quantity: '2 x Paint Rubbers (8kg)' },
      { name: 'Oloyin Fast-Cooking Beans', quantity: '1 x Paint Rubber (4kg)' },
      { name: 'Vegetable Cooking Oil', quantity: '1 x 3L Flagon' },
      { name: 'Pure Palm Oil', quantity: '1 x 2L Bottle' },
      { name: 'Smoked Catfish', quantity: '3 Large Pieces' },
    ],
    bestFor: 'Students, corpers, and young bachelors/bachelorettes',
  },
  {
    id: 'pkg-3',
    name: 'Owanbe & Party Caterer Feast Bundle',
    badge: 'Commercial Grade',
    description: 'Heavyweight bulk quantities curated for wedding cooks, church programs, or weekend celebrations.',
    priceCents: 39500000, // ₦395,000.00
    originalPriceCents: 46000000, // ₦460,000.00
    savingsPercentage: 14,
    items: [
      { name: 'Royal Stallion Rice', quantity: '2 x 50kg Bags' },
      { name: 'Benue Big Yam Tubers', quantity: '20 Giant Tubers' },
      { name: 'Grand Pure Vegetable Oil', quantity: '1 x 25L Keg' },
      { name: 'Edo Native Palm Oil', quantity: '1 x 25L Keg' },
      { name: 'Hand-peeled Egusi', quantity: '2 x Paint Rubbers' },
      { name: 'Aromatic Oron Crayfish', quantity: '1 x 5kg Bag' },
    ],
    bestFor: 'Catering businesses, restaurants, and event organizers',
  },
  {
    id: 'pkg-4',
    name: 'Traditional Soup Ingredients Hamper',
    badge: 'Delicacy Bundle',
    description: 'All the authentic traditional protein and soup thickeners required to make legendary Nigerian pots.',
    priceCents: 2900000, // ₦29,000.00
    originalPriceCents: 3400000, // ₦34,000.00
    savingsPercentage: 15,
    items: [
      { name: 'Hand-picked Egusi (Melon)', quantity: '1 x Paint Rubber' },
      { name: 'Ogbono (Wild Mango Seeds)', quantity: '1 x Derica Cup' },
      { name: 'Dried Oron Crayfish', quantity: '1 x Derica Cup' },
      { name: 'Oven-Dried Smoked Catfish', quantity: '5 Pieces' },
      { name: 'Locust Beans (Iru / Ogiri)', quantity: '4 Wrapped Cakes' },
      { name: 'Yellow Pepper (Nsukka variety)', quantity: '1/2 Paint Rubber' },
    ],
    bestFor: 'Lovers of authentic soups (Banga, Egusi, Ogbono, Afang)',
  },
];

export const PackagesPage: React.FC = () => {
  const [orderedPkg, setOrderedPkg] = useState<string | null>(null);

  const handleOrder = (pkgName: string) => {
    setOrderedPkg(pkgName);
    setTimeout(() => setOrderedPkg(null), 3500);
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Toast */}
      {orderedPkg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">Selected {orderedPkg}! Added to checkout queue.</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs uppercase tracking-wider font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
          Pre-Curated Bundles
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
          Curated Foodstuff Packs & Family Rations
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Save more by purchasing balanced food bundles designed around Nigerian meal plans. Every bundle includes certified scale weights and direct delivery.
        </p>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {FEATURED_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden"
          >
            <div className="p-6 sm:p-8 space-y-5">
              {/* Top row */}
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-bold text-accent-700 bg-accent-50 border border-accent-200 px-3 py-1 rounded-full">
                  {pkg.badge}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Save {pkg.savingsPercentage}% vs retail
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">{pkg.name}</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{pkg.description}</p>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  What's Inside this Pack:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {pkg.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-xl"
                    >
                      <span className="text-brand-600 font-bold">✓</span>
                      <div className="truncate">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="text-slate-500 block text-[11px]">{item.quantity}</span>
                      </div>
                    </div>
                  ))}
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
                  <span className="text-2xl font-extrabold text-slate-900">
                    {formatNaira(pkg.priceCents)}
                  </span>
                  <span className="text-xs text-slate-400 line-through">
                    {formatNaira(pkg.originalPriceCents)}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 font-medium">Free door-step delivery in Lagos</span>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Link
                  to="/savings"
                  className="w-1/2 sm:w-auto text-center px-4 py-3 rounded-xl border border-brand-300 bg-white hover:bg-brand-50 text-brand-700 font-semibold text-xs transition-colors"
                >
                  Save in Plan
                </Link>
                <button
                  onClick={() => handleOrder(pkg.name)}
                  className="w-1/2 sm:w-auto px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm hover:shadow transition-all"
                >
                  Order Bundle
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
