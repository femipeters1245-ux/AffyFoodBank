// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PersistentBasketBar } from './components/PersistentBasketBar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { MarketplacePage } from './pages/MarketplacePage';
import { PackagesPage } from './pages/PackagesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { AdpApplicationPage } from './pages/AdpApplicationPage';
import { AdpApplicationStatusPage } from './pages/AdpApplicationStatusPage';
import { AdpDashboardPage } from './pages/AdpDashboardPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-brand-500 selection:text-white relative">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-28 sm:pb-32 md:pb-16">
              <Routes>
                <Route path="/" element={<MarketplacePage />} />
                <Route path="/packages" element={<PackagesPage />} />
                {/* Retired Wallet & Food Savings — cleanly redirected to Commercial Bundles */}
                <Route path="/savings" element={<Navigate to="/packages" replace />} />
                <Route path="/wallet" element={<Navigate to="/packages" replace />} />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <MyOrdersPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/orders/:orderReference" element={<OrderTrackingPage />} />
                <Route
                  path="/adp/apply"
                  element={
                    <ProtectedRoute>
                      <AdpApplicationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/adp/status"
                  element={
                    <ProtectedRoute>
                      <AdpApplicationStatusPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/adp/dashboard"
                  element={
                    <ProtectedRoute>
                      <AdpDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <CartDrawer />
            <PersistentBasketBar />
            <MobileBottomNav />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
