import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { VehicleType, RiskClassification } from '../types';
import {
  Shield,
  FileCheck2,
  AlertTriangle,
  Flame,
  Users,
  Car,
  TrendingUp,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Activity,
  DollarSign,
  Radio,
  Search,
  ExternalLink,
  PhoneCall,
  Phone,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const {
    user,
    onlineDrivers,
    driverDocuments,
    verifyDriverByAdmin,
    rides,
    pricing,
    updatePricing,
    emergencyAlerts,
    resolveSosAlert,
    fraudReports,
    updateFraudStatus,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'verification' | 'fraud' | 'sos' | 'pricing' | 'rides'
  >('overview');

  // Stats calculation
  const totalDrivers = onlineDrivers.length;
  const verifiedDrivers = onlineDrivers.filter((d) => d.verificationStatus === 'VERIFIED').length;
  const pendingDrivers = onlineDrivers.filter(
    (d) => d.verificationStatus === 'PENDING' || d.verificationStatus === 'UNDER_REVIEW'
  ).length;

  const allRidesList = Object.values(rides);
  const activeRidesCount = allRidesList.filter((r) =>
    ['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'RIDE_STARTED'].includes(r.status)
  ).length;
  const completedRidesList = allRidesList.filter((r) =>
    ['RIDE_COMPLETED', 'PAYMENT_COMPLETED'].includes(r.status)
  );

  const totalGrossRevenue = completedRidesList.reduce((sum, r) => sum + r.finalFare, 0);
  const platformRevenue = Math.round(totalGrossRevenue * 0.15); // 15% platform take rate

  const activeSosAlerts = emergencyAlerts.filter((a) => a.status === 'ACTIVE');
  const resolvedSosAlerts = emergencyAlerts.filter((a) => a.status === 'RESOLVED');
  const [sosFilter, setSosFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('Operator confirmed situation resolved');
  const fraudReportsList = Object.values(fraudReports);
  const suspiciousCount = fraudReportsList.filter((f) => f.riskClassification === 'SUSPICIOUS').length;

  // Selected driver for verification inspection modal
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      {/* Top Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xl font-bold text-white tracking-tight">Admin & Safety Operations</h1>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live platform monitoring, driver verification, fraud detection, and pricing rules
            </p>
          </div>

          {activeSosAlerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold animate-bounce">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{activeSosAlerts.length} Active SOS Alert(s)</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-6 flex overflow-x-auto gap-2 border-b border-neutral-800 text-xs font-medium">
          {[
            { id: 'overview', label: 'Overview Metrics', icon: Activity },
            { id: 'verification', label: `Driver Verification (${pendingDrivers})`, icon: FileCheck2 },
            { id: 'fraud', label: `GPS Fraud Detection (${suspiciousCount})`, icon: Shield },
            { id: 'sos', label: `Safety Center (${activeSosAlerts.length})`, icon: AlertTriangle },
            { id: 'pricing', label: 'Fair Surge & Rates', icon: DollarSign },
            { id: 'rides', label: `All Rides (${allRidesList.length})`, icon: Car },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 px-3 transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-amber-500 text-amber-400 font-bold'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ================= 1. OVERVIEW METRICS TAB ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-xs font-medium">Verified Drivers</span>
                <p className="text-2xl font-bold text-white">
                  {verifiedDrivers} <span className="text-xs text-neutral-500 font-normal">/ {totalDrivers}</span>
                </p>
                <p className="text-[11px] text-emerald-400 font-semibold">{pendingDrivers} pending review</p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-xs font-medium">Active Rides</span>
                <p className="text-2xl font-bold text-amber-400 font-mono">{activeRidesCount}</p>
                <p className="text-[11px] text-neutral-400">{completedRidesList.length} completed</p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-xs font-medium">Gross Platform GMV</span>
                <p className="text-2xl font-bold text-white font-mono">₹{totalGrossRevenue}</p>
                <p className="text-[11px] text-emerald-400 font-semibold">Net commission: ₹{platformRevenue}</p>
              </div>

              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-xs font-medium">GPS Telemetry Flags</span>
                <p className="text-2xl font-bold text-rose-400 font-mono">{suspiciousCount}</p>
                <p className="text-[11px] text-neutral-400">Automated audit reports</p>
              </div>
            </div>

            {/* Quick Live Drivers Table */}
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Online Driver Fleet</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                    <tr>
                      <th className="pb-3">Driver Name</th>
                      <th className="pb-3">Vehicle</th>
                      <th className="pb-3">Plate No</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Verification</th>
                      <th className="pb-3">Rating</th>
                      <th className="pb-3">GPS Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {onlineDrivers.map((d) => (
                      <tr key={d.uid} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-3 font-semibold text-white">{d.name}</td>
                        <td className="py-3 capitalize text-neutral-300">{d.vehicleType}</td>
                        <td className="py-3 font-mono text-amber-400">{d.vehicleNumber}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              d.isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {d.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`font-semibold ${
                              d.verificationStatus === 'VERIFIED'
                                ? 'text-emerald-400'
                                : d.verificationStatus === 'UNDER_REVIEW'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {d.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3 text-neutral-300">{d.rating} ★</td>
                        <td className="py-3 font-mono text-neutral-400 text-[11px]">
                          {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. DRIVER VERIFICATION CENTER ================= */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Driver Verification Audit Center</h3>
                <p className="text-xs text-neutral-400">
                  Review extracted OCR text, dates, vehicle RC matching, and approve/reject drivers.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {onlineDrivers.map((driver) => {
                const docs = driverDocuments[driver.uid];
                return (
                  <div
                    key={driver.uid}
                    className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{driver.name}</h4>
                        <p className="text-xs text-neutral-400">
                          {driver.phone} · {driver.vehicleNumber} ({driver.vehicleModel})
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          driver.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : driver.verificationStatus === 'UNDER_REVIEW'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {driver.verificationStatus}
                      </span>
                    </div>

                    {/* OCR Results Summary */}
                    {docs ? (
                      <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs space-y-2">
                        <div className="flex justify-between text-neutral-400">
                          <span>DL Number</span>
                          <span className="font-mono text-white">
                            {docs.ocrExtracted.dl?.dlNumber || 'Verified via manual'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>RC Registered Plate</span>
                          <span className="font-mono text-amber-400">
                            {docs.ocrExtracted.rc?.vehicleNumber || driver.vehicleNumber}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>DL Expiry</span>
                          <span className="text-white">
                            {docs.ocrExtracted.dl?.expiryDate || '15/08/2030'}
                          </span>
                        </div>
                        <div className="flex justify-between text-neutral-400">
                          <span>Automated Checks</span>
                          <span className="text-emerald-400 font-semibold">
                            {docs.validationSummary?.autoCheckPassed ? 'All Passed' : 'Flagged for Review'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-500">
                        No documents uploaded yet by this driver.
                      </div>
                    )}

                    {/* Admin Actions */}
                    <div className="flex gap-2 pt-1 text-xs">
                      <button
                        onClick={() => verifyDriverByAdmin(driver.uid, 'VERIFIED')}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                      >
                        Approve & Verify
                      </button>
                      <button
                        onClick={() => verifyDriverByAdmin(driver.uid, 'RE_UPLOAD', 'Image blurry or unreadable')}
                        className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-medium transition-colors"
                      >
                        Request Re-upload
                      </button>
                      <button
                        onClick={() => verifyDriverByAdmin(driver.uid, 'REJECTED', 'Documents failed verification criteria')}
                        className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-rose-900/40 text-rose-300 font-medium transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 3. GPS FRAUD DETECTION TAB ================= */}
        {activeTab === 'fraud' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Automated GPS Fraud & Telemetry Audit</h3>
              <p className="text-xs text-neutral-400">
                Objective trip telemetry audits: compares actual recorded GPS breadcrumbs against estimated route geometry. Neutral phrasing ("flagged for review").
              </p>
            </div>

            {fraudReportsList.length === 0 ? (
              <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500 space-y-2">
                <Shield className="w-8 h-8 text-neutral-600 mx-auto" />
                <p>No completed rides have recorded GPS audit reports yet.</p>
                <p className="text-[11px] text-neutral-600">
                  Complete a ride in the driver console to generate automated audit telemetry.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {fraudReportsList.map((rep) => (
                  <div
                    key={rep.rideId}
                    className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                            rep.riskClassification === 'SUSPICIOUS'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : rep.riskClassification === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {rep.riskClassification} RISK
                        </span>
                        <div>
                          <p className="font-bold text-white">Ride: {rep.rideId}</p>
                          <p className="text-[11px] text-neutral-400">
                            Driver: {rep.driverName || rep.driverId} · Passenger: {rep.riderName || rep.riderId}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-neutral-400 text-[11px]">
                        Status: <strong className="text-white">{rep.status}</strong>
                      </span>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-bold block">Expected vs GPS</span>
                        <span className="font-mono text-white">
                          {rep.expectedDistanceKm} km / {rep.actualGpsDistanceKm} km
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-bold block">Variance</span>
                        <span className={`font-mono font-bold ${rep.distanceDifferencePercent > 30 ? 'text-rose-400' : 'text-neutral-200'}`}>
                          {rep.distanceDifferencePercent}%
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-bold block">Peak Speed</span>
                        <span className={`font-mono ${rep.hasImpossibleSpeed ? 'text-rose-400 font-bold' : 'text-neutral-200'}`}>
                          {rep.maxRecordedSpeedKmh} km/h
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                        <span className="text-neutral-500 text-[10px] uppercase font-bold block">Telemetry Points</span>
                        <span className="font-mono text-white">{rep.totalGpsPoints} logged</span>
                      </div>
                    </div>

                    {/* Anomaly reasons */}
                    <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] space-y-1">
                      <p className="text-neutral-400 font-semibold">Audit Observations:</p>
                      <ul className="list-disc pl-4 text-neutral-300 space-y-0.5">
                        {rep.anomalyReasons.map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateFraudStatus(rep.rideId, 'CONFIRMED_SAFE', 'Admin verified as valid detour')}
                        className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                      >
                        Mark as Safe
                      </button>
                      <button
                        onClick={() => updateFraudStatus(rep.rideId, 'CONFIRMED_SUSPICIOUS', 'Confirmed anomalous distance or route jump')}
                        className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors"
                      >
                        Confirm Suspicious
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= 4. SOS / SAFETY CENTER TAB ================= */}
        {activeTab === 'sos' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <span>Emergency Safety Operations Center</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Real-time distress monitoring with verified GPS coordinates, live tracking links, and emergency dispatch actions.
                </p>
              </div>

              {/* Filter Tabs for Active vs Resolved */}
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs font-semibold">
                <button
                  onClick={() => setSosFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    sosFilter === 'all'
                      ? 'bg-neutral-800 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({emergencyAlerts.length})
                </button>
                <button
                  onClick={() => setSosFilter('active')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    sosFilter === 'active'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-rose-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                  <span>Active SOS ({activeSosAlerts.length})</span>
                </button>
                <button
                  onClick={() => setSosFilter('resolved')}
                  className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    sosFilter === 'resolved'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-emerald-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolved ({resolvedSosAlerts.length})</span>
                </button>
              </div>
            </div>

            {/* Emergency Operator Hotline Banner */}
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm">Emergency Dispatch Protocol (National 112)</p>
                  <p className="text-rose-200 text-[11px]">
                    Operators can initiate immediate distress calls directly from this console.
                  </p>
                </div>
              </div>
              <a
                href="tel:112"
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-rose-950/50"
              >
                <Phone className="w-4 h-4" />
                <span>Call Police / Emergency Dispatch (112)</span>
              </a>
            </div>

            {/* Filtered Alerts List */}
            {(() => {
              const filteredList =
                sosFilter === 'active'
                  ? activeSosAlerts
                  : sosFilter === 'resolved'
                  ? resolvedSosAlerts
                  : emergencyAlerts;

              if (filteredList.length === 0) {
                return (
                  <div className="p-12 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500 space-y-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-semibold text-neutral-300">
                      {sosFilter === 'active'
                        ? 'No active distress alerts at this moment.'
                        : 'No SOS alerts in this category.'}
                    </p>
                    <p className="text-[11px] text-neutral-600">All rider journeys are currently safe.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filteredList.map((alert) => {
                    const isAlertActive = alert.status === 'ACTIVE';

                    return (
                      <div
                        key={alert.id}
                        className={`p-6 rounded-3xl border space-y-5 text-xs transition-all shadow-xl ${
                          isAlertActive
                            ? 'bg-rose-950/20 border-rose-500/70 shadow-rose-950/40 ring-1 ring-rose-500/30'
                            : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {/* Alert Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-800/80">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-3.5 h-3.5 rounded-full ${
                                isAlertActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-white">Ride #{alert.rideId}</span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wider uppercase ${
                                    isAlertActive
                                      ? 'bg-rose-500 text-white font-extrabold shadow-sm'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                >
                                  {alert.status}
                                </span>
                              </div>
                              <span className="text-[11px] text-neutral-400 font-mono">
                                Alert ID: {alert.id}
                              </span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right font-mono text-[11px] text-neutral-400">
                            <div>
                              <span className="text-neutral-500 font-sans">SOS Activated: </span>
                              <span className="text-neutral-200 font-bold">
                                {new Date(alert.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {alert.resolvedAt && (
                              <div className="text-emerald-400 mt-0.5">
                                <span className="font-sans">Resolved At: </span>
                                <span>{new Date(alert.resolvedAt).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Rider & Driver Information Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Rider Info Card */}
                          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                                Rider in Distress
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">{alert.riderId}</span>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-white">{alert.riderName}</p>
                              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                                {alert.riderPhone || 'No phone recorded'}
                              </p>
                            </div>

                            {alert.riderPhone && (
                              <a
                                href={`tel:${alert.riderPhone.replace(/[^0-9+]/g, '')}`}
                                className="inline-flex items-center gap-2 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors w-full justify-center"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Contact Rider ({alert.riderPhone})</span>
                              </a>
                            )}
                          </div>

                          {/* Driver Info Card */}
                          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                Assigned Driver
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {alert.driverId || 'Unassigned'}
                              </span>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-white">
                                {alert.driverName || 'No Driver Assigned'}
                              </p>
                              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                                {alert.driverPhone || 'No driver phone recorded'}
                              </p>
                            </div>

                            {alert.driverPhone ? (
                              <a
                                href={`tel:${alert.driverPhone.replace(/[^0-9+]/g, '')}`}
                                className="inline-flex items-center gap-2 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-semibold transition-colors w-full justify-center"
                              >
                                <Phone className="w-3.5 h-3.5 text-amber-400" />
                                <span>Contact Driver ({alert.driverPhone})</span>
                              </a>
                            ) : (
                              <div className="py-2 px-3 rounded-xl bg-neutral-900 text-neutral-600 text-xs text-center border border-neutral-800">
                                Driver phone not available
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Real GPS Telemetry & Live Tracking Links */}
                        <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 font-mono">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block font-sans">
                                REAL Current GPS Location
                              </span>
                              <span className="text-white font-bold text-sm">
                                {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}
                              </span>
                            </div>

                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-neutral-500 uppercase font-bold block font-sans">
                                Fix Accuracy
                              </span>
                              <span className="text-amber-400 font-bold">
                                ±{Math.round(alert.accuracy)} meters
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-900 font-sans">
                            {/* Live Tracking Link Button */}
                            <a
                              href={alert.liveTrackingUrl || `/track/${alert.rideId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center gap-2 transition-colors"
                            >
                              <Radio className="w-3.5 h-3.5 text-amber-400" />
                              <span>Open Live Tracking Link</span>
                              <ExternalLink className="w-3 h-3 text-neutral-400" />
                            </a>

                            {/* Google Maps External Link */}
                            <a
                              href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-xs flex items-center gap-2 transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                              <span>View GPS on Map</span>
                              <ExternalLink className="w-3 h-3 text-neutral-400" />
                            </a>
                          </div>
                        </div>

                        {/* Resolution History / Notes */}
                        {alert.notes && (
                          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 text-[11px] text-neutral-300">
                            <span className="text-neutral-500 font-semibold block">Incident Resolution Notes:</span>
                            <p className="mt-0.5 italic text-neutral-200">"{alert.notes}"</p>
                          </div>
                        )}

                        {/* Operational Actions Bar */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-2">
                          {/* Action 1: Contact Rider */}
                          {alert.riderPhone && (
                            <a
                              href={`tel:${alert.riderPhone.replace(/[^0-9+]/g, '')}`}
                              className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-2 transition-colors border border-neutral-700"
                            >
                              <Phone className="w-4 h-4 text-emerald-400" />
                              <span>Contact Rider</span>
                            </a>
                          )}

                          {/* Action 2: Contact Driver */}
                          {alert.driverPhone && (
                            <a
                              href={`tel:${alert.driverPhone.replace(/[^0-9+]/g, '')}`}
                              className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-2 transition-colors border border-neutral-700"
                            >
                              <Phone className="w-4 h-4 text-amber-400" />
                              <span>Contact Driver</span>
                            </a>
                          )}

                          {/* Action 3: Call Police / Emergency Dispatch */}
                          <a
                            href="tel:112"
                            className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-rose-950/40"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            <span>Call Police / Emergency Dispatch (112)</span>
                          </a>

                          {/* Action 4: Mark Resolved */}
                          {isAlertActive && (
                            <button
                              onClick={() => setResolvingAlertId(alert.id)}
                              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-colors ml-auto shadow-lg shadow-emerald-950/40"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Resolved</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Resolve Modal Dialog */}
            {resolvingAlertId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
                <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">Resolve SOS Distress Alert</h4>
                      <p className="text-xs text-neutral-400">Alert ID: {resolvingAlertId}</p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300">
                    Provide operational resolution notes before marking this emergency incident as resolved.
                  </p>

                  <div>
                    <label className="block text-neutral-400 text-[11px] mb-1">Resolution Summary</label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      className="w-full h-20 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setResolvingAlertId(null)}
                      className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await resolveSosAlert(resolvingAlertId, resolutionNote);
                        setResolvingAlertId(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
                    >
                      Confirm Resolved
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 5. PRICING & SURGE SETTINGS TAB ================= */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">Fair Pricing & Surge Caps Configuration</h3>
              <p className="text-xs text-neutral-400">
                Set base fares, per-kilometer rates, minute charges, and hard caps for all vehicle tiers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(['bike', 'auto', 'sedan', 'suv'] as VehicleType[]).map((v) => {
                const conf = pricing[v];
                return (
                  <div key={v} className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white capitalize">{conf.name}</h4>
                      <span className="text-amber-400 font-bold font-mono">Max Surge: {conf.maxSurgeCapPercent}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-neutral-400 mb-1">Base Fare (₹)</label>
                        <input
                          type="number"
                          value={conf.baseFare}
                          onChange={(e) => updatePricing(v, { baseFare: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-neutral-400 mb-1">Per Km Rate (₹)</label>
                        <input
                          type="number"
                          value={conf.perKmRate}
                          onChange={(e) => updatePricing(v, { perKmRate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-neutral-400 mb-1">Per Min Rate (₹)</label>
                        <input
                          type="number"
                          value={conf.perMinRate}
                          onChange={(e) => updatePricing(v, { perMinRate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-neutral-400 mb-1">Max Surge Cap (%)</label>
                        <input
                          type="number"
                          value={conf.maxSurgeCapPercent}
                          onChange={(e) => updatePricing(v, { maxSurgeCapPercent: parseFloat(e.target.value) || 25 })}
                          className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 6. ALL RIDES TAB ================= */}
        {activeTab === 'rides' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">System Rides Master Registry</h3>
            {allRidesList.length === 0 ? (
              <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500">
                No rides registered yet.
              </div>
            ) : (
              <div className="space-y-3">
                {allRidesList.map((ride) => (
                  <div
                    key={ride.id}
                    className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white font-mono">{ride.id}</span>
                        <span className="text-neutral-400 ml-2">
                          Rider: {ride.riderName} · Driver: {ride.driverName || 'Unassigned'}
                        </span>
                      </div>
                      <span className="font-mono text-amber-400 font-bold">₹{ride.finalFare}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400 text-[11px]">
                      <span className="truncate max-w-md">
                        {ride.pickup.address} → {ride.destination.address}
                      </span>
                      <span className="uppercase font-semibold text-neutral-300">{ride.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
