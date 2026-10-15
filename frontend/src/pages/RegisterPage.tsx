import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AffyLogo } from '../components/AffyLogo';

export const RegisterPage: React.FC = () => {
  const { sendSignupOtp, verifySignupOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/wallet';

  const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationTicket, setVerificationTicket] = useState<string | undefined>(undefined);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);

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

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendSignupOtp({
        email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setVerificationTicket(res.verificationTicket);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
      setStep('OTP');
      setResendCountdown(30);
      setSuccessMsg(res.message || 'Verification code sent to your email inbox.');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Registration failed. This email may already be in use.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifySignupOtp(email, otp.trim(), verificationTicket);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Invalid or expired verification code. Please check and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setError(null);
    setLoading(true);
    try {
      const res = await sendSignupOtp({
        email, password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setVerificationTicket(res.verificationTicket);
      if (res.previewOtp) setPreviewOtp(res.previewOtp);
      setResendCountdown(30);
      setSuccessMsg(res.message || 'A new verification code has been sent to your inbox.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xl space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <AffyLogo variant="light" size="lg" className="mx-auto" />
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {step === 'OTP' ? 'Verify Your Email' : 'Create an Account'}
          </h2>
          <p className="text-xs text-slate-500">
            {step === 'OTP'
              ? `We sent a 6-digit code to ${email}. Check your inbox.`
              : 'Open your Affy Food Wallet and start buying bulk foodstuffs at farm prices.'}
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

        {/* Resend Testing Sandbox Helper */}
        {previewOtp && step === 'OTP' && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center space-x-1.5">
                <span>🧪</span>
                <span>Resend Test Mode Code:</span>
              </span>
              <button
                type="button"
                onClick={() => setOtp(previewOtp)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors"
              >
                Auto-Fill Code
              </button>
            </div>
            <div className="font-mono text-xl font-black tracking-widest text-amber-950 bg-amber-100/70 py-2 rounded-xl text-center">
              {previewOtp}
            </div>
            <p className="text-[11px] text-amber-800 leading-normal">
              A copy was also relayed to <strong>affybrand@gmail.com</strong>. To deliver directly to all user emails, verify your domain at{' '}
              <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900">
                resend.com/domains
              </a>.
            </p>
          </div>
        )}

        {/* STEP 1: REGISTRATION DETAILS */}
        {step === 'DETAILS' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  id="reg-firstname"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Amaka"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  id="reg-lastname"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Adeyemi"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                placeholder="amaka@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password <span className="text-rose-500">*</span>
                <span className="text-slate-400 font-normal ml-1">(min. 8 characters)</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              id="btn-send-signup-otp"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
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
                  <span>Continue with Email OTP</span>
                  <span>✉️</span>
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
                id="reg-otp"
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
              id="btn-verify-signup-otp"
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
                  <span>Creating your account…</span>
                </>
              ) : (
                <span>Verify &amp; Complete Registration</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => { setStep('DETAILS'); setError(null); setOtp(''); }}
                className="text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back / Edit Info
              </button>
              <button
                id="btn-resend-signup-otp"
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
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-bold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
