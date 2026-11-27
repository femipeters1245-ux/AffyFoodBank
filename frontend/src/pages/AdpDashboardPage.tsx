// frontend/src/pages/AdpDashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adpApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AdpDashboardPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bank Change Modal
  const [showBankModal, setShowBankModal] = useState(false);
  const [banks, setBanks] = useState<Array<{ code: string; name: string }>>([]);
  const [newBankCode, setNewBankCode] = useState('058');
  const [newBankName, setNewBankName] = useState('Guaranty Trust Bank');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankVerifyError, setBankVerifyError] = useState<string | null>(null);
  const [submittingBankChange, setSubmittingBankChange] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState<string | null>(null);

  // Action states
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);
      const data = await adpApi.getOperatorDashboard();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load operator dashboard:', err);
      setError(err.response?.data?.message || err.message || 'Could not load delivery port dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [isAuthenticated]);

  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await adpApi.getBanks();
        setBanks(res || []);
      } catch (e) {
        console.warn('Could not load banks:', e);
      }
    }
    fetchBanks();
  }, []);

  const handleBankChangeSelect = (code: string) => {
    setNewBankCode(code);
    const found = banks.find((b) => b.code === code);
    if (found) setNewBankName(found.name);
    setVerifiedName(null);
    setBankVerifyError(null);
  };

  const handleVerifyNewBank = async () => {
    if (!newAccountNumber || newAccountNumber.trim().length !== 10) {
      setBankVerifyError('Please enter a valid 10-digit account number');
      return;
    }
    try {
      setVerifyingBank(true);
      setBankVerifyError(null);
      const res = await adpApi.verifyBank(newAccountNumber.trim(), newBankCode);
      if (res?.accountName) {
        setVerifiedName(res.accountName);
        if (!newAccountName) setNewAccountName(res.accountName);
      } else {
        setBankVerifyError('Could not verify account name');
      }
    } catch (err: any) {
      setBankVerifyError(err.response?.data?.message || err.message || 'Name enquiry failed');
      setVerifiedName(null);
    } finally {
      setVerifyingBank(false);
    }
  };

  const handleSubmitBankChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountNumber || newAccountNumber.length !== 10) return;
    try {
      setSubmittingBankChange(true);
      setBankVerifyError(null);
      await adpApi.requestBankChange({
        bankName: newBankName,
        bankCode: newBankCode,
        accountNumber: newAccountNumber.trim(),
        accountName: newAccountName.trim() || verifiedName || '',
      });
      setBankSuccessMsg('Bank account update submitted successfully and is pending review.');
      setTimeout(() => {
        setShowBankModal(false);
        setBankSuccessMsg(null);
        fetchDashboard();
      }, 2000);
    } catch (err: any) {
      setBankVerifyError(err.response?.data?.message || err.message || 'Failed to update bank details');
    } finally {
      setSubmittingBankChange(false);
    }
  };

  const handleConfirmCollection = async (orderId: string) => {
    if (!confirm('Confirm that the student recipient has collected their order?')) return;
    try {
      setConfirmingOrderId(orderId);
      await adpApi.confirmCollection(orderId);
      await fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to confirm collection');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Please Sign In</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Sign in to access your ADP operator portal.
          </p>
          <Link
            to="/login"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="space-y-4">
          <div className="h-28 bg-white rounded-3xl border border-slate-200 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            📍
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Delivery Port Not Found</h2>
          <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
            {error || "You don't have an approved delivery port registered to this account yet."}
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/adp/apply"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition"
            >
              Apply as Delivery Port
            </Link>
            <Link
              to="/adp/status"
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
            >
              Check Application Status
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { operator, metrics, assignedOrders, recentEarnings } = dashboardData;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Port Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg text-xs">
                {operator.applicationReference}
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-lg text-xs">
                📍 {operator.coverageZone?.name || 'UNILESA Zone'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {operator.hostelName}
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              {operator.hostelAddress} {operator.closestLandmark ? `(Near ${operator.closestLandmark})` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {operator.isActive ? (
              <span className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs uppercase tracking-wider">
                ✓ Port Active & Receiving
              </span>
            ) : operator.status === 'SUSPENDED' ? (
              <span className="px-3.5 py-1.5 bg-purple-100 text-purple-800 rounded-full font-black text-xs uppercase tracking-wider">
                ⏸️ Port Suspended
              </span>
            ) : (
              <span className="px-3.5 py-1.5 bg-amber-100 text-amber-800 rounded-full font-black text-xs uppercase tracking-wider">
                ⏳ Under Verification
              </span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-xs text-slate-500 font-semibold block">Total Earned</span>
            <span className="text-2xl font-black text-slate-900">
              ₦{((metrics.totalEarnedCents || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <span className="text-xs text-emerald-700 font-semibold block">Pending Payout</span>
            <span className="text-2xl font-black text-emerald-800">
              ₦{((metrics.pendingPayoutCents || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
            <span className="text-xs text-brand-700 font-semibold block">Completed Collections</span>
            <span className="text-2xl font-black text-brand-900">
              {metrics.completedCollections || 0}
            </span>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <span className="text-xs text-amber-700 font-semibold block">Awaiting Student Pickup</span>
            <span className="text-2xl font-black text-amber-800">
              {metrics.activeAssignedOrders || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Assigned Orders & Bank Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Assigned Orders for Student Pickup */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-900">Assigned Student Deliveries</h2>
              <span className="text-xs text-slate-500">
                {assignedOrders.length} {assignedOrders.length === 1 ? 'Order' : 'Orders'}
              </span>
            </div>

            {assignedOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <span className="text-3xl block mb-2">📦</span>
                <p className="text-xs font-semibold">No package deliveries assigned to your port right now.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Orders placed by students selecting your hostel will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">{order.reference}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            order.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status === 'DELIVERED' ? '✓ Collected' : '⏳ Awaiting Pickup'}
                        </span>
                      </div>
                      <p className="text-slate-600 font-semibold mt-1">
                        Recipient: {order.customerName || 'Student'} ({order.customerPhone || 'N/A'})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Total: ₦{((order.totalAmountCents || 0) / 100).toLocaleString()} • {new Date(order.createdAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>

                    {order.status !== 'DELIVERED' && (
                      <div>
                        <button
                          type="button"
                          onClick={() => handleConfirmCollection(order.id)}
                          disabled={confirmingOrderId === order.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-2xs"
                        >
                          {confirmingOrderId === order.id ? 'Confirming...' : '✓ Confirm Pickup'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Earnings Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-4">Earnings History</h3>
            {recentEarnings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No collection earnings recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentEarnings.map((earn: any) => (
                      <tr key={earn.id}>
                        <td className="p-3 text-[11px]">
                          {new Date(earn.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="p-3 font-bold text-emerald-700">
                          ₦{((earn.amountCents || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              earn.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {earn.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Masked Bank Details & Profile */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-xs space-y-4">
            <h3 className="text-base font-black text-slate-900">Payout Bank Details</h3>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
              <div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                  Bank Name
                </span>
                <span className="font-bold text-slate-800 text-sm">{operator.bankName}</span>
              </div>

              <div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                  Account Number (Encrypted at Rest)
                </span>
                <span className="font-mono font-bold text-slate-800 text-sm tracking-wider">
                  {operator.accountNumberMasked}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                  Beneficiary Name
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  {operator.nameEnquiryVerifiedName || operator.accountName}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBankModal(true)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Request Bank Details Update
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-xs space-y-2">
            <h3 className="text-base font-black text-slate-900">Student Profile</h3>
            <p><strong>Name:</strong> {operator.fullName}</p>
            <p><strong>Matric:</strong> {operator.matricNumber}</p>
            <p><strong>Faculty:</strong> {operator.faculty}</p>
            <p><strong>Level:</strong> {operator.academicLevel}</p>
            <p><strong>Phone:</strong> {operator.phone}</p>
          </div>
        </div>
      </div>

      {/* Modal: Bank Details Change Request */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Update Payout Bank Details</h3>
              <button onClick={() => setShowBankModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              Your existing account remains active until your new details are independently verified with TransactPay.
            </p>

            {bankSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-semibold">
                ✓ {bankSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSubmitBankChange} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Bank *</label>
                <select
                  value={newBankCode}
                  onChange={(e) => handleBankChangeSelect(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                >
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  10-Digit Account Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="0123456789"
                    required
                    className="flex-1 h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyNewBank}
                    disabled={verifyingBank || newAccountNumber.length !== 10}
                    className="px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold rounded-xl text-[11px]"
                  >
                    {verifyingBank ? 'Checking...' : 'Verify'}
                  </button>
                </div>
              </div>

              {verifiedName && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold text-[11px]">
                  ✓ Verified: {verifiedName}
                </div>
              )}

              {bankVerifyError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold text-[11px]">
                  ⚠️ {bankVerifyError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  value={newAccountName || verifiedName || ''}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Matches bank record"
                  required
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBankChange || !newAccountNumber}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl"
                >
                  {submittingBankChange ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
