// frontend/src/pages/MyOrdersPage.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ordersApi } from '../services/api';
import { formatNaira } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export const MyOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersApi.getMyOrders();
      setOrders(data);
    } catch (err: any) {
      console.warn('[MyOrders] Error fetching orders:', err);
      setError('Could not load your orders. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const getStatusBadge = (status: string, deliveryStatus?: string) => {
    const s = (deliveryStatus && deliveryStatus !== 'PENDING' ? deliveryStatus : status).toUpperCase();

    if (s === 'DELIVERED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
          <span>✓</span>
          <span>Delivered</span>
        </span>
      );
    }
    if (s === 'DISPATCHED' || s === 'IN_TRANSIT') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 animate-pulse">
          <span>🚚</span>
          <span>Out for Delivery</span>
        </span>
      );
    }
    if (s === 'READY_FOR_DISPATCH') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800">
          <span>📦</span>
          <span>Ready for Dispatch</span>
        </span>
      );
    }
    if (s === 'PROCESSING') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800">
          <span>⏳</span>
          <span>Processing &amp; Packing</span>
        </span>
      );
    }
    if (s === 'CANCELLED' || s === 'FAILED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800">
          <span>✕</span>
          <span>Cancelled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">
        <span>⏱️</span>
        <span>Order Confirmed</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Breadcrumb & Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link to="/wallet" className="hover:text-brand-700 font-medium">Wallet</Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">My Orders</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Order History &amp; Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track your farm-direct raw foodstuff deliveries and download official receipts.
          </p>
        </div>

        <button
          onClick={loadOrders}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadOrders}
            className="text-xs font-black text-rose-800 underline ml-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && orders.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs animate-pulse space-y-3">
              <div className="flex justify-between items-center">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
              </div>
              <div className="h-4 w-48 bg-slate-200 rounded"></div>
              <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 && !error && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-3xl mx-auto shadow-inner">
            🛒
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">No Orders Placed Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              You haven't placed any foodstuff orders yet. Browse our marketplace to purchase farm-gate rice, beans, oils, and foodstuffs.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md transition-all active:scale-95"
          >
            <span>Browse Marketplace</span>
            <span>➔</span>
          </Link>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {orders.map((order) => {
          const dateStr = new Date(order.createdAt).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs hover:shadow-md transition-shadow space-y-3.5"
            >
              {/* Header: Reference + Status badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ref:</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {order.orderReference}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.orderReference)}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold p-1"
                    title="Copy reference code"
                  >
                    {copiedRef === order.orderReference ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>

                <div>
                  {getStatusBadge(order.status, order.deliveryStatus)}
                </div>
              </div>

              {/* Order summary info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div>
                  <span className="block text-[11px] text-slate-400 font-medium">Placed On</span>
                  <span className="text-xs font-bold text-slate-800">{dateStr}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 font-medium">Total Paid</span>
                  <span className="text-xs font-black text-brand-900">
                    {formatNaira(order.totalAmountCents)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 font-medium">Items</span>
                  <span className="text-xs font-bold text-slate-800">
                    {order.items?.length || order.itemCount || 1} item(s)
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-400 font-medium">Delivery Destination</span>
                  <span className="text-xs font-medium text-slate-800 truncate block">
                    {order.address || 'Ilesa, Osun State'}
                  </span>
                </div>
              </div>

              {/* Items Preview */}
              {order.items && order.items.length > 0 && (
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Package Contents
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((it: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 bg-white border border-slate-200 px-2 py-1 rounded-lg text-xs font-medium text-slate-700"
                      >
                        <span className="font-bold">{it.quantity}x</span>
                        <span className="truncate max-w-[140px]">{it.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-medium">
                  {order.delivery?.actualDeliveryAt ? 'Delivered' : 'Estimated delivery: Within 24-48 Hours'}
                </span>

                <Link
                  to={`/orders/${order.orderReference}`}
                  className="inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs hover:shadow transition-all active:scale-95 touch-manipulation"
                >
                  <span>Track Order</span>
                  <span className="text-xs">➔</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

