import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { MapboxMap } from '../components/MapboxMap';
import { Ride, DriverLiveState } from '../types';
import { haversineDistance, isWithinRadius } from '../lib/geo';
import {
  Car,
  Radio,
  ShieldCheck,
  AlertTriangle,
  FileText,
  TrendingUp,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Navigation,
  Compass,
  Phone,
  Power,
  ChevronRight,
  BatteryCharging,
} from 'lucide-react';

export const DriverDashboardPage: React.FC = () => {
  const {
    user,
    driverState,
    setDriverOnline,
    updateDriverGps,
    rides,
    driverActiveRideId,
    driverAcceptRide,
    driverArrivedAtPickup,
    driverStartRide,
    driverCompleteRide,
    driverRateRider,
    simulateDriverMovement,
  } = useAppStore();

  const navigate = useNavigate();

  // Active or incoming ride
  const activeRide: Ride | undefined = driverActiveRideId ? rides[driverActiveRideId] : undefined;

  // Local states
  const [onlineToggling, setOnlineToggling] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [startRideError, setStartRideError] = useState('');
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [incomingTimeoutSec, setIncomingTimeoutSec] = useState(20);

  // References
  const gpsWatchRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastRecordedPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Screen Wake Lock API handler
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      }
    } catch (err) {
      console.warn('Screen wake lock not acquired:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  };

  // Watch Driver GPS position when online
  useEffect(() => {
    if (driverState?.isOnline && navigator.geolocation) {
      requestWakeLock();

      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading } = pos.coords;

          // Check if moved by > 10m or first fix
          let shouldUpdate = false;
          if (!lastRecordedPosRef.current) {
            shouldUpdate = true;
          } else {
            const distM = haversineDistance(
              lastRecordedPosRef.current.lat,
              lastRecordedPosRef.current.lng,
              latitude,
              longitude
            ) * 1000;
            if (distM >= 10) {
              shouldUpdate = true;
            }
          }

          if (shouldUpdate) {
            lastRecordedPosRef.current = { lat: latitude, lng: longitude };
            updateDriverGps({
              lat: latitude,
              lng: longitude,
              accuracy: accuracy,
              speed: speed ? Math.round(speed * 3.6) : 0, // convert m/s to km/h
              heading: heading || 0,
            });
          }
        },
        (err) => {
          console.warn('Driver GPS watch error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
    } else {
      if (gpsWatchRef.current) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      releaseWakeLock();
    }

    return () => {
      if (gpsWatchRef.current) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
      releaseWakeLock();
    };
  }, [driverState?.isOnline]);

  // Demo simulation driver movement along route if toggled
  useEffect(() => {
    if (!simulateDriverMovement || !activeRide || activeRide.status !== 'RIDE_STARTED') return;

    const coords = activeRide.routeGeometry?.coordinates as [number, number][];
    if (!coords || coords.length < 2) return;

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < coords.length) {
        const [lng, lat] = coords[idx];
        updateDriverGps({
          lat,
          lng,
          accuracy: 5,
          speed: 38,
          heading: (idx * 30) % 360,
        });
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [simulateDriverMovement, activeRide?.status]);

  // Toggle online/offline
  const handleToggleOnline = async () => {
    if (!driverState) return;
    setOnlineToggling(true);
    setOnlineError('');

    const targetOnline = !driverState.isOnline;
    const res = await setDriverOnline(targetOnline);

    if (!res.success) {
      setOnlineError(res.error || 'Failed to change online status');
    }
    setOnlineToggling(false);
  };

  // Find incoming requested rides matching vehicle type & within 5km
  const availableRides = Object.values(rides).filter((r) => {
    if (r.status !== 'REQUESTED') return false;
    if (driverState && r.vehicleType !== driverState.vehicleType) return false;
    if (driverState) {
      const dist = haversineDistance(driverState.lat, driverState.lng, r.pickup.lat, r.pickup.lng);
      return dist <= 5.0;
    }
    return true;
  });

  // Calculate today's earnings (85% driver share of completed rides)
  const completedRides = Object.values(rides).filter(
    (r) => r.driverId === driverState?.uid && (r.status === 'RIDE_COMPLETED' || r.status === 'PAYMENT_COMPLETED')
  );
  const totalEarnings = completedRides.reduce((sum, r) => sum + Math.round(r.finalFare * 0.85), 0);

  // Accept incoming ride
  const handleAcceptRide = async (rideId: string) => {
    if (!driverState) return;
    const res = await driverAcceptRide(rideId, driverState);
    if (!res.success) {
      setOnlineError(res.error || 'Could not accept ride');
    }
  };

  // Start ride with 200m geofence enforcement
  const handleStartRide = async (rideId: string) => {
    setStartRideError('');
    if (!driverState) return;

    const res = await driverStartRide(rideId, { lat: driverState.lat, lng: driverState.lng });
    if (!res.success) {
      setStartRideError(res.error || 'Must be within 200m of pickup point to start ride');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      {/* Top Header */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Driver Control Center</h1>
              {wakeLockActive && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                  <BatteryCharging className="w-3 h-3" />
                  Screen Wake Lock Active
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {driverState ? `${driverState.name} · ${driverState.vehicleNumber} (${driverState.vehicleType.toUpperCase()})` : 'Driver Profile'}
            </p>
          </div>

          {/* Online Toggle & Verification Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span
                className={`text-xs font-bold block ${
                  driverState?.verificationStatus === 'VERIFIED'
                    ? 'text-emerald-400'
                    : driverState?.verificationStatus === 'UNDER_REVIEW'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {driverState?.verificationStatus || 'PENDING'}
              </span>
              <span className="text-[11px] text-neutral-500">Document Verification</span>
            </div>

            <button
              onClick={handleToggleOnline}
              disabled={onlineToggling || driverState?.verificationStatus !== 'VERIFIED'}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                driverState?.isOnline
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950 shadow-emerald-500/20'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40'
              }`}
            >
              <Power className={`w-4 h-4 ${driverState?.isOnline ? 'animate-pulse' : ''}`} />
              <span>{driverState?.isOnline ? 'ONLINE' : 'GO ONLINE'}</span>
            </button>
          </div>
        </div>

        {/* Verification Alert Banner if not verified */}
        {driverState && driverState.verificationStatus !== 'VERIFIED' && (
          <div className="max-w-7xl mx-auto mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold">
                  {driverState.verificationStatus === 'UNDER_REVIEW'
                    ? 'Documents Submitted for Verification'
                    : 'Driver Verification Required'}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {driverState.verificationStatus === 'UNDER_REVIEW'
                    ? 'Admin team is auditing your Driving License, RC, and Insurance OCR data.'
                    : 'Upload your documents for client-side OCR checks before you can go online.'}
                </p>
              </div>
            </div>
            <Link
              to="/driver/verify"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold shrink-0 transition-colors"
            >
              Verify Documents
            </Link>
          </div>
        )}

        {onlineError && (
          <div className="max-w-7xl mx-auto mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{onlineError}</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Status & Active Job */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Ride Card */}
          {activeRide ? (
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    ACTIVE RIDE · {activeRide.status.replace(/_/g, ' ')}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-1">Passenger: {activeRide.riderName}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400">Your Share (85%)</p>
                  <p className="text-xl font-mono font-bold text-emerald-400">
                    ₹{Math.round(activeRide.finalFare * 0.85)}
                  </p>
                </div>
              </div>

              {/* Trip Pickup / Destination */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-neutral-950 shrink-0 mt-0.5">
                    P
                  </div>
                  <div>
                    <p className="text-neutral-400 text-[10px] uppercase font-bold">Pickup Location</p>
                    <p className="text-white font-medium">{activeRide.pickup.address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-neutral-950 shrink-0 mt-0.5">
                    D
                  </div>
                  <div>
                    <p className="text-neutral-400 text-[10px] uppercase font-bold">Drop-off Destination</p>
                    <p className="text-white font-medium">{activeRide.destination.address}</p>
                  </div>
                </div>
              </div>

              {/* Error if cannot start */}
              {startRideError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{startRideError}</span>
                </div>
              )}

              {/* Lifecycle Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {activeRide.status === 'DRIVER_ASSIGNED' && (
                  <button
                    onClick={() => driverArrivedAtPickup(activeRide.id)}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
                  >
                    I Have Arrived at Pickup
                  </button>
                )}

                {activeRide.status === 'DRIVER_ARRIVED' && (
                  <button
                    onClick={() => handleStartRide(activeRide.id)}
                    className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-colors"
                  >
                    Start Ride (200m Verification)
                  </button>
                )}

                {activeRide.status === 'RIDE_STARTED' && (
                  <button
                    onClick={() => driverCompleteRide(activeRide.id)}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-lg shadow-emerald-950/50"
                  >
                    Complete Ride & Record Telemetry
                  </button>
                )}

                <a
                  href={`tel:${activeRide.riderPhone}`}
                  className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-neutral-700"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Call Rider</span>
                </a>
              </div>
            </div>
          ) : (
            /* Incoming Requests List */
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Nearby Ride Requests (within 5 km)</h3>
                <span className="text-xs text-neutral-400 font-mono">
                  {availableRides.length} available
                </span>
              </div>

              {!driverState?.isOnline ? (
                <div className="py-12 text-center text-neutral-500 space-y-2">
                  <Radio className="w-8 h-8 mx-auto text-neutral-600" />
                  <p className="text-xs">You are currently offline.</p>
                  <p className="text-[11px] text-neutral-600">
                    Switch to ONLINE to receive instant ride requests in your area.
                  </p>
                </div>
              ) : availableRides.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 space-y-2">
                  <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-neutral-300 font-medium">Listening for live requests...</p>
                  <p className="text-[11px] text-neutral-600">
                    High accuracy GPS active. You will receive requests matching your vehicle tier.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableRides.map((req) => {
                    const distToPickup = driverState
                      ? Math.round(haversineDistance(driverState.lat, driverState.lng, req.pickup.lat, req.pickup.lng) * 10) / 10
                      : 1.2;
                    const expectedEarnings = Math.round(req.finalFare * 0.85);

                    return (
                      <div
                        key={req.id}
                        className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 transition-colors space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-white">{req.riderName}</p>
                              {req.bookingType === 'PREBOOKED' && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold">
                                  🕐 PRE-BOOKED
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400">
                              Pickup is {distToPickup} km away ({req.estimatedDurationMin} mins trip)
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-mono font-bold text-emerald-400">
                              +₹{expectedEarnings}
                            </span>
                            <span className="text-[10px] text-neutral-500 block">
                              Total fare: ₹{req.finalFare}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-neutral-400 space-y-1">
                          <p className="truncate">
                            <strong className="text-neutral-300">From:</strong> {req.pickup.address}
                          </p>
                          <p className="truncate">
                            <strong className="text-neutral-300">To:</strong> {req.destination.address}
                          </p>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleAcceptRide(req.id)}
                            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
                          >
                            Accept Request
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* GPS Telemetry Diagnostics */}
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Real-Time Telemetry Feed</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-500 block">Coordinates</span>
                <span className="font-mono text-white">
                  {driverState ? `${driverState.lat.toFixed(4)}, ${driverState.lng.toFixed(4)}` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-500 block">GPS Accuracy</span>
                <span className="font-mono text-white">±{driverState?.accuracy || 10} m</span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-500 block">Current Speed</span>
                <span className="font-mono text-white">{driverState?.speed || 0} km/h</span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="text-neutral-500 block">Heading</span>
                <span className="font-mono text-white">{driverState?.heading || 0}°</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Earnings, Documents, Profile */}
        <div className="space-y-6">
          {/* Earnings Card */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Today's Earnings</h3>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-mono font-black text-white">₹{totalEarnings}</p>
              <p className="text-xs text-neutral-400 mt-1">
                {completedRides.length} trip(s) completed today (85% net payout)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <div className="flex justify-between">
                <span>Driver Rating</span>
                <span className="text-amber-400 font-bold">{driverState?.rating || 5.0} ★</span>
              </div>
              <div className="flex justify-between">
                <span>Total Lifetime Rides</span>
                <span className="text-white font-medium">{driverState?.totalRides || 0}</span>
              </div>
            </div>
          </div>

          {/* Document Verification Card */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Verification Status</h3>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-neutral-400">
              Government ID, Driving License, Vehicle RC & Insurance must be authenticated via client-side OCR.
            </p>
            <Link
              to="/driver/verify"
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-neutral-700"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Manage Documents & OCR</span>
            </Link>
          </div>

          {/* Quick Ride History */}
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-3 text-xs">
            <h3 className="text-sm font-bold text-white">Recent Completed Rides</h3>
            {completedRides.length === 0 ? (
              <p className="text-neutral-500 py-3">No trips completed in this session.</p>
            ) : (
              <div className="space-y-2">
                {completedRides.slice(0, 3).map((r) => (
                  <div key={r.id} className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px]">
                    <div className="flex justify-between font-semibold text-white">
                      <span className="truncate">{r.destination.name || r.destination.address}</span>
                      <span className="text-emerald-400 font-mono">+₹{Math.round(r.finalFare * 0.85)}</span>
                    </div>
                    <span className="text-neutral-500 text-[10px]">
                      {new Date(r.completedAt || r.requestedAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
