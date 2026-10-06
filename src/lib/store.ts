import { create } from 'zustand';
import {
  DriverDocuments,
  DriverLiveState,
  EmergencyAlert,
  FraudReport,
  GpsLogPoint,
  InAppNotification,
  PricingConfig,
  Ride,
  RideStatus,
  TrackingTokenData,
  TrustedContact,
  UserProfile,
  VehicleType,
} from '../types';
import {
  auth,
  db,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fbSignOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  runTransaction,
} from './firebase';
import { DEFAULT_PRICING, calculateFare } from './pricing';
import { SEEDED_DOCUMENTS, SEEDED_DRIVERS, SEEDED_USERS } from './seed';
import { haversineDistance, isWithinRadius } from './geo';
import { analyzeRideGpsLogs } from './fraud';

interface AppStore {
  // Authentication & Profile
  user: UserProfile | null;
  authLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signupRider: (data: {
    email: string;
    pass: string;
    name: string;
    phone: string;
    trustedContact?: { name: string; phone: string; relationship: string };
  }) => Promise<{ success: boolean; error?: string }>;
  signupDriver: (data: {
    email: string;
    pass: string;
    name: string;
    phone: string;
    vehicleType: VehicleType;
    vehicleNumber: string;
    vehicleModel: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;

  // Driver Live State
  driverState: DriverLiveState | null;
  onlineDrivers: DriverLiveState[];
  setDriverOnline: (isOnline: boolean) => Promise<{ success: boolean; error?: string }>;
  updateDriverGps: (gps: { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }) => Promise<void>;
  driverDocuments: Record<string, DriverDocuments>;
  uploadDriverDocuments: (docs: DriverDocuments) => Promise<void>;
  verifyDriverByAdmin: (driverId: string, status: 'VERIFIED' | 'REJECTED' | 'RE_UPLOAD', reason?: string) => Promise<void>;

  // Rides & Lifecycle
  rides: Record<string, Ride>;
  activeRideId: string | null;
  driverActiveRideId: string | null;
  rideGpsLogs: Record<string, GpsLogPoint[]>;
  createRideRequest: (rideData: Omit<Ride, 'id' | 'status' | 'requestedAt'>) => Promise<string>;
  createPrebookedRide: (rideData: Omit<Ride, 'id' | 'status' | 'requestedAt'> & {
    scheduledDate: string;
    scheduledTime: string;
    scheduledAt: string;
    scheduledTimezone: string;
  }) => Promise<string>;
  cancelScheduledRide: (rideId: string, reason: string) => Promise<void>;
  promoteScheduledRide: (rideId: string) => Promise<void>;
  markNoDriverFound: (rideId: string) => Promise<void>;
  fastForwardScheduledRide: (rideId: string) => Promise<void>;
  activationWindowMinutes: number;
  setActivationWindowMinutes: (mins: number) => void;
  cancelRide: (rideId: string, reason?: string) => Promise<void>;
  driverAcceptRide: (rideId: string, driver: DriverLiveState) => Promise<{ success: boolean; error?: string }>;
  driverArrivedAtPickup: (rideId: string) => Promise<void>;
  driverStartRide: (rideId: string, driverLocation: { lat: number; lng: number }) => Promise<{ success: boolean; error?: string }>;
  driverCompleteRide: (rideId: string) => Promise<void>;
  completePayment: (rideId: string, method: 'cash' | 'upi' | 'card') => Promise<void>;
  rateRide: (rideId: string, rating: number, feedback?: string) => Promise<void>;
  driverRateRider: (rideId: string, score: number) => Promise<void>;

  // Pricing Admin
  pricing: Record<VehicleType, PricingConfig>;
  updatePricing: (vehicleType: VehicleType, config: Partial<PricingConfig>) => Promise<void>;

  // Emergency SOS
  emergencyAlerts: EmergencyAlert[];
  activeSosAlertId: string | null;
  triggerSos: (rideId: string, lat: number, lng: number, accuracy: number) => Promise<string>;
  stopSos: (alertId: string, reason?: string) => Promise<void>;
  updateSosLocation: (alertId: string, lat: number, lng: number, accuracy: number) => Promise<void>;
  resolveSosAlert: (alertId: string, notes?: string) => Promise<void>;

  // Trusted Contact Safety & Location
  updateRiderGpsOnRide: (rideId: string, gps: { lat: number; lng: number; accuracy?: number }) => Promise<void>;
  saveSafetySettings: (settings: {
    primaryContact: TrustedContact;
    secondaryContact?: TrustedContact;
    liveSharingEnabled: boolean;
    consentGiven: boolean;
  }) => Promise<void>;
  removeTrustedContact: (isSecondary?: boolean) => Promise<void>;
  showSafetyModal: boolean;
  setShowSafetyModal: (show: boolean) => void;

  // Trusted Contact Tracking
  trackingTokens: Record<string, TrackingTokenData>;
  createTrackingToken: (rideId: string, riderFirstName: string) => Promise<string>;
  revokeTrackingToken: (tokenHash: string) => Promise<void>;

  // Fraud Reports
  fraudReports: Record<string, FraudReport>;
  updateFraudStatus: (rideId: string, status: 'CONFIRMED_SAFE' | 'CONFIRMED_SUSPICIOUS', notes?: string) => Promise<void>;

  // Notifications
  notifications: InAppNotification[];
  addNotification: (notif: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;

  // Demo Controls
  demoMode: boolean;
  pcDemoCallMode: boolean;
  togglePcDemoCallMode: () => void;
  setPcDemoCallMode: (val: boolean) => void;
  isPeakDemandSimulated: boolean;
  togglePeakDemand: () => void;
  simulateGpsAnomaly: boolean;
  toggleSimulateGpsAnomaly: () => void;
  simulateDriverMovement: boolean;
  toggleSimulateDriverMovement: () => void;
  resetDemoRide: () => void;
}

// In-memory cross-tab communication bus for seamless preview testing
const broadcast = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('arohana_events') : null;

// Initial local storage hydration
const SAVED_USER_KEY = 'arohana_user_session';

export const useAppStore = create<AppStore>((set, get) => {
  // Load initial local user if exists
  let initialUser: UserProfile | null = null;
  try {
    const raw = localStorage.getItem(SAVED_USER_KEY);
    if (raw) initialUser = JSON.parse(raw);
  } catch {}

  // Find corresponding driver state if driver
  let initialDriverState: DriverLiveState | null = null;
  if (initialUser && initialUser.role === 'driver') {
    const match = SEEDED_DRIVERS.find((d) => d.uid === initialUser!.uid);
    if (match) {
      initialDriverState = match;
    } else {
      initialDriverState = {
        uid: initialUser.uid,
        name: initialUser.name,
        phone: initialUser.phone,
        vehicleType: initialUser.vehicleType || 'sedan',
        vehicleNumber: initialUser.vehicleNumber || 'KA01AB1234',
        vehicleModel: initialUser.vehicleModel || 'White Sedan',
        isOnline: false,
        verificationStatus: 'PENDING',
        rating: 5.0,
        totalRides: 0,
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 10,
        lastLocationUpdate: new Date().toISOString(),
      };
    }
  }

  // Cross-tab sync handler
  if (broadcast) {
    broadcast.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (!type) return;

      if (type === 'RIDE_UPDATED') {
        const ride = payload as Ride;
        set((state) => ({
          rides: { ...state.rides, [ride.id]: ride },
        }));
      } else if (type === 'DRIVER_GPS') {
        const driver = payload as DriverLiveState;
        set((state) => {
          const updated = state.onlineDrivers.map((d) => (d.uid === driver.uid ? driver : d));
          if (!updated.some((d) => d.uid === driver.uid) && driver.isOnline) {
            updated.push(driver);
          }
          return {
            onlineDrivers: updated,
            driverState: state.driverState?.uid === driver.uid ? driver : state.driverState,
          };
        });
      } else if (type === 'SOS_ALERT') {
        const alert = payload as EmergencyAlert;
        set((state) => {
          const existing = state.emergencyAlerts.find((a) => a.id === alert.id);
          const alerts = existing
            ? state.emergencyAlerts.map((a) => (a.id === alert.id ? alert : a))
            : [alert, ...state.emergencyAlerts];
          return { emergencyAlerts: alerts, activeSosAlertId: alert.id };
        });
      } else if (type === 'SOS_RESOLVED') {
        const { alertId, resolvedAt, reason } = payload || {};
        set((state) => ({
          emergencyAlerts: state.emergencyAlerts.map((a) =>
            a.id === alertId ? { ...a, status: 'RESOLVED', resolvedAt, notes: reason } : a
          ),
          activeSosAlertId: state.activeSosAlertId === alertId ? null : state.activeSosAlertId,
        }));
      } else if (type === 'RIDER_GPS_UPDATE') {
        const { rideId, riderGps, trackingToken } = payload || {};
        set((state) => {
          const ride = state.rides[rideId];
          const tokens = { ...state.trackingTokens };
          if (trackingToken && tokens[trackingToken]) {
            tokens[trackingToken] = {
              ...tokens[trackingToken],
              riderCurrentGps: riderGps,
              lastUpdated: riderGps?.timestamp,
            };
          }
          return {
            rides: ride ? { ...state.rides, [rideId]: { ...ride, riderCurrentGps: riderGps } } : state.rides,
            trackingTokens: tokens,
          };
        });
      } else if (type === 'TRACKING_REVOKED') {
        const { tokenHash } = payload || {};
        set((state) => {
          if (!state.trackingTokens[tokenHash]) return state;
          return {
            trackingTokens: {
              ...state.trackingTokens,
              [tokenHash]: { ...state.trackingTokens[tokenHash], isRevoked: true },
            },
          };
        });
      } else if (type === 'TRACKING_TOKEN_CREATED') {
        const tokenData = payload as TrackingTokenData;
        if (tokenData?.tokenHash) {
          set((state) => ({
            trackingTokens: {
              ...state.trackingTokens,
              [tokenData.tokenHash]: tokenData,
            },
          }));
        }
      } else if (type === 'FRAUD_REPORT') {
        const report = payload as FraudReport;
        set((state) => ({
          fraudReports: { ...state.fraudReports, [report.rideId]: report },
        }));
      }
    };
  }

  return {
    user: initialUser,
    authLoading: false,
    setUser: (u) => {
      if (u) {
        localStorage.setItem(SAVED_USER_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(SAVED_USER_KEY);
      }
      set({ user: u });
    },

    login: async (email, pass) => {
      const cleanEmail = email.trim().toLowerCase();

      // Check real Firebase first if configured
      if (isFirebaseConfigured() && auth && db) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
          const snap = await getDoc(doc(db, 'users', cred.user.uid));
          if (snap.exists()) {
            const profile = snap.data() as UserProfile;
            get().setUser(profile);
            return { success: true };
          }
        } catch (err: any) {
          // If not in firebase, check seeded demo accounts below
          console.warn('Firebase login attempt:', err?.message);
        }
      }

      // Check seeded demo accounts
      const seeded = SEEDED_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
      if (seeded) {
        get().setUser(seeded);
        if (seeded.role === 'driver') {
          const dMatch = SEEDED_DRIVERS.find((d) => d.uid === seeded.uid) || {
            uid: seeded.uid,
            name: seeded.name,
            phone: seeded.phone,
            vehicleType: seeded.vehicleType || 'sedan',
            vehicleNumber: seeded.vehicleNumber || 'DL01AB9876',
            vehicleModel: seeded.vehicleModel || 'Honda City',
            isOnline: true,
            verificationStatus: 'VERIFIED',
            rating: 4.9,
            totalRides: 120,
            lat: 12.9716,
            lng: 77.5946,
            lastLocationUpdate: new Date().toISOString(),
          };
          set({ driverState: dMatch });
        }
        return { success: true };
      }

      // Fallback for custom registered accounts
      return { success: false, error: 'Invalid credentials. Try a demo account or sign up.' };
    },

    signupRider: async (data) => {
      const uid = 'rider_' + Date.now();
      const profile: UserProfile = {
        uid,
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: 'rider',
        createdAt: new Date().toISOString(),
        trustedContact: data.trustedContact,
      };

      if (isFirebaseConfigured() && auth && db) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, data.email, data.pass);
          const fbProfile = { ...profile, uid: cred.user.uid };
          await setDoc(doc(db, 'users', cred.user.uid), fbProfile);
          get().setUser(fbProfile);
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }

      // Local / preview signup
      get().setUser(profile);
      return { success: true };
    },

    signupDriver: async (data) => {
      const uid = 'driver_' + Date.now();
      const profile: UserProfile = {
        uid,
        email: data.email.trim().toLowerCase(),
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: 'driver',
        createdAt: new Date().toISOString(),
        vehicleType: data.vehicleType,
        vehicleNumber: data.vehicleNumber.toUpperCase().trim(),
        vehicleModel: data.vehicleModel.trim(),
      };

      const dState: DriverLiveState = {
        uid,
        name: data.name.trim(),
        phone: data.phone.trim(),
        vehicleType: data.vehicleType,
        vehicleNumber: data.vehicleNumber.toUpperCase().trim(),
        vehicleModel: data.vehicleModel.trim(),
        isOnline: false,
        verificationStatus: 'PENDING',
        rating: 5.0,
        totalRides: 0,
        lat: 12.9716,
        lng: 77.5946,
        lastLocationUpdate: new Date().toISOString(),
      };

      if (isFirebaseConfigured() && auth && db) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, data.email, data.pass);
          const fbProfile = { ...profile, uid: cred.user.uid };
          const fbDState = { ...dState, uid: cred.user.uid };
          await setDoc(doc(db, 'users', cred.user.uid), fbProfile);
          await setDoc(doc(db, 'drivers', cred.user.uid), fbDState);
          get().setUser(fbProfile);
          set({ driverState: fbDState });
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }

      get().setUser(profile);
      set({ driverState: dState });
      return { success: true };
    },

    logout: async () => {
      if (isFirebaseConfigured() && auth) {
        try {
          await fbSignOut(auth);
        } catch {}
      }
      get().setUser(null);
      set({ driverState: null, activeRideId: null, driverActiveRideId: null });
    },

    updateUserProfile: async (data) => {
      const u = get().user;
      if (!u) return;
      const updated = { ...u, ...data };
      get().setUser(updated);

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'users', u.uid), data as any);
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Driver Live State
    driverState: initialDriverState,
    onlineDrivers: [...SEEDED_DRIVERS],
    driverDocuments: { ...SEEDED_DOCUMENTS },

    setDriverOnline: async (isOnline) => {
      const state = get().driverState;
      if (!state) return { success: false, error: 'Driver not found' };

      // Strictly enforce: driver cannot go online unless verificationStatus == "VERIFIED"
      if (isOnline && state.verificationStatus !== 'VERIFIED') {
        return {
          success: false,
          error: `Cannot go online. Driver verification status is "${state.verificationStatus}". Only VERIFIED drivers can go online.`,
        };
      }

      const updated = {
        ...state,
        isOnline,
        lastLocationUpdate: new Date().toISOString(),
      };

      set((s) => ({
        driverState: updated,
        onlineDrivers: isOnline
          ? [...s.onlineDrivers.filter((d) => d.uid !== state.uid), updated]
          : s.onlineDrivers.filter((d) => d.uid !== state.uid),
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'DRIVER_GPS', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'drivers', state.uid), {
            isOnline,
            lastLocationUpdate: new Date().toISOString(),
          });
        } catch (e) {
          console.error(e);
        }
      }

      return { success: true };
    },

    updateDriverGps: async (gps) => {
      const state = get().driverState;
      if (!state) return;

      const updated: DriverLiveState = {
        ...state,
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy ?? state.accuracy,
        speed: gps.speed ?? state.speed,
        heading: gps.heading ?? state.heading,
        lastLocationUpdate: new Date().toISOString(),
      };

      set((s) => ({
        driverState: updated,
        onlineDrivers: s.onlineDrivers.map((d) => (d.uid === state.uid ? updated : d)),
      }));

      // If driver is currently on an active ride, update ride currentGps & append to gpsLogs
      const activeRideId = get().driverActiveRideId;
      if (activeRideId) {
        const ride = get().rides[activeRideId];
        if (ride && ride.status === 'RIDE_STARTED') {
          const logPoint: GpsLogPoint = {
            lat: gps.lat,
            lng: gps.lng,
            accuracy: gps.accuracy || 10,
            speed: gps.speed || 0,
            heading: gps.heading || 0,
            timestamp: new Date().toISOString(),
            recordedAt: Date.now(),
          };

          set((s) => ({
            rideGpsLogs: {
              ...s.rideGpsLogs,
              [activeRideId]: [...(s.rideGpsLogs[activeRideId] || []), logPoint],
            },
            rides: {
              ...s.rides,
              [activeRideId]: {
                ...ride,
                currentGps: {
                  lat: gps.lat,
                  lng: gps.lng,
                  heading: gps.heading,
                  speed: gps.speed,
                  timestamp: new Date().toISOString(),
                },
              },
            },
          }));
        }
      }

      if (broadcast) {
        broadcast.postMessage({ type: 'DRIVER_GPS', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'drivers', state.uid), {
            lat: gps.lat,
            lng: gps.lng,
            accuracy: gps.accuracy ?? 10,
            speed: gps.speed ?? 0,
            heading: gps.heading ?? 0,
            lastLocationUpdate: new Date().toISOString(),
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    uploadDriverDocuments: async (docs) => {
      set((s) => ({
        driverDocuments: { ...s.driverDocuments, [docs.driverId]: docs },
        driverState: s.driverState ? { ...s.driverState, verificationStatus: 'UNDER_REVIEW' } : null,
      }));

      if (isFirebaseConfigured() && db) {
        try {
          await setDoc(doc(db, 'driverDocuments', docs.driverId), docs);
          await updateDoc(doc(db, 'drivers', docs.driverId), {
            verificationStatus: 'UNDER_REVIEW',
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    verifyDriverByAdmin: async (driverId, status, reason) => {
      set((s) => {
        const d = s.onlineDrivers.find((item) => item.uid === driverId);
        const updatedDrivers = s.onlineDrivers.map((item) =>
          item.uid === driverId ? { ...item, verificationStatus: status, rejectionReason: reason } : item
        );
        return {
          onlineDrivers: updatedDrivers,
          driverState: s.driverState?.uid === driverId
            ? { ...s.driverState, verificationStatus: status, rejectionReason: reason, isOnline: status === 'VERIFIED' ? s.driverState.isOnline : false }
            : s.driverState,
        };
      });

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'drivers', driverId), {
            verificationStatus: status,
            rejectionReason: reason || null,
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Rides & Lifecycle
    rides: {},
    activeRideId: null,
    driverActiveRideId: null,
    rideGpsLogs: {},

    createRideRequest: async (rideData) => {
      const id = 'ride_' + Math.random().toString(36).substring(2, 9);
      const newRide: Ride = {
        ...rideData,
        id,
        status: 'REQUESTED',
        requestedAt: new Date().toISOString(),
      };

      set((s) => ({
        rides: { ...s.rides, [id]: newRide },
        activeRideId: id,
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: newRide });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await setDoc(doc(db, 'rides', id), newRide);
        } catch (e) {
          console.error(e);
        }
      }

      // Check matching drivers
      // VERIFIED, online, right vehicle type, location updated in last 30s, within 5 km
      const drivers = get().onlineDrivers.filter((d) => {
        if (!d.isOnline || d.verificationStatus !== 'VERIFIED') return false;
        if (d.vehicleType !== newRide.vehicleType) return false;
        const dist = haversineDistance(d.lat, d.lng, newRide.pickup.lat, newRide.pickup.lng);
        return dist <= 5.0;
      });

      // If matching drivers found in demo/preview, notify or auto-assign nearest driver
      if (drivers.length > 0) {
        // Find nearest
        const sorted = [...drivers].sort((a, b) => {
          const dA = haversineDistance(a.lat, a.lng, newRide.pickup.lat, newRide.pickup.lng);
          const dB = haversineDistance(b.lat, b.lng, newRide.pickup.lat, newRide.pickup.lng);
          return dA - dB;
        });

        // Set as candidate for driver active ride if logged in as that driver
        const currentDriver = get().driverState;
        if (currentDriver && currentDriver.uid === sorted[0].uid) {
          set({ driverActiveRideId: id });
        }
      }

      return id;
    },

    createPrebookedRide: async (rideData) => {
      const id = 'ride_sched_' + Math.random().toString(36).substring(2, 9);
      const newRide: Ride = {
        ...rideData,
        id,
        status: 'SCHEDULED',
        bookingType: 'PREBOOKED',
        requestedAt: new Date().toISOString(),
      };

      // Safe isolated storage: do NOT set activeRideId or start driver search/tracking/SOS
      set((s) => ({
        rides: { ...s.rides, [id]: newRide },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: newRide });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await setDoc(doc(db, 'rides', id), newRide);
        } catch (e) {
          console.error(e);
        }
      }

      get().addNotification({
        title: 'Ride Scheduled Successfully',
        message: `Your ride for ${rideData.scheduledDate} at ${rideData.scheduledTime} is confirmed. Driver search starts 30 mins before travel.`,
        type: 'success',
      });

      return id;
    },

    cancelScheduledRide: async (rideId, reason) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'SCHEDULED') return;

      const updated: Ride = {
        ...ride,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'rider',
        cancellationReason: reason || 'Cancelled by rider',
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'CANCELLED',
            cancelledAt: updated.cancelledAt,
            cancelledBy: 'rider',
            cancellationReason: reason,
          });
        } catch (e) {
          console.error(e);
        }
      }

      get().addNotification({
        title: 'Scheduled Ride Cancelled',
        message: `Your scheduled ride on ${ride.scheduledDate} was cancelled (${reason}).`,
        type: 'info',
      });
    },

    promoteScheduledRide: async (rideId) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'SCHEDULED') return;

      // Re-check fare against surge cap
      const activeRequestsCount = Object.values(get().rides).filter((r) => r.status === 'REQUESTED').length + 1;
      const verifiedOnlineDrivers = get().onlineDrivers.filter(
        (d) => d.isOnline && d.verificationStatus === 'VERIFIED'
      ).length;
      const rawDemandRatio = (activeRequestsCount / Math.max(1, verifiedOnlineDrivers)) * (get().isPeakDemandSimulated ? 2.5 : 1.0);
      const currentFare = calculateFare(
        ride.vehicleType,
        ride.estimatedDistanceKm || 5.0,
        ride.estimatedDurationMin || 15,
        rawDemandRatio,
        get().pricing[ride.vehicleType]
      );

      const promoted: Ride = {
        ...ride,
        status: 'REQUESTED',
        searchStartedAt: new Date().toISOString(),
        finalFare: currentFare.finalFare,
        surgePercentage: currentFare.appliedSurgePercent,
        surgeAmount: currentFare.surgeAmount,
        fareBreakdown: currentFare,
      };

      const isCurrentRider = get().user?.uid === ride.riderId;
      set((s) => ({
        rides: { ...s.rides, [rideId]: promoted },
        activeRideId: isCurrentRider && !s.activeRideId ? rideId : s.activeRideId,
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: promoted });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'REQUESTED',
            searchStartedAt: promoted.searchStartedAt,
            finalFare: promoted.finalFare,
            surgePercentage: promoted.surgePercentage,
            surgeAmount: promoted.surgeAmount,
            fareBreakdown: promoted.fareBreakdown,
          });
        } catch (e) {
          console.error(e);
        }
      }

      get().addNotification({
        title: 'Driver Search Started',
        message: `Driver search started for your scheduled ride to ${ride.destination.name || ride.destination.address}.`,
        type: 'info',
      });

      // Match nearest driver using existing driver matching
      const drivers = get().onlineDrivers.filter((d) => {
        if (!d.isOnline || d.verificationStatus !== 'VERIFIED') return false;
        if (d.vehicleType !== promoted.vehicleType) return false;
        const dist = haversineDistance(d.lat, d.lng, promoted.pickup.lat, promoted.pickup.lng);
        return dist <= 5.0;
      });

      if (drivers.length > 0) {
        const sorted = [...drivers].sort((a, b) => {
          const dA = haversineDistance(a.lat, a.lng, promoted.pickup.lat, promoted.pickup.lng);
          const dB = haversineDistance(b.lat, b.lng, promoted.pickup.lat, promoted.pickup.lng);
          return dA - dB;
        });
        const currentDriver = get().driverState;
        if (currentDriver && currentDriver.uid === sorted[0].uid) {
          set({ driverActiveRideId: rideId });
        }
      }
    },

    markNoDriverFound: async (rideId) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'REQUESTED') return;

      const updated: Ride = {
        ...ride,
        status: 'NO_DRIVER_FOUND',
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      get().addNotification({
        title: 'No Driver Found',
        message: `We could not find an available driver for your scheduled ride on ${ride.scheduledDate}. Please try requesting again.`,
        type: 'warning',
      });
    },

    fastForwardScheduledRide: async (rideId) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'SCHEDULED') return;

      const fastForwardTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const updated: Ride = {
        ...ride,
        scheduledAt: fastForwardTime,
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      await get().promoteScheduledRide(rideId);
    },

    activationWindowMinutes: 30,
    setActivationWindowMinutes: (mins) => {
      set({ activationWindowMinutes: mins });
    },

    cancelRide: async (rideId, reason) => {
      const ride = get().rides[rideId];
      if (!ride) return;

      const updated: Ride = {
        ...ride,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancellationReason: reason || 'Cancelled by rider',
      };

      // Stop trusted-contact live sharing immediately: revoke tracking token
      if (ride.trackingToken) {
        await get().revokeTrackingToken(ride.trackingToken);
      }

      // If active SOS exists for this ride, mark it resolved
      if (ride.activeSosAlertId) {
        await get().stopSos(ride.activeSosAlertId, `Ride was cancelled: ${reason || 'Cancelled'}`);
      }

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
        activeRideId: s.activeRideId === rideId ? null : s.activeRideId,
        driverActiveRideId: s.driverActiveRideId === rideId ? null : s.driverActiveRideId,
      }));

      get().addNotification({
        title: 'Ride Cancelled',
        message: `Ride #${rideId.slice(-6)} was cancelled: ${reason || 'Cancelled by user'}`,
        type: 'info',
        rideId,
      });

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString(),
            cancellationReason: reason || 'Cancelled by rider',
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    driverAcceptRide: async (rideId, driver) => {
      // Atomic guard: check if ride is still in REQUESTED state
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'REQUESTED') {
        return { success: false, error: 'Ride request is no longer available or was accepted by another driver.' };
      }

      const updated: Ride = {
        ...ride,
        status: 'DRIVER_ASSIGNED',
        driverId: driver.uid,
        driverName: driver.name,
        driverPhone: driver.phone,
        driverVehicleNumber: driver.vehicleNumber,
        driverVehicleModel: driver.vehicleModel,
        driverRating: driver.rating,
        acceptedAt: new Date().toISOString(),
        currentGps: {
          lat: driver.lat,
          lng: driver.lng,
          heading: driver.heading,
          speed: driver.speed,
          timestamp: new Date().toISOString(),
        },
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
        driverActiveRideId: rideId,
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        const firestore = db;
        try {
          await runTransaction(firestore, async (txn) => {
            const rideRef = doc(firestore, 'rides', rideId);
            const snap = await txn.get(rideRef);
            if (!snap.exists() || snap.data().status !== 'REQUESTED') {
              throw new Error('Ride already taken');
            }
            txn.update(rideRef, {
              status: 'DRIVER_ASSIGNED',
              driverId: driver.uid,
              driverName: driver.name,
              driverPhone: driver.phone,
              driverVehicleNumber: driver.vehicleNumber,
              driverVehicleModel: driver.vehicleModel,
              driverRating: driver.rating,
              acceptedAt: new Date().toISOString(),
            });
          });
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      }

      return { success: true };
    },

    driverArrivedAtPickup: async (rideId) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'DRIVER_ASSIGNED') return;

      const updated: Ride = {
        ...ride,
        status: 'DRIVER_ARRIVED',
        driverArrivedAt: new Date().toISOString(),
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'DRIVER_ARRIVED',
            driverArrivedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    driverStartRide: async (rideId, driverLocation) => {
      const ride = get().rides[rideId];
      if (!ride) return { success: false, error: 'Ride not found' };

      // Strictly enforce: Driver can start the ride ONLY within 200 m of the pickup
      const within200m = isWithinRadius(driverLocation, ride.pickup, 200);
      if (!within200m) {
        const distM = Math.round(haversineDistance(driverLocation.lat, driverLocation.lng, ride.pickup.lat, ride.pickup.lng) * 1000);
        return {
          success: false,
          error: `Driver must be within 200m of pickup to start ride. You are currently ${distM}m away.`,
        };
      }

      // Automatically generate live tracking link if sharing enabled
      let trackingTokenHash = ride.trackingToken;
      const riderUser = get().user;
      const liveSharingEnabled = riderUser?.liveSharingEnabled !== false;
      if (liveSharingEnabled && !trackingTokenHash) {
        trackingTokenHash = await get().createTrackingToken(rideId, ride.riderName.split(' ')[0] || 'Rider');
      }

      const updated: Ride = {
        ...ride,
        status: 'RIDE_STARTED',
        startedAt: new Date().toISOString(),
        trackingToken: trackingTokenHash,
      };

      // Seed initial GPS log point
      const initialGps: GpsLogPoint = {
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        accuracy: 8,
        speed: 0,
        heading: 0,
        timestamp: new Date().toISOString(),
        recordedAt: Date.now(),
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
        rideGpsLogs: {
          ...s.rideGpsLogs,
          [rideId]: [initialGps],
        },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'RIDE_STARTED',
            startedAt: new Date().toISOString(),
            trackingToken: trackingTokenHash || null,
          });
        } catch (e) {
          console.error(e);
        }
      }

      return { success: true };
    },

    driverCompleteRide: async (rideId) => {
      const ride = get().rides[rideId];
      if (!ride || ride.status !== 'RIDE_STARTED') return;

      const updated: Ride = {
        ...ride,
        status: 'RIDE_COMPLETED',
        completedAt: new Date().toISOString(),
      };

      // Stop trusted-contact live sharing automatically on completion
      if (ride.trackingToken) {
        await get().revokeTrackingToken(ride.trackingToken);
      }

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      // GPS Fraud Analysis Engine Execution
      const logs = get().rideGpsLogs[rideId] || [];
      const report = analyzeRideGpsLogs({
        rideId,
        driverId: ride.driverId || 'unknown',
        riderId: ride.riderId,
        driverName: ride.driverName,
        riderName: ride.riderName,
        vehicleType: ride.vehicleType,
        expectedDistanceKm: ride.estimatedDistanceKm,
        gpsPoints: logs,
        routeCoordinates: ride.routeGeometry?.coordinates as [number, number][],
      });

      set((s) => ({
        fraudReports: { ...s.fraudReports, [rideId]: report },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
        broadcast.postMessage({ type: 'FRAUD_REPORT', payload: report });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'RIDE_COMPLETED',
            completedAt: new Date().toISOString(),
          });
          await setDoc(doc(db, 'fraudReports', rideId), report);
        } catch (e) {
          console.error(e);
        }
      }
    },

    completePayment: async (rideId, method) => {
      const ride = get().rides[rideId];
      if (!ride) return;

      const updated: Ride = {
        ...ride,
        status: 'PAYMENT_COMPLETED',
        paymentMethod: method,
        paymentStatus: 'COMPLETED',
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'RIDE_UPDATED', payload: updated });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            status: 'PAYMENT_COMPLETED',
            paymentMethod: method,
            paymentStatus: 'COMPLETED',
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    rateRide: async (rideId, rating, feedback) => {
      const ride = get().rides[rideId];
      if (!ride) return;

      const updated: Ride = {
        ...ride,
        riderRating: rating,
        riderFeedback: feedback,
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            riderRating: rating,
            riderFeedback: feedback || null,
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    driverRateRider: async (rideId, score) => {
      const ride = get().rides[rideId];
      if (!ride) return;

      const updated: Ride = {
        ...ride,
        driverRatingScore: score,
      };

      set((s) => ({
        rides: { ...s.rides, [rideId]: updated },
      }));

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'rides', rideId), {
            driverRatingScore: score,
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Pricing Admin
    pricing: { ...DEFAULT_PRICING },
    updatePricing: async (vehicleType, config) => {
      set((s) => ({
        pricing: {
          ...s.pricing,
          [vehicleType]: { ...s.pricing[vehicleType], ...config },
        },
      }));

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'pricing', vehicleType), config as any);
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Emergency SOS
    emergencyAlerts: [
      {
        id: 'sos_rec_active_01',
        rideId: 'ride_in_progress_712',
        riderId: 'rider_usr_001',
        riderName: 'Aarav Sharma',
        riderPhone: '+91 98220 12345',
        driverId: 'driver_usr_001',
        driverName: 'Rajesh Kumar Verma',
        driverPhone: '+91 98110 54321',
        lat: 12.9716,
        lng: 77.5946,
        accuracy: 12,
        timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        status: 'ACTIVE',
        liveTrackingUrl: `${window.location.origin}/track/demo_active_token`,
      },
      {
        id: 'sos_rec_resolved_02',
        rideId: 'ride_archived_884',
        riderId: 'rider_usr_002',
        riderName: 'Ananya Deshmukh',
        riderPhone: '+91 98233 45678',
        driverId: 'driver_usr_002',
        driverName: 'Manoj Santosh Patil',
        driverPhone: '+91 97654 32190',
        lat: 12.9352,
        lng: 77.6245,
        accuracy: 8,
        timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
        notes: 'Rider confirmed situation is resolved. Driver was verified and safe.',
        stopReason: 'Rider confirmed safe',
        liveTrackingUrl: `${window.location.origin}/track/demo_resolved_token`,
      },
    ],
    activeSosAlertId: 'sos_rec_active_01',
    triggerSos: async (rideId, lat, lng, accuracy) => {
      const id = 'sos_' + Date.now();
      const user = get().user;
      const ride = get().rides[rideId];

      // Ensure a live tracking link is active
      let tokenHash = ride?.trackingToken;
      if (!tokenHash) {
        tokenHash = await get().createTrackingToken(rideId, user?.name?.split(' ')[0] || 'Rider');
      }
      const liveTrackingUrl = `${window.location.origin}/track/${tokenHash}`;

      const alert: EmergencyAlert = {
        id,
        rideId,
        riderId: user?.uid || 'unknown',
        riderName: user?.name || 'Rider in distress',
        riderPhone: user?.phone || '',
        driverId: ride?.driverId,
        driverName: ride?.driverName,
        driverPhone: ride?.driverPhone,
        lat,
        lng,
        accuracy,
        timestamp: new Date().toISOString(),
        status: 'ACTIVE',
        liveTrackingUrl,
      };

      set((s) => ({
        emergencyAlerts: [alert, ...s.emergencyAlerts],
        activeSosAlertId: id,
        rides: ride
          ? {
              ...s.rides,
              [rideId]: {
                ...ride,
                activeSosAlertId: id,
                trackingToken: tokenHash,
              },
            }
          : s.rides,
      }));

      get().addNotification({
        title: 'Emergency SOS Broadcast Active',
        message: 'Coordinates transmitted to Safety Center. Trusted contacts notified.',
        type: 'emergency',
        rideId,
      });

      if (broadcast) {
        broadcast.postMessage({ type: 'SOS_ALERT', payload: alert });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await setDoc(doc(db, 'emergencyAlerts', id), alert);
          if (ride) {
            await updateDoc(doc(db, 'rides', rideId), {
              activeSosAlertId: id,
              trackingToken: tokenHash,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      return id;
    },

    stopSos: async (alertId, reason) => {
      const alert = get().emergencyAlerts.find((a) => a.id === alertId);
      const rideId = alert?.rideId;
      const ride = rideId ? get().rides[rideId] : undefined;
      const resolvedTimestamp = new Date().toISOString();

      // Expire the secure tracking token immediately
      if (ride?.trackingToken) {
        await get().revokeTrackingToken(ride.trackingToken);
      }

      set((s) => ({
        emergencyAlerts: s.emergencyAlerts.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status: 'RESOLVED',
                resolvedAt: resolvedTimestamp,
                notes: reason || 'Rider pressed STOP SOS and confirmed safety',
                stopReason: reason || 'Rider confirmed STOP SOS',
              }
            : a
        ),
        activeSosAlertId: null,
        rides:
          rideId && s.rides[rideId]
            ? {
                ...s.rides,
                [rideId]: { ...s.rides[rideId], activeSosAlertId: undefined, trackingToken: undefined },
              }
            : s.rides,
      }));

      get().addNotification({
        title: 'SOS Emergency Resolved',
        message: 'Distress broadcast concluded. Safety center updated.',
        type: 'info',
        rideId,
      });

      if (broadcast) {
        broadcast.postMessage({
          type: 'SOS_RESOLVED',
          payload: { alertId, resolvedAt: resolvedTimestamp, reason },
        });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'emergencyAlerts', alertId), {
            status: 'RESOLVED',
            resolvedAt: resolvedTimestamp,
            notes: reason || 'Rider pressed STOP SOS',
          });
          if (rideId) {
            await updateDoc(doc(db, 'rides', rideId), {
              activeSosAlertId: null,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    },

    updateSosLocation: async (alertId, lat, lng, accuracy) => {
      set((s) => ({
        emergencyAlerts: s.emergencyAlerts.map((a) =>
          a.id === alertId ? { ...a, lat, lng, accuracy, timestamp: new Date().toISOString() } : a
        ),
      }));

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'emergencyAlerts', alertId), {
            lat,
            lng,
            accuracy,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    resolveSosAlert: async (alertId, notes) => {
      await get().stopSos(alertId, notes || 'Admin marked as resolved');
    },

    // Trusted Contact Safety & Location
    showSafetyModal: false,
    setShowSafetyModal: (show) => set({ showSafetyModal: show }),

    saveSafetySettings: async (settings) => {
      const u = get().user;
      if (!u) return;

      const updatedUser: UserProfile = {
        ...u,
        trustedContact: settings.primaryContact,
        secondaryContact: settings.secondaryContact,
        liveSharingEnabled: settings.liveSharingEnabled,
        emergencyConsentGiven: settings.consentGiven,
        hasCompletedSafetySetup: true,
      };

      get().setUser(updatedUser);

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'users', u.uid), {
            trustedContact: settings.primaryContact,
            secondaryContact: settings.secondaryContact || null,
            liveSharingEnabled: settings.liveSharingEnabled,
            emergencyConsentGiven: settings.consentGiven,
            hasCompletedSafetySetup: true,
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    removeTrustedContact: async (isSecondary) => {
      const u = get().user;
      if (!u) return;

      const updatedUser: UserProfile = {
        ...u,
        ...(isSecondary
          ? { secondaryContact: undefined }
          : { trustedContact: undefined }),
      };

      get().setUser(updatedUser);

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'users', u.uid), {
            ...(isSecondary ? { secondaryContact: null } : { trustedContact: null }),
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    updateRiderGpsOnRide: async (rideId, gps) => {
      const ride = get().rides[rideId];
      if (!ride) return;

      const now = new Date().toISOString();
      const riderGps = {
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy || 10,
        timestamp: now,
      };

      const updatedRide: Ride = {
        ...ride,
        riderCurrentGps: riderGps,
      };

      let updatedTokens = { ...get().trackingTokens };
      if (ride.trackingToken && updatedTokens[ride.trackingToken]) {
        updatedTokens[ride.trackingToken] = {
          ...updatedTokens[ride.trackingToken],
          riderCurrentGps: riderGps,
          lastUpdated: now,
        };
      }

      set((s) => ({
        rides: { ...s.rides, [rideId]: updatedRide },
        trackingTokens: updatedTokens,
      }));

      if (ride.activeSosAlertId) {
        get().updateSosLocation(ride.activeSosAlertId, gps.lat, gps.lng, gps.accuracy || 10);
      }

      if (broadcast) {
        broadcast.postMessage({
          type: 'RIDER_GPS_UPDATE',
          payload: { rideId, riderGps, trackingToken: ride.trackingToken },
        });
      }
    },

    // Trusted Contact Tracking
    trackingTokens: {},
    createTrackingToken: async (rideId, riderFirstName) => {
      // Create 32+ bytes cryptographic random token
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');

      // Hash with SHA-256 for secure storage lookup
      const msgUint8 = new TextEncoder().encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const tokenData: TrackingTokenData = {
        tokenHash,
        rideId,
        riderId: get().user?.uid || '',
        riderFirstName,
        expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(), // 6 hours
        isRevoked: false,
        createdAt: new Date().toISOString(),
      };

      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('arohana_tracking_' + tokenHash, JSON.stringify(tokenData));
        } catch (e) {}
      }

      set((s) => ({
        trackingTokens: { ...s.trackingTokens, [tokenHash]: tokenData },
      }));

      if (broadcast) {
        broadcast.postMessage({ type: 'TRACKING_TOKEN_CREATED', payload: tokenData });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await setDoc(doc(db, 'trackingTokens', tokenHash), tokenData);
        } catch (e) {
          console.error(e);
        }
      }

      return tokenHash;
    },

    revokeTrackingToken: async (tokenHash) => {
      set((s) => {
        const item = s.trackingTokens[tokenHash];
        if (!item) return s;
        const updatedItem = { ...item, isRevoked: true };
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('arohana_tracking_' + tokenHash, JSON.stringify(updatedItem));
          } catch (e) {}
        }
        return {
          trackingTokens: {
            ...s.trackingTokens,
            [tokenHash]: updatedItem,
          },
        };
      });

      if (broadcast) {
        broadcast.postMessage({ type: 'TRACKING_REVOKED', payload: { tokenHash } });
      }

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'trackingTokens', tokenHash), { isRevoked: true });
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Fraud Reports
    fraudReports: {},
    updateFraudStatus: async (rideId, status, notes) => {
      set((s) => {
        const rep = s.fraudReports[rideId];
        if (!rep) return s;
        return {
          fraudReports: {
            ...s.fraudReports,
            [rideId]: { ...rep, status, adminNotes: notes },
          },
        };
      });

      if (isFirebaseConfigured() && db) {
        try {
          await updateDoc(doc(db, 'fraudReports', rideId), {
            status,
            adminNotes: notes || null,
          });
        } catch (e) {
          console.error(e);
        }
      }
    },

    // Notifications
    notifications: [],
    addNotification: (notif) => {
      const id = 'notif_' + Date.now();
      const newNotif: InAppNotification = {
        ...notif,
        id,
        timestamp: new Date().toISOString(),
        read: false,
      };
      set((s) => ({ notifications: [newNotif, ...s.notifications] }));
    },
    markNotificationRead: (id) => {
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },

    // Demo Controls
    demoMode: true,
    pcDemoCallMode: true,
    togglePcDemoCallMode: () => {
      set((s) => ({ pcDemoCallMode: !s.pcDemoCallMode }));
    },
    setPcDemoCallMode: (val) => {
      set({ pcDemoCallMode: val });
    },
    isPeakDemandSimulated: false,
    togglePeakDemand: () => {
      set((s) => ({ isPeakDemandSimulated: !s.isPeakDemandSimulated }));
    },
    simulateGpsAnomaly: false,
    toggleSimulateGpsAnomaly: () => {
      set((s) => ({ simulateGpsAnomaly: !s.simulateGpsAnomaly }));
    },
    simulateDriverMovement: false,
    toggleSimulateDriverMovement: () => {
      set((s) => ({ simulateDriverMovement: !s.simulateDriverMovement }));
    },
    resetDemoRide: () => {
      set({
        activeRideId: null,
        driverActiveRideId: null,
      });
    },
  };
});
