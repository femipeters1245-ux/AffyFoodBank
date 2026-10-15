import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AffyLogo } from '../components/AffyLogo';

export const LoginPage: React.FC = () => {
  const { sendLoginOtp, verifyLoginOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  // Step state: 'CREDENTIALS' or 'OTP'
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  // Countdown timer for OTP resend (30s)
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Step 1: Request OTP via Resend
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await sendLoginOtp(email, password);
      setStep('OTP');
      setResendCountdown(30);
      if (res.previewOtp) {
        setPreviewOtp(res.previewOtp);
      }
      setSuccessMsg(res.message || 'Verification code sent to your email.');
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.message === 'Network Error'
          ? 'Cannot connect to server. Please verify your connection or try again shortly.'
          : null);
      setError(serverMsg ?? 'Invalid email or password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and log in
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await verifyLoginOtp(email, otp.trim());
      const role = user.role?.name || (user as any).role;
      if (
        role === 'Admin' ||
        role === 'FinanceStaff' ||
        email === 'affybrand@gmail.com' ||
        email === 'admin@affyfoodbank.ng' ||
        email === 'staff@affyfoodbank.ng'
      ) {
        navigate('/admin', { replace: true });
      } else {
        navigate(from === '/' ? '/wallet' : from, { replace: true });
      }
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Invalid or expired verification code. Please check and try again.';
      setError(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await sendLoginOtp(email, password);
      setResendCountdown(30);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
      setSuccessMsg('New 6-digit verification code sent to your inbox!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setStep('CREDENTIALS');
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/seed-demo', { method: 'POST' });
      if (!res.ok) throw new Error('Database seeding returned status ' + res.status);
      setSeedSuccess('Demo database initialized! Customer, Staff, and Admin accounts are ready.');
    } catch (err: any) {
      setError('Failed to seed database: ' + (err.message || 'Please check server logs.'));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <AffyLogo variant="light" size="lg" className="mx-auto" />
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {step === 'OTP' ? 'Email Verification' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-500">
            {step === 'OTP'
              ? `We sent a 6-digit verification code via Resend to ${email}`
              : 'Sign in with Resend 2-Step OTP authentication to manage your food wallet.'}
          </p>
        </div>

        {seedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-2">
            <span>✅</span>
            <span>{seedSuccess}</span>
          </div>
        )}

        {successMsg && step === 'OTP' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-2">
            <span>📩</span>
            <span>{successMsg}</span>
          </div>
        )}

        {previewOtp && step === 'OTP' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>🔑</span>
              <span>Dev Preview OTP: <strong>{previewOtp}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setOtp(previewOtp)}
              className="text-[11px] underline text-amber-700 hover:text-amber-800 font-bold"
            >
              Auto-fill
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <span className="text-[11px] text-brand-600 hover:text-brand-700 cursor-pointer">
                  Forgot password?
                </span>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Sending Code via Resend...</span>
              ) : (
                <>
                  <span>Continue with OTP</span>
                  <span>🔒</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono font-bold py-3 px-4 border-2 border-brand-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              <p className="text-[11px] text-slate-400 text-center mt-1.5">
                Check your email inbox and spam folder for the Resend notification.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow transition-all"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('CREDENTIALS');
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back / Edit Email
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCountdown > 0 || loading}
                className="text-brand-600 hover:text-brand-700 font-bold disabled:text-slate-400"
              >
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Demo Fill Buttons (Visible in Credentials Step) */}
        {step === 'CREDENTIALS' && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="text-[11px] text-slate-400 text-center font-semibold uppercase tracking-wider">
              Quick Fill Demo Accounts
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('customer@affyfoodbank.ng', 'Password123!')}
                className="py-2 px-2 bg-slate-50 border border-slate-200 hover:bg-brand-50 text-[11px] font-semibold text-slate-700 rounded-xl transition-colors text-center"
              >
                Customer
              </button>
              <button
                type="button"
                onClick={() => fillDemo('staff@affyfoodbank.ng', 'StaffPassword123!')}
                className="py-2 px-2 bg-slate-50 border border-slate-200 hover:bg-brand-50 text-[11px] font-semibold text-slate-700 rounded-xl transition-colors text-center"
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => fillDemo('affybrand@gmail.com', 'AdminPassword123!')}
                className="py-2 px-2 bg-slate-50 border border-slate-200 hover:bg-brand-50 text-[11px] font-semibold text-slate-700 rounded-xl transition-colors text-center"
              >
                Admin
              </button>
            </div>

            {/* Database Setup Helper */}
            <div className="text-center pt-1">
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedDatabase}
                className="text-[11px] text-brand-600 hover:text-brand-700 underline font-semibold"
              >
                {seeding ? 'Initializing database accounts...' : 'Database empty? Click to auto-seed demo accounts'}
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-500">
          Don't have an account yet?{' '}
          <Link to="/register" className="text-brand-600 font-bold hover:underline">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};
