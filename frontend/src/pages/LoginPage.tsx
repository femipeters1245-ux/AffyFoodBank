import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AffyLogo } from '../components/AffyLogo';

export const LoginPage: React.FC = () => {
  const { sendLoginOtp, verifyLoginOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationTicket, setVerificationTicket] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await sendLoginOtp(email, password);
      setVerificationTicket(res.verificationTicket);
      setStep('OTP');
      setResendCountdown(30);
      setSuccessMsg(res.message || 'Verification code sent to your email inbox.');
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.message === 'Network Error'
          ? 'Cannot connect to server. Please check your internet connection.'
          : null);
      setError(serverMsg ?? 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await verifyLoginOtp(email, otp.trim(), verificationTicket);
      const role = (user as any).role?.name || (user as any).role;
      if (role === 'Admin' || role === 'FinanceStaff') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from === '/' ? '/wallet' : from, { replace: true });
      }
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Invalid or expired verification code. Please check your inbox and try again.';
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
      setVerificationTicket(res.verificationTicket);
      setResendCountdown(30);
      setSuccessMsg(res.message || 'A new verification code has been sent to your inbox.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <AffyLogo variant="light" size="lg" className="mx-auto" />
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {step === 'OTP' ? 'Email Verification' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-500">
            {step === 'OTP'
              ? `We sent a 6-digit code to ${email}. Check your inbox.`
              : 'Sign in securely with email + OTP two-factor authentication.'}
          </p>
        </div>

        {/* Success banner */}
        {successMsg && step === 'OTP' && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-2">
            <span>📩</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center space-x-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: EMAIL + PASSWORD */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-brand-600 hover:text-brand-700 font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              id="btn-request-otp"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Sending code…</span>
                </>
              ) : (
                <>
                  <span>Continue with OTP</span>
                  <span>🔒</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OTP ENTRY */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                Enter 6-Digit Verification Code
              </label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-2xl tracking-[0.4em] font-mono font-bold py-3 px-4 border-2 border-brand-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
              
              {/* Delivery notice & Spam advice */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1 mt-2 text-left">
                <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                  <span>📬</span>
                  <span>Can't find the email in your primary inbox?</span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  Please check your <strong>Spam / Junk</strong> folder or <strong>Promotions</strong> tab. The sender appears as <em>Affy FoodBank</em>. Email delivery may take 15–45 seconds depending on your email provider.
                </p>
              </div>
            </div>

            <button
              id="btn-verify-login-otp"
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Verifying…</span>
                </>
              ) : (
                <span>Verify &amp; Sign In</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => { setStep('CREDENTIALS'); setError(null); setOtp(''); }}
                className="text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back / Edit Email
              </button>
              <button
                id="btn-resend-login-otp"
                type="button"
                onClick={handleResendOtp}
                disabled={resendCountdown > 0 || loading}
                className="text-brand-600 hover:text-brand-700 font-bold disabled:text-slate-400"
              >
                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
              </button>
            </div>
          </form>
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
