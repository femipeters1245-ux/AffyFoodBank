// frontend/src/components/CartDrawer.tsx
import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
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

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isCartOpen) return null;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
        {/* Backdrop */}
        <div
          onClick={() => setIsCartOpen(false)}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-slideLeft">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
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
                  <h2 className="text-base font-extrabold text-slate-900">Your Food Basket</h2>
                  <p className="text-xs text-slate-500">
                    {totalItems} item{totalItems === 1 ? '' : 's'} selected
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                title="Close Basket"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
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
                    className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex items-center space-x-3.5 hover:border-brand-200 transition-all"
                  >
                    {/* Food Thumbnail */}
                    <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex-shrink-0 border border-slate-200">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // fallback on image broken
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400 uppercase">
                          Food
                        </div>
                      )}
                    </div>

                    {/* Details & Controls */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatNaira(product.priceCents)} / {product.unit?.name ?? 'unit'}
                      </p>

                      <div className="flex items-center justify-between mt-2.5">
                        {/* Stepper */}
                        <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-slate-900 px-2 min-w-[20px] text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 text-xs font-bold"
                          >
                            +
                          </button>
                        </div>

                        {/* Item Subtotal & Trash */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold text-slate-900">
                            {formatNaira(product.priceCents * quantity)}
                          </span>
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remove item"
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
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-800">
                      {formatNaira(totalAmountCents)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>TransactPay Handling:</span>
                    <span className="font-semibold text-emerald-600">Free Processing</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200/80">
                    <span>Estimated Total:</span>
                    <span className="text-brand-800 text-base">
                      {formatNaira(totalAmountCents)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleProceedToCheckout}
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to Checkout</span>
                    <span className="text-xs">➔</span>
                  </button>

                  <button
                    onClick={clearCart}
                    className="w-full text-center text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors py-1"
                  >
                    Clear Basket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} />
    </>
  );
};
