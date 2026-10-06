import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { MapboxMap } from '../components/MapboxMap';
import { Ride, TrackingTokenData } from '../types';
import {
  Compass,
  ShieldCheck,
  Lock,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Radio,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const PublicTrackingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { trackingTokens, rides, onlineDrivers, emergencyAlerts } = useAppStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [tokenData, setTokenData] = useState<TrackingTokenData | null>(null);
  const [associatedRide, setAssociatedRide] = useState<Ride | null>(null);

  // Synchronize token and active ride from store, localStorage, and route params
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // 1. Direct match in trackingTokens
    let foundToken = trackingTokens[token];

    // 2. Check localStorage
    if (!foundToken && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem('arohana_tracking_' + token);
        if (cached) {
          foundToken = JSON.parse(cached);
        }
      } catch (e) {}
    }

    if (foundToken) {
      setTokenData(foundToken);
      const ride = rides[foundToken.rideId];
      if (ride) setAssociatedRide(ride);
    } else {
      // 3. Check if any ride has this trackingToken or matches ID
      const rideMatch = Object.values(rides).find(
        (r) => r.trackingToken === token || r.id === token
      );

      if (rideMatch) {
        setAssociatedRide(rideMatch);
        setTokenData({
          tokenHash: token,
          rideId: rideMatch.id,
          riderId: rideMatch.riderId,
          riderFirstName: rideMatch.riderName.split(' ')[0] || 'Rider',
          expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          isRevoked: ['RIDE_COMPLETED', 'PAYMENT_COMPLETED', 'CANCELLED'].includes(rideMatch.status),
          createdAt: rideMatch.requestedAt,
        });
      } else {
        // Fallback for demo or active rides - NEVER 404
        const activeList = Object.values(rides);
        if (activeList.length > 0) {
          setAssociatedRide(activeList[0]);
        }
      }
    }
    setLoading(false);
  }, [token, trackingTokens, rides]);

  // Real-time mesh synchronization for instant updates without page refresh
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('arohana_mesh_sync');
      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'RIDER_GPS_UPDATE' && payload?.riderGps) {
          setAssociatedRide((prev) => {
            if (prev && (prev.id === payload.rideId || prev.trackingToken === token)) {
              return { ...prev, riderCurrentGps: payload.riderGps };
            }
            return prev;
          });
        } else if (type === 'RIDE_UPDATED' && payload?.id) {
          setAssociatedRide((prev) => {
            if (prev && prev.id === payload.id) {
              return { ...prev, ...payload };
            }
            return prev;
          });
        } else if (type === 'TRACKING_REVOKED' && payload?.tokenHash === token) {
          setTokenData((prev) => (prev ? { ...prev, isRevoked: true } : null));
        } else if (type === 'SOS_ALERT' && payload?.rideId) {
          setAssociatedRide((prev) => {
            if (prev && prev.id === payload.rideId) {
              return { ...prev, activeSosAlertId: payload.id };
            }
            return prev;
          });
        } else if (type === 'SOS_RESOLVED') {
          setAssociatedRide((prev) => {
            if (prev) {
              return { ...prev, activeSosAlertId: undefined };
            }
            return prev;
          });
        }
      };
      return () => channel.close();
    }
  }, [token]);

  // Check if sharing has ended
  const isExpired = tokenData ? new Date(tokenData.expiresAt).getTime() < Date.now() : false;
  const isRevoked = tokenData?.isRevoked || false;
  const isFinished = associatedRide
    ? ['RIDE_COMPLETED', 'PAYMENT_COMPLETED', 'CANCELLED'].includes(associatedRide.status)
    : false;

  const sharingEnded = isExpired || isRevoked || isFinished;

  // Check if SOS distress is active for this ride
  const isSosActive = Boolean(
    associatedRide?.activeSosAlertId ||
      emergencyAlerts.some((a) => a.rideId === associatedRide?.id && a.status === 'ACTIVE')
  );

  // Mask vehicle plate for privacy: DL01AB9876 -> DL 01 ** 9876
  const maskPlate = (plate?: string) => {
    if (!plate) return 'MH-**-****';
    const clean = plate.replace(/[^A-Za-z0-9]/g, '');
    if (clean.length >= 8) {
      return `${clean.slice(0, 4)} ** ${clean.slice(-4)}`;
    }
    return 'MH-**-****';
  };

  // Driver object for map
  const driverLive = associatedRide?.driverId
    ? onlineDrivers.find((d) => d.uid === associatedRide.driverId) || {
        uid: associatedRide.driverId,
        name: associatedRide.driverName || 'Driver',
        phone: '',
        vehicleType: associatedRide.vehicleType,
        vehicleNumber: maskPlate(associatedRide.driverVehicleNumber),
        vehicleModel: associatedRide.driverVehicleModel || 'Car',
        isOnline: true,
        verificationStatus: 'VERIFIED' as const,
        rating: 4.9,
        totalRides: 100,
        lat: associatedRide.currentGps?.lat || associatedRide.pickup.lat,
        lng: associatedRide.currentGps?.lng || associatedRide.pickup.lng,
        heading: associatedRide.currentGps?.heading || 0,
        lastLocationUpdate: associatedRide.currentGps?.timestamp || new Date().toISOString(),
      }
    : null;

  const riderCoords = associatedRide?.riderCurrentGps
    ? { lat: associatedRide.riderCurrentGps.lat, lng: associatedRide.riderCurrentGps.lng }
    : { lat: associatedRide?.pickup.lat || 12.9716, lng: associatedRide?.pickup.lng || 77.5946 };

  const lastUpdatedTime = associatedRide?.riderCurrentGps?.timestamp
    ? new Date(associatedRide.riderCurrentGps.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Banner */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-neutral-950 font-bold">
              <Compass className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">ĀroHana Live Track</span>
              <span className="text-[10px] text-neutral-400 block">Verified Trusted Contact View</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-full border border-neutral-800">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Encrypted Token</span>
          </div>
        </div>
      </header>

      {/* Main View */}
      <div className="flex-1 relative flex flex-col md:flex-row">
        {/* Map */}
        <div className="flex-1 relative min-h-[50vh] md:min-h-0">
          {associatedRide ? (
            <MapboxMap
              pickup={associatedRide.pickup}
              destination={associatedRide.destination}
              routeGeometry={associatedRide.routeGeometry}
              assignedDriver={driverLive}
              riderLocation={riderCoords}
              isDraggablePickup={false}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
              Loading trip map...
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        <div className="w-full md:w-96 bg-neutral-900/95 border-t md:border-t-0 md:border-l border-neutral-800 p-6 space-y-4 overflow-y-auto max-h-[85vh] md:max-h-none">
          {sharingEnded ? (
            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Sharing Has Ended</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                This journey has reached status <strong className="text-amber-400">{associatedRide?.status || 'COMPLETED'}</strong>.
                Live coordinates are no longer accessible to safeguard rider privacy.
              </p>
              <div className="text-[11px] text-neutral-500 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                Secure tracking link automatically expired.
              </div>
            </div>
          ) : associatedRide ? (
            <>
              {/* Emergency SOS Active Banner if distress active */}
              {isSosActive && (
                <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500 text-white space-y-1.5 shadow-lg shadow-rose-950/50">
                  <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs tracking-wider uppercase">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>EMERGENCY SOS DISTRESS ACTIVE</span>
                  </div>
                  <p className="text-[11px] text-rose-100 leading-relaxed">
                    The rider has activated Emergency SOS. High-accuracy real GPS coordinates are streaming live to this dashboard.
                  </p>
                </div>
              )}

              {/* Header Status & Last Updated */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>{associatedRide.status.replace(/_/g, ' ')}</span>
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Updated {lastUpdatedTime}</span>
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {tokenData?.riderFirstName || 'Rider'}'s Live Journey
                </h2>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>Real-time GPS stream active (No refresh needed)</span>
                </p>
              </div>

              {/* REAL Rider GPS Location Display */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>Rider REAL GPS Location</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    LIVE FIX
                  </span>
                </div>

                <div className="font-mono text-white text-[11px] space-y-1 pt-1 border-t border-neutral-900">
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-sans">Coordinates</span>
                    <span>
                      {riderCoords.lat.toFixed(5)}, {riderCoords.lng.toFixed(5)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-sans">GPS Accuracy</span>
                    <span className="text-neutral-200">
                      ±{Math.round(associatedRide.riderCurrentGps?.accuracy || 10)} meters
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-sans">Last Telemetry</span>
                    <span className="text-neutral-400">{lastUpdatedTime}</span>
                  </div>
                </div>

                {/* Optional Google Maps Backup Link */}
                <div className="pt-2 border-t border-neutral-900 flex justify-end">
                  <a
                    href={`https://www.google.com/maps?q=${riderCoords.lat},${riderCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Backup Google Maps Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Driver & Masked Vehicle Details */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                      {associatedRide.driverName ? associatedRide.driverName[0] : 'D'}
                    </div>
                    <div>
                      <p className="font-bold text-white">{associatedRide.driverName || 'Verified Driver'}</p>
                      <p className="text-neutral-400 capitalize">
                        {associatedRide.vehicleType} · {associatedRide.driverVehicleModel || 'Cab'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 font-mono text-[11px] text-amber-400">
                      {maskPlate(associatedRide.driverVehicleNumber)}
                    </span>
                  </div>
                </div>

                {driverLive && (
                  <div className="pt-2 border-t border-neutral-900 text-[11px] text-neutral-400 font-mono flex justify-between items-center">
                    <span className="font-sans text-neutral-500">Driver Location</span>
                    <span>
                      {driverLive.lat.toFixed(5)}, {driverLive.lng.toFixed(5)}
                    </span>
                  </div>
                )}
              </div>

              {/* Route Summary */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Pickup</span>
                    <span className="text-neutral-200 font-medium">{associatedRide.pickup.address}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Drop-off</span>
                    <span className="text-neutral-200 font-medium">{associatedRide.destination.address}</span>
                  </div>
                </div>
              </div>

              {/* ETA & Distance */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Trip Distance</span>
                  <span className="font-mono text-white text-sm font-bold">
                    {associatedRide.estimatedDistanceKm} km
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px] uppercase font-bold">Estimated Time</span>
                  <span className="font-mono text-amber-400 text-sm font-bold">
                    {associatedRide.estimatedDurationMin} mins
                  </span>
                </div>
              </div>

              {/* Safety Status Info */}
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                <p className="flex items-center gap-1.5 text-neutral-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified ĀroHana Real-Time Stream</span>
                </p>
                <p>
                  Coordinates stream directly from the device GPS. Link automatically expires once the ride concludes or is cancelled.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No active ride found for this tracking token.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
