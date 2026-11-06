// frontend/src/pages/SavingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavingsPlan } from '../types';
import { savingsApi, walletApi } from '../services/api';
import { formatNaira, formatDate } from '../utils/format';

interface GoalTemplate {
  name: string;
  description: string;
  amountNaira: string;
  icon: string;
  periodDays: number;
}

const SAVINGS_TEMPLATES: GoalTemplate[] = [
  {
    name: '50kg Royal Stallion Rice Bag',
    description: 'Lock in farm gate price for 50kg clean parboiled Nigerian rice.',
    amountNaira: '75000',
    icon: '🌾',
    periodDays: 45,
  },
  {
    name: 'Quarterly Family Food Ration',
    description: 'Bulk rice, beans, garri and 25L vegetable oil for the family.',
    amountNaira: '180000',
    icon: '🍲',
    periodDays: 90,
  },
  {
    name: 'Student Semester Food Pack',
    description: 'Weekly staples: derica rice, garri, noodles, eggs & seasonings.',
    amountNaira: '35000',
    icon: '📦',
    periodDays: 30,
  },
];

export const SavingsPage: React.FC = () => {
  const { wallet, refreshWallet, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<SavingsPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
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
      setLoadingPlans(true);
      const data = await savingsApi.list();
      setPlans(data || []);
    } catch {
      setPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [isAuthenticated]);

  const handleApplyTemplate = (tpl: GoalTemplate) => {
    setNewPlanName(tpl.name);
    setNewPlanDesc(tpl.description);
    setNewPlanAmountNaira(tpl.amountNaira);
    const target = new Date(Date.now() + tpl.periodDays * 24 * 3600 * 1000).toISOString().split('T')[0];
    setNewPlanTargetDate(target);
    setIsModalOpen(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName || !newPlanAmountNaira) {
      setMessage({ type: 'error', text: 'Please complete all required fields.' });
      return;
    }
    setLoading(true);
    try {
      const targetAmountCents = Math.round(parseFloat(newPlanAmountNaira) * 100);
      const created = await savingsApi.create({
        name: newPlanName,
        description: newPlanDesc,
        targetAmountCents,
        targetDate: new Date(newPlanTargetDate).toISOString(),
      });
      setPlans([created, ...plans]);
      setIsModalOpen(false);
      setNewPlanName('');
      setNewPlanDesc('');
      setNewPlanAmountNaira('');
      setMessage({ type: 'success', text: 'Food savings goal started successfully!' });
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
      await walletApi.allocate({
        savingsPlanId: selectedPlan.id,
        amountCents,
      });
      await refreshWallet();
      await fetchPlans();
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
    if (!window.confirm('Are you sure you want to cancel this savings plan? Allocated funds will return to your available balance.')) return;
    try {
      await savingsApi.cancel(planId);
      await refreshWallet();
      await fetchPlans();
      setMessage({ type: 'success', text: 'Savings plan cancelled.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error ?? 'Failed to cancel plan' });
    }
  };

  const availableWalletCents = wallet
    ? Number(wallet.totalBalanceCents) - Number(wallet.allocatedToSavingsCents)
    : 0;

  return (
    <div className="space-y-6 sm:space-y-10 pb-8 sm:pb-16">
      {/* Toast Notification */}
      {message && (
        <div
          className={`fixed top-16 sm:top-20 right-3 sm:right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 border text-xs font-semibold animate-slideDown max-w-[90vw] ${
            message.type === 'success'
              ? 'bg-slate-950 text-white border-emerald-500'
              : 'bg-rose-950 text-white border-rose-500'
          }`}
        >
          <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
          <span className="truncate">{message.text}</span>
        </div>
      )}

      {/* ─── Header & Stats Banner (Mobile & Desktop Responsive) ─── */}
      <div className="bg-gradient-to-br from-affy-dark via-brand-900 to-brand-950 rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 border border-purple-900/50 relative overflow-hidden">
        <div className="space-y-2 sm:space-y-3 max-w-xl text-left">
          <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-accent-400 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            Disciplined Food Banking
          </span>
          <h1 className="text-xl sm:text-3xl font-black">Food Savings &amp; Inflation Hedge</h1>
          <p className="text-xs sm:text-sm text-brand-100/90 leading-relaxed font-normal">
            Save gradually towards planned bulk foodstuffs. Once your target is completed, take delivery of your bags of rice, beans, or oils locked in at today&apos;s benchmark prices.
          </p>
        </div>

        <button
          onClick={() => {
            setNewPlanName('');
            setNewPlanDesc('');
            setNewPlanAmountNaira('');
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto text-center whitespace-nowrap bg-accent-500 hover:bg-accent-600 text-slate-950 font-black text-xs sm:text-sm px-5 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2"
        >
          <span>+ Create Food Savings Goal</span>
        </button>
      </div>

      {/* ─── How It Works (Mobile Compact 3-Step Row) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-black text-sm sm:text-base">
            1
          </div>
          <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Set Your Food Target</h3>
          <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
            Pick your target foodstuffs (e.g. bags of Rice for festive seasons or boarding school supplies).
          </p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-accent-100 text-accent-700 flex items-center justify-center font-black text-sm sm:text-base">
            2
          </div>
          <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Save at Your Own Pace</h3>
          <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
            Automate small daily or weekly allocations straight from your Affy Food Wallet. Zero hidden charges.
          </p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 sm:space-y-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm sm:text-base">
            3
          </div>
          <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">Guaranteed Food Delivery</h3>
          <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
            When 100% saved, we dispatch farm-fresh foodstuff straight to your doorstep with certified scale weights.
          </p>
        </div>
      </div>

      {/* ─── Recommended Goal Templates (Quick Start) ─── */}
      <div className="space-y-3">
        <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-500 px-1">
          Popular Savings Goals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAVINGS_TEMPLATES.map((tpl) => (
            <div
              key={tpl.name}
              className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-brand-300 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="text-2xl p-2 rounded-xl bg-brand-50 flex-shrink-0">
                  {tpl.icon}
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{tpl.name}</h4>
                  <p className="text-[11px] font-black text-brand-800 mt-0.5">
                    ₦{Number(tpl.amountNaira).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleApplyTemplate(tpl)}
                className="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap active:scale-95"
              >
                Start
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Active Plans Section ─── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
          <div>
            <h2 className="text-base sm:text-xl font-black text-slate-900">Your Active Food Savings Plans</h2>
            <p className="text-xs text-slate-500">Track and fund your ongoing food goals</p>
          </div>
          {wallet && (
            <div className="text-xs bg-brand-50 border border-brand-200/80 px-3 py-1.5 rounded-xl text-brand-900 font-medium">
              Available in Wallet: <strong>{formatNaira(availableWalletCents)}</strong>
            </div>
          )}
        </div>

        {loadingPlans ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-8 sm:p-12 text-center text-slate-400 text-xs sm:text-sm">
            Loading your food savings goals...
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner">
              🌾
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">No Active Savings Goals Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Protect yourself against volatile food inflation. Choose a popular goal above or create your own custom staple target.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
            >
              + Start Custom Food Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {plans.map((plan) => {
              const saved = Number(plan.amountSavedCents);
              const target = Number(plan.targetAmountCents);
              const remaining = Math.max(0, target - saved);
              const percent = Math.min(100, Math.round((saved / target) * 100));

              return (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                          {plan.name}
                        </h3>
                        {plan.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {plan.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
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

                    {/* Financial Metrics: Saved, Target & Remaining */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase">Saved</div>
                        <div className="text-xs sm:text-sm font-black text-brand-800 mt-0.5 truncate">
                          {formatNaira(saved)}
                        </div>
                      </div>
                      <div className="border-x border-slate-200">
                        <div className="text-[10px] text-slate-400 font-medium uppercase">Target</div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 truncate">
                          {formatNaira(target)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase">Remaining</div>
                        <div className="text-xs sm:text-sm font-black text-accent-700 mt-0.5 truncate">
                          {formatNaira(remaining)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Savings Progress</span>
                        <span className="font-black text-brand-700">{percent}%</span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                        <div
                          className="h-full bg-gradient-to-r from-affy-gold via-brand-500 to-brand-700 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-400 pt-0.5">
                        <span>Started: {formatDate(plan.createdAt)}</span>
                        <span>Maturity: {formatDate(plan.targetDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {plan.status === 'ACTIVE' ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPlan(plan);
                            setIsContributeModalOpen(true);
                          }}
                          className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all active:scale-95"
                        >
                          + Fund From Wallet
                        </button>
                        <button
                          onClick={() => handleCancelPlan(plan.id)}
                          className="py-2 px-3 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-semibold transition-colors"
                        >
                          Cancel
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
        )}
      </div>

      {/* ─── Modal: Create Savings Goal (Mobile-Tuned) ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-7 space-y-4 shadow-2xl border border-slate-100 my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base sm:text-lg font-black text-slate-900">Start a Food Savings Goal</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. December Rice & Oil Stockup"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 bags of Rice and 1 keg of Oil for family"
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Amount (₦) *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    required
                    placeholder="e.g. 75000"
                    value={newPlanAmountNaira}
                    onChange={(e) => setNewPlanAmountNaira(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Maturity *
                  </label>
                  <input
                    type="date"
                    required
                    value={newPlanTargetDate}
                    onChange={(e) => setNewPlanTargetDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-brand-50 rounded-xl border border-brand-200 text-[11px] text-brand-900 leading-relaxed">
                🔒 Funds allocated to this plan remain safely in your ledger. Once 100% saved, foodstuffs are dispatched at benchmark rates.
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-black text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-all active:scale-95"
                >
                  {loading ? 'Creating...' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Contribute / Fund From Wallet (Mobile-Tuned) ─── */}
      {isContributeModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                Fund &quot;{selectedPlan.name}&quot;
              </h3>
              <button
                onClick={() => setIsContributeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleContribute} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Amount to Allocate (₦) *
                </label>
                <input
                  type="number"
                  min="500"
                  required
                  placeholder="e.g. 10000"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {wallet && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  Available in Wallet:{' '}
                  <strong className="text-brand-900">
                    {formatNaira(availableWalletCents)}
                  </strong>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContributeModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-black text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition-all active:scale-95"
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
