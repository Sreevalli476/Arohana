import { haversineDistance } from './geo';
import { GeoJsonLineString } from '../types';

export const MAPBOX_TOKEN: string = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();

export function isMapboxConfigured(): boolean {
  return (
    Boolean(MAPBOX_TOKEN) &&
    MAPBOX_TOKEN !== 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUwMDAwMDExMnh4YW1wbGUifQ.example' &&
    MAPBOX_TOKEN.startsWith('pk.')
  );
}

export interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  properties?: {
    category?: string;
    address?: string;
  };
}

export interface RouteDirectionsResult {
  distanceKm: number;
  durationMin: number;
  geometry: GeoJsonLineString;
  isApproximate: boolean;
  notes?: string;
}

/**
 * Searches places in India using Mapbox Geocoding API with proximity bias
 */
export async function searchPlacesInIndia(
  query: string,
  userLocation?: { lat: number; lng: number }
): Promise<GeocodingFeature[]> {
  if (!query || query.trim().length < 2) return [];

  const token = MAPBOX_TOKEN;
  if (!token || !isMapboxConfigured()) {
    throw new Error('Mapbox configuration required');
  }

  const encodedQuery = encodeURIComponent(query.trim());
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${token}&country=IN&limit=6&types=poi,address,neighborhood,locality,place`;

  if (userLocation) {
    url += `&proximity=${userLocation.lng},${userLocation.lat}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding error: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.features || []).map((f: any) => ({
    id: f.id,
    place_name: f.place_name,
    text: f.text,
    center: f.center,
    properties: f.properties,
  }));
}

/**
 * Reverse geocodes coordinates to street address
 */
export async function reverseGeocodeIndia(
  lng: number,
  lat: number
): Promise<{ address: string; name: string }> {
  const token = MAPBOX_TOKEN;
  if (!token || !isMapboxConfigured()) {
    return {
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      name: 'Pinned Location',
    };
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&country=IN&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const feat = data.features[0];
      return {
        address: feat.place_name,
        name: feat.text || feat.place_name.split(',')[0],
      };
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
  }

  return {
    address: `Near ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    name: 'Current Location',
  };
}

/**
 * Gets real road route from Mapbox Directions API (profile: driving, geometries=geojson, overview=full)
 * Falls back to straight-line distance if routing fails
 */
export async function getRouteDirections(
  start: [number, number], // [lng, lat]
  end: [number, number] // [lng, lat]
): Promise<RouteDirectionsResult> {
  const token = MAPBOX_TOKEN;
  if (!token || !isMapboxConfigured()) {
    // Return approximate straight line
    const straightKm = haversineDistance(start[1], start[0], end[1], end[0]);
    return {
      distanceKm: Math.round(straightKm * 10) / 10,
      durationMin: Math.round((straightKm / 25) * 60) + 3, // avg 25 km/h city speed
      geometry: {
        type: 'LineString',
        coordinates: [start, end],
      },
      isApproximate: true,
      notes: 'Approximate (route unavailable)',
    };
  }

  try {
    const coordsStr = `${start[0]},${start[1]};${end[0]},${end[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?access_token=${token}&geometries=geojson&overview=full&steps=true`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Directions API status ${res.status}`);
    }

    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        durationMin: Math.max(1, Math.round(route.duration / 60)),
        geometry: route.geometry,
        isApproximate: false,
      };
    }
  } catch (err) {
    console.warn('Mapbox directions error, using straight line fallback:', err);
  }

  // Fallback straight-line
  const straightKm = haversineDistance(start[1], start[0], end[1], end[0]);
  return {
    distanceKm: Math.round(straightKm * 10) / 10,
    durationMin: Math.round((straightKm / 25) * 60) + 3,
    geometry: {
      type: 'LineString',
      coordinates: [start, end],
    },
    isApproximate: true,
    notes: 'Approximate (route unavailable)',
  };
}
