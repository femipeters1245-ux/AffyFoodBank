// frontend/src/components/TransactPayModal.tsx
import React, { useState, useEffect } from 'react';
import { formatNaira } from '../utils/format';

interface TransactPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountCents: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  onSuccess: (paymentData: {
    reference: string;
    channel: string;
    amountCents: number;
    paidAt: string;
  }) => void;
}

type PaymentChannel = 'card' | 'transfer' | 'opay';

export const TransactPayModal: React.FC<TransactPayModalProps> = ({
  isOpen,
  onClose,
  amountCents,
  customer,
  onSuccess,
}) => {
  const [channel, setChannel] = useState<PaymentChannel>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 mins in seconds
  const [copied, setCopied] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [step, setStep] = useState<'details' | 'pin' | 'verifying' | 'success'>('details');

  // Virtual account for bank transfer simulation
  const [virtualAccount] = useState(() => {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    return {
      bankName: 'Wema Bank (TransactPay PSSP)',
      accountNumber: `79${randomSuffix}`,
      accountName: `Affy FoodBank - ${customer.name || 'Order'}`,
      reference: `TP_REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };
  });

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const formattedTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(virtualAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 16) {
      alert('Please enter a valid 16-digit card number');
      return;
    }
    setStep('pin');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('verifying');
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
      setTimeout(() => {
        onSuccess({
          reference: virtualAccount.reference,
          channel: 'CARD',
          amountCents,
          paidAt: new Date().toISOString(),
        });
      }, 1200);
    }, 2000);
  };

  const handleTransferConfirmed = () => {
    setIsProcessing(true);
    setStep('verifying');
    setTimeout(() => {
      setIsProcessing(false);
      setStep('success');
      setTimeout(() => {
        onSuccess({
          reference: virtualAccount.reference,
          channel: 'BANK_TRANSFER',
          amountCents,
          paidAt: new Date().toISOString(),
        });
      }, 1200);
    }, 2500);
  };

  const fillTestCard = () => {
    setCardNumber('5399 4100 2841 8920');
    setCardExpiry('12/28');
    setCardCvv('892');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 pb-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Close payment window"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center space-x-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-sm tracking-wider">
              TP
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-base font-extrabold tracking-tight">TransactPay</span>
                <span className="text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 rounded font-semibold">
                  CBN Licensed
                </span>
              </div>
              <p className="text-[11px] text-blue-100/80">Secured Checkout Gateway</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex items-baseline justify-between">
            <span className="text-xs text-blue-200">Amount to Pay:</span>
            <span className="text-2xl font-black text-white">{formatNaira(amountCents)}</span>
          </div>
          <div className="text-[11px] text-blue-200/90 truncate mt-0.5">
            Paying as: <span className="font-semibold text-white">{customer.email || 'Customer'}</span>
          </div>
        </div>

        {/* Channel Navigation Tabs */}
        {step !== 'verifying' && step !== 'success' && (
          <div className="grid grid-cols-3 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-semibold">
            <button
              onClick={() => {
                setChannel('card');
                setStep('details');
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                channel === 'card'
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Card</span>
            </button>

            <button
              onClick={() => {
                setChannel('transfer');
                setStep('details');
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                channel === 'transfer'
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
              </svg>
              <span>Transfer</span>
            </button>

            <button
              onClick={() => {
                setChannel('opay');
                setStep('details');
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                channel === 'opay'
                  ? 'bg-white text-blue-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>OPay</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* VERIFYING STATE */}
          {step === 'verifying' && (
            <div className="text-center py-8 space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin"></div>
              </div>
              <h4 className="font-bold text-slate-900 text-lg">Authorizing Payment...</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Communicating with TransactPay PSSP switches. Please do not close or refresh this window.
              </p>
            </div>
          )}

          {/* SUCCESS STATE */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                ✓
              </div>
              <h4 className="font-extrabold text-slate-900 text-xl">Payment Successful!</h4>
              <p className="text-xs text-slate-500">
                Transaction reference: <span className="font-mono text-slate-700">{virtualAccount.reference}</span>
              </p>
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
                Your foodstuff order has been confirmed and routed to logistics dispatch.
              </div>
            </div>
          )}

          {/* CARD PAYMENT FLOW */}
          {channel === 'card' && step === 'details' && (
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Supported: Verve, Mastercard, Visa</span>
                <button
                  type="button"
                  onClick={fillTestCard}
                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                >
                  Fill Demo Card
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Card Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                      const formatted = v.match(/.{1,4}/g)?.join(' ') || v;
                      setCardNumber(formatted);
                    }}
                    placeholder="5399 4100 0000 0000"
                    className="w-full pl-3.5 pr-12 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold uppercase">
                    CARD
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                      setCardExpiry(v);
                    }}
                    placeholder="MM/YY"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CVV
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                    placeholder="123"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all"
              >
                Pay {formatNaira(amountCents)} with TransactPay
              </button>
            </form>
          )}

          {/* CARD PIN PROMPT */}
          {channel === 'card' && step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4 text-center py-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto text-xl">
                🔒
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Enter 4-Digit Card PIN</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Secured by 256-bit bank grade encryption
                </p>
              </div>

              <div className="max-w-[160px] mx-auto">
                <input
                  type="password"
                  required
                  autoFocus
                  maxLength={4}
                  value={cardPin}
                  onChange={(e) => setCardPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-[1em] text-2xl py-2.5 border-2 border-blue-500 rounded-xl bg-slate-50 font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cardPin.length < 4 || isProcessing}
                  className="py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow transition-all disabled:opacity-50"
                >
                  Authorize Payment
                </button>
              </div>
            </form>
          )}

          {/* BANK TRANSFER (VIRTUAL ACCOUNT) FLOW */}
          {channel === 'transfer' && step === 'details' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Virtual Account expires in:</span>
                <span className="font-mono font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                  {formattedTimer}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Bank Name:</span>
                  <span className="font-bold text-slate-800">{virtualAccount.bankName}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Account Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-black text-blue-700 font-mono tracking-wider">
                      {virtualAccount.accountNumber}
                    </span>
                    <button
                      onClick={handleCopyAccount}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Beneficiary Name:</span>
                  <span className="font-semibold text-slate-800">{virtualAccount.accountName}</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Exact Amount:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatNaira(amountCents)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Make a normal bank transfer from any Nigerian banking app or USSD (*737#, *894#, *966#, etc.). TransactPay automatically detects your credit within seconds.
              </p>

              <button
                onClick={handleTransferConfirmed}
                disabled={isProcessing}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2"
              >
                <span>I have sent the money</span>
                <span className="text-xs opacity-75">➔</span>
              </button>
            </div>
          )}

          {/* OPAY / WALLET FLOW */}
          {channel === 'opay' && step === 'details' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <div className="text-2xl">📱</div>
                <h4 className="font-bold text-emerald-900 text-sm">Pay via OPay Merchant Switch</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Enter your registered OPay phone number to receive a 1-tap payment push on your OPay app.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  OPay Phone Number
                </label>
                <input
                  type="tel"
                  defaultValue={customer.phone || '08012345678'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleTransferConfirmed}
                disabled={isProcessing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all"
              >
                Send OPay Push Request ({formatNaira(amountCents)})
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 px-5">
          <div className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>PCI-DSS Level 1 Compliant</span>
          </div>
          <span className="font-semibold text-slate-600">TransactPay Direct</span>
        </div>
      </div>
    </div>
  );
};
