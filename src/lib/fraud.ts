import { FraudReport, GpsLogPoint, RiskClassification, VehicleType } from '../types';
import { calculateTotalGpsDistance, haversineDistance, minDistanceToPolyline } from './geo';

export interface FraudAnalysisOptions {
  rideId: string;
  driverId: string;
  riderId: string;
  driverName?: string;
  riderName?: string;
  vehicleType: VehicleType;
  expectedDistanceKm: number;
  gpsPoints: GpsLogPoint[];
  routeCoordinates?: [number, number][]; // [lng, lat]
}

/**
 * Evaluates GPS breadcrumb telemetry against route constraints
 * Neutral and objective wording: "flagged for review"
 */
export function analyzeRideGpsLogs(options: FraudAnalysisOptions): FraudReport {
  const {
    rideId,
    driverId,
    riderId,
    driverName,
    riderName,
    vehicleType,
    expectedDistanceKm,
    gpsPoints,
    routeCoordinates,
  } = options;

  const reasons: string[] = [];

  // 1. Calculate actual GPS distance ignoring points with accuracy > 100m
  const actualGpsDistanceKm = calculateTotalGpsDistance(gpsPoints, 100);

  // 2. Compute distance difference %
  const safeExpected = Math.max(expectedDistanceKm, 0.5);
  const diffKm = Math.abs(actualGpsDistanceKm - safeExpected);
  const distanceDifferencePercent = Math.round((diffKm / safeExpected) * 100);

  // 3. Speed checks: overall speed > 120 km/h, or bikes/autos > 80 km/h
  let maxRecordedSpeedKmh = 0;
  let hasImpossibleSpeed = false;
  const maxSpeedThreshold = vehicleType === 'bike' || vehicleType === 'auto' ? 80 : 120;

  for (const pt of gpsPoints) {
    if (pt.speed && pt.speed > maxRecordedSpeedKmh) {
      maxRecordedSpeedKmh = pt.speed;
    }
  }

  if (maxRecordedSpeedKmh > maxSpeedThreshold) {
    hasImpossibleSpeed = true;
    reasons.push(
      `Speed peak detected (${Math.round(maxRecordedSpeedKmh)} km/h exceeds normal ${vehicleType} threshold of ${maxSpeedThreshold} km/h)`
    );
  }

  // 4. GPS Jumps: > 500 m in under 3 s
  let hasGpsJumps = false;
  let jumpCount = 0;
  for (let i = 0; i < gpsPoints.length - 1; i++) {
    const p1 = gpsPoints[i];
    const p2 = gpsPoints[i + 1];
    const timeDeltaSec = Math.abs(p2.recordedAt - p1.recordedAt) / 1000;
    const distMeters = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng) * 1000;

    if (timeDeltaSec <= 3 && distMeters > 500) {
      hasGpsJumps = true;
      jumpCount++;
    }
  }

  if (hasGpsJumps) {
    reasons.push(`${jumpCount} sudden coordinate jump(s) >500m within 3 seconds`);
  }

  // 5. Timestamp gaps > 30 s
  let hasLargeTimestampGaps = false;
  let gapCount = 0;
  for (let i = 0; i < gpsPoints.length - 1; i++) {
    const p1 = gpsPoints[i];
    const p2 = gpsPoints[i + 1];
    const timeDeltaSec = Math.abs(p2.recordedAt - p1.recordedAt) / 1000;

    if (timeDeltaSec > 30) {
      hasLargeTimestampGaps = true;
      gapCount++;
    }
  }

  if (hasLargeTimestampGaps) {
    reasons.push(`${gapCount} telemetry interval gap(s) exceeding 30 seconds`);
  }

  // 6. Route deviation: points > 300 m from the route
  let routeDeviationsCount = 0;
  if (routeCoordinates && routeCoordinates.length > 1) {
    for (const pt of gpsPoints) {
      if (pt.accuracy && pt.accuracy <= 100) {
        const distToRoute = minDistanceToPolyline({ lat: pt.lat, lng: pt.lng }, routeCoordinates);
        if (distToRoute > 300) {
          routeDeviationsCount++;
        }
      }
    }
  }

  if (routeDeviationsCount > 3) {
    reasons.push(
      `${routeDeviationsCount} GPS points observed >300m away from the mapped corridor`
    );
  }

  // Difference percentage reasons
  if (distanceDifferencePercent > 50) {
    reasons.push(
      `Recorded GPS distance (${actualGpsDistanceKm.toFixed(1)} km) varies by ${distanceDifferencePercent}% from estimated route (${expectedDistanceKm.toFixed(1)} km)`
    );
  } else if (distanceDifferencePercent >= 20) {
    reasons.push(
      `Recorded distance variance is ${distanceDifferencePercent}% compared to estimated route`
    );
  }

  // 7. Risk Classification:
  // NORMAL: under 20%, no flags
  // WARNING: 20-50% or one flag
  // SUSPICIOUS: over 50% or several flags
  const flagCount =
    (hasImpossibleSpeed ? 1 : 0) +
    (hasGpsJumps ? 1 : 0) +
    (hasLargeTimestampGaps ? 1 : 0) +
    (routeDeviationsCount > 3 ? 1 : 0);

  let riskClassification: RiskClassification = 'NORMAL';

  if (distanceDifferencePercent > 50 || flagCount >= 2) {
    riskClassification = 'SUSPICIOUS';
  } else if (distanceDifferencePercent >= 20 || flagCount === 1) {
    riskClassification = 'WARNING';
  } else {
    riskClassification = 'NORMAL';
  }

  return {
    rideId,
    driverId,
    riderId,
    driverName,
    riderName,
    expectedDistanceKm,
    actualGpsDistanceKm: Math.round(actualGpsDistanceKm * 10) / 10,
    distanceDifferencePercent,
    maxRecordedSpeedKmh: Math.round(maxRecordedSpeedKmh),
    hasImpossibleSpeed,
    hasGpsJumps,
    hasLargeTimestampGaps,
    routeDeviationsCount,
    totalGpsPoints: gpsPoints.length,
    riskClassification,
    status: 'PENDING_REVIEW',
    anomalyReasons: reasons.length > 0 ? reasons : ['All telemetry metrics within standard operating parameters'],
    computedAt: new Date().toISOString(),
  };
}
