// frontend/src/pages/OrderTrackingPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ordersApi } from '../services/api';
import { formatNaira } from '../utils/format';
import { AffyLogo } from '../components/AffyLogo';

export const OrderTrackingPage: React.FC = () => {
  const { orderReference } = useParams<{ orderReference: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orderReference) {
      loadTrackingData(orderReference);
    }
  }, [orderReference]);

  const loadTrackingData = async (ref: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.trackOrder(ref);
      setOrder(data);
    } catch (err: any) {
      console.warn('[OrderTracking] Load note:', err);
      setError(
        err.response?.data?.message ||
        'Unable to find tracking details for this reference. Please check your reference code or contact support.'
      );
    } finally {
      setLoading(false);
    }
  };

  const copyReference = () => {
    if (orderReference) {
      navigator.clipboard?.writeText(orderReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/orders" className="hover:text-brand-700 font-semibold flex items-center space-x-1">
            <span>←</span>
            <span>Back to Orders</span>
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold truncate max-w-[160px] sm:max-w-none">
            {orderReference}
          </span>
        </div>

        <button
          onClick={() => orderReference && loadTrackingData(orderReference)}
          disabled={loading}
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-2xs"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span className="hidden sm:inline">Live Refresh</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && !order && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-sm animate-pulse">
          <div className="w-12 h-12 bg-slate-200 rounded-2xl mx-auto"></div>
          <div className="h-5 w-48 bg-slate-200 rounded mx-auto"></div>
          <div className="h-24 w-full bg-slate-100 rounded-2xl"></div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">
            ⚠️
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Order Reference Not Found</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/orders"
              className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-700 transition-colors"
            >
              View My Orders
            </Link>
            <Link
              to="/"
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      )}

      {/* Order Tracking Body */}
      {order && (
        <div className="space-y-4 sm:space-y-6">
          {/* Main Status Hero Card */}
          <div className="bg-gradient-to-br from-brand-950 via-affy-dark to-brand-900 text-white rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden border border-brand-800/40">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-brand-200 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-Time Dispatch Tracking</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {order.delivery?.status === 'DELIVERED'
                    ? 'Delivered to Doorstep 🎉'
                    : order.delivery?.status === 'DISPATCHED'
                    ? 'Dispatched & On the Way 🚚'
                    : order.delivery?.status === 'READY_FOR_DISPATCH'
                    ? 'Packed & Ready for Dispatch 📦'
                    : 'Order Processing at Farm Hub ⏳'}
                </h2>

                <div className="flex items-center space-x-2 text-xs text-brand-200/90">
                  <span>Tracking Ref:</span>
                  <span className="font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-md">
                    {order.orderReference}
                  </span>
                  <button
                    onClick={copyReference}
                    className="text-accent-400 hover:text-white font-bold transition-colors ml-1"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Amount badge */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-left sm:text-right shrink-0">
                <span className="text-[10px] text-brand-200 uppercase tracking-wider block font-semibold">
                  Amount Paid
                </span>
                <span className="text-xl sm:text-2xl font-black text-white">
                  {formatNaira(order.totalAmountCents)}
                </span>
                <span className="text-[10px] text-emerald-300 block font-semibold mt-0.5">
                  ✓ Verified Settlement
                </span>
              </div>
            </div>
          </div>

          {/* Visual Progress Timeline */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-xs space-y-6">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <span>📍</span>
              <span>Delivery Progress Timeline</span>
            </h3>

            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {(order.timeline || []).map((step: any, index: number) => {
                const isCompleted = step.completed;
                const isLatest = isCompleted && (index === order.timeline.length - 1 || !order.timeline[index + 1]?.completed);

                return (
                  <div key={index} className="relative group">
                    {/* Step Icon Marker */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-0 w-5 sm:w-7 h-5 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        isCompleted
                          ? 'bg-brand-600 border-brand-600 text-white shadow-xs'
                          : 'bg-white border-slate-300 text-slate-400'
                      } ${isLatest ? 'ring-4 ring-brand-100' : ''}`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>

                    {/* Step Content */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            isCompleted ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.timestamp && (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                            {new Date(step.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery Destination & Rider Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Address */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <span>🚚</span>
                <span>Delivery Destination</span>
              </span>
              <div className="font-bold text-sm text-slate-900">
                {order.customer?.name || 'Customer'}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {order.customer?.address || 'Ilesa Central, Osun State'}
              </p>
              {order.customer?.phone && (
                <p className="text-xs font-mono font-medium text-slate-500 pt-1 border-t border-slate-100">
                  Phone: {order.customer.phone}
                </p>
              )}
            </div>

            {/* Dispatch Notes / Rider */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <span>🛡️</span>
                <span>Affy Logistics Guarantee</span>
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct farm-gate distribution without transit holding delays. Verified scale weight guaranteed for every tuber, bag, and liter.
              </p>
              <div className="pt-2 border-t border-slate-100 text-xs text-brand-700 font-bold flex items-center justify-between">
                <span>Support hotline:</span>
                <span>080-AFFY-FOOD</span>
              </div>
            </div>
          </div>

          {/* Items Summary Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <span>🛒</span>
              <span>Purchased Foodstuffs</span>
            </h3>

            <div className="divide-y divide-slate-100">
              {(order.items || []).map((it: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                      🥗
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-xs text-slate-900 truncate">{it.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Qty: {it.quantity} {it.unit || ''}
                      </div>
                    </div>
                  </div>

                  <div className="font-black text-xs text-slate-900 shrink-0">
                    {formatNaira(it.priceCents * it.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600">Total Settlement:</span>
              <span className="font-black text-base text-brand-900">
                {formatNaira(order.totalAmountCents)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs shadow-2xs transition-all text-center"
            >
              Print / Save Tracking Receipt
            </button>
            <Link
              to="/"
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-md transition-all text-center active:scale-95"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

