// frontend/src/pages/AdpApplicationStatusPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adpApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AdpAppRecord {
  id: string;
  applicationReference: string;
  fullName: string;
  matricNumber: string;
  hostelName: string;
  hostelAddress: string;
  accountNumberMasked: string;
  bankName: string;
  status: string;
  studentVerificationStatus: string;
  hostelVerificationStatus: string;
  paymentVerificationStatus: string;
  nameEnquiryVerifiedName?: string;
  rejectionReason?: string;
  coverageZone?: {
    name: string;
  };
  createdAt: string;
}

export const AdpApplicationStatusPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [applications, setApplications] = useState<AdpAppRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApps() {
      if (!isAuthenticated) return;
      try {
        setLoading(true);
        const data = await adpApi.getMyApplications();
        setApplications(data || []);
      } catch (err) {
        console.error('Failed to load applications:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Please Sign In</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Sign in to check the status of your ADP delivery port application.
          </p>
          <Link
            to="/login"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
            ✓ Approved & Active
          </span>
        );
      case 'PENDING_REVIEW':
      case 'PENDING':
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
            ⏳ Pending Review
          </span>
        );
      case 'UNDER_VERIFICATION':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold uppercase tracking-wider">
            🔍 Under Verification
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold uppercase tracking-wider">
            ✕ Rejected
          </span>
        );
      case 'MANUAL_REVIEW':
        return (
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold uppercase tracking-wider">
            ⚙️ Manual Review
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Delivery Port Applications
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Track your UNILESA student delivery partner status and verification tracks.
          </p>
        </div>
        <div>
          <Link
            to="/adp/apply"
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm rounded-xl transition shadow-sm inline-flex items-center gap-1.5"
          >
            <span>+</span> Apply as New Port
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-white rounded-3xl p-6 border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            📍
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No Applications Found</h3>
          <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
            You haven&apos;t submitted an Affy Delivery Port application yet. Join the student delivery network to earn steady income per delivered food collection.
          </p>
          <Link
            to="/adp/apply"
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition shadow-sm inline-block"
          >
            Apply Now
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 transition hover:border-slate-300"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
                <div>
                  <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg">
                    {app.applicationReference}
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 mt-2">
                    {app.hostelName} ({app.coverageZone?.name || 'Coverage Zone'})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submitted on {new Date(app.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div>{renderStatusBadge(app.status)}</div>
              </div>

              {/* Three Verification Tracks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      🎓 Student Track
                    </span>
                    {app.studentVerificationStatus === 'APPROVED' ? (
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-amber-600 font-bold text-sm">⏳</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Matric: {app.matricNumber}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Status: {app.studentVerificationStatus}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      🏠 Hostel Track
                    </span>
                    {app.hostelVerificationStatus === 'APPROVED' ? (
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    ) : (
                      <span className="text-amber-600 font-bold text-sm">⏳</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 block truncate">
                    {app.hostelAddress}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Status: {app.hostelVerificationStatus}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      💳 Payment Track
                    </span>
                    {app.paymentVerificationStatus === 'APPROVED' ? (
                      <span className="text-emerald-600 font-bold text-sm">✓</span>
                    ) : app.paymentVerificationStatus === 'MANUAL_REVIEW' ? (
                      <span className="text-purple-600 font-bold text-sm">⚙️</span>
                    ) : (
                      <span className="text-amber-600 font-bold text-sm">⏳</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    {app.bankName} ({app.accountNumberMasked})
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    Status: {app.paymentVerificationStatus}
                  </span>
                </div>
              </div>

              {app.rejectionReason && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs mb-4">
                  <strong>Rejection Note:</strong> {app.rejectionReason}
                </div>
              )}

              <div className="text-xs text-slate-500 flex items-center justify-between pt-4 border-t border-slate-100">
                <span>All 3 tracks must be approved by logistics & finance before activation.</span>
                <span className="text-brand-600 font-medium">Review time: 24–48 hrs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
