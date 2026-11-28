// frontend/src/components/MobileBottomNav.tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { totalItems, setIsCartOpen } = useCart();

  const pathname = location.pathname;

  const isHomeActive = pathname === '/';
  const isOrdersActive = pathname.startsWith('/orders');
  const isBundlesActive = pathname === '/packages';

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-4 h-16 items-center">
        {/* 1. Home */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isHomeActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Home / Marketplace"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform ${isHomeActive ? 'scale-110' : ''}`}
              fill={isHomeActive ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isHomeActive ? 2 : 1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            {isHomeActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Home</span>
        </Link>

        {/* 2. Basket */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 font-medium transition-colors"
          aria-label="View Food Basket"
        >
          <div className="relative">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-brand-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Basket</span>
        </button>

        {/* 3. My Orders */}
        <Link
          to="/orders"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isOrdersActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="My Orders"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform ${isOrdersActive ? 'scale-110' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isOrdersActive ? 2 : 1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            {isOrdersActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Orders</span>
        </Link>

        {/* 4. Commercial Bundles (Exact position of retired Wallet) */}
        <Link
          to="/packages"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isBundlesActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Commercial Food Bundles"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform ${isBundlesActive ? 'scale-110' : ''}`}
              fill={isBundlesActive ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isBundlesActive ? 2 : 1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            {isBundlesActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Bundles</span>
        </Link>
      </div>
    </nav>
  );
};

