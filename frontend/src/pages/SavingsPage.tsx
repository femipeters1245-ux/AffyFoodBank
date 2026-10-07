// frontend/src/pages/SavingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavingsPlan } from '../types';
import { savingsApi, walletApi } from '../services/api';
import { formatNaira, formatDate } from '../utils/format';

const DEMO_SAVINGS_PLANS: SavingsPlan[] = [
  {
    id: 'sp-1',
    customerProfileId: 'cp-demo',
    name: 'December Christmas Food Stockup',
    description: 'Saving ahead of December food price inflation for 2 bags of Rice and 1 keg of Oil.',
    targetAmountCents: 18000000, // ₦180,000.00
    amountSavedCents: 12000000, // ₦120,000.00 (66%)
    targetDate: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'sp-2',
    customerProfileId: 'cp-demo',
    name: 'Boarding House Term 1 Food Supply',
    description: 'Weekly disciplined contribution for child’s foodstuff supplies.',
    targetAmountCents: 6500000, // ₦65,000.00
    amountSavedCents: 4500000, // ₦45,000.00 (69%)
    targetDate: new Date(Date.now() + 25 * 24 * 3600 * 1000).toISOString(),
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
  },
];

export const SavingsPage: React.FC = () => {
  const { wallet, refreshWallet, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<SavingsPlan[]>(DEMO_SAVINGS_PLANS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SavingsPlan | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields for new plan
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanAmountNaira, setNewPlanAmountNaira] = useState('');
  const [newPlanTargetDate, setNewPlanTargetDate] = useState(
    new Date(Date.now() + 45 * 24 * 3600 * 1000).toISOString().split('T')[0],
  );

  const fetchPlans = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await savingsApi.list();
      if (data && data.length > 0) {
        setPlans(data);
      }
    } catch {
      // Keep demo plans if API has no records yet
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [isAuthenticated]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName || !newPlanAmountNaira) {
      setMessage({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    setLoading(true);
    try {
      const targetAmountCents = Math.round(parseFloat(newPlanAmountNaira) * 100);
      if (isAuthenticated) {
        const created = await savingsApi.create({
          name: newPlanName,
          description: newPlanDesc,
          targetAmountCents,
          targetDate: new Date(newPlanTargetDate).toISOString(),
        });
        setPlans([created, ...plans]);
      } else {
        // Local simulation if not logged in
        const fakePlan: SavingsPlan = {
          id: `sp-${Date.now()}`,
          customerProfileId: 'local',
          name: newPlanName,
          description: newPlanDesc,
          targetAmountCents,
          amountSavedCents: 0,
          targetDate: new Date(newPlanTargetDate).toISOString(),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        setPlans([fakePlan, ...plans]);
      }
      setIsModalOpen(false);
      setNewPlanName('');
      setNewPlanDesc('');
      setNewPlanAmountNaira('');
      setMessage({ type: 'success', text: 'Food savings plan started successfully!' });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error ?? 'Failed to create plan. Please sign in.',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !contributeAmount) return;
    const amountCents = Math.round(parseFloat(contributeAmount) * 100);
    setLoading(true);

    try {
      if (isAuthenticated) {
        await walletApi.allocate({
          savingsPlanId: selectedPlan.id,
          amountCents,
        });
        await refreshWallet();
        await fetchPlans();
      } else {
        // Local simulation
        setPlans(
          plans.map((p) =>
            p.id === selectedPlan.id
              ? { ...p, amountSavedCents: Number(p.amountSavedCents) + amountCents }
              : p,
          ),
        );
      }
      setIsContributeModalOpen(false);
      setContributeAmount('');
      setMessage({ type: 'success', text: `Allocated ${formatNaira(amountCents)} to ${selectedPlan.name}!` });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error ?? 'Insufficient available wallet balance. Deposit funds first.',
      });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleCancelPlan = async (planId: string) => {
    if (!window.confirm('Are you sure you want to cancel this savings plan?')) return;
    try {
      if (isAuthenticated) {
        await savingsApi.cancel(planId);
        await fetchPlans();
      } else {
        setPlans(plans.map((p) => (p.id === planId ? { ...p, status: 'CANCELLED' } : p)));
      }
      setMessage({ type: 'success', text: 'Savings plan cancelled.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error ?? 'Failed to cancel plan' });
    }
  };

  return (
    <div className="space-y-10 pb-16">
      {/* Toast */}
      {message && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center space-x-3 border animate-bounce ${
            message.type === 'success'
              ? 'bg-slate-900 text-white border-emerald-500'
              : 'bg-rose-900 text-white border-rose-500'
          }`}
        >
          <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-brand-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs uppercase tracking-wider font-bold text-accent-400 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            Disciplined Food Banking
          </span>
          <h1 className="text-3xl font-extrabold">Food Savings & Inflation Hedge</h1>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Deposit daily or weekly towards bulk foodstuff. Once your target is met, receive guaranteed delivery of your bags of rice, beans, or oils at today's benchmark price.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="whitespace-nowrap bg-accent-500 hover:bg-accent-600 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg transition-all flex items-center space-x-2"
        >
          <span>+ Create New Savings Goal</span>
        </button>
      </div>

      {/* How It Works Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-lg">
            1
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Set Your Food Target</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pick your target foodstuffs (e.g. 2 bags of Rice for December or quarterly boarding school supplies).
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-accent-100 text-accent-700 flex items-center justify-center font-bold text-lg">
            2
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Save at Your Own Pace</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Automate small daily or weekly allocations straight from your Affy Food Wallet. Zero hidden charges.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
            3
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Take Guaranteed Delivery</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            When 100% saved, we dispatch farm-fresh foodstuff straight to your door or warehouse with verified scale weights.
          </p>
        </div>
      </div>

      {/* Active Plans Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Active Food Savings Plans</h2>
            <p className="text-xs text-slate-500">Track and fund your ongoing food goals</p>
          </div>
          {wallet && (
            <div className="text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
              Available in Wallet: <strong>{formatNaira(Number(wallet.totalBalanceCents) - Number(wallet.allocatedToSavingsCents))}</strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const saved = Number(plan.amountSavedCents);
            const target = Number(plan.targetAmountCents);
            const percent = Math.min(100, Math.round((saved / target) * 100));

            return (
              <div
                key={plan.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        plan.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : plan.status === 'CANCELLED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900 text-base">
                          {formatNaira(saved)}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">
                          saved of {formatNaira(target)}
                        </span>
                      </div>
                      <span className="font-bold text-brand-700">{percent}%</span>
                    </div>

                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                      <div
                        className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                      <span>Started: {formatDate(plan.createdAt)}</span>
                      <span>Target Delivery: {formatDate(plan.targetDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  {plan.status === 'ACTIVE' ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedPlan(plan);
                          setIsContributeModalOpen(true);
                        }}
                        className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
                      >
                        + Fund From Wallet
                      </button>
                      <button
                        onClick={() => handleCancelPlan(plan.id)}
                        className="py-2.5 px-3 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-medium transition-colors"
                      >
                        Cancel Plan
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Plan Inactive</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Create Plan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Start a Food Savings Goal</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. December Rice & Oil Stockup"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 bags of Rice and 1 keg of Oil for the family"
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Amount (₦) *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    required
                    placeholder="e.g. 150000"
                    value={newPlanAmountNaira}
                    onChange={(e) => setNewPlanAmountNaira(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newPlanTargetDate}
                    onChange={(e) => setNewPlanTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 text-xs text-brand-800">
                🔒 Funds allocated to this plan remain safely in your ledger until completed or cancelled.
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
                >
                  {loading ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Contribute from Wallet */}
      {isContributeModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Fund "{selectedPlan.name}"</h3>
              <button
                onClick={() => setIsContributeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount to Allocate (₦) *
                </label>
                <input
                  type="number"
                  min="500"
                  required
                  placeholder="e.g. 20000"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {wallet && (
                <div className="text-xs text-slate-500">
                  Available in Wallet:{' '}
                  <strong>
                    {formatNaira(Number(wallet.totalBalanceCents) - Number(wallet.allocatedToSavingsCents))}
                  </strong>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsContributeModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
                >
                  {loading ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
