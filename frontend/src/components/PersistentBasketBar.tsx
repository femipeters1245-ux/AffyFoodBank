// frontend/src/components/PersistentBasketBar.tsx
import React from 'react';
import { useCart } from '../context/CartContext';
import { formatNaira } from '../utils/format';

export const PersistentBasketBar: React.FC = () => {
  const { totalItems, totalAmountCents, isCartOpen, setIsCartOpen } = useCart();

  if (totalItems <= 0 || isCartOpen) {
    return null;
  }

  return (
    <>
      {/* ─── Mobile Persistent Basket Summary (Item7Go Inspired) ─── */}
      <div className="md:hidden fixed bottom-[72px] inset-x-3 z-30 animate-slideUp">
        <button
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-gradient-to-r from-brand-950 via-affy-dark to-brand-900 text-white rounded-2xl p-3.5 shadow-2xl border border-brand-700/60 flex items-center justify-between active:scale-[0.98] transition-all"
          aria-label="View shopping basket"
        >
          <div className="flex items-center space-x-3 min-w-0">
            {/* Basket Badge */}
            <div className="relative w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/15">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 bg-accent-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                {totalItems}
              </span>
            </div>

            {/* Total / Count info */}
            <div className="text-left truncate">
              <div className="text-[11px] text-brand-200 font-medium leading-none">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in basket
              </div>
              <div className="text-base font-black text-white mt-1 tracking-tight">
                {formatNaira(totalAmountCents)}
              </div>
            </div>
          </div>

          {/* Action Callout */}
          <div className="flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm flex-shrink-0 transition-colors">
            <span>View Basket</span>
            <span className="text-sm leading-none">➔</span>
          </div>
        </button>
      </div>

      {/* ─── Desktop Floating Quick Basket (Preserved) ─── */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-30 animate-slideUp">
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
    </>
  );
};

