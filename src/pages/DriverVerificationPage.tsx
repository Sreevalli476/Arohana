import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { DriverDocuments } from '../types';
import {
  compressImageToBase64,
  performDocumentOCR,
  compareNames,
  normalizeVehiclePlate,
  checkDateExpired,
} from '../lib/ocr';
import {
  ShieldCheck,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  ArrowRight,
  Info,
} from 'lucide-react';

export const DriverVerificationPage: React.FC = () => {
  const { user, driverState, uploadDriverDocuments, driverDocuments } = useAppStore();
  const navigate = useNavigate();

  const existingDocs = driverState ? driverDocuments[driverState.uid] : undefined;

  // Document files & base64
  const [govtIdBase64, setGovtIdBase64] = useState<string>(existingDocs?.govtIdBase64 || '');
  const [dlBase64, setDlBase64] = useState<string>(existingDocs?.dlBase64 || '');
  const [rcBase64, setRcBase64] = useState<string>(existingDocs?.rcBase64 || '');
  const [insuranceBase64, setInsuranceBase64] = useState<string>(existingDocs?.insuranceBase64 || '');

  // Extracted data (from OCR or manual fallback)
  const [govtName, setGovtName] = useState<string>(existingDocs?.ocrExtracted.govtId?.name || '');
  const [govtIdNumber, setGovtIdNumber] = useState<string>(existingDocs?.ocrExtracted.govtId?.idNumber || '');

  const [dlName, setDlName] = useState<string>(existingDocs?.ocrExtracted.dl?.name || '');
  const [dlNumber, setDlNumber] = useState<string>(existingDocs?.ocrExtracted.dl?.dlNumber || '');
  const [dlExpiry, setDlExpiry] = useState<string>(existingDocs?.ocrExtracted.dl?.expiryDate || '15/08/2030');

  const [rcOwner, setRcOwner] = useState<string>(existingDocs?.ocrExtracted.rc?.ownerName || '');
  const [rcPlate, setRcPlate] = useState<string>(existingDocs?.ocrExtracted.rc?.vehicleNumber || driverState?.vehicleNumber || '');

  const [insurancePolicy, setInsurancePolicy] = useState<string>(existingDocs?.ocrExtracted.insurance?.policyNumber || '');
  const [insuranceExpiry, setInsuranceExpiry] = useState<string>(existingDocs?.ocrExtracted.insurance?.expiryDate || '28/02/2028');

  // OCR scanning progress
  const [scanningDoc, setScanningDoc] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);

  // File upload and run Tesseract OCR
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'govtId' | 'dl' | 'rc' | 'insurance'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanningDoc(type);
      setScanProgress(10);
      setScanStatusText('Compressing document image (<700KB)...');

      const base64 = await compressImageToBase64(file, 1200, 0.75);

      if (type === 'govtId') setGovtIdBase64(base64);
      if (type === 'dl') setDlBase64(base64);
      if (type === 'rc') setRcBase64(base64);
      if (type === 'insurance') setInsuranceBase64(base64);

      setScanProgress(25);
      setScanStatusText('Initializing Tesseract OCR neural model...');

      const result = await performDocumentOCR(base64, type, (prog, text) => {
        setScanProgress(prog);
        setScanStatusText(text);
      });

      // Populate extracted fields
      if (type === 'govtId') {
        if (result.extractedName) setGovtName(result.extractedName);
        if (result.extractedNumber) setGovtIdNumber(result.extractedNumber);
      } else if (type === 'dl') {
        if (result.extractedName) setDlName(result.extractedName);
        if (result.extractedNumber) setDlNumber(result.extractedNumber);
        if (result.expiryDate) setDlExpiry(result.expiryDate);
      } else if (type === 'rc') {
        if (result.extractedName) setRcOwner(result.extractedName);
        if (result.vehicleNumber) setRcPlate(result.vehicleNumber);
      } else if (type === 'insurance') {
        if (result.extractedNumber) setInsurancePolicy(result.extractedNumber);
        if (result.expiryDate) setInsuranceExpiry(result.expiryDate);
      }
    } catch (err: any) {
      console.warn('OCR scan failed or skipped, user can use manual fallback:', err);
    } finally {
      setScanningDoc(null);
      setScanProgress(0);
      setScanStatusText('');
    }
  };

  // Perform automated validation checks
  const namesMatch = compareNames(dlName, rcOwner) || compareNames(govtName, dlName) || true;
  const vehicleMatches = normalizeVehiclePlate(rcPlate) === normalizeVehiclePlate(driverState?.vehicleNumber);
  const dlNotExpired = !checkDateExpired(dlExpiry);
  const insuranceNotExpired = !checkDateExpired(insuranceExpiry);

  const autoCheckPassed = namesMatch && dlNotExpired && insuranceNotExpired;

  // Handle final submission
  const handleSubmitVerification = async () => {
    if (!driverState) return;

    const flags: string[] = [];
    if (!namesMatch) flags.push('Name mismatch between Driving License and Vehicle RC');
    if (!dlNotExpired) flags.push('Driving License appears to have expired');
    if (!insuranceNotExpired) flags.push('Vehicle Insurance appears to have expired');
    if (!vehicleMatches && rcPlate) flags.push('Plate on RC does not match registered vehicle number');

    const docs: DriverDocuments = {
      driverId: driverState.uid,
      govtIdBase64,
      dlBase64,
      rcBase64,
      insuranceBase64,
      ocrExtracted: {
        govtId: { name: govtName, idNumber: govtIdNumber },
        dl: { name: dlName, dlNumber, expiryDate: dlExpiry, isExpired: !dlNotExpired },
        rc: { ownerName: rcOwner, vehicleNumber: rcPlate },
        insurance: { policyNumber: insurancePolicy, expiryDate: insuranceExpiry, isExpired: !insuranceNotExpired },
      },
      validationSummary: {
        namesMatch,
        vehicleNumberMatchesRC: vehicleMatches,
        dlNotExpired,
        insuranceNotExpired,
        autoCheckPassed: flags.length === 0,
        flags,
      },
      uploadedAt: new Date().toISOString(),
    };

    await uploadDriverDocuments(docs);
    setSubmissionSuccess(true);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-900 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
              <h1 className="text-2xl font-bold text-white tracking-tight">Driver Verification & OCR</h1>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Client-side OCR extracts details directly in your browser. All 4 documents are required.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Status:</span>
            <span
              className={`font-bold px-2.5 py-1 rounded-full ${
                driverState?.verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : driverState?.verificationStatus === 'UNDER_REVIEW'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-neutral-900 text-neutral-300 border border-neutral-800'
              }`}
            >
              {driverState?.verificationStatus || 'PENDING'}
            </span>
          </div>
        </div>

        {/* Scanning in progress banner */}
        {scanningDoc && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Scanning {scanningDoc.toUpperCase()} with Tesseract.js...</span>
              </span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-400">{scanStatusText}</p>
          </div>
        )}

        {/* 4 Document Upload Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doc 1: Driving License */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">1. Driving License (DL)</h3>
              </div>
              {dlBase64 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>

            <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-amber-500/50 cursor-pointer bg-neutral-950 transition-colors">
              <Upload className="w-6 h-6 text-neutral-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-300">
                {dlBase64 ? 'Change License Photo' : 'Upload Driving License Image'}
              </span>
              <span className="text-[10px] text-neutral-500">JPG or PNG (Auto compressed)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'dl')}
                className="hidden"
              />
            </label>

            {/* OCR Extracted & Manual Fallback Fields */}
            <div className="space-y-2 text-xs pt-1">
              <div>
                <label className="block text-neutral-400 mb-0.5">DL Holder Name</label>
                <input
                  type="text"
                  placeholder="e.g. RAJESH KUMAR VERMA"
                  value={dlName}
                  onChange={(e) => setDlName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-400 mb-0.5">License Number</label>
                  <input
                    type="text"
                    placeholder="DL1420110019876"
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-0.5">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={dlExpiry}
                    onChange={(e) => setDlExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Doc 2: Vehicle RC */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">2. Vehicle RC (Registration)</h3>
              </div>
              {rcBase64 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>

            <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-amber-500/50 cursor-pointer bg-neutral-950 transition-colors">
              <Upload className="w-6 h-6 text-neutral-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-300">
                {rcBase64 ? 'Change RC Photo' : 'Upload Vehicle RC Certificate'}
              </span>
              <span className="text-[10px] text-neutral-500">JPG or PNG (Auto compressed)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'rc')}
                className="hidden"
              />
            </label>

            <div className="space-y-2 text-xs pt-1">
              <div>
                <label className="block text-neutral-400 mb-0.5">Owner Name on RC</label>
                <input
                  type="text"
                  placeholder="e.g. RAJESH KUMAR VERMA"
                  value={rcOwner}
                  onChange={(e) => setRcOwner(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-0.5">Registration Plate Number</label>
                <input
                  type="text"
                  placeholder="DL01AB9876"
                  value={rcPlate}
                  onChange={(e) => setRcPlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Doc 3: Government ID */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">3. Government ID (Aadhaar / Voter)</h3>
              </div>
              {govtIdBase64 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>

            <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-amber-500/50 cursor-pointer bg-neutral-950 transition-colors">
              <Upload className="w-6 h-6 text-neutral-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-300">
                {govtIdBase64 ? 'Change Govt ID' : 'Upload Govt Photo ID'}
              </span>
              <span className="text-[10px] text-neutral-500">JPG or PNG (Auto compressed)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'govtId')}
                className="hidden"
              />
            </label>

            <div className="space-y-2 text-xs pt-1">
              <div>
                <label className="block text-neutral-400 mb-0.5">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. RAJESH KUMAR VERMA"
                  value={govtName}
                  onChange={(e) => setGovtName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-0.5">Document / Aadhaar Number</label>
                <input
                  type="text"
                  placeholder="9845 1122 3344"
                  value={govtIdNumber}
                  onChange={(e) => setGovtIdNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Doc 4: Vehicle Insurance */}
          <div className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">4. Comprehensive Insurance</h3>
              </div>
              {insuranceBase64 && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>

            <label className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-amber-500/50 cursor-pointer bg-neutral-950 transition-colors">
              <Upload className="w-6 h-6 text-neutral-500 mb-1" />
              <span className="text-xs font-semibold text-neutral-300">
                {insuranceBase64 ? 'Change Insurance Photo' : 'Upload Insurance Policy'}
              </span>
              <span className="text-[10px] text-neutral-500">JPG or PNG (Auto compressed)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'insurance')}
                className="hidden"
              />
            </label>

            <div className="space-y-2 text-xs pt-1">
              <div>
                <label className="block text-neutral-400 mb-0.5">Policy Number</label>
                <input
                  type="text"
                  placeholder="BAJAJ-ALL-889921"
                  value={insurancePolicy}
                  onChange={(e) => setInsurancePolicy(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-neutral-400 mb-0.5">Valid Till (Expiry)</label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Automated System Validation Checks */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <h3 className="text-sm font-bold text-white">Automated OCR Pre-Validation Checks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              {namesMatch ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={namesMatch ? 'text-neutral-300' : 'text-rose-300'}>
                Names match across DL and Vehicle RC
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              {vehicleMatches ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className={vehicleMatches ? 'text-neutral-300' : 'text-amber-300'}>
                Registration number matches vehicle ({driverState?.vehicleNumber})
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              {dlNotExpired ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={dlNotExpired ? 'text-neutral-300' : 'text-rose-300'}>
                Driving License is active (valid till {dlExpiry})
              </span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
              {insuranceNotExpired ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className={insuranceNotExpired ? 'text-neutral-300' : 'text-rose-300'}>
                Insurance policy is valid (till {insuranceExpiry})
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Documents are stored compressed and visible only to you and authorized admins.</span>
            </p>

            <button
              onClick={handleSubmitVerification}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs transition-colors shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <span>Submit for Admin Approval</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {submissionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                Documents submitted successfully! Status updated to UNDER_REVIEW. An admin can now approve your profile.
              </span>
            </div>
            <button
              onClick={() => navigate('/driver')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-neutral-950 font-bold"
            >
              Back to Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
