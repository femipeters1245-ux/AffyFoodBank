// frontend/src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AffyLogo } from '../components/AffyLogo';
import { authApi } from '../services/api';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If redirecting from checkout
  const isFromCheckout =
    new URLSearchParams(location.search).get('redirect') === 'checkout' ||
    localStorage.getItem('affy_checkout_intent') === 'true';

  const defaultDestination = isFromCheckout ? '/?checkout=true' : '/';
  const from = (location.state as any)?.from?.pathname || defaultDestination;

  // Automatically redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'Admin' || user?.role === 'FinanceStaff' || user?.role === 'SuperAdmin') {
        navigate('/admin', { replace: true });
      } else if (localStorage.getItem('affy_checkout_intent') === 'true') {
        localStorage.removeItem('affy_checkout_intent');
        navigate('/?checkout=true', { replace: true });
      } else {
        navigate(from === '/login' ? '/' : from, { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, from]);

  // Mode: 'LOGIN' or 'FORGOT_PASSWORD'
  const [viewMode, setViewMode] = useState<'LOGIN' | 'FORGOT_PASSWORD'>('LOGIN');

  // Password Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [resetStep, setResetStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle standard password login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await login(email.trim(), password);

      const hasCheckoutIntent = localStorage.getItem('affy_checkout_intent') === 'true';
      if (hasCheckoutIntent) {
        localStorage.removeItem('affy_checkout_intent');
        navigate('/?checkout=true', { replace: true });
        return;
      }

      const storedUser = localStorage.getItem('affy_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          const role = parsed.role?.name || parsed.role;
          if (role === 'Admin' || role === 'FinanceStaff' || role === 'SuperAdmin') {
            navigate('/admin', { replace: true });
            return;
          }
        } catch {
          // ignore parse errors
        }
      }
      navigate(from === '/login' ? '/wallet' : from, { replace: true });
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Invalid email or password. Please check your credentials and try again.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Request (send OTP)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const targetEmail = resetEmail.trim().toLowerCase();
      const res = await authApi.requestPasswordReset(targetEmail);
      setSuccessMsg(res.message || `A 6-digit verification code was sent to ${targetEmail}.`);
      setResetStep('VERIFY');
      setResendCountdown(60);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to send password reset code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP & Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: resetEmail.trim().toLowerCase(),
        otp: resetOtp.trim(),
        newPassword,
      });

      setSuccessMsg(res.message || 'Password reset successfully! Please sign in with your new password.');
      setViewMode('LOGIN');
      setEmail(resetEmail.trim().toLowerCase());
      setPassword('');
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setResetStep('REQUEST');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Invalid or expired verification code. Please check your inbox and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-5 sm:p-10 shadow-xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <AffyLogo variant="light" size="lg" className="mx-auto" />
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {viewMode === 'LOGIN'
              ? 'Welcome Back'
              : resetStep === 'REQUEST'
              ? 'Reset Password'
              : 'Enter 6-Digit Code'}
          </h2>
          <p className="text-xs text-slate-500">
            {viewMode === 'LOGIN'
              ? isFromCheckout
                ? 'Sign in to confirm your delivery details and proceed to checkout.'
                : 'Sign in to access your wallet, track orders, and manage savings.'
              : resetStep === 'REQUEST'
              ? 'Enter your registered email address to receive a secure password reset code.'
              : `Enter the 6-digit code sent to ${resetEmail} and your new password.`}
          </p>
        </div>

        {/* Notice for guest redirected from checkout */}
        {isFromCheckout && viewMode === 'LOGIN' && (
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-900 font-medium flex items-center space-x-2">
            <span>🛒</span>
            <span>Your basket items are saved. Sign in to complete your order.</span>
          </div>
        )}

        {/* Success banner */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium space-y-2">
            <div className="flex items-start space-x-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* ─── VIEW 1: PASSWORD LOGIN (ONLY METHOD) ───────────────────────── */}
        {viewMode === 'LOGIN' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="login-password-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('FORGOT_PASSWORD');
                    setResetStep('REQUEST');
                    setResetEmail(email);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              id="btn-login-password-submit"
              type="submit"
              disabled={loading || !email.includes('@') || !password}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow transition-all flex items-center justify-center space-x-2 touch-manipulation"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        {/* ─── VIEW 2: FORGOT PASSWORD (OTP BASED RESET) ──────────────────── */}
        {viewMode === 'FORGOT_PASSWORD' && (
          <div className="space-y-4">
            {resetStep === 'REQUEST' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Registered Email
                  </label>
                  <input
                    id="reset-email-input"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@gmail.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !resetEmail.includes('@')}
                  className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Sending reset code…</span>
                    </>
                  ) : (
                    <span>Send Reset Code (OTP)</span>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('LOGIN');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    id="reset-otp-input"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.4em] font-mono font-bold py-3 px-4 border-2 border-brand-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  <div className="flex items-center justify-between text-xs mt-1.5 px-1">
                    <span className="text-slate-500">{resetEmail}</span>
                    <button
                      type="button"
                      onClick={handleRequestReset}
                      disabled={resendCountdown > 0 || loading}
                      className="text-brand-600 hover:text-brand-800 font-bold disabled:text-slate-400"
                    >
                      {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showNewPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || resetOtp.length < 6 || !newPassword || newPassword !== confirmPassword}
                  className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Resetting password…</span>
                    </>
                  ) : (
                    <span>Set New Password &amp; Sign In</span>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep('REQUEST');
                      setError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    ← Change Email Address
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Don't have an account yet?{' '}
          <Link to="/register" className="text-brand-600 font-bold hover:underline">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};
