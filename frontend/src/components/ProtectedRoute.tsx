// frontend/src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const AUTH_GATE_META: Record<string, { icon: string; title: string; subtitle: string; cta: string }> = {
  '/savings': {
    icon: '🏦',
    title: 'Food Savings is Private',
    subtitle:
      'Sign in or create a free account to set savings goals, track your progress, and lock in today's farm prices before inflation hits.',
    cta: 'Start Saving Today',
  },
  '/wallet': {
    icon: '💳',
    title: 'Your Wallet is Private',
    subtitle:
      'Log in to view your Affy Food Wallet, check your balance, top up funds, and review all your transaction history.',
    cta: 'Access My Wallet',
  },
};

const DEFAULT_GATE = {
  icon: '🔒',
  title: 'Sign In Required',
  subtitle: 'You need to be logged in to access this page.',
  cta: 'Sign In',
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const meta = AUTH_GATE_META[location.pathname] ?? DEFAULT_GATE;

    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Icon bubble */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-50 to-purple-100 border-2 border-brand-200 flex items-center justify-center text-5xl shadow-inner">
              {meta.icon}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold text-slate-900">{meta.title}</h1>
            <p className="text-sm text-slate-500 leading-relaxed">{meta.subtitle}</p>
          </div>

          {/* Auth CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              state={{ from: location }}
              className="flex-1 py-3.5 px-6 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-600/25 transition-all hover:-translate-y-0.5"
            >
              {meta.cta} — It's Free
            </Link>
            <Link
              to="/login"
              state={{ from: location }}
              className="flex-1 py-3.5 px-6 bg-white border-2 border-slate-200 hover:border-brand-300 text-slate-700 hover:text-brand-700 font-bold text-sm rounded-xl transition-all hover:-translate-y-0.5"
            >
              Sign In
            </Link>
          </div>

          {/* Divider with public page pointers */}
          <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-2">
            <p>No account needed to browse and shop:</p>
            <div className="flex justify-center gap-4">
              <Link to="/" className="text-brand-600 hover:underline font-medium">
                → Marketplace
              </Link>
              <Link to="/packages" className="text-brand-600 hover:underline font-medium">
                → Food Bundles
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
