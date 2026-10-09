import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { AffyLogo } from './AffyLogo';

export const Navbar: React.FC = () => {
  const { user, wallet, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center group py-1" aria-label="Affy FoodBank Home">
              <AffyLogo variant="light" size="md" className="group-hover:scale-[1.03] transition-transform duration-200" />
            </Link>
          </div>

          {/* Desktop Nav Links */}
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/savings')
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Food Savings
            </Link>
            <Link
              to="/wallet"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/wallet')
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              My Wallet
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

          {/* User Controls & Balance */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {/* Wallet Balance Chip */}
                <Link
                  to="/wallet"
                  className="flex items-center space-x-2 bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200/80 px-3 py-1.5 rounded-full hover:shadow-sm hover:border-brand-300 transition-all"
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
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm hover:shadow transition-all"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          {isAuthenticated && wallet && (
            <div className="p-3 bg-brand-50 rounded-xl flex items-center justify-between border border-brand-200">
              <span className="text-xs text-brand-700 font-medium">Available Balance</span>
              <span className="text-sm font-bold text-brand-900">
                {formatNaira(wallet.totalBalanceCents)}
              </span>
            </div>
          )}
          <div className="space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Marketplace
            </Link>
            <Link
              to="/packages"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Food Bundles
            </Link>
            <Link
              to="/savings"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              Food Savings
            </Link>
            <Link
              to="/wallet"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-base font-medium text-slate-700 hover:bg-slate-100"
            >
              My Wallet
            </Link>
            {(user?.role === 'Admin' || user?.role === 'FinanceStaff' || user?.role === 'SuperAdmin') && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-bold text-purple-700 bg-purple-50 hover:bg-purple-100"
              >
                ⚙️ Operations Portal
              </Link>
            )}
          </div>
          <div className="pt-3 border-t border-slate-100">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-rose-600 font-medium hover:bg-rose-50 rounded-lg"
              >
                Logout ({user?.email})
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-sm font-medium text-white bg-brand-600 rounded-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
