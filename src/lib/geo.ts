/**
 * Geographic calculation utilities for ĀroHana
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates Great Circle distance between two points using the Haversine formula
 * Returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Checks if distance is within specified radius in meters
 */
export function isWithinRadius(
  point1: Coordinate,
  point2: Coordinate,
  radiusMeters: number
): boolean {
  const distKm = haversineDistance(point1.lat, point1.lng, point2.lat, point2.lng);
  return distKm * 1000 <= radiusMeters;
}

/**
 * Calculates initial bearing / heading (in degrees from 0 to 360) from point1 to point2
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));

  let brng = Math.atan2(y, x);
  brng = toDeg(brng);
  return (brng + 360) % 360;
}

/**
 * Linear interpolation between two coordinates
 */
export function interpolateCoordinate(
  start: Coordinate,
  end: Coordinate,
  fraction: number
): Coordinate {
  const t = Math.max(0, Math.min(1, fraction));
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lng: start.lng + (end.lng - start.lng) * t,
  };
}

/**
 * Calculates sum of Haversine segments across an array of coordinates,
 * optionally filtering out points with high accuracy error.
 */
export function calculateTotalGpsDistance(
  points: { lat: number; lng: number; accuracy?: number }[],
  maxAccuracyThresholdMeters: number = 100
): number {
  if (points.length < 2) return 0;

  // Filter out noisy points
  const validPoints = points.filter(
    (p) => p.accuracy === undefined || p.accuracy <= maxAccuracyThresholdMeters
  );

  if (validPoints.length < 2) return 0;

  let totalKm = 0;
  for (let i = 0; i < validPoints.length - 1; i++) {
    totalKm += haversineDistance(
      validPoints[i].lat,
      validPoints[i].lng,
      validPoints[i + 1].lat,
      validPoints[i + 1].lng
    );
  }
  return totalKm;
}

/**
 * Computes minimum perpendicular distance from a point to a polyline in meters
 */
export function minDistanceToPolyline(
  point: Coordinate,
  polyline: [number, number][] // [lng, lat] format from GeoJSON
): number {
  if (polyline.length === 0) return 0;
  if (polyline.length === 1) {
    return haversineDistance(point.lat, point.lng, polyline[0][1], polyline[0][0]) * 1000;
  }

  let minDistanceMeters = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = { lat: polyline[i][1], lng: polyline[i][0] };
    const p2 = { lat: polyline[i + 1][1], lng: polyline[i + 1][0] };
    const dist = distancePointToSegment(point, p1, p2);
    if (dist < minDistanceMeters) {
      minDistanceMeters = dist;
    }
  }

  return minDistanceMeters;
}

function distancePointToSegment(p: Coordinate, v: Coordinate, w: Coordinate): number {
  // Approximate flat-earth projection for small distance segments
  const l2 = Math.pow(w.lat - v.lat, 2) + Math.pow(w.lng - v.lng, 2);
  if (l2 === 0) return haversineDistance(p.lat, p.lng, v.lat, v.lng) * 1000;

  const t = Math.max(
    0,
    Math.min(1, ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2)
  );
  const projection: Coordinate = {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng),
  };

  return haversineDistance(p.lat, p.lng, projection.lat, projection.lng) * 1000;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
