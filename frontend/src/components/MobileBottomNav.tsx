// frontend/src/components/MobileBottomNav.tsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();

  const pathname = location.pathname;

  const isHomeActive = pathname === '/';
  const isSavingsActive = pathname === '/savings';
  const isAccountActive = ['/wallet', '/login', '/register', '/admin'].includes(pathname);

  const handleCategoriesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/') {
      const el = document.getElementById('categories-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      navigate('/?focus=categories');
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-5 h-16 items-center">
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

        {/* 2. Categories */}
        <button
          onClick={handleCategoriesClick}
          className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 font-medium transition-colors"
          aria-label="Browse Food Categories"
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
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Categories</span>
        </button>

        {/* 3. Food Savings */}
        <Link
          to="/savings"
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isSavingsActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Food Savings"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform ${isSavingsActive ? 'scale-110' : ''}`}
              fill={isSavingsActive ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isSavingsActive ? 2 : 1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {!isAuthenticated && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-500 ring-2 ring-white" />
            )}
            {isSavingsActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Savings</span>
        </Link>

        {/* 4. Basket / Cart */}
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

        {/* 5. Account */}
        <Link
          to={isAuthenticated ? '/wallet' : '/login'}
          className={`flex flex-col items-center justify-center py-1 transition-colors ${
            isAccountActive ? 'text-brand-700 font-bold' : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
          aria-label="Account / Wallet"
        >
          <div className="relative">
            <svg
              className={`w-5 h-5 transition-transform ${isAccountActive ? 'scale-110' : ''}`}
              fill={isAccountActive ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isAccountActive ? 2 : 1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {isAccountActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">
            {isAuthenticated ? 'Wallet' : 'Account'}
          </span>
        </Link>
      </div>
    </nav>
  );
};

