// frontend/src/components/Navbar.tsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatNaira } from '../utils/format';
import { AffyLogo } from './AffyLogo';

// Lock icon badge shown on auth-required links for guests
const LockBadge: React.FC = () => (
  <span
    className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500"
    title="Sign in required"
    aria-label="Sign in required"
  >
    <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 1a3 3 0 0 0-3 3v1H3.5A1.5 1.5 0 0 0 2 6.5v7A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 12.5 5H11V4a3 3 0 0 0-3-3zm-2 4V4a2 2 0 1 1 4 0v1H6z"/>
    </svg>
  </span>
);

export const Navbar: React.FC = () => {
  const { user, wallet, isAuthenticated, logout } = useAuth();
  const { totalItems, setIsCartOpen } = useCart();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* ─── Logo & Brand (Left) ─── */}
            <div className="flex items-center space-x-2">
              <Link to="/" className="flex items-center group py-1" aria-label="Affy FoodBank Home">
                {/* On mobile, use sm size; on desktop, md */}
                <span className="block sm:hidden">
                  <AffyLogo variant="light" size="sm" className="group-hover:scale-[1.02] transition-transform duration-200" />
                </span>
                <span className="hidden sm:block">
                  <AffyLogo variant="light" size="md" className="group-hover:scale-[1.03] transition-transform duration-200" />
                </span>
              </Link>
            </div>

            {/* ─── Desktop Nav Links (Preserved) ─── */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Marketplace
              </Link>
              <Link
                to="/packages"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/packages')
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Food Bundles
              </Link>
              <Link
                to="/savings"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                  isActive('/savings')
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Food Savings
                {!isAuthenticated && <LockBadge />}
              </Link>
              <Link
                to="/wallet"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                  isActive('/wallet')
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                My Wallet
                {!isAuthenticated && <LockBadge />}
              </Link>
              {(user?.role === 'Admin' || user?.role === 'FinanceStaff' || user?.role === 'SuperAdmin') && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                    isActive('/admin')
                      ? 'bg-purple-900 text-white font-bold'
                      : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                  }`}
                >
                  ⚙️ Operations Portal
                </Link>
              )}
            </div>

            {/* ─── Controls: Cart & Hamburger / Auth ─── */}
            <div className="flex items-center space-x-1.5 sm:space-x-2.5">
              {/* Basket / Cart Button (Visible on both mobile & desktop) */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-slate-700 hover:text-brand-700 hover:bg-brand-50 active:bg-brand-100 rounded-xl transition-all flex items-center space-x-1.5 border border-slate-200/90 shadow-2xs"
                title="View Basket / Cart"
                aria-label="Shopping Basket"
              >
                <svg className="w-5 h-5 text-brand-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                {totalItems > 0 ? (
                  <span className="bg-brand-600 text-white text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-xs">
                    {totalItems}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Basket</span>
                )}
              </button>

              {/* Desktop Auth Controls */}
              <div className="hidden md:flex items-center space-x-3">
                {isAuthenticated ? (
                  <div className="flex items-center space-x-3">
                    {/* Wallet Balance Chip */}
                    <Link
                      to="/wallet"
                      className="flex items-center space-x-2 bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200/80 px-3 py-1.5 rounded-full hover:shadow-xs hover:border-brand-300 transition-all"
                      title="View wallet & ledger"
                    >
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Bal:</span>
                      <span className="text-xs font-bold text-brand-800">
                        {wallet ? formatNaira(wallet.totalBalanceCents) : '₦0.00'}
                      </span>
                    </Link>

                    {/* User menu */}
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 uppercase">
                        {user?.firstName ? user.firstName[0] : user?.email[0] ?? 'U'}
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {user?.firstName ?? user?.email.split('@')[0]}
                      </span>
                      <button
                        onClick={() => logout()}
                        className="ml-2 text-xs text-slate-500 hover:text-rose-600 font-medium py-1 px-2 rounded hover:bg-rose-50 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      to="/login"
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-xs hover:shadow transition-all"
                    >
                      Create Account
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Hamburger Button (Right) */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-xl text-slate-700 hover:text-brand-900 hover:bg-brand-50 active:bg-brand-100 border border-slate-200/80 transition-colors"
                  aria-label="Toggle navigation menu"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Mobile Slide-out Menu Drawer ─── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 overflow-hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-12 w-full sm:max-w-sm">
            <div className="w-full bg-white shadow-2xl flex flex-col justify-between overflow-y-auto animate-slideLeft">
              {/* Drawer Header */}
              <div>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <AffyLogo variant="light" size="sm" />
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                    aria-label="Close menu"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* User Info / Wallet card if authenticated */}
                {isAuthenticated && (
                  <div className="p-4 mx-4 mt-4 bg-gradient-to-br from-brand-900 to-affy-dark text-white rounded-2xl shadow-sm space-y-2">
                    <div className="flex items-center justify-between text-xs text-brand-200">
                      <span>Signed in as</span>
                      <span className="font-semibold">{user?.role ?? 'Customer'}</span>
                    </div>
                    <div className="font-bold text-sm truncate">
                      {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email}
                    </div>
                    {wallet && (
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-brand-200 font-medium">Wallet Balance:</span>
                        <span className="text-sm font-black text-white">
                          {formatNaira(wallet.totalBalanceCents)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Links */}
                <div className="p-4 space-y-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
                    Ordering & Banking
                  </div>

                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive('/')
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-sm">
                      🛒
                    </span>
                    <span>Marketplace</span>
                  </Link>

                  <Link
                    to="/packages"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive('/packages')
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center text-sm">
                      📦
                    </span>
                    <span>Food Bundles</span>
                  </Link>

                  <Link
                    to="/savings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive('/savings')
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                        🏦
                      </span>
                      <span>Food Savings</span>
                    </div>
                    {!isAuthenticated && <LockBadge />}
                  </Link>

                  <Link
                    to="/wallet"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive('/wallet')
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm">
                        💳
                      </span>
                      <span>My Wallet</span>
                    </div>
                    {!isAuthenticated && <LockBadge />}
                  </Link>

                  {(user?.role === 'Admin' || user?.role === 'FinanceStaff' || user?.role === 'SuperAdmin') && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        isActive('/admin')
                          ? 'bg-purple-900 text-white'
                          : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                      }`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-purple-200 text-purple-900 flex items-center justify-center text-sm">
                        ⚙️
                      </span>
                      <span>Operations Portal</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Drawer Footer / Account Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 px-4 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs transition-colors shadow-2xs"
                  >
                    Logout from Account
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 rounded-xl font-bold text-center text-xs transition-colors shadow-2xs"
                    >
                      Account Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-black text-center text-xs transition-colors shadow-xs"
                    >
                      Create Free Account
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
