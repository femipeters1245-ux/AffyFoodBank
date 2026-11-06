// frontend/src/components/CartDrawer.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { CheckoutModal } from './CheckoutModal';

export const CartDrawer: React.FC = () => {
  const {
    items,
    totalItems,
    totalAmountCents,
    updateQuantity,
    removeFromCart,
    clearCart,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Resume checkout if user returned from auth with ?checkout=true or checkout intent
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'true' && isAuthenticated && items.length > 0) {
      setIsCheckoutOpen(true);
    }
  }, [location.search, isAuthenticated, items.length]);

  const handleProceedToCheckout = () => {
    if (!isAuthenticated) {
      // Save intent to resume checkout and preserve basket throughout login
      localStorage.setItem('affy_checkout_intent', 'true');
      setIsCartOpen(false);
      navigate('/login?redirect=checkout', { state: { from: { pathname: '/?checkout=true' } } });
      return;
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  if (!isCartOpen && !isCheckoutOpen) return null;

  return (
    <>
      {isCartOpen && (
      <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
        {/* Backdrop */}
        <div
          onClick={() => setIsCartOpen(false)}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 w-full sm:max-w-md">
          <div className="w-full bg-white shadow-2xl flex flex-col justify-between animate-slideLeft">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900">Your Food Basket</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    {totalItems} item{totalItems === 1 ? '' : 's'} selected
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition-colors"
                title="Close Basket"
                aria-label="Close basket"
              >
                ✕
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="text-4xl text-slate-300">🛒</div>
                  <h3 className="font-bold text-slate-800 text-base">Your basket is empty</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Browse our wholesale raw foodstuffs and add fresh rice, beans, garri, and oils to
                    your order.
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                items.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex items-center space-x-3 hover:border-brand-200 transition-all"
                  >
                    {/* Food Thumbnail */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-200/80">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                          Food
                        </div>
                      )}
                    </div>

                    {/* Details & Controls */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                        {formatNaira(product.priceCents)} / {product.unit?.name ?? 'unit'}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        {/* Stepper */}
                        <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-slate-900 px-1.5 min-w-[18px] text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Item Subtotal & Trash */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-slate-900">
                            {formatNaira(product.priceCents * quantity)}
                          </span>
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary & Checkout Button */}
            {items.length > 0 && (
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 space-y-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Basket Subtotal:</span>
                    <span className="font-bold text-slate-800">
                      {formatNaira(totalAmountCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>TransactPay Handling:</span>
                    <span className="font-bold text-emerald-600">Free Processing</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm font-black text-slate-900 pt-2 border-t border-slate-200/80">
                    <span>Estimated Payable:</span>
                    <span className="text-brand-900 text-sm sm:text-base font-black">
                      {formatNaira(totalAmountCents)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleProceedToCheckout}
                    className="w-full py-3 sm:py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-2 active:scale-95"
                  >
                    <span>Proceed to Checkout</span>
                    <span className="text-xs">➔</span>
                  </button>

                  <button
                    onClick={clearCart}
                    className="w-full text-center text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors py-1"
                  >
                    Clear Food Basket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
    </>
  );
};
