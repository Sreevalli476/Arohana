import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { MapboxMap } from '../components/MapboxMap';
import { LocationPoint, Ride, VehicleType, GeoJsonLineString } from '../types';
import { searchPlacesInIndia, getRouteDirections, reverseGeocodeIndia, GeocodingFeature } from '../lib/mapbox';
import { calculateFare } from '../lib/pricing';
import { SosModal } from '../components/SosModal';
import { EmergencyContactSetupModal } from '../components/EmergencyContactSetupModal';
import { CancelRideModal } from '../components/CancelRideModal';
import { PreBookSlotPicker } from '../components/PreBookSlotPicker';
import { MyScheduledRides } from '../components/MyScheduledRides';
import { haversineDistance } from '../lib/geo';
import { combineDateAndSlotToInstant, validateSlotSelection, getLocalTimezoneName } from '../lib/prebooking';
import {
  Compass,
  MapPin,
  Search,
  Navigation,
  Shield,
  AlertTriangle,
  Share2,
  Clock,
  Car,
  Star,
  CheckCircle,
  CreditCard,
  QrCode,
  Banknote,
  Copy,
  ExternalLink,
  ChevronDown,
  X,
  Phone,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
} from 'lucide-react';

export const RiderBookingPage: React.FC = () => {
  const {
    user,
    activeRideId,
    rides,
    pricing,
    onlineDrivers,
    createRideRequest,
    createPrebookedRide,
    cancelScheduledRide,
    cancelRide,
    completePayment,
    rateRide,
    createTrackingToken,
    updateRiderGpsOnRide,
    isPeakDemandSimulated,
  } = useAppStore();

  // Booking Options Mode: IMMEDIATE (Book Now) or PREBOOKED (Pre-Book Ride)
  const [bookingMode, setBookingMode] = useState<'IMMEDIATE' | 'PREBOOKED'>('IMMEDIATE');
  const [preBookError, setPreBookError] = useState<string>('');

  // Default pre-booking date (today) and slot (1 hour from now rounded to 30 mins)
  const [preBookDate, setPreBookDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [preBookSlot, setPreBookSlot] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const m = d.getMinutes() < 30 ? '30' : '00';
    let h = d.getHours();
    if (d.getMinutes() >= 30) h = (h + 1) % 24;
    const ampm = h < 12 ? 'AM' : 'PM';
    let dispH = h % 12;
    if (dispH === 0) dispH = 12;
    return `${dispH}:${m} ${ampm}`;
  });

  // Active ride in store
  const activeRide: Ride | undefined = activeRideId ? rides[activeRideId] : undefined;

  // Locations & Routing
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<GeoJsonLineString | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);
  const [routeDurationMin, setRouteDurationMin] = useState<number>(0);
  const [isApproximateRoute, setIsApproximateRoute] = useState<boolean>(false);
  const [routingLoading, setRoutingLoading] = useState<boolean>(false);

  // Search input & Debounce
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [searchTarget, setSearchTarget] = useState<'destination' | 'pickup'>('destination');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // Selected vehicle tier
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');

  // Modals & Panels
  const [showSosModal, setShowSosModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showSafetySetupModal, setShowSafetySetupModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'card'>('upi');

  // Check first-time emergency contact setup prompt
  useEffect(() => {
    if (user && user.role === 'rider' && !user.hasCompletedSafetySetup && !user.trustedContact) {
      setShowSafetySetupModal(true);
    }
  }, [user]);

  // Stream REAL GPS updates to active ride & live tracking link
  useEffect(() => {
    if (!activeRide) return;
    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateRiderGpsOnRide(activeRide.id, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeRide?.id]);

  // Handle Debounced Place Search (300ms)
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlacesInIndia(
          query,
          pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined
        );
        setSearchResults(results);
      } catch (err) {
        console.warn('Geocoding search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectPlace = (feature: GeocodingFeature) => {
    const point: LocationPoint = {
      lat: feature.center[1],
      lng: feature.center[0],
      address: feature.place_name,
      name: feature.text,
    };

    if (searchTarget === 'pickup') {
      setPickup(point);
    } else {
      setDestination(point);
    }

    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Re-calculate route when pickup or destination changes
  useEffect(() => {
    if (!pickup || !destination) {
      setRouteGeometry(null);
      setRouteDistanceKm(0);
      setRouteDurationMin(0);
      return;
    }

    let isMounted = true;
    const fetchDirections = async () => {
      setRoutingLoading(true);
      try {
        const res = await getRouteDirections(
          [pickup.lng, pickup.lat],
          [destination.lng, destination.lat]
        );
        if (isMounted) {
          setRouteGeometry(res.geometry);
          setRouteDistanceKm(res.distanceKm);
          setRouteDurationMin(res.durationMin);
          setIsApproximateRoute(res.isApproximate);
        }
      } catch (err) {
        console.warn('Failed to calculate route:', err);
      } finally {
        if (isMounted) setRoutingLoading(false);
      }
    };

    fetchDirections();
    return () => {
      isMounted = false;
    };
  }, [pickup, destination]);

  // Synchronize route geometry with active ride
  useEffect(() => {
    if (activeRide) {
      setPickup(activeRide.pickup);
      setDestination(activeRide.destination);
      if (activeRide.routeGeometry) {
        setRouteGeometry(activeRide.routeGeometry);
        setRouteDistanceKm(activeRide.estimatedDistanceKm);
        setRouteDurationMin(activeRide.estimatedDurationMin);
      }
      if (activeRide.status === 'RIDE_COMPLETED' && !activeRide.riderRating) {
        setShowRatingModal(true);
      }
    }
  }, [activeRide]);

  // Compute live demand/supply ratio
  const activeRequestsCount = Object.values(rides).filter((r) => r.status === 'REQUESTED').length + 1;
  const verifiedOnlineDrivers = onlineDrivers.filter(
    (d) => d.isOnline && d.verificationStatus === 'VERIFIED'
  ).length;
  // If simulated peak demand is toggled, amplify ratio
  const rawDemandRatio = (activeRequestsCount / Math.max(1, verifiedOnlineDrivers)) * (isPeakDemandSimulated ? 2.5 : 1.0);

  // Calculate pricing breakdown for current selection
  const currentFare = calculateFare(
    selectedVehicle,
    routeDistanceKm || 5.0,
    routeDurationMin || 15,
    rawDemandRatio,
    pricing[selectedVehicle]
  );

  // Request ride booking
  const handleBookRide = async () => {
    if (!pickup || !destination) return;

    await createRideRequest({
      riderId: user?.uid || 'guest_rider_' + Date.now(),
      riderName: user?.name || 'Rider',
      riderPhone: user?.phone || '+91 91234 56789',
      vehicleType: selectedVehicle,
      pickup,
      destination,
      estimatedDistanceKm: routeDistanceKm,
      estimatedDurationMin: routeDurationMin,
      fareBreakdown: currentFare,
      baseFare: currentFare.baseFare,
      surgePercentage: currentFare.appliedSurgePercent,
      surgeAmount: currentFare.surgeAmount,
      finalFare: currentFare.finalFare,
      maxAllowedFare: currentFare.maxAllowedFare,
      routeGeometry: routeGeometry || undefined,
    });
  };

  // Pre-Book Ride Request Handler
  const handleScheduleRide = async () => {
    if (!pickup || !destination) return;
    setPreBookError('');

    const validation = validateSlotSelection(preBookDate, preBookSlot);
    if (!validation.isValid) {
      setPreBookError(validation.errorMessage || 'Invalid scheduling slot');
      return;
    }

    const scheduledInstant = combineDateAndSlotToInstant(preBookDate, preBookSlot);

    await createPrebookedRide({
      riderId: user?.uid || 'guest_rider_' + Date.now(),
      riderName: user?.name || 'Rider',
      riderPhone: user?.phone || '+91 91234 56789',
      vehicleType: selectedVehicle,
      pickup,
      destination,
      estimatedDistanceKm: routeDistanceKm,
      estimatedDurationMin: routeDurationMin,
      fareBreakdown: currentFare,
      baseFare: currentFare.baseFare,
      surgePercentage: currentFare.appliedSurgePercent,
      surgeAmount: currentFare.surgeAmount,
      finalFare: currentFare.finalFare,
      maxAllowedFare: currentFare.maxAllowedFare,
      routeGeometry: routeGeometry || undefined,
      scheduledDate: preBookDate,
      scheduledTime: preBookSlot,
      scheduledAt: scheduledInstant.toISOString(),
      scheduledTimezone: getLocalTimezoneName(),
    });
  };

  const handleViewScheduledRoute = (schedRide: Ride) => {
    setPickup(schedRide.pickup);
    setDestination(schedRide.destination);
    if (schedRide.routeGeometry) {
      setRouteGeometry(schedRide.routeGeometry);
      setRouteDistanceKm(schedRide.estimatedDistanceKm);
      setRouteDurationMin(schedRide.estimatedDurationMin);
    }
  };

  // Filter scheduled rides for current rider
  const myScheduledRides = Object.values(rides).filter((r) => {
    const isOwner = user?.uid ? r.riderId === user.uid : r.riderId.startsWith('guest_');
    return isOwner && r.bookingType === 'PREBOOKED' && r.status === 'SCHEDULED';
  });

  // Generate trusted contact live tracking link
  const handleOpenShareModal = async () => {
    if (!activeRide) return;
    const token = await createTrackingToken(activeRide.id, user?.name?.split(' ')[0] || 'Rider');
    const url = `${window.location.origin}/track/${token}`;
    setShareLink(url);
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getWhatsAppShareUrl = () => {
    const text = encodeURIComponent(
      `Track my live ĀroHana journey in real time: ${shareLink}\n(Driver: ${activeRide?.driverName || 'Assigned'}, Vehicle: ${activeRide?.driverVehicleNumber || ''})`
    );
    const phone = user?.trustedContact?.phone ? user.trustedContact.phone.replace(/[^0-9]/g, '') : '';
    const target = phone ? (phone.startsWith('91') ? phone : `91${phone}`) : '';
    return target ? `https://wa.me/${target}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  // Driver object if assigned
  const assignedDriver = activeRide?.driverId
    ? onlineDrivers.find((d) => d.uid === activeRide.driverId) || {
        uid: activeRide.driverId,
        name: activeRide.driverName || 'Driver Partner',
        phone: activeRide.driverPhone || '+91 98000 00000',
        vehicleType: activeRide.vehicleType,
        vehicleNumber: activeRide.driverVehicleNumber || 'MH12AB1234',
        vehicleModel: activeRide.driverVehicleModel || 'Sedan',
        isOnline: true,
        verificationStatus: 'VERIFIED' as const,
        rating: activeRide.driverRating || 4.9,
        totalRides: 200,
        lat: activeRide.currentGps?.lat || activeRide.pickup.lat,
        lng: activeRide.currentGps?.lng || activeRide.pickup.lng,
        lastLocationUpdate: activeRide.currentGps?.timestamp || new Date().toISOString(),
      }
    : null;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-neutral-950 flex flex-col md:flex-row">
      {/* Map Viewport */}
      <div className="relative flex-1 w-full h-full">
        <MapboxMap
          pickup={pickup}
          destination={destination}
          onPickupChange={(p) => setPickup(p)}
          onDestinationChange={(d) => setDestination(d)}
          routeGeometry={routeGeometry}
          assignedDriver={assignedDriver}
          isDraggablePickup={!activeRide}
          className="w-full h-full"
        />

        {/* SOS / STOP SOS floating trigger button when ride is active */}
        {activeRide && (
          <button
            onClick={() => setShowSosModal(true)}
            className={`absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-2xl transition-transform active:scale-95 animate-pulse ${
              activeRide.activeSosAlertId
                ? 'bg-neutral-900 border-2 border-rose-500 text-white shadow-rose-950'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 border border-rose-400/30'
            }`}
          >
            {activeRide.activeSosAlertId ? (
              <>
                <StopCircle className="w-4 h-4 text-rose-500" />
                <span>🛑 STOP SOS</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>EMERGENCY SOS</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Booking / Active Ride Floating Panel (Bottom Sheet on Mobile, Sidebar on Desktop) */}
      <div className="w-full md:w-[420px] bg-neutral-900/95 border-t md:border-t-0 md:border-l border-neutral-800 backdrop-blur-xl z-20 flex flex-col overflow-y-auto max-h-[55vh] md:max-h-full p-4 sm:p-6 shadow-2xl">
        {!activeRide ? (
          /* ================= PRE-BOOKING FLOW ================= */
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">Plan Your Journey</h2>
                {isPeakDemandSimulated && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    High Demand Area
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">Guaranteed maximum 25% capped surge.</p>
            </div>

            {/* Booking Options Toggle: [🚕 Book Now] [🕐 Pre-Book Ride] */}
            <div className="flex p-1 rounded-2xl bg-neutral-950 border border-neutral-800">
              <button
                type="button"
                onClick={() => setBookingMode('IMMEDIATE')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  bookingMode === 'IMMEDIATE'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🚕 Book Now</span>
              </button>
              <button
                type="button"
                onClick={() => setBookingMode('PREBOOKED')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                  bookingMode === 'PREBOOKED'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🕐 Pre-Book Ride</span>
              </button>
            </div>

            {/* Location Inputs */}
            <div className="space-y-2.5">
              {/* Pickup input */}
              <button
                onClick={() => {
                  setSearchTarget('pickup');
                  setShowSearchModal(true);
                }}
                className="w-full p-3 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-3"
              >
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-neutral-950 shrink-0">
                  P
                </div>
                <div className="truncate flex-1">
                  <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Pickup Location</p>
                  <p className="text-xs font-medium text-white truncate">
                    {pickup ? pickup.name || pickup.address : 'Detecting your location...'}
                  </p>
                </div>
              </button>

              {/* Destination input */}
              <button
                onClick={() => {
                  setSearchTarget('destination');
                  setShowSearchModal(true);
                }}
                className="w-full p-3 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition-colors flex items-center gap-3"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-neutral-950 shrink-0">
                  D
                </div>
                <div className="truncate flex-1">
                  <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Destination</p>
                  <p className="text-xs font-medium text-neutral-300 truncate">
                    {destination ? destination.name || destination.address : 'Where to? (Tap to search)'}
                  </p>
                </div>
                <Search className="w-4 h-4 text-neutral-500 shrink-0" />
              </button>
            </div>

            {/* Route Stats if available */}
            {destination && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                <div className="flex items-center gap-2 text-neutral-300">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>{routeDistanceKm} km</span>
                  <span className="text-neutral-600">·</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>{routeDurationMin} mins</span>
                </div>
                {isApproximateRoute && (
                  <span className="text-[10px] text-amber-400 font-medium">Approximate</span>
                )}
              </div>
            )}

            {/* Vehicle Selection */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-300">Choose Vehicle Category</p>
              <div className="grid grid-cols-2 gap-2">
                {(['bike', 'auto', 'sedan', 'suv'] as VehicleType[]).map((v) => {
                  const fare = calculateFare(
                    v,
                    routeDistanceKm || 5,
                    routeDurationMin || 15,
                    rawDemandRatio,
                    pricing[v]
                  );
                  const isSelected = selectedVehicle === v;

                  return (
                    <div
                      key={v}
                      onClick={() => setSelectedVehicle(v)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-md'
                          : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="capitalize font-bold text-xs text-white">{v}</span>
                        <span className="text-xs font-extrabold text-amber-400">
                          ₹{fare.finalFare}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">
                        {pricing[v].description}
                      </p>
                      {fare.appliedSurgePercent > 0 && (
                        <span className="text-[9px] font-semibold text-amber-400 block mt-1">
                          +{fare.appliedSurgePercent}% surge applied
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fair Surge Breakdown Accordion */}
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-300 font-semibold">
                <span>Fair Pricing Breakdown</span>
                <span className="text-amber-400">25% Cap Guarantee</span>
              </div>
              <div className="space-y-1 text-neutral-400 text-[11px] pt-1 border-t border-neutral-800/80">
                <div className="flex justify-between">
                  <span>Base Fare</span>
                  <span className="text-white">₹{currentFare.baseFare}</span>
                </div>
                <div className="flex justify-between">
                  <span>Distance ({currentFare.distanceKm} km)</span>
                  <span className="text-white">₹{currentFare.distanceFare}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time ({currentFare.durationMin} min)</span>
                  <span className="text-white">₹{currentFare.timeFare}</span>
                </div>
                {currentFare.appliedSurgePercent > 0 && (
                  <div className="flex justify-between text-amber-400 font-medium">
                    <span>Surge ({currentFare.appliedSurgePercent}%)</span>
                    <span>+₹{currentFare.surgeAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-400">
                  <span>Maximum Allowed Ceiling</span>
                  <span>₹{currentFare.maxAllowedFare}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-neutral-800">
                  <span>{bookingMode === 'PREBOOKED' ? 'Estimated fare' : 'Estimated Total'}</span>
                  <span className="text-amber-400 text-base">₹{currentFare.finalFare}</span>
                </div>
              </div>
            </div>

            {/* Pre-Booking Date & Time Selector (when Pre-Book Ride is active) */}
            {bookingMode === 'PREBOOKED' && (
              <div className="space-y-2">
                <PreBookSlotPicker
                  selectedDate={preBookDate}
                  onDateChange={setPreBookDate}
                  selectedSlot={preBookSlot}
                  onSlotChange={setPreBookSlot}
                />
                {preBookError && (
                  <p className="text-xs text-rose-400 font-semibold px-2">{preBookError}</p>
                )}
              </div>
            )}

            {/* Request Button */}
            <button
              onClick={bookingMode === 'PREBOOKED' ? handleScheduleRide : handleBookRide}
              disabled={!destination || routingLoading}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-extrabold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {!destination
                  ? 'Choose Drop-off Point'
                  : bookingMode === 'PREBOOKED'
                  ? `Schedule Ride · ₹${currentFare.finalFare}`
                  : `Confirm ${selectedVehicle.toUpperCase()} · ₹${currentFare.finalFare}`}
              </span>
            </button>

            {/* My Scheduled Rides Section */}
            <div className="pt-3 border-t border-neutral-800/80">
              <MyScheduledRides
                scheduledRides={myScheduledRides}
                onViewRoute={handleViewScheduledRoute}
                onCancelScheduledRide={cancelScheduledRide}
              />
            </div>
          </div>
        ) : (
          /* ================= ACTIVE RIDE LIFECYCLE FLOW ================= */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Status Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {activeRide.status.replace(/_/g, ' ')}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {activeRide.status === 'REQUESTED' && 'Finding Nearby Drivers...'}
                  {activeRide.status === 'DRIVER_ASSIGNED' && 'Driver Assigned'}
                  {activeRide.status === 'DRIVER_ARRIVING' && 'Driver is Arriving'}
                  {activeRide.status === 'DRIVER_ARRIVED' && 'Driver Has Arrived'}
                  {activeRide.status === 'RIDE_STARTED' && 'Journey in Progress'}
                  {activeRide.status === 'RIDE_COMPLETED' && 'Ride Completed'}
                  {activeRide.status === 'PAYMENT_COMPLETED' && 'Payment Settled'}
                </h3>
              </div>
              <span className="text-xl font-mono font-bold text-amber-400">₹{activeRide.finalFare}</span>
            </div>

            {/* Driver Details if Assigned */}
            {activeRide.driverName ? (
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                      {activeRide.driverName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{activeRide.driverName}</p>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <span className="flex items-center text-amber-400 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                          {activeRide.driverRating?.toFixed(1) || '4.9'}
                        </span>
                        <span>·</span>
                        <span>{activeRide.driverVehicleModel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs font-mono font-bold text-amber-400">
                      {activeRide.driverVehicleNumber}
                    </span>
                  </div>
                </div>

                {activeRide.driverPhone && (
                  <a
                    href={`tel:${activeRide.driverPhone}`}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 border border-neutral-800 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Call Driver ({activeRide.driverPhone})</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-2">
                <div className="w-8 h-8 mx-auto rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <p className="text-xs text-neutral-300 font-medium">Notifying verified nearby drivers within 5km...</p>
                <p className="text-[11px] text-neutral-500">20s auto-pass window per driver</p>
              </div>
            )}

            {/* Journey Progress Indicators */}
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs space-y-2">
              <div className="flex items-center gap-2 text-neutral-300">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="truncate flex-1 font-medium">{activeRide.pickup.address}</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="truncate flex-1 font-medium">{activeRide.destination.address}</span>
              </div>
            </div>

            {/* Safety & Sharing Action Toolbar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleOpenShareModal}
                className="py-2.5 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Share Live Track</span>
              </button>

              <button
                onClick={() => setShowSosModal(true)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                  activeRide.activeSosAlertId
                    ? 'bg-neutral-900 border-rose-500 text-white shadow-md'
                    : 'bg-rose-950/40 hover:bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {activeRide.activeSosAlertId ? (
                  <>
                    <StopCircle className="w-4 h-4 text-rose-500" />
                    <span>🛑 STOP SOS</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>Emergency SOS</span>
                  </>
                )}
              </button>
            </div>

            {/* Payment & Completion Step */}
            {activeRide.status === 'RIDE_COMPLETED' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">Payment Due</span>
                  <span className="text-lg font-mono font-black text-white">₹{activeRide.finalFare}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['upi', 'cash', 'card'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-semibold capitalize border ${
                        paymentMethod === m
                          ? 'bg-amber-500 text-neutral-950 border-amber-500'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => completePayment(activeRide.id, paymentMethod)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
                >
                  Pay ₹{activeRide.finalFare} via {paymentMethod.toUpperCase()}
                </button>
              </div>
            )}

            {/* Cancel Ride Button during applicable ride states */}
            {['REQUESTED', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(activeRide.status) && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-950 hover:bg-rose-950/20 border border-neutral-800 hover:border-rose-800/50 text-xs text-rose-300 font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Cancel Ride</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Place Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-neutral-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                Search {searchTarget === 'pickup' ? 'Pickup' : 'Destination'} in India
              </h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mb-4">
              <input
                type="text"
                autoFocus
                placeholder="Search station, hospital, college, airport, or landmark..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-neutral-950 border border-neutral-700 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-medium"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
            </div>

            {/* Results List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5">
              {searching ? (
                <div className="py-6 text-center text-xs text-neutral-500">Searching places in India...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((feat) => (
                  <div
                    key={feat.id}
                    onClick={() => handleSelectPlace(feat)}
                    className="p-3 rounded-xl hover:bg-neutral-800 cursor-pointer transition-colors flex items-start gap-3"
                  >
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-white">{feat.text}</p>
                      <p className="text-[11px] text-neutral-400 line-clamp-1">{feat.place_name}</p>
                    </div>
                  </div>
                ))
              ) : searchQuery.length >= 2 ? (
                <div className="py-6 text-center text-xs text-neutral-500">No matching places found. Try another landmark.</div>
              ) : (
                <div className="py-4 text-center text-[11px] text-neutral-500">
                  Type at least 2 characters. Suggestions are prioritized by proximity to your current location.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Live Tracking Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative text-neutral-100 space-y-4">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Share Live Journey</h3>
                <p className="text-xs text-neutral-400">Zero-login private tracking for trusted contacts</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Anyone with this link can view your live vehicle location and estimated arrival in real time. Your phone number, email, and payment data remain completely hidden.
            </p>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="w-full bg-transparent text-xs text-neutral-300 focus:outline-none font-mono truncate"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center gap-1 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <a
              href={getWhatsAppShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share on WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </a>

            <p className="text-[10px] text-neutral-500 text-center">
              Link automatically expires when the ride finishes or after 6 hours. You can revoke it anytime.
            </p>
          </div>
        </div>
      )}

      {/* Rider Rating Modal */}
      {showRatingModal && activeRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <h3 className="text-base font-bold text-white">Rate Your Journey</h3>
            <p className="text-xs text-neutral-400">
              How was your ride with {activeRide.driverName || 'your driver'}?
            </p>

            {/* Stars */}
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingScore(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= ratingScore
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-neutral-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            <textarea
              placeholder="Leave feedback on driver safety and courtesy (optional)..."
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              className="w-full h-20 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />

            <button
              onClick={() => {
                rateRide(activeRide.id, ratingScore, ratingFeedback);
                setShowRatingModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors"
            >
              Submit Rating
            </button>
          </div>
        </div>
      )}

      {/* Emergency SOS Modal */}
      {showSosModal && activeRide && (
        <SosModal
          ride={activeRide}
          trustedContact={user?.trustedContact}
          secondaryContact={user?.secondaryContact}
          onClose={() => setShowSosModal(false)}
        />
      )}

      {/* Cancel Ride Modal */}
      {showCancelModal && activeRide && (
        <CancelRideModal
          isOpen={showCancelModal}
          rideId={activeRide.id}
          onConfirm={async (reason) => {
            await cancelRide(activeRide.id, reason);
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* First-time Emergency Contact Setup Modal */}
      {showSafetySetupModal && (
        <EmergencyContactSetupModal
          isOpen={showSafetySetupModal}
          isInitialSetup={true}
          onClose={() => setShowSafetySetupModal(false)}
        />
      )}
    </div>
  );
};
