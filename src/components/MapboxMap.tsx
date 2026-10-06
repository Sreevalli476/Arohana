import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { isMapboxConfigured, MAPBOX_TOKEN, reverseGeocodeIndia } from '../lib/mapbox';
import { LocationPoint, DriverLiveState, GeoJsonLineString } from '../types';
import { calculateBearing, interpolateCoordinate } from '../lib/geo';
import {
  Compass,
  Crosshair,
  AlertCircle,
  Navigation2,
  RefreshCw,
  WifiOff,
  Car,
  Key,
} from 'lucide-react';

interface MapboxMapProps {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  onPickupChange?: (point: LocationPoint) => void;
  onDestinationChange?: (point: LocationPoint) => void;
  routeGeometry?: GeoJsonLineString | null;
  assignedDriver?: DriverLiveState | null;
  riderLocation?: { lat: number; lng: number } | null;
  isDraggablePickup?: boolean;
  className?: string;
  showDriverMarker?: boolean;
  onGpsAccuracyWarning?: (accuracy: number) => void;
  centerOnPickup?: boolean;
}

export const MapboxMap: React.FC<MapboxMapProps> = ({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  routeGeometry,
  assignedDriver,
  riderLocation,
  isDraggablePickup = true,
  className = 'w-full h-full',
  showDriverMarker = true,
  onGpsAccuracyWarning,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Markers
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const riderLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userGpsMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // State
  const [hasToken, setHasToken] = useState<boolean>(isMapboxConfigured());
  const [customTokenInput, setCustomTokenInput] = useState<string>('');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'locked' | 'error' | 'denied'>('idle');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string>('');
  const [userPanned, setUserPanned] = useState<boolean>(false);
  const [driverDelayed, setDriverDelayed] = useState<boolean>(false);
  const [lastDriverLocation, setLastDriverLocation] = useState<{ lat: number; lng: number; heading: number } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastDriverUpdateRef = useRef<number>(Date.now());

  // Initialize Mapbox map if configured
  useEffect(() => {
    if (!hasToken || !mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN || customTokenInput;

    const initialLat = pickup?.lat || 12.9716;
    const initialLng = pickup?.lng || 77.5946;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [initialLng, initialLat],
      zoom: 14,
      pitch: 35,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

    map.on('dragstart', () => {
      setUserPanned(true);
    });

    map.on('load', () => {
      mapRef.current = map;
      // Initialize Route Layer
      if (!map.getSource('route-source')) {
        map.addSource('route-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [],
            },
          },
        });

        // Route casing / glow
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#F59E0B',
            'line-width': 8,
            'line-opacity': 0.35,
            'line-blur': 3,
          },
        });

        // Route main line
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#F59E0B',
            'line-width': 4,
          },
        });
      }
    });

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [hasToken, customTokenInput]);

  // Request Current Location via navigator.geolocation.watchPosition
  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('locating');
    setGpsErrorMessage('');

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(accuracy);
        setGpsStatus('locked');

        if (accuracy > 150) {
          if (onGpsAccuracyWarning) onGpsAccuracyWarning(accuracy);
        }

        // If pickup is not set, set pickup from current location
        if (!pickup && onPickupChange) {
          const rev = await reverseGeocodeIndia(longitude, latitude);
          onPickupChange({
            lat: latitude,
            lng: longitude,
            address: rev.address,
            name: rev.name,
          });
        }

        // Update GPS blue dot marker
        if (mapRef.current) {
          if (!userGpsMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-gps-container';
            el.innerHTML = `
              <div class="relative flex items-center justify-center">
                <div class="w-8 h-8 rounded-full bg-blue-500/20 animate-ping absolute"></div>
                <div class="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md"></div>
              </div>
            `;
            userGpsMarkerRef.current = new mapboxgl.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(mapRef.current);
          } else {
            userGpsMarkerRef.current.setLngLat([longitude, latitude]);
          }

          if (!userPanned) {
            mapRef.current.easeTo({
              center: [longitude, latitude],
              zoom: 15,
              duration: 1000,
            });
          }
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        if (err.code === 1) {
          setGpsStatus('denied');
          setGpsErrorMessage('Location permission denied. Please enable location access or type your pickup address.');
        } else if (err.code === 2) {
          setGpsStatus('error');
          setGpsErrorMessage('Location unavailable. Please search your pickup location manually.');
        } else if (err.code === 3) {
          setGpsStatus('error');
          setGpsErrorMessage('GPS request timed out. Retrying...');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  }, [pickup, onPickupChange, userPanned, onGpsAccuracyWarning]);

  // Trigger GPS lock on initial mount
  useEffect(() => {
    requestCurrentLocation();
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [requestCurrentLocation]);

  // Recenter map button
  const handleRecenter = () => {
    setUserPanned(false);
    if (mapRef.current) {
      if (pickup && destination) {
        // Fit bounds
        const bounds = new mapboxgl.LngLatBounds()
          .extend([pickup.lng, pickup.lat])
          .extend([destination.lng, destination.lat]);
        mapRef.current.fitBounds(bounds, { padding: 80, duration: 1000 });
      } else if (pickup) {
        mapRef.current.easeTo({ center: [pickup.lng, pickup.lat], zoom: 15, duration: 800 });
      } else {
        requestCurrentLocation();
      }
    }
  };

  // Pickup marker update
  useEffect(() => {
    if (!mapRef.current || !hasToken) return;

    if (!pickup) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
      return;
    }

    if (!pickupMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'cursor-grab active:cursor-grabbing group';
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-bold text-amber-400 shadow-lg whitespace-nowrap mb-1">
            Pickup (Drag to adjust)
          </div>
          <div class="w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-xl flex items-center justify-center text-neutral-950 font-bold text-xs">
            P
          </div>
          <div class="w-1 h-2 bg-amber-500 rounded-b"></div>
        </div>
      `;

      const marker = new mapboxgl.Marker({
        element: el,
        draggable: isDraggablePickup,
      })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(mapRef.current);

      marker.on('dragend', async () => {
        const lngLat = marker.getLngLat();
        const rev = await reverseGeocodeIndia(lngLat.lng, lngLat.lat);
        if (onPickupChange) {
          onPickupChange({
            lat: lngLat.lat,
            lng: lngLat.lng,
            address: rev.address,
            name: rev.name,
          });
        }
      });

      pickupMarkerRef.current = marker;
    } else {
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
      pickupMarkerRef.current.setDraggable(isDraggablePickup);
    }
  }, [pickup, isDraggablePickup, onPickupChange, hasToken]);

  // Destination marker update
  useEffect(() => {
    if (!mapRef.current || !hasToken) return;

    if (!destination) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }
      return;
    }

    if (!destinationMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-bold text-emerald-400 shadow-lg whitespace-nowrap mb-1">
            Drop-off
          </div>
          <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-neutral-950 font-bold text-xs">
            D
          </div>
          <div class="w-1 h-2 bg-emerald-500 rounded-b"></div>
        </div>
      `;

      destinationMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([destination.lng, destination.lat])
        .addTo(mapRef.current);
    } else {
      destinationMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    }
  }, [destination, hasToken]);

  // Live rider location marker update (for live tracking link)
  useEffect(() => {
    if (!mapRef.current || !hasToken) return;

    if (!riderLocation) {
      if (riderLocationMarkerRef.current) {
        riderLocationMarkerRef.current.remove();
        riderLocationMarkerRef.current = null;
      }
      return;
    }

    if (!riderLocationMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-500/70 text-[10px] font-bold text-blue-300 shadow-xl whitespace-nowrap mb-1 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            <span>Rider Live GPS</span>
          </div>
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-blue-500/25 animate-ping absolute"></div>
            <div class="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-2xl flex items-center justify-center text-[10px] font-bold text-white">
              R
            </div>
          </div>
        </div>
      `;

      riderLocationMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([riderLocation.lng, riderLocation.lat])
        .addTo(mapRef.current);
    } else {
      riderLocationMarkerRef.current.setLngLat([riderLocation.lng, riderLocation.lat]);
    }
  }, [riderLocation, hasToken]);

  // Route drawing & viewport fit
  useEffect(() => {
    if (!mapRef.current || !hasToken) return;

    const source = mapRef.current.getSource('route-source') as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (routeGeometry && routeGeometry.coordinates.length > 0) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: routeGeometry,
      });

      // Fit map to route bounds
      if (!userPanned) {
        const bounds = new mapboxgl.LngLatBounds();
        routeGeometry.coordinates.forEach((coord: any) => {
          bounds.extend(coord as [number, number]);
        });
        mapRef.current.fitBounds(bounds, {
          padding: { top: 90, bottom: 250, left: 50, right: 50 },
          duration: 1200,
        });
      }
    } else {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [],
        },
      });
    }
  }, [routeGeometry, userPanned, hasToken]);

  // Smooth live driver marker animation (interpolation + heading rotation)
  useEffect(() => {
    if (!mapRef.current || !hasToken || !showDriverMarker) return;

    if (!assignedDriver) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      return;
    }

    const { lat, lng, heading = 0 } = assignedDriver;
    lastDriverUpdateRef.current = Date.now();
    setDriverDelayed(false);

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.id = 'assigned-driver-car-marker';
      el.className = 'transition-transform duration-500 ease-out';
      el.innerHTML = `
        <div class="relative flex items-center justify-center p-2 rounded-full bg-neutral-900 border-2 border-amber-500 shadow-2xl">
          <svg class="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
          <div class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950 font-bold text-[9px] whitespace-nowrap shadow">
            ${assignedDriver.vehicleNumber || 'Driver'}
          </div>
        </div>
      `;

      driverMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setRotation(heading)
        .addTo(mapRef.current);

      setLastDriverLocation({ lat, lng, heading });
    } else {
      // Smoothly interpolate coordinate
      const el = driverMarkerRef.current.getElement();
      driverMarkerRef.current.setLngLat([lng, lat]);
      driverMarkerRef.current.setRotation(heading);
      setLastDriverLocation({ lat, lng, heading });
    }
  }, [assignedDriver, showDriverMarker, hasToken]);

  // Check for driver update delay (>15s)
  useEffect(() => {
    if (!assignedDriver) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastDriverUpdateRef.current;
      if (elapsed > 15000) {
        setDriverDelayed(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [assignedDriver]);

  // If Mapbox is not configured, show mandatory configuration banner
  if (!hasToken) {
    return (
      <div className={`flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center ${className}`}>
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
          <Key className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Map Configuration Required</h3>
        <p className="text-sm text-neutral-400 max-w-md mb-6 leading-relaxed">
          ĀroHana adheres to the strict rule: <strong className="text-neutral-200">REAL data only—no fake maps or mock coordinates</strong>.
          Please provide a valid Mapbox Public Access Token (<code className="text-amber-400">pk.*</code>) to render live vector tiles, real road routes, and geocoding.
        </p>

        <div className="w-full max-w-md space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter Mapbox Token (pk.eyJ1...)"
              value={customTokenInput}
              onChange={(e) => setCustomTokenInput(e.target.value.trim())}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
          <button
            onClick={() => {
              if (customTokenInput.startsWith('pk.')) {
                setHasToken(true);
              }
            }}
            disabled={!customTokenInput.startsWith('pk.')}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition-colors"
          >
            Activate Live Map
          </button>
          <p className="text-[11px] text-neutral-500">
            Or configure <code className="text-amber-400">VITE_MAPBOX_TOKEN</code> in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Status Badges */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        {/* GPS Accuracy Warning */}
        {gpsAccuracy !== null && gpsAccuracy > 150 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/90 text-neutral-950 font-medium text-xs shadow-lg backdrop-blur pointer-events-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Low GPS accuracy (~{Math.round(gpsAccuracy)}m). Drag pin for exact pickup.</span>
          </div>
        )}

        {/* Driver location delayed indicator */}
        {driverDelayed && assignedDriver && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/90 text-white font-medium text-xs shadow-lg backdrop-blur pointer-events-auto">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Driver location delayed (&gt;15s). Waiting for signal...</span>
          </div>
        )}

        {/* GPS Denied or Error */}
        {gpsErrorMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600/90 text-white font-medium text-xs shadow-lg backdrop-blur pointer-events-auto max-w-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gpsErrorMessage}</span>
          </div>
        )}
      </div>

      {/* Recenter & GPS Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          title="Recenter Map"
          className="p-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 shadow-xl backdrop-blur transition-transform active:scale-95"
        >
          <Crosshair className="w-5 h-5 text-amber-400" />
        </button>

        <button
          onClick={requestCurrentLocation}
          title="Get Current GPS Location"
          className={`p-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 shadow-xl backdrop-blur transition-transform active:scale-95 ${
            gpsStatus === 'locating' ? 'text-amber-400 animate-spin' : 'text-neutral-200'
          }`}
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Accuracy meter in footer */}
      {gpsAccuracy !== null && (
        <div className="absolute bottom-2 left-3 z-10 text-[10px] text-neutral-400 bg-neutral-950/80 px-2 py-0.5 rounded border border-neutral-800/80 font-mono">
          GPS fix: ±{Math.round(gpsAccuracy)}m
        </div>
      )}
    </div>
  );
};
