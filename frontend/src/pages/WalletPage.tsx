// frontend/src/pages/WalletPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WalletTransaction } from '../types';
import { walletApi, paymentsApi } from '../services/api';
import { formatNaira, formatDate } from '../utils/format';

interface BankItem {
  name: string;
  code: string;
  id?: string;
}

export const WalletPage: React.FC = () => {
  const { wallet, refreshWallet, isAuthenticated, user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  // Modals & Tabs
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [depositTab, setDepositTab] = useState<'virtual_account' | 'card'>('virtual_account');

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('25000');
  const [loadingVA, setLoadingVA] = useState(false);
  const [vaError, setVaError] = useState<string | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<{
    accountNumber: string;
    bankName: string;
    accountName: string;
    reference: string;
    bankCode?: string;
  } | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState(user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '');
  const [selectedBankCode, setSelectedBankCode] = useState('058'); // Default GTBank
  const [banksList, setBanksList] = useState<BankItem[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // General Loading & Feedback State
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch Transaction Ledger
  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setTxLoading(true);
      const data = await walletApi.listTransactions();
      setTransactions(data || []);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Load Banks from TransactPay for Withdrawal
  useEffect(() => {
    async function loadBanks() {
      try {
        setLoadingBanks(true);
        const res = await paymentsApi.getBanks();
        if (res?.banks && res.banks.length > 0) {
          setBanksList(res.banks);
        }
      } catch (e) {
        console.warn('Could not load dynamic banks:', e);
      } finally {
        setLoadingBanks(false);
      }
    }
    loadBanks();
  }, []);

  // Compute Balances
  // Prefer server-computed availableBalanceCents (accounts for reserved withdrawals)
  // Fall back to totalBalanceCents - allocatedToSavingsCents for older wallet shapes
  const totalBal = wallet ? Number(wallet.totalBalanceCents) : 0;
  const allocatedBal = wallet ? Number(wallet.allocatedToSavingsCents) : 0;
  const availableBal = wallet
    ? Number((wallet as any).availableBalanceCents ?? totalBal - allocatedBal)
    : 0;

  // ─── 1. Automated Permanent Virtual Account for Bank Transfer Deposit ─────
  const fetchVirtualAccount = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingVA(true);
    setVaError(null);
    try {
      const res = await paymentsApi.createVirtualAccount();
      if (res?.accountNumber) {
        setVirtualAccount({
          accountNumber: res.accountNumber,
          bankName: res.bankName || 'Wema Bank (TransactPay PSSP)',
          bankCode: res.bankCode,
          accountName: res.accountName || `Affy / ${user?.firstName || 'Customer'}`,
          reference: res.reference,
        });
      }
    } catch (err: any) {
      setVaError(
        err.response?.data?.message || err.response?.data?.error || 'Unable to retrieve dedicated account. Please try again shortly.'
      );
    } finally {
      setLoadingVA(false);
    }
  }, [isAuthenticated, user?.firstName]);

  useEffect(() => {
    if (isDepositOpen && !virtualAccount && !loadingVA) {
      fetchVirtualAccount();
    }
  }, [isDepositOpen, virtualAccount, loadingVA, fetchVirtualAccount]);

  // Copy Account Number
  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    showToast('Account number copied to clipboard!', 'info');
    setTimeout(() => setCopiedAccount(false), 3000);
  };

  // Confirm / Verify Sent Bank Transfer
  const handleConfirmTransfer = () => {
    setIsDepositOpen(false);
    showToast(
      'Your transfer is being processed. Your wallet will update automatically once TransactPay confirms the transaction.',
      'info'
    );
  };

  // ─── 2. Instant Card / Gateway Deposit ──────────────────────────────────────
  const handleCardDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    const amountCents = Math.round(amountNum * 100);
    setLoading(true);

    try {
      const paymentRef = `TP_WLT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const res = await paymentsApi.createTransactPayOrder({
        amountNaira: amountNum,
        email: user?.email || 'customer@affyfoodbank.ng',
        name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Customer',
      });

      if (res?.checkoutUrl && !res.isSandbox) {
        // Redirect to TransactPay hosted checkout — wallet credited after webhook confirmation
        window.location.href = res.checkoutUrl;
        return;
      }

      // Sandbox / no redirect path: payment is pending provider confirmation
      setIsDepositOpen(false);
      showToast(
        'Payment initiated. Your wallet will update automatically once TransactPay confirms the transaction.',
        'info'
      );
    } catch (err: any) {
      showToast(err.response?.data?.error ?? 'Deposit failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── 3. Automated Payout / Withdrawal via TransactPay Payout API ───────────
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 500) {
      showToast('Minimum withdrawal amount is ₦500', 'error');
      return;
    }
    const amountCents = Math.round(amountNum * 100);

    if (amountCents > availableBal) {
      showToast(`Cannot withdraw more than available balance (${formatNaira(availableBal)})`, 'error');
      return;
    }
    if (!accountNumber || accountNumber.trim().length !== 10) {
      showToast('Please enter a valid 10-digit Nigerian bank account number', 'error');
      return;
    }
    if (!accountName || accountName.trim().length < 3) {
      showToast('Please enter recipient account name as registered with bank', 'error');
      return;
    }

    setLoading(true);
    const selectedBank = banksList.find((b) => b.code === selectedBankCode) || {
      name: 'Commercial Bank',
      code: selectedBankCode,
    };

    try {
      const payoutRes = await paymentsApi.initiatePayout({
        amountNaira: amountNum,
        accountNumber: accountNumber.trim(),
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountName: accountName.trim(),
        description: `Affy FoodBank Wallet Withdrawal to ${selectedBank.name}`,
      });

      await refreshWallet();
      await fetchTransactions();

      setIsWithdrawOpen(false);
      setWithdrawAmount('');
      setAccountNumber('');
      showToast(
        `Withdrawal of ${formatNaira(amountCents)} initiated. Funds reserved — your bank account will be credited once TransactPay clears the payout. Reference: ${
          payoutRes.reference || 'PGW-PAYOUT'
        }`,
        'info'
      );
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Withdrawal processing failed. Please check bank details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-8 sm:pb-16">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-16 sm:top-20 right-3 sm:right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 border text-xs font-semibold animate-slideDown max-w-[90vw] ${
            toast.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-800'
              : toast.type === 'info'
              ? 'bg-slate-900 text-brand-300 border-slate-700'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          <span className="font-bold">
            {toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✓'}
          </span>
          <span className="truncate">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 px-1">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
              ⚡ TransactPay Automated Wallet
            </span>
            <span className="text-[10px] sm:text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
              ● Active PSSP
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 sm:mt-2">Affy Food Wallet</h1>
          <p className="text-xs text-slate-500">
            Account: <strong>{user?.email || 'Active Member'}</strong> • Automated Deposits &amp; Payouts
          </p>
        </div>

        {/* Action Buttons: 2-column grid on mobile, flex on desktop */}
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:space-x-3 pt-1">
          <button
            onClick={() => {
              setIsDepositOpen(true);
              setVirtualAccount(null);
            }}
            className="py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black rounded-xl sm:rounded-2xl shadow-xs transition-all flex items-center justify-center space-x-1.5 active:scale-95"
          >
            <span className="text-sm">📥</span>
            <span>Deposit</span>
          </button>
          <button
            onClick={() => setIsWithdrawOpen(true)}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-black rounded-xl sm:rounded-2xl shadow-2xs transition-all flex items-center justify-center space-x-1.5 active:scale-95"
          >
            <span className="text-sm">📤</span>
            <span>Withdraw</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        {/* Total Balance Card */}
        <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-purple-950 text-white p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl shadow-lg border border-purple-900/40 space-y-3">
          <div className="flex justify-between items-center text-xs text-brand-200/90 font-semibold">
            <span>Total Ledger Balance</span>
            <span className="text-lg">💳</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black">{formatNaira(totalBal)}</div>
            <div className="text-[10px] sm:text-[11px] text-brand-300/80 mt-1">
              Combined available &amp; locked savings
            </div>
          </div>
        </div>

        {/* Available to Spend Card */}
        <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl shadow-2xs border border-slate-200/90 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
            <span>Available to Spend / Withdraw</span>
            <span className="text-emerald-600 font-bold text-base">₦</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{formatNaira(availableBal)}</div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-1">
              Eligible for instant automated bank payout
            </div>
          </div>
        </div>

        {/* Locked in Food Savings Card */}
        <div className="bg-white p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl shadow-2xs border border-slate-200/90 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
            <span>Locked in Food Savings</span>
            <span className="text-accent-500 text-base">🌾</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{formatNaira(allocatedBal)}</div>
            <div className="text-[10px] sm:text-[11px] text-accent-700 font-semibold mt-1">
              Guaranteed food price inflation protection
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Access: Orders & Deliveries Tracking Banner ─── */}
      <div className="bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-lg shadow-sm">
            📦
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">Foodstuff Orders &amp; Doorstep Tracking</h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Track live packing and rider dispatch status for your foodstuff orders.
            </p>
          </div>
        </div>

        <Link
          to="/orders"
          className="w-full sm:w-auto text-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 touch-manipulation"
        >
          View My Orders &amp; Track ➔
        </Link>
      </div>

      {/* ─── Transactions Ledger (Mobile-Native Cards + Desktop Table) ─── */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-2 sm:space-y-4">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900">TransactPay Ledger History</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Audit log of automated deposits, payouts, and grocery checkouts
            </p>
          </div>
          <span className="text-[10px] sm:text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
            {transactions.length} Transactions
          </span>
        </div>

        {txLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Loading transaction history...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No transactions found on your food wallet ledger yet.
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (Screen < 768px) */}
            <div className="md:hidden divide-y divide-slate-100 px-3">
              {transactions.map((tx) => {
                const isIncoming = tx.direction === 'IN';
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                          isIncoming
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {tx.type === 'DEPOSIT'
                          ? '📥'
                          : tx.type === 'WITHDRAWAL'
                          ? '📤'
                          : tx.type === 'SAVINGS_ALLOCATION'
                          ? '🌾'
                          : '🛒'}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {tx.description || tx.type}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(tx.createdAt)} • <span className="font-mono">{tx.reference.slice(-8)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div
                        className={`text-xs font-black ${
                          isIncoming ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isIncoming ? '+' : '-'} {formatNaira(tx.amountCents)}
                      </div>
                      <span
                        className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full border mt-0.5 ${
                          tx.status === 'SUCCESSFUL'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : tx.status === 'PENDING'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-rose-700 bg-rose-50 border-rose-200'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop Table View (Screen >= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Reference &amp; Date</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Gateway Description</th>
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
                          <div className="font-mono text-xs font-bold text-slate-900">{tx.reference}</div>
                          <div className="text-[11px] text-slate-400">{formatDate(tx.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
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
                        <td className="px-6 py-4 text-slate-700 font-medium max-w-xs truncate">
                          {tx.description ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center space-x-1.5 border px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              tx.status === 'SUCCESSFUL'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : tx.status === 'PENDING'
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            <span>●</span>
                            <span>{tx.status}</span>
                          </span>
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-black text-sm ${
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
          </>
        )}
      </div>

      {/* ─── MODAL 1: AUTOMATED DEPOSIT VIA TRANSACTPAY (Virtual Account & Card) ─── */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-7 space-y-4 shadow-2xl border border-slate-100 my-auto">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Automated Wallet Top-Up</h3>
                <p className="text-[11px] text-slate-500">Powered by TransactPay PSSP Gateway</p>
              </div>
              <button
                onClick={() => {
                  setIsDepositOpen(false);
                  setVirtualAccount(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Deposit Method Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDepositTab('virtual_account')}
                className={`flex-1 py-2 rounded-lg transition-all truncate px-1 ${
                  depositTab === 'virtual_account'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🏦 Bank Transfer
              </button>
              <button
                type="button"
                onClick={() => setDepositTab('card')}
                className={`flex-1 py-2 rounded-lg transition-all truncate px-1 ${
                  depositTab === 'card'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                💳 Debit Card / USSD
              </button>
            </div>

            {/* TAB 1: PERMANENT VIRTUAL ACCOUNT TRANSFER */}
            {depositTab === 'virtual_account' && (
              <div className="space-y-3.5">
                {loadingVA ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-500 font-semibold">Retrieving your dedicated account details...</p>
                  </div>
                ) : vaError ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center space-y-2.5">
                    <p className="text-xs text-rose-700 font-bold">{vaError}</p>
                    <button
                      type="button"
                      onClick={fetchVirtualAccount}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Retry Account Setup
                    </button>
                  </div>
                ) : virtualAccount ? (
                  /* Display Permanent Virtual Account Details */
                  <div className="space-y-3 animate-fadeIn">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white p-4 sm:p-5 rounded-2xl border border-slate-700 space-y-2.5">
                      <div className="flex justify-between items-center text-[10px] text-slate-300 font-bold">
                        <span>YOUR PERMANENT RESERVED ACCOUNT</span>
                        <span className="text-emerald-400 font-mono">LIVE PSSP CLEARING</span>
                      </div>

                      <div className="bg-white/10 p-3.5 rounded-xl border border-white/10 space-y-1.5">
                        <div className="text-[10px] text-slate-400 font-semibold">Bank Name:</div>
                        <div className="text-xs sm:text-sm font-extrabold text-white">{virtualAccount.bankName}</div>

                        <div className="text-[10px] text-slate-400 font-semibold pt-1">Account Number:</div>
                        <div className="flex items-center justify-between">
                          <span className="text-xl sm:text-2xl font-mono font-black tracking-wider text-emerald-400">
                            {virtualAccount.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount(virtualAccount.accountNumber)}
                            className="px-3 py-1 bg-white text-slate-900 rounded-lg text-xs font-black hover:bg-slate-100 transition-colors"
                          >
                            {copiedAccount ? 'Copied! ✓' : 'Copy'}
                          </button>
                        </div>

                        <div className="text-[10px] text-slate-400 font-semibold pt-1">Beneficiary Account Name:</div>
                        <div className="text-xs font-bold text-slate-200 truncate">{virtualAccount.accountName}</div>
                      </div>

                      <div className="text-[10px] text-slate-400 truncate">
                        Account Ref: <span className="font-mono text-slate-300">{virtualAccount.reference}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                      <div className="font-extrabold flex items-center space-x-1.5">
                        <span>⚡ Instant Automated Bank Transfer Crediting</span>
                      </div>
                      <div className="text-[11px] text-emerald-700 leading-relaxed">
                        This is your permanent dedicated account. Transfer any amount from any Nigerian bank (Access, GTB, Zenith, OPay, PalmPay, Kuda, etc.). Your food wallet is credited automatically once confirmed by the bank.
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleConfirmTransfer}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition-colors shadow-2xs active:scale-95"
                      >
                        I Have Sent Money ✓
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* TAB 2: INSTANT DEBIT CARD / GATEWAY CHECKOUT */}
            {depositTab === 'card' && (
              <form onSubmit={handleCardDeposit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-base font-black focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
                  <div className="font-bold">Card, USSD &amp; QR Payment</div>
                  <div className="text-[11px] text-purple-700">
                    Pay securely using Mastercard, Visa, or Verve cards through TransactPay&apos;s PCI-DSS compliant checkout.
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDepositOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 text-xs font-black text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-xs transition-all active:scale-95"
                  >
                    {loading ? 'Connecting...' : 'Pay with TransactPay →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 2: AUTOMATED WITHDRAWAL / PAYOUT ─── */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-7 space-y-4 shadow-2xl border border-slate-100 my-auto">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Automated Bank Withdrawal</h3>
                <p className="text-[11px] text-slate-500">TransactPay Direct Payout API</p>
              </div>
              <button
                onClick={() => setIsWithdrawOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Nigerian Bank *</label>
                <select
                  value={selectedBankCode}
                  onChange={(e) => setSelectedBankCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-semibold text-xs sm:text-sm bg-white"
                >
                  {loadingBanks ? (
                    <option value="">Loading banks...</option>
                  ) : (
                    banksList.map((b) => (
                      <option key={b.code + b.name} value={b.code}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  10-Digit NUBAN Account Number *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  placeholder="e.g. 0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Account Name (as registered with bank) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adebayo Ogunlesi"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-semibold text-xs sm:text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">Withdrawal Amount (₦) *</label>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount((availableBal / 100).toString())}
                    className="text-[11px] text-brand-700 font-bold hover:underline"
                  >
                    Max ({formatNaira(availableBal)})
                  </button>
                </div>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  placeholder="50000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWithdrawOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-black text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-xs transition-all active:scale-95"
                >
                  {loading ? 'Dispatched...' : 'Confirm Withdrawal →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
