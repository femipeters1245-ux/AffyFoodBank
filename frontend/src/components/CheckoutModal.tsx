// frontend/src/components/CheckoutModal.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { TransactPayModal } from './TransactPayModal';
import { paymentsApi, deliveryApi, ordersApi, zonesApi } from '../services/api';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { items, totalAmountCents, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Delivery form state
  const [fullName, setFullName] = useState(
    user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
  );
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('080');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Ilesa Central (Roundabout, Isokun, Imo)');
  const [isExpressDelivery, setIsExpressDelivery] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Delivery mode: Doorstep or Affy's Delivery Port (Hostel Port)
  const [deliveryMode, setDeliveryMode] = useState<'DOORSTEP' | 'ADP_HOSTEL'>('DOORSTEP');
  const [coverageZones, setCoverageZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [zoneOperators, setZoneOperators] = useState<any[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [loadingOperators, setLoadingOperators] = useState<boolean>(false);

  // TransactPay modal trigger & completed order state
  const [showTransactPay, setShowTransactPay] = useState(false);
  const [createdOrderRef, setCreatedOrderRef] = useState<string | undefined>(undefined);
  const [isInitiating, setIsInitiating] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    reference: string;
    paidAt: string;
    channel: string;
    totalCents: number;
    itemsCount: number;
    adpInfo?: {
      hostelName: string;
      zoneName: string;
      landmark?: string;
      address?: string;
    } | null;
  } | null>(null);

  // Dynamic delivery fee settings (set by staff & admin in portal)
  const [deliveryConfig, setDeliveryConfig] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('affy_delivery_fee_config');
      return saved
        ? JSON.parse(saved)
        : {
            standardFeeCents: 150000,
            freeDeliveryThresholdCents: 5000000,
            expressFeeCents: 250000,
            stateFees: {
              'Ilesa Central (Roundabout, Isokun, Imo)': 120000,
              'Ilesa West (Breweries, Omi Aladiye, Ereja)': 150000,
              'Ilesa East (Grammar School, Bolorunduro, Irojo)': 150000,
              'Ijebu-Jesa / Oriade': 200000,
              'Ipetu-Ijesha': 250000,
              'Ibokun / Obokun': 220000,
              'Osogbo (State Capital)': 300000,
              'Ile-Ife (Campus & Town)': 300000,
              'Other Osun State Locations': 350000,
              Default: 150000,
            },
          };
    } catch {
      return {
        standardFeeCents: 150000,
        freeDeliveryThresholdCents: 5000000,
        expressFeeCents: 250000,
        stateFees: {
          'Ilesa Central (Roundabout, Isokun, Imo)': 120000,
          'Ilesa West (Breweries, Omi Aladiye, Ereja)': 150000,
          'Ilesa East (Grammar School, Bolorunduro, Irojo)': 150000,
          'Ijebu-Jesa / Oriade': 200000,
          'Ipetu-Ijesha': 250000,
          'Ibokun / Obokun': 220000,
          'Osogbo (State Capital)': 300000,
          'Ile-Ife (Campus & Town)': 300000,
          'Other Osun State Locations': 350000,
          Default: 150000,
        },
      };
    }
  });

  React.useEffect(() => {
    const fetchConfig = () => {
      deliveryApi
        .getDeliveryFee()
        .then((cfg) => {
          if (cfg && typeof cfg.standardFeeCents === 'number') {
            setDeliveryConfig(cfg);
            localStorage.setItem('affy_delivery_fee_config', JSON.stringify(cfg));
          }
        })
        .catch(() => {});
    };

    fetchConfig();
    window.addEventListener('affy_delivery_fee_updated', fetchConfig);
    return () => window.removeEventListener('affy_delivery_fee_updated', fetchConfig);
  }, []);

  // Fetch coverage zones for ADP hostel pickup
  React.useEffect(() => {
    zonesApi
      .getActiveZones()
      .then((data) => {
        setCoverageZones(data || []);
        if (data && data.length > 0 && !selectedZoneId) {
          setSelectedZoneId(data[0].id);
        }
      })
      .catch((err) => {
        console.warn('[CheckoutModal] Failed to load coverage zones:', err.message);
      });
  }, []);

  // When selectedZoneId changes, fetch active approved operators for that zone
  React.useEffect(() => {
    if (!selectedZoneId) {
      setZoneOperators([]);
      setSelectedOperatorId('');
      return;
    }
    setLoadingOperators(true);
    zonesApi
      .getOperatorsByZone(selectedZoneId)
      .then((ops) => {
        setZoneOperators(ops || []);
        if (ops && ops.length > 0) {
          setSelectedOperatorId(ops[0].id);
        } else {
          setSelectedOperatorId('');
        }
      })
      .catch((err) => {
        console.warn('[CheckoutModal] Failed to load zone operators:', err.message);
        setZoneOperators([]);
        setSelectedOperatorId('');
      })
      .finally(() => {
        setLoadingOperators(false);
      });
  }, [selectedZoneId]);

  if (!isOpen) return null;

  // Delivery cost calculation (Affy food collective standard delivery set by Admin/Staff)
  const calculateDeliveryFee = () => {
    const threshold = Number(deliveryConfig?.freeDeliveryThresholdCents ?? 5000000);
    let baseFee = 0;
    let isFreeDelivery = false;

    if (threshold > 0 && totalAmountCents >= threshold) {
      baseFee = 0;
      isFreeDelivery = true;
    } else {
      const stateFee = deliveryConfig?.stateFees?.[state];
      if (typeof stateFee === 'number' && stateFee >= 0) {
        baseFee = stateFee;
      } else {
        baseFee = Number(deliveryConfig?.stateFees?.Default ?? deliveryConfig?.standardFeeCents ?? 150000);
      }
    }

    const expressFee = isExpressDelivery ? Number(deliveryConfig?.expressFeeCents ?? 250000) : 0;
    const totalDelivery = baseFee + expressFee;
    return {
      totalDeliveryFeeCents: totalDelivery,
      baseDeliveryFeeCents: baseFee,
      expressFeeCents: expressFee,
      isFree: isFreeDelivery,
    };
  };

  const { totalDeliveryFeeCents, baseDeliveryFeeCents, expressFeeCents, isFree } = calculateDeliveryFee();
  const grandTotalCents = totalAmountCents + totalDeliveryFeeCents;

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) {
      alert('Please fill in your name and phone number.');
      return;
    }

    if (deliveryMode === 'DOORSTEP' && !address) {
      alert('Please enter your doorstep delivery street address.');
      return;
    }

    if (deliveryMode === 'ADP_HOSTEL' && !selectedOperatorId) {
      alert('Please select an active Affy Delivery Port (Hostel Port) for your package pickup.');
      return;
    }

    const selectedZone = coverageZones.find((z) => z.id === selectedZoneId);
    const selectedOperator = zoneOperators.find((o) => o.id === selectedOperatorId);
    const effectiveAddress =
      deliveryMode === 'ADP_HOSTEL' && selectedOperator
        ? `Affy Delivery Port: ${selectedOperator.hostelName}${selectedOperator.hostelAddress ? ` (${selectedOperator.hostelAddress})` : ''}, Landmark: ${selectedOperator.closestLandmark || 'Campus Environs'}`
        : `${address}, ${state}`;
    const effectiveLocation =
      deliveryMode === 'ADP_HOSTEL' && selectedZone ? selectedZone.name : state;
    const adpPayloadId = deliveryMode === 'ADP_HOSTEL' ? selectedOperatorId : undefined;
    const adpSummaryInfo =
      deliveryMode === 'ADP_HOSTEL' && selectedOperator
        ? {
            hostelName: selectedOperator.hostelName,
            zoneName: selectedZone?.name || 'UNILESA Zone',
            landmark: selectedOperator.closestLandmark,
            address: selectedOperator.hostelAddress,
          }
        : null;

    setIsInitiating(true);
    try {
      // Create TransactPay order on backend
      const orderRes = await paymentsApi.createTransactPayOrder({
        amountNaira: grandTotalCents / 100,
        email: email || user?.email || 'customer@affyfoodbank.ng',
        name: fullName,
        phone,
        address: effectiveAddress,
        location: effectiveLocation,
          isExpress: isExpressDelivery,
          adpOperatorId: adpPayloadId,
          items: items.map((i: any) => ({
            productId: i.product?.id || i.id,
            name: i.product?.name || i.name,
            quantity: i.quantity,
            priceCents: i.product?.priceCents || i.priceCents,
          })),
        });

        const activeOrderRef = orderRes?.orderReference || `TP_ORD_${Date.now()}`;
        setCreatedOrderRef(activeOrderRef);

        // Mark whether this order was created live on the TransactPay gateway
        // (isSandbox: true means create-order fell back to local simulation — TransactPay doesn't know the ref)
        (window as any).__transactpayLiveOrder = !orderRes?.isSandbox;

        // Check if TransactPay Standard Kit Checkout SDK is loaded (from transactpay.readme.io)
        if (typeof (window as any).CheckoutNS?.PaymentCheckout === 'function') {
          const config = await paymentsApi.getConfig();
          const names = (fullName || 'Customer').trim().split(' ');
          const Checkout = new (window as any).CheckoutNS.PaymentCheckout({
            orderId: activeOrderRef,
            orderReference: activeOrderRef,
            reference: activeOrderRef,
            merchantReference: activeOrderRef,
            firstName: names[0] || 'Customer',
            lastName: names.slice(1).join(' ') || 'User',
            mobile: phone,
            country: 'NG',
            email: email || user?.email || 'customer@affyfoodbank.ng',
            currency: 'NGN',
            amount: grandTotalCents / 100,
            description: 'Affy FoodBank Raw Foodstuff Order',
            apiKey: config.publicKey,
            encryptionKey: config.encryptionKey,
            onCompleted: async (data: any) => {
              console.log('[TransactPay Standard Kit] Payment completed:', data);
              try {
                await paymentsApi.verifyTransactPay(data?.reference || activeOrderRef);
              } catch (vErr) {
                console.warn('[TransactPay] Verification notice:', vErr);
              }
              handleTransactPaySuccess({
                reference: data?.reference || activeOrderRef,
                channel: data?.paymentMethod || 'TRANSACTPAY',
                amountCents: grandTotalCents,
                paidAt: new Date().toISOString(),
                adpInfo: adpSummaryInfo,
              });
            },
            onClose: () => {
              console.warn('[TransactPay Standard Kit] Checkout modal closed by user');
            },
            onError: (err: any) => {
              console.warn('[TransactPay Standard Kit] SDK error, fallback to embedded modal:', err);
              setShowTransactPay(true);
            },
          });
          Checkout.init();
        } else {
          // Fallback to embedded TransactPay modal
          setShowTransactPay(true);
        }
      } catch (err: any) {
        console.warn('[TransactPay] Gateway initialization notice:', err.message);
        (window as any).__transactpayLiveOrder = false;
        setShowTransactPay(true);
      } finally {
        setIsInitiating(false);
      }
  };

  const handleTransactPaySuccess = (paymentData: {
    reference: string;
    channel: string;
    amountCents: number;
    paidAt: string;
    adpInfo?: any;
  }) => {
    setShowTransactPay(false);
    const selectedZone = coverageZones.find((z) => z.id === selectedZoneId);
    const selectedOperator = zoneOperators.find((o) => o.id === selectedOperatorId);
    const adpSummaryInfo =
      deliveryMode === 'ADP_HOSTEL' && selectedOperator
        ? {
            hostelName: selectedOperator.hostelName,
            zoneName: selectedZone?.name || 'UNILESA Zone',
            landmark: selectedOperator.closestLandmark,
            address: selectedOperator.hostelAddress,
          }
        : null;

    setCompletedOrder({
      reference: paymentData.reference,
      paidAt: paymentData.paidAt,
      channel: paymentData.channel,
      totalCents: grandTotalCents,
      itemsCount: items.reduce((s, i) => s + i.quantity, 0),
      adpInfo: paymentData.adpInfo ?? adpSummaryInfo,
    });
    clearCart();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[94vh]">
          {/* Header */}
          <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {completedOrder ? 'Order Confirmed! 🎉' : 'Checkout & Delivery'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {completedOrder
                  ? 'Your raw foodstuff will be dispatched directly from wholesale farms.'
                  : 'Fast dispatch across Ilesa & surrounding Osun State communities via Affy Logistics.'}
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
                    TransactPay Gateway
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

                {completedOrder.adpInfo ? (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60 bg-emerald-50/60 -mx-5 px-5 py-2.5 rounded-lg">
                    <span className="text-emerald-800 font-bold flex items-center space-x-1">
                      <span>📍</span>
                      <span>Affy Delivery Port:</span>
                    </span>
                    <span className="font-semibold text-emerald-900 text-right max-w-xs">
                      {completedOrder.adpInfo.hostelName} ({completedOrder.adpInfo.zoneName})
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/60">
                    <span className="text-slate-500">Delivery Address:</span>
                    <span className="font-medium text-slate-800 text-right max-w-xs truncate">
                      {address}, {state}
                    </span>
                  </div>
                )}

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
                  onClick={() => {
                    const ref = completedOrder.reference;
                    onClose();
                    navigate(`/orders/${ref}`);
                  }}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 touch-manipulation"
                >
                  <span>Track Order Status</span>
                  <span>➔</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-xs transition-all"
                >
                  Print / Save Receipt
                </button>
                <button
                  onClick={onClose}
                  className="sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* CHECKOUT FORM VIEW */
            <form onSubmit={handleStartPayment} className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
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
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Delivery Destination
                  </h4>
                  <span className="text-[11px] text-brand-700 font-semibold">
                    Campus & Ilesa Network
                  </span>
                </div>

                {/* Delivery Mode Toggle */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('DOORSTEP')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                      deliveryMode === 'DOORSTEP'
                        ? 'bg-white text-brand-900 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🚚</span>
                    <span>Doorstep Delivery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('ADP_HOSTEL')}
                    className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                      deliveryMode === 'ADP_HOSTEL'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>📍</span>
                    <span>Affy Delivery Port (Hostel)</span>
                  </button>
                </div>

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
                      Phone Number (for notifications) *
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

                {deliveryMode === 'DOORSTEP' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Street Address / Estate *
                      </label>
                      <input
                        type="text"
                        required={deliveryMode === 'DOORSTEP'}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. No 12, Ereja Square / Imo Road, Ilesa, Osun State"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Delivery Location (Ilesa & Osun State) *
                      </label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {Object.keys(deliveryConfig?.stateFees || {}).filter((k: string) => k !== 'Default').map((zone: string) => (
                          <option key={zone} value={zone}>
                            {zone} {typeof deliveryConfig.stateFees[zone] === 'number' ? `— ₦${(deliveryConfig.stateFees[zone] / 100).toLocaleString()}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  /* ADP HOSTEL PICKUP SELECTION */
                  <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-emerald-950 mb-1">
                          1. Select Coverage Zone (UNILESA) *
                        </label>
                        <select
                          value={selectedZoneId}
                          onChange={(e) => setSelectedZoneId(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Choose Coverage Zone --</option>
                          {coverageZones.map((z: any) => (
                            <option key={z.id} value={z.id}>
                              {z.name} ({z.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-emerald-950 mb-1">
                          2. Choose Pickup Hostel Port *
                        </label>
                        {loadingOperators ? (
                          <div className="p-2.5 bg-white border border-emerald-200 rounded-xl text-xs text-slate-500 animate-pulse">
                            Loading ports...
                          </div>
                        ) : zoneOperators.length === 0 ? (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                            No approved ADP ports in this zone yet. Choose another zone or Doorstep Delivery.
                          </div>
                        ) : (
                          <select
                            value={selectedOperatorId}
                            onChange={(e) => setSelectedOperatorId(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Choose Hostel Port --</option>
                            {zoneOperators.map((op: any) => (
                              <option key={op.id} value={op.id}>
                                🏢 {op.hostelName} {op.closestLandmark ? `(${op.closestLandmark})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {selectedOperatorId && (
                      (() => {
                        const op = zoneOperators.find((o: any) => o.id === selectedOperatorId);
                        if (!op) return null;
                        return (
                          <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-emerald-900 flex items-center space-x-1">
                                <span>📍 Assigned Port:</span>
                                <span>{op.hostelName}</span>
                              </span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                                Verified Port
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px]">
                              <span>Address: {op.hostelAddress || 'Hostel Compound'}</span>
                              {op.closestLandmark && (
                                <span className="block text-slate-500">Landmark: {op.closestLandmark}</span>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

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

                {/* Priority / Express Delivery Option */}
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="checkbox"
                      id="is-express-delivery"
                      checked={isExpressDelivery}
                      onChange={(e) => setIsExpressDelivery(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="is-express-delivery" className="text-xs font-bold text-amber-950 cursor-pointer">
                      ⚡ Same-Day Priority Dispatch (+₦{((deliveryConfig?.expressFeeCents ?? 250000) / 100).toLocaleString()})
                    </label>
                  </div>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">3–6 Hrs</span>
                </div>
              </div>

              {/* Payment Method Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Payment Method
                </h4>

                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 shadow-2xs space-y-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      💳
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 block">
                        TransactPay Secure Gateway
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Pay with Debit Card (Mastercard, Visa, Verve), Bank Transfer, or USSD
                      </span>
                    </div>
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
                  <span>Doorstep Delivery ({state}):</span>
                  <span className="font-semibold text-slate-800">
                    {isFree ? (
                      <span className="text-emerald-600 font-bold">
                        FREE (Order ≥ ₦{((deliveryConfig?.freeDeliveryThresholdCents ?? 5000000) / 100).toLocaleString()})
                      </span>
                    ) : (
                      formatNaira(baseDeliveryFeeCents)
                    )}
                  </span>
                </div>
                {isExpressDelivery && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>⚡ Priority Dispatch Surcharge:</span>
                    <span>+{formatNaira(expressFeeCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>Total Amount Due:</span>
                  <span className="text-brand-800 text-base">{formatNaira(grandTotalCents)}</span>
                </div>
              </div>

              {/* Checkout Submit Button */}
              <button
                type="submit"
                disabled={isInitiating}
                className="w-full py-4 rounded-2xl font-black text-sm text-white shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-75 bg-blue-700 hover:bg-blue-800 shadow-blue-600/30 active:scale-[0.98]"
              >
                {isInitiating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Initializing TransactPay...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {formatNaira(grandTotalCents)} with TransactPay</span>
                    <span>➔</span>
                  </>
                )}
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
        orderReference={createdOrderRef}
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
