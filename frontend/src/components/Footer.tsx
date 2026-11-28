import React from 'react';
import { Link } from 'react-router-dom';
import { AffyLogo } from './AffyLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-affy-dark text-slate-300 text-sm mt-auto border-t border-purple-950/60 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="inline-block py-1">
              <AffyLogo variant="dark" size="lg" />
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering Nigerian households, restaurants, and caterers to hedge against food inflation through direct farm-gate sourcing and commercial food bundles.
            </p>
            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <span>🇳🇬 Lagos, Nigeria</span>
              <span>•</span>
              <span>RC: 8392019</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Marketplace</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/" className="hover:text-brand-400 transition-colors">Raw Foodstuff Catalogue</Link></li>
              <li><Link to="/packages" className="hover:text-brand-400 transition-colors">Commercial Food Bundles</Link></li>
              <li><Link to="/adp/apply" className="hover:text-brand-400 transition-colors">Affy Delivery Ports (ADP)</Link></li>
              <li><Link to="/orders" className="hover:text-brand-400 transition-colors">Order Tracking</Link></li>
            </ul>
          </div>

          {/* Food Staple Categories */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Popular Staples</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-slate-400">Rice (Short, Long, Basmati)</span></li>
              <li><span className="text-slate-400">Beans (Oloyin, White, Brown)</span></li>
              <li><span className="text-slate-400">Garri (Ijebu, Yellow, White)</span></li>
              <li><span className="text-slate-400">Pure Palm & Vegetable Oils</span></li>
              <li><span className="text-slate-400">Tubers (Abakaliki & Benue Yam)</span></li>
            </ul>
          </div>

          {/* Trust & Guarantee */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">The Affy Guarantee</h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start space-x-2">
                <span className="text-brand-400 font-bold">✓</span>
                <span>100% Certified Scale Weights (No "tampered derica" or hollow cups)</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-brand-400 font-bold">✓</span>
                <span>Farm-gate bulk rates direct to end users</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-brand-400 font-bold">✓</span>
                <span>Safe &amp; verified TransactPay payment gateway</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <p>© {new Date().getFullYear()} Affy FoodBank Technologies Ltd. All rights reserved.</p>
          <div className="flex space-x-6">
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Support: hello@affyfoodbank.ng</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
