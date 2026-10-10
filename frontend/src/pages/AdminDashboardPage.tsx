// frontend/src/pages/AdminDashboardPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';
import { AffyLogo } from '../components/AffyLogo';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  priceCents: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

interface SavingsMonitorItem {
  id: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  savedCents: number;
  targetCents: number;
  targetDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'FULFILLED';
}

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Premium Royal Stallion Rice (50kg)', category: 'Grains & Flours', stock: 140, unit: '50kg Bag', priceCents: 7500000, status: 'In Stock' },
  { id: '2', name: 'Sweet Honey Oloyin Beans (50kg)', category: 'Grains & Flours', stock: 85, unit: '50kg Bag', priceCents: 9800000, status: 'In Stock' },
  { id: '3', name: 'Original Ijebu Garri (4kg)', category: 'Grains & Flours', stock: 320, unit: 'Paint Rubber', priceCents: 450000, status: 'In Stock' },
  { id: '4', name: 'Pure Unadulterated Palm Oil (25L)', category: 'Oils & Fats', stock: 18, unit: '25L Keg', priceCents: 3800000, status: 'Low Stock' },
  { id: '5', name: 'Benue Giant White Yam (5 Tubers)', category: 'Tubers & Roots', stock: 65, unit: 'Set of 5', priceCents: 1650000, status: 'In Stock' },
  { id: '6', name: 'Golden Penny Vegetable Oil (25L)', category: 'Oils & Fats', stock: 24, unit: '25L Keg', priceCents: 4200000, status: 'In Stock' },
];

const INITIAL_SAVINGS_MONITOR: SavingsMonitorItem[] = [
  { id: 'sav-101', customerName: 'Adebayo Ogunlesi', customerEmail: 'customer@affyfoodbank.ng', planName: 'December Festive Rice & Oil Feast', savedCents: 12000000, targetCents: 15000000, targetDate: '2026-12-15', status: 'ACTIVE' },
  { id: 'sav-102', customerName: 'Chioma Okeke', customerEmail: 'chioma.caterers@gmail.com', planName: 'Catering Staples Bulk Buffer', savedCents: 28000000, targetCents: 28000000, targetDate: '2026-11-01', status: 'COMPLETED' },
  { id: 'sav-103', customerName: 'Ibrahim Danjuma', customerEmail: 'ibrahim.d@yahoo.com', planName: 'Beans & Garri Household Hedge', savedCents: 4500000, targetCents: 6000000, targetDate: '2026-11-20', status: 'ACTIVE' },
  { id: 'sav-104', customerName: 'Blessing Adeyemi', customerEmail: 'blessing.restaurant@gmail.com', planName: 'Monthly Restaurant Restock', savedCents: 42000000, targetCents: 42000000, targetDate: '2026-10-25', status: 'FULFILLED' },
];

export const AdminDashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'savings' | 'users'>('overview');
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [savingsItems, setSavingsItems] = useState<SavingsMonitorItem[]>(INITIAL_SAVINGS_MONITOR);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRestock = (id: string) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, stock: item.stock + 50, status: 'In Stock' } : item,
      ),
    );
    showToast('Inventory restocked successfully (+50 units)');
  };

  const handleFulfillOrder = (id: string) => {
    setSavingsItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'FULFILLED' } : item)),
    );
    showToast('Food supplies marked as Dispatched & Delivered to customer');
  };

  const roleTitle = user?.role === 'Admin' || user?.role === 'SuperAdmin' ? 'System Administrator' : 'Staff Operations';

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Alert */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-affy-dark text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-purple-800 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-affy-dark via-brand-900 to-brand-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-purple-900/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <AffyLogo variant="dark" size="md" className="hidden sm:inline-block" />
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-bold text-accent-400 uppercase tracking-wider">
                {roleTitle}
              </span>
              <span className="text-xs text-brand-200">
                Logged in as: <strong className="text-white">{user?.email}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">Affy FoodBank Operations Portal</h1>
            <p className="text-xs text-brand-200/90 mt-0.5">
              Wholesale farm-gate stock management, customer savings fulfillment, and platform governance.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/wallet"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white transition-colors"
          >
            Customer View
          </Link>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        {[
          { key: 'overview', label: '📊 System Overview' },
          { key: 'inventory', label: '🏪 Raw Foodstuff Inventory' },
          { key: 'savings', label: '🌾 Food Savings Monitor' },
          { key: 'users', label: '👥 User & Role Access' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-brand-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Volume</span>
              <div className="text-3xl font-black text-slate-900">₦48,500,000</div>
              <div className="text-xs text-emerald-600 font-semibold">+18.4% this month</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Locked in Food Savings</span>
              <div className="text-3xl font-black text-brand-900">₦24,800,000</div>
              <div className="text-xs text-brand-600 font-semibold">142 Active Saver Households</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Warehouse Tonnage</span>
              <div className="text-3xl font-black text-slate-900">18.5 Tons</div>
              <div className="text-xs text-slate-500 font-medium">Rice, Beans, Yam, Garri, Palm Oil</div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Dispatches</span>
              <div className="text-3xl font-black text-accent-600">8 Deliveries</div>
              <div className="text-xs text-accent-700 font-semibold">Fulfillment Ready</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Quick Operational Tasks</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab('inventory')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-brand-50 border border-slate-200 text-left transition-colors group"
              >
                <div className="font-bold text-sm text-slate-800 group-hover:text-brand-900">Update Grain Prices</div>
                <div className="text-xs text-slate-500 mt-1">Adjust benchmark prices for Rice, Beans & Garri</div>
              </button>
              <button
                onClick={() => setActiveTab('savings')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-brand-50 border border-slate-200 text-left transition-colors group"
              >
                <div className="font-bold text-sm text-slate-800 group-hover:text-brand-900">Review Matured Savings</div>
                <div className="text-xs text-slate-500 mt-1">Approve door-step deliveries for 100% saved customers</div>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-brand-50 border border-slate-200 text-left transition-colors group"
              >
                <div className="font-bold text-sm text-slate-800 group-hover:text-brand-900">Staff Permissions</div>
                <div className="text-xs text-slate-500 mt-1">Manage warehouse, finance, and logistics personnel</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Warehouse Foodstuff Stock</h2>
              <p className="text-xs text-slate-500">Live inventory and farm-gate pricing in Lagos hubs</p>
            </div>
            <button
              onClick={() => showToast('Stock refresh completed from warehouse sensors')}
              className="px-4 py-2 bg-brand-900 hover:bg-brand-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              Sync Warehouse Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Current Stock</th>
                  <th className="px-6 py-4">Benchmark Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.category}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.stock} {item.unit}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-brand-900">{formatNaira(item.priceCents)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRestock(item.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-800 text-slate-700 font-bold rounded-lg transition-colors"
                      >
                        + Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SAVINGS MONITOR */}
      {activeTab === 'savings' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Customer Food Savings Plans</h2>
              <p className="text-xs text-slate-500">Track target contributions and fulfill bulk food supply orders</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Savings Goal</th>
                  <th className="px-6 py-4">Saved vs Target</th>
                  <th className="px-6 py-4">Target Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {savingsItems.map((item) => {
                  const percent = Math.min(100, Math.round((item.savedCents / item.targetCents) * 100));
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{item.customerName}</div>
                        <div className="text-[11px] text-slate-400">{item.customerEmail}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{item.planName}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {formatNaira(item.savedCents)} / {formatNaira(item.targetCents)}
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-affy-purple rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.targetDate}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'FULFILLED'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.status === 'COMPLETED' ? (
                          <button
                            onClick={() => handleFulfillOrder(item.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                          >
                            Dispatch Order
                          </button>
                        ) : item.status === 'FULFILLED' ? (
                          <span className="text-xs text-slate-400 font-semibold">Delivered ✅</span>
                        ) : (
                          <span className="text-xs text-slate-400">In Progress ({percent}%)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: USERS & ROLE ACCESS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">System Accounts & Access Matrix</h2>
            <p className="text-xs text-slate-500">Default roles seeded for the Affy FoodBank platform</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full uppercase">
                  Administrator
                </span>
                <span className="text-lg">🔐</span>
              </div>
              <div>
                <div className="font-extrabold text-sm text-slate-900">admin@affyfoodbank.ng</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Password: AdminPassword123!</div>
              </div>
              <p className="text-xs text-slate-600">
                Full wildcard system permissions (*:*). Can manage inventory, fulfill savings plans, and manage users.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full uppercase">
                  Finance Staff
                </span>
                <span className="text-lg">💼</span>
              </div>
              <div>
                <div className="font-extrabold text-sm text-slate-900">staff@affyfoodbank.ng</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Password: StaffPassword123!</div>
              </div>
              <p className="text-xs text-slate-600">
                Manages customer wallets, monitors deposits, reconciles payment gateway webhooks, and updates orders.
              </p>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
                  Customer
                </span>
                <span className="text-lg">🛒</span>
              </div>
              <div>
                <div className="font-extrabold text-sm text-slate-900">customer@affyfoodbank.ng</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Password: Password123!</div>
              </div>
              <p className="text-xs text-slate-600">
                End-user account with active digital food wallet (pre-funded with ₦150k), active savings goals, and marketplace orders.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
