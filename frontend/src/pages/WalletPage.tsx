// frontend/src/pages/WalletPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { WalletTransaction } from '../types';
import { walletApi } from '../services/api';
import { formatNaira, formatDate } from '../utils/format';

const DEMO_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-1',
    walletId: 'w-demo',
    customerId: 'c-demo',
    reference: 'PAY_AFB_839210492811',
    type: 'DEPOSIT',
    amountCents: 15000000, // ₦150,000.00
    currency: 'NGN',
    direction: 'IN',
    status: 'SUCCESSFUL',
    description: 'Bank Transfer via Paystack Gateway',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-2',
    walletId: 'w-demo',
    customerId: 'c-demo',
    reference: 'SAV_ALLOC_92810398',
    type: 'SAVINGS_ALLOCATION',
    amountCents: 5000000, // ₦50,000.00
    currency: 'NGN',
    direction: 'OUT',
    status: 'SUCCESSFUL',
    description: 'Allocation to December Food Stockup',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-3',
    walletId: 'w-demo',
    customerId: 'c-demo',
    reference: 'PAY_AFB_109283746192',
    type: 'DEPOSIT',
    amountCents: 8000000, // ₦80,000.00
    currency: 'NGN',
    direction: 'IN',
    status: 'SUCCESSFUL',
    description: 'Debit Card Top-up',
    createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-4',
    walletId: 'w-demo',
    customerId: 'c-demo',
    reference: 'PURCH_ORD_7719283',
    type: 'PURCHASE',
    amountCents: 450000, // ₦4,500.00
    currency: 'NGN',
    direction: 'OUT',
    status: 'SUCCESSFUL',
    description: 'Purchase: 1 Paint Rubber Ijebu Garri',
    createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
  },
];

export const WalletPage: React.FC = () => {
  const { wallet, refreshWallet, isAuthenticated, user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>(DEMO_TRANSACTIONS);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('25000');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await walletApi.listTransactions();
      if (data && data.length > 0) {
        setTransactions(data);
      }
    } catch {
      // Keep demo list
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [isAuthenticated]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    const amountCents = Math.round(amountNum * 100);
    setLoading(true);

    try {
      const paymentRef = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (isAuthenticated) {
        await walletApi.deposit({
          amountCents,
          paymentReference: paymentRef,
          description: `Card deposit: ${formatNaira(amountCents)}`,
        });
        await refreshWallet();
        await fetchTransactions();
      } else {
        // Local simulation
        const fakeTx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          walletId: 'w-local',
          customerId: 'c-local',
          reference: paymentRef,
          type: 'DEPOSIT',
          amountCents,
          currency: 'NGN',
          direction: 'IN',
          status: 'SUCCESSFUL',
          description: 'Simulated Card Deposit',
          createdAt: new Date().toISOString(),
        };
        setTransactions([fakeTx, ...transactions]);
      }
      setIsDepositOpen(false);
      showToast(`Successfully deposited ${formatNaira(amountCents)} to your wallet!`);
    } catch (err: any) {
      showToast(err.response?.data?.error ?? 'Deposit failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    const amountCents = Math.round(amountNum * 100);
    setLoading(true);

    try {
      if (isAuthenticated) {
        await walletApi.withdraw({
          amountCents,
          description: `Bank withdrawal to verified account`,
        });
        await refreshWallet();
        await fetchTransactions();
      } else {
        const fakeTx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          walletId: 'w-local',
          customerId: 'c-local',
          reference: `wdr_${Date.now()}`,
          type: 'WITHDRAWAL',
          amountCents,
          currency: 'NGN',
          direction: 'OUT',
          status: 'SUCCESSFUL',
          description: 'Simulated Bank Withdrawal',
          createdAt: new Date().toISOString(),
        };
        setTransactions([fakeTx, ...transactions]);
      }
      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      showToast(`Withdrawal of ${formatNaira(amountCents)} initiated!`);
    } catch (err: any) {
      showToast(err.response?.data?.error ?? 'Insufficient available balance.');
    } finally {
      setLoading(false);
    }
  };

  const totalBal = wallet ? Number(wallet.totalBalanceCents) : 18500000;
  const allocatedBal = wallet ? Number(wallet.allocatedToSavingsCents) : 5000000;
  const availableBal = totalBal - allocatedBal;

  return (
    <div className="space-y-10 pb-16">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            Financial Ledger
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Affy Food Wallet</h1>
          <p className="text-xs text-slate-500">
            Account: <strong>{user?.email ?? 'customer@affyfoodbank.ng'}</strong> • Escrow Protected
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDepositOpen(true)}
            className="px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
          >
            <span>+ Top-Up Wallet</span>
          </button>
          <button
            onClick={() => setIsWithdrawOpen(true)}
            className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
          >
            Withdraw to Bank
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance Card */}
        <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-lg border border-brand-800 space-y-4">
          <div className="flex justify-between items-center text-xs text-emerald-200/80">
            <span>Total Ledger Balance</span>
            <span className="text-xl">💳</span>
          </div>
          <div>
            <div className="text-3xl font-black">{formatNaira(totalBal)}</div>
            <div className="text-[11px] text-emerald-300/80 mt-1">
              Combined available & locked savings
            </div>
          </div>
        </div>

        {/* Available to Spend Card */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Available to Spend / Withdraw</span>
            <span className="text-emerald-500 font-bold text-lg">₦</span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {formatNaira(availableBal)}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              Instant checkout on raw foodstuffs
            </div>
          </div>
        </div>

        {/* Locked in Food Savings Card */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Locked in Food Savings</span>
            <span className="text-accent-500 text-lg">🌾</span>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">
              {formatNaira(allocatedBal)}
            </div>
            <div className="text-[11px] text-accent-700 font-semibold mt-1">
              Guaranteed food price protection
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-slate-900">Transaction History</h2>
            <p className="text-xs text-slate-500">Double-entry audit log of all deposits, releases, and purchases</p>
          </div>
          <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 rounded-full font-medium">
            {transactions.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Reference & Date</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5">Description</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isIncoming = tx.direction === 'IN';
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">
                        {tx.reference}
                      </div>
                      <div className="text-[11px] text-slate-400">{formatDate(tx.createdAt)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type === 'DEPOSIT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.type === 'WITHDRAWAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : tx.type === 'SAVINGS_ALLOCATION'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {tx.description ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        <span>●</span>
                        <span>{tx.status}</span>
                      </span>
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-extrabold text-sm ${
                        isIncoming ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isIncoming ? '+' : '-'} {formatNaira(tx.amountCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Deposit */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Top-Up Food Wallet</h3>
              <button
                onClick={() => setIsDepositOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount in Naira (₦) *
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  placeholder="25000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[5000, 10000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDepositAmount(val.toString())}
                    className="py-1.5 bg-slate-50 border border-slate-200 hover:border-brand-500 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    ₦{(val / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="font-bold">Instant Credit via Card / Bank Transfer</div>
                <div className="text-[11px] text-emerald-700">
                  Zero gateway maintenance charges. Funds are immediately available for grocery purchases or savings.
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDepositOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
                >
                  {loading ? 'Processing...' : 'Pay with Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Withdraw */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Withdraw Funds to Bank</h3>
              <button
                onClick={() => setIsWithdrawOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount in Naira (₦) *
                </label>
                <input
                  type="number"
                  min="500"
                  required
                  placeholder="e.g. 10000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="text-xs text-slate-500">
                Available to Withdraw: <strong>{formatNaira(availableBal)}</strong>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
                >
                  {loading ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
