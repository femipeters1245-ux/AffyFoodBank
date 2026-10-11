// frontend/src/components/CheckoutModal.tsx
import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { TransactPayModal } from './TransactPayModal';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { items, totalAmountCents, clearCart } = useCart();
  const { user, wallet } = useAuth();

  // Delivery form state
  const [fullName, setFullName] = useState(
    user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
  );
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('080');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Lagos');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'transactpay' | 'wallet'>('transactpay');

  // TransactPay modal trigger & completed order state
  const [showTransactPay, setShowTransactPay] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    reference: string;
    paidAt: string;
    channel: string;
    totalCents: number;
    itemsCount: number;
  } | null>(null);

  if (!isOpen) return null;

  // Delivery cost calculation (Affy food collective standard delivery)
  const deliveryFeeCents = totalAmountCents > 10000000 ? 0 : 250000; // Free above ₦100,000, else ₦2,500
  const grandTotalCents = totalAmountCents + deliveryFeeCents;

  const handleStartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !address) {
      alert('Please fill in your name, phone number, and delivery address.');
      return;
    }

    if (paymentMethod === 'wallet') {
      const balance = wallet?.totalBalanceCents ?? 0;
      if (balance < grandTotalCents) {
        alert(
          `Insufficient wallet balance. You have ${formatNaira(balance)} but order total is ${formatNaira(grandTotalCents)}. Please use TransactPay or top up your wallet.`,
        );
        return;
      }
      // Process wallet payment
      const ref = `WLT_ORD_${Date.now()}`;
      setCompletedOrder({
        reference: ref,
        paidAt: new Date().toISOString(),
        channel: 'WALLET',
        totalCents: grandTotalCents,
        itemsCount: items.reduce((s, i) => s + i.quantity, 0),
      });
      clearCart();
    } else {
      // Launch TransactPay checkout modal
      setShowTransactPay(true);
    }
  };

  const handleTransactPaySuccess = (paymentData: {
    reference: string;
    channel: string;
    amountCents: number;
    paidAt: string;
  }) => {
    setShowTransactPay(false);
    setCompletedOrder({
      reference: paymentData.reference,
      paidAt: paymentData.paidAt,
      channel: paymentData.channel,
      totalCents: grandTotalCents,
      itemsCount: items.reduce((s, i) => s + i.quantity, 0),
    });
    clearCart();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {completedOrder ? 'Order Confirmed! 🎉' : 'Checkout & Delivery'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {completedOrder
                  ? 'Your raw foodstuff will be dispatched directly from wholesale farms.'
                  : 'Fast dispatch across Nigeria via Affy Cold & Bulk Logistics.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* COMPLETED ORDER RECEIPT VIEW */}
          {completedOrder ? (
            <div className="p-6 overflow-y-auto space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black shadow-inner">
                ✓
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Payment Verified
                </span>
                <h4 className="text-2xl font-black text-slate-900 mt-3">
                  Thank You for Your Order!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  We have received your payment via{' '}
                  <span className="font-bold text-slate-800">
                    {completedOrder.channel === 'WALLET' ? 'Affy Wallet' : 'TransactPay Gateway'}
                  </span>
                  .
                </p>
              </div>

              {/* Order Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Tracking Reference:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {completedOrder.reference}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Recipient Name:</span>
                  <span className="font-semibold text-slate-800">{fullName}</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Delivery Address:</span>
                  <span className="font-medium text-slate-800 text-right max-w-xs truncate">
                    {address}, {state}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Contact Phone:</span>
                  <span className="font-mono font-semibold text-slate-800">{phone}</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Total Paid:</span>
                  <span className="font-black text-emerald-700 text-base">
                    {formatNaira(completedOrder.totalCents)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                  <span className="text-slate-500">Estimated Delivery:</span>
                  <span className="font-semibold text-slate-800">Within 24 - 48 Hours</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all"
                >
                  Print / Save Receipt
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md transition-all"
                >
                  Return to Marketplace
                </button>
              </div>
            </div>
          ) : (
            /* CHECKOUT FORM VIEW */
            <form onSubmit={handleStartPayment} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Items summary ribbon */}
              <div className="bg-brand-50/80 border border-brand-200 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-brand-900">
                    {items.length} foodstuff item{items.length === 1 ? '' : 's'} in order
                  </span>
                  <p className="text-[11px] text-brand-700/80">
                    Direct from farmers collective at wholesale price
                  </p>
                </div>
                <span className="font-black text-brand-900 text-base">
                  {formatNaira(totalAmountCents)}
                </span>
              </div>

              {/* Delivery Contact Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Delivery Destination
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Babatunde Adeleke"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number (for rider) *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0803 000 0000"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Street Address / Estate *
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="No 14, Admiralty Way, Lekki Phase 1"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State *
                    </label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="Lagos">Lagos State</option>
                      <option value="Abuja">Abuja (FCT)</option>
                      <option value="Ogun">Ogun State</option>
                      <option value="Oyo">Oyo State (Ibadan)</option>
                      <option value="Rivers">Rivers (Port Harcourt)</option>
                      <option value="Kaduna">Kaduna State</option>
                      <option value="Other">Other State</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Instructions (optional)
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="e.g. Call when entering gate, deliver to flat 3B"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Choose Payment Method
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* TransactPay Gateway Option */}
                  <div
                    onClick={() => setPaymentMethod('transactpay')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      paymentMethod === 'transactpay'
                        ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          TP
                        </div>
                        <span className="font-extrabold text-sm text-slate-900">
                          TransactPay Gateway
                        </span>
                      </div>
                      <input
                        type="radio"
                        checked={paymentMethod === 'transactpay'}
                        onChange={() => setPaymentMethod('transactpay')}
                        className="text-blue-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Debit Card (Verve, Mastercard, Visa), Bank Transfer, or OPay. Instant CBN
                      settlement.
                    </p>
                  </div>

                  {/* Affy Wallet Option */}
                  <div
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      paymentMethod === 'wallet'
                        ? 'border-brand-600 bg-brand-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-700 text-white font-bold text-xs flex items-center justify-center">
                          ₦
                        </div>
                        <span className="font-extrabold text-sm text-slate-900">
                          Affy Food Wallet
                        </span>
                      </div>
                      <input
                        type="radio"
                        checked={paymentMethod === 'wallet'}
                        onChange={() => setPaymentMethod('wallet')}
                        className="text-brand-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Available Balance:{' '}
                      <span className="font-bold text-slate-800">
                        {wallet ? formatNaira(wallet.totalBalanceCents) : '₦0.00'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Calculation */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Foodstuff Subtotal:</span>
                  <span className="font-semibold text-slate-800">
                    {formatNaira(totalAmountCents)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Logistics & Handling:</span>
                  <span className="font-semibold text-slate-800">
                    {deliveryFeeCents === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE (Bulk Order)</span>
                    ) : (
                      formatNaira(deliveryFeeCents)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Amount Due:</span>
                  <span className="text-brand-800 text-base">{formatNaira(grandTotalCents)}</span>
                </div>
              </div>

              {/* Checkout Submit Button */}
              <button
                type="submit"
                className={`w-full py-4 rounded-2xl font-black text-sm text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  paymentMethod === 'transactpay'
                    ? 'bg-blue-700 hover:bg-blue-800 shadow-blue-600/30'
                    : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30'
                }`}
              >
                <span>
                  {paymentMethod === 'transactpay'
                    ? `Pay ${formatNaira(grandTotalCents)} with TransactPay`
                    : `Pay ${formatNaira(grandTotalCents)} from Wallet`}
                </span>
                <span>➔</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Embedded TransactPay Payment Gateway Modal */}
      <TransactPayModal
        isOpen={showTransactPay}
        onClose={() => setShowTransactPay(false)}
        amountCents={grandTotalCents}
        customer={{
          name: fullName,
          email: email || 'customer@affyfoodbank.ng',
          phone,
          address,
        }}
        onSuccess={handleTransactPaySuccess}
      />
    </>
  );
};
