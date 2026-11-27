// frontend/src/pages/AdpApplicationPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { zonesApi, adpApi, AdpApplicationPayload } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ZoneItem {
  id: string;
  name: string;
}

interface BankItem {
  code: string;
  name: string;
}

export const AdpApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Zones & Banks data
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [banks, setBanks] = useState<BankItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [coverageZoneId, setCoverageZoneId] = useState('');
  const [fullName, setFullName] = useState(
    user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : ''
  );
  const [matricNumber, setMatricNumber] = useState('');
  const [institution, setInstitution] = useState('University of Ilesa (UNILESA)');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [academicLevel, setAcademicLevel] = useState('200L');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');

  // Hostel / Location
  const [hostelName, setHostelName] = useState('');
  const [hostelAddress, setHostelAddress] = useState('');
  const [closestLandmark, setClosestLandmark] = useState('');

  // Bank Info
  const [bankCode, setBankCode] = useState('058'); // Default GTBank
  const [bankName, setBankName] = useState('Guaranty Trust Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [alternativeContact, setAlternativeContact] = useState('');
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyingBank, setVerifyingBank] = useState(false);
  const [bankVerifyError, setBankVerifyError] = useState<string | null>(null);

  // Document Upload
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Consent & Submission
  const [ndpaConsent, setNdpaConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<any | null>(null);

  // Load Zones & Banks
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        const [zonesRes, banksRes] = await Promise.all([
          zonesApi.getActiveZones(),
          adpApi.getBanks(),
        ]);
        setZones(zonesRes || []);
        if (zonesRes && zonesRes.length > 0) {
          setCoverageZoneId(zonesRes[0].id);
        }
        setBanks(banksRes || []);
        if (banksRes && banksRes.length > 0) {
          const defaultBank = banksRes.find((b: any) => b.code === '058') || banksRes[0];
          setBankCode(defaultBank.code);
          setBankName(defaultBank.name);
        }
      } catch (err: any) {
        console.error('Failed to load zones or banks:', err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Update bank name when code changes
  const handleBankChange = (code: string) => {
    setBankCode(code);
    const found = banks.find((b) => b.code === code);
    if (found) setBankName(found.name);
    setVerifiedName(null);
    setBankVerifyError(null);
  };

  // Verify Bank Account
  const handleVerifyBank = async () => {
    if (!accountNumber || accountNumber.trim().length !== 10) {
      setBankVerifyError('Please enter a valid 10-digit NUBAN account number');
      return;
    }
    try {
      setVerifyingBank(true);
      setBankVerifyError(null);
      const res = await adpApi.verifyBank(accountNumber.trim(), bankCode);
      if (res?.accountName) {
        setVerifiedName(res.accountName);
        if (!accountName) setAccountName(res.accountName);
      } else {
        setBankVerifyError('Could not verify account name. Please double-check details.');
      }
    } catch (err: any) {
      setBankVerifyError(err.response?.data?.message || err.message || 'Name enquiry failed');
      setVerifiedName(null);
    } finally {
      setVerifyingBank(false);
    }
  };

  // Handle Document Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB limit. Please upload a smaller document.');
      return;
    }

    setDocFile(file);
    setUploadError(null);

    try {
      setUploadingDoc(true);
      const uploadInit = await adpApi.getUploadUrl(file.name);
      if (!uploadInit?.signedUrl || !uploadInit?.path) {
        throw new Error('Could not obtain secure upload authorization');
      }

      await adpApi.uploadDocumentDirectly(uploadInit.signedUrl, file);
      setDocPath(uploadInit.path);
    } catch (err: any) {
      console.error('Document upload error:', err);
      setUploadError(err.message || 'Failed to upload document. Please retry.');
      setDocPath(null);
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit Application
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!coverageZoneId) {
      setFormError('Please select a coverage zone.');
      return;
    }
    if (!fullName.trim() || !matricNumber.trim() || !faculty.trim() || !department.trim()) {
      setFormError('Please complete all student identity fields.');
      return;
    }
    if (!docPath) {
      setFormError('Please upload a clear copy of your Student ID card.');
      return;
    }
    if (!hostelName.trim() || !hostelAddress.trim()) {
      setFormError('Please provide your hostel name and full address.');
      return;
    }
    if (!accountNumber.trim() || accountNumber.trim().length !== 10) {
      setFormError('A valid 10-digit bank account number is required.');
      return;
    }
    if (!ndpaConsent) {
      setFormError('You must acknowledge the data protection and privacy consent to proceed.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: AdpApplicationPayload = {
        coverageZoneId,
        fullName: fullName.trim(),
        matricNumber: matricNumber.trim(),
        institution: institution.trim(),
        faculty: faculty.trim(),
        department: department.trim(),
        academicLevel,
        phone: phone.trim(),
        email: email.trim(),
        studentIdDocPath: docPath,
        hostelName: hostelName.trim(),
        hostelAddress: hostelAddress.trim(),
        closestLandmark: closestLandmark.trim() || undefined,
        bankName,
        bankCode,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim() || verifiedName || fullName.trim(),
        alternativeContact: alternativeContact.trim() || undefined,
      };

      const res = await adpApi.submitApplication(payload);
      setSubmissionSuccess(res?.data || res);
    } catch (err: any) {
      setFormError(
        err.response?.data?.message || err.message || 'Application submission failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            🎓
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Sign in to Apply as an ADP Partner</h2>
          <p className="text-slate-600 mb-6">
            Affy&apos;s Delivery Port (ADP) operators are verified student-partners at UNILESA. Please sign in or register an account before applying.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/login"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition shadow-sm"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (submissionSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-8 sm:p-10 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
            ✓
          </div>
          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
            Application Submitted
          </span>
          <h1 className="text-3xl font-black text-slate-900 mb-3">Welcome to the ADP Network!</h1>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Your delivery port application has been received and registered under application reference:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 inline-block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Application Reference
            </span>
            <span className="text-2xl font-mono font-bold text-brand-700">
              {submissionSuccess.applicationReference}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left max-w-lg mx-auto">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Student Track</span>
              <span className="text-sm font-semibold text-amber-600">Under Review</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Hostel Track</span>
              <span className="text-sm font-semibold text-amber-600">Pending Inspection</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 block">Payment Track</span>
              <span className="text-sm font-semibold text-emerald-600">
                {submissionSuccess.paymentVerificationStatus === 'MANUAL_REVIEW' ? 'Manual Review' : 'Verified'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to="/adp/status"
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl shadow-sm transition"
            >
              Track Application Status
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
            >
              Return to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          <span>📍</span> UNILESA Student Delivery Network
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Apply as an Affy Delivery Port (ADP)
        </h1>
        <p className="text-slate-600 mt-2 text-base max-w-2xl">
          Turn your hostel into an official food distribution hub. Receive packaged food deliveries for students in your zone, facilitate order collections, and earn verified per-collection payouts directly into your bank account.
        </p>
      </div>

      {formError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 font-medium">{formError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Coverage Zone Selection */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-xl font-bold text-slate-800">Coverage Zone</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Select the official UNILESA zone where your hostel or accommodation is located.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Assigned UNILESA Zone *
            </label>
            {loadingInitial ? (
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={coverageZoneId}
                onChange={(e) => setCoverageZoneId(e.target.value)}
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Section 2: Student Identity */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-xl font-bold text-slate-800">Student Identity & Academic Credentials</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            All ADP operators must be currently enrolled students at UNILESA.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Legal Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Babatunde Adekunle"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Matriculation Number *
              </label>
              <input
                type="text"
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                placeholder="e.g. CSC/2022/1045"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Institution
              </label>
              <input
                type="text"
                value={institution}
                disabled
                className="w-full h-11 px-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Academic Level *
              </label>
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="100L">100 Level</option>
                <option value="200L">200 Level</option>
                <option value="300L">300 Level</option>
                <option value="400L">400 Level</option>
                <option value="500L">500 Level</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Faculty *
              </label>
              <input
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. Faculty of Science"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Department *
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Active Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="080XXXXXXXX"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Student Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@unilesa.edu.ng"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Student ID Card Upload */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Upload Student ID Card (JPG, PNG, or PDF, max 5MB) *
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Stored securely in a private access-controlled vault. Only authorized verification staff can review this document.
            </p>

            <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
              <input
                type="file"
                id="docUpload"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="docUpload" className="cursor-pointer block">
                {uploadingDoc ? (
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-sm font-medium text-slate-600">Encrypting & uploading document...</span>
                  </div>
                ) : docPath ? (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl text-emerald-600 mb-2">✓</span>
                    <span className="text-sm font-bold text-slate-800">{docFile?.name || 'Document Uploaded'}</span>
                    <span className="text-xs text-emerald-600 font-semibold mt-1">
                      Ready for verification. Click to replace.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-3xl text-slate-400 mb-2">📄</span>
                    <span className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                      Click to choose Student ID file
                    </span>
                    <span className="text-xs text-slate-400 mt-1">JPG, PNG, or PDF up to 5MB</span>
                  </div>
                )}
              </label>
            </div>
            {uploadError && <p className="text-xs text-rose-600 mt-2 font-medium">{uploadError}</p>}
          </div>
        </div>

        {/* Section 3: Hostel / Delivery Port Location */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h2 className="text-xl font-bold text-slate-800">Hostel & Distribution Port Location</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            This is where student packages in your zone will be securely dropped off and collected.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Hostel / Residence Name *
              </label>
              <input
                type="text"
                value={hostelName}
                onChange={(e) => setHostelName(e.target.value)}
                placeholder="e.g. Royal Crown Villa / Diamond Hostel"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Detailed Hostel Physical Address *
              </label>
              <textarea
                value={hostelAddress}
                onChange={(e) => setHostelAddress(e.target.value)}
                placeholder="Include street name, house/gate number, and room/flat information..."
                rows={3}
                required
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Closest Recognizable Landmark
              </label>
              <input
                type="text"
                value={closestLandmark}
                onChange={(e) => setClosestLandmark(e.target.value)}
                placeholder="e.g. Beside RCCG Mega church / Opposite MichoDollar gate"
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Bank Details for Earnings */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h2 className="text-xl font-bold text-slate-800">Earnings & Payout Bank Account</h2>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-6 flex items-start gap-3">
            <span className="text-lg">🔒</span>
            <p className="text-xs text-emerald-900 leading-relaxed">
              <strong>Bank-grade Encryption:</strong> Your bank account number is encrypted at rest using AES-256-GCM. We never collect or request ATM PINs, BVN, or OTP passwords. Payouts are made directly via TransactPay verified bank transfer.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Bank Name *
              </label>
              <select
                value={bankCode}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  10-Digit NUBAN Account Number *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value.replace(/\D/g, ''));
                    setVerifiedName(null);
                    setBankVerifyError(null);
                  }}
                  placeholder="0123456789"
                  required
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-base"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleVerifyBank}
                  disabled={verifyingBank || accountNumber.length !== 10}
                  className="w-full h-11 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-medium text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  {verifyingBank ? 'Checking...' : '🔍 Verify Account'}
                </button>
              </div>
            </div>

            {verifiedName && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                <span>✓</span>
                <span>Verified Account Beneficiary: <strong>{verifiedName}</strong></span>
              </div>
            )}

            {bankVerifyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                ⚠️ {bankVerifyError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Account Holder Name *
              </label>
              <input
                type="text"
                value={accountName || verifiedName || ''}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Matches bank record"
                required
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Alternative Emergency Contact (Phone / WhatsApp)
              </label>
              <input
                type="tel"
                value={alternativeContact}
                onChange={(e) => setAlternativeContact(e.target.value)}
                placeholder="Optional backup phone number"
                className="w-full h-11 px-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 5: NDPA Data Protection Notice & Consent */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">
            Nigeria Data Protection Act (NDPA) Consent
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            In compliance with the Nigeria Data Protection Act (NDPA 2023), AffyFoodBank strictly collects and processes your student credentials, hostel details, and banking information solely for delivery partner vetting, order assignment, and automated compensation disbursements. Sensitive financial details are encrypted at rest with AES-256-GCM. You retain full rights to request updates or deletion of your records upon cessation of your delivery partnership.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ndpaConsent}
              onChange={(e) => setNdpaConsent(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs text-slate-800 font-medium">
              I agree to the collection, verification, and processing of my student and banking credentials for ADP delivery port operations. *
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={submitting || !ndpaConsent}
            className="w-full py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-md transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting Application...</span>
              </>
            ) : (
              <span>Submit Delivery Port Application</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
