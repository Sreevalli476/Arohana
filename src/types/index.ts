export type UserRole = 'rider' | 'driver' | 'admin';

export type VehicleType = 'bike' | 'auto' | 'sedan' | 'suv';

export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RE_UPLOAD';

export interface TrustedContact {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  trustedContact?: TrustedContact;
  secondaryContact?: TrustedContact;
  liveSharingEnabled?: boolean;
  emergencyConsentGiven?: boolean;
  hasCompletedSafetySetup?: boolean;
  // Driver specific fields
  vehicleType?: VehicleType;
  vehicleNumber?: string;
  vehicleModel?: string;
}

export interface DriverLiveState {
  uid: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  vehicleModel: string;
  isOnline: boolean;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  rating: number;
  totalRides: number;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number; // km/h
  heading?: number; // degrees
  lastLocationUpdate: string;
}

export interface DocumentOCRResult {
  docType: 'govtId' | 'dl' | 'rc' | 'insurance';
  rawText: string;
  extractedName?: string;
  extractedNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  vehicleNumber?: string;
  isExpired?: boolean;
  isValidFormat?: boolean;
}

export interface DriverDocuments {
  driverId: string;
  govtIdBase64?: string;
  dlBase64?: string;
  rcBase64?: string;
  insuranceBase64?: string;
  ocrExtracted: {
    govtId?: { name?: string; idNumber?: string; rawText?: string };
    dl?: { name?: string; dlNumber?: string; expiryDate?: string; isExpired?: boolean; rawText?: string };
    rc?: { ownerName?: string; vehicleNumber?: string; registrationDate?: string; rawText?: string };
    insurance?: { policyNumber?: string; expiryDate?: string; isExpired?: boolean; rawText?: string };
  };
  validationSummary: {
    namesMatch: boolean;
    vehicleNumberMatchesRC: boolean;
    dlNotExpired: boolean;
    insuranceNotExpired: boolean;
    autoCheckPassed: boolean;
    flags: string[];
  };
  uploadedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  address: string;
  name?: string;
}

export type RideStatus =
  | 'REQUESTED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'DRIVER_ARRIVED'
  | 'RIDE_STARTED'
  | 'RIDE_COMPLETED'
  | 'PAYMENT_COMPLETED'
  | 'CANCELLED'
  | 'SCHEDULED'
  | 'NO_DRIVER_FOUND';

export interface PricingConfig {
  vehicleType: VehicleType;
  name: string;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  maxSurgeCapPercent: number; // e.g. 25 means maximum 25% surge
  demandThresholdRatio: number; // e.g. 1.2
  capacity: number;
  description: string;
}

export interface RideFareBreakdown {
  baseFare: number;
  distanceKm: number;
  durationMin: number;
  distanceFare: number;
  timeFare: number;
  rawSurgePercent: number;
  appliedSurgePercent: number;
  surgeAmount: number;
  finalFare: number;
  maxAllowedFare: number;
  isCapped: boolean;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface Ride {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicleNumber?: string;
  driverVehicleModel?: string;
  driverRating?: number;
  status: RideStatus;
  vehicleType: VehicleType;
  pickup: LocationPoint;
  destination: LocationPoint;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  fareBreakdown: RideFareBreakdown;
  baseFare: number;
  surgePercentage: number;
  surgeAmount: number;
  finalFare: number;
  maxAllowedFare: number;
  routeGeometry?: GeoJsonLineString;
  requestedAt: string;
  acceptedAt?: string;
  driverArrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  bookingType?: 'IMMEDIATE' | 'PREBOOKED';
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledAt?: string | any;
  searchStartedAt?: string;
  paymentMethod?: 'cash' | 'upi' | 'card';
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
  riderRating?: number;
  riderFeedback?: string;
  driverRatingScore?: number;
  driverRatingFeedback?: string;
  trackingToken?: string;
  activeSosAlertId?: string;
  riderCurrentGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: string;
  };
  currentGps?: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  };
}

export interface GpsLogPoint {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  heading: number;
  timestamp: string;
  recordedAt: number;
}

export type RiskClassification = 'NORMAL' | 'WARNING' | 'SUSPICIOUS';

export interface FraudReport {
  rideId: string;
  driverId: string;
  riderId: string;
  driverName?: string;
  riderName?: string;
  expectedDistanceKm: number;
  actualGpsDistanceKm: number;
  distanceDifferencePercent: number;
  maxRecordedSpeedKmh: number;
  hasImpossibleSpeed: boolean;
  hasGpsJumps: boolean;
  hasLargeTimestampGaps: boolean;
  routeDeviationsCount: number;
  totalGpsPoints: number;
  riskClassification: RiskClassification;
  status: 'PENDING_REVIEW' | 'CONFIRMED_SAFE' | 'CONFIRMED_SUSPICIOUS';
  anomalyReasons: string[];
  adminNotes?: string;
  computedAt: string;
}

export interface EmergencyAlert {
  id: string;
  rideId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  status: 'ACTIVE' | 'RESPONDED' | 'RESOLVED';
  resolvedAt?: string;
  notes?: string;
  liveTrackingUrl?: string;
  stopReason?: string;
}

export interface TrackingTokenData {
  tokenHash: string;
  rideId: string;
  riderId: string;
  riderFirstName: string;
  expiresAt: string;
  isRevoked: boolean;
  createdAt: string;
  riderCurrentGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: string;
  };
  lastUpdated?: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'emergency';
  timestamp: string;
  read: boolean;
  rideId?: string;
}
