import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { Ride } from '../types';
import { MapboxMap } from '../components/MapboxMap';
import {
  Compass,
  Clock,
  MapPin,
  Calendar,
  Car,
  ChevronRight,
  RotateCcw,
  Star,
  X,
  CreditCard,
} from 'lucide-react';

export const RiderHistoryPage: React.FC = () => {
  const { user, rides } = useAppStore();
  const [selectedRideForReplay, setSelectedRideForReplay] = useState<Ride | null>(null);

  // Filter rides for current rider or show all if guest/demo
  const myRides = Object.values(rides).filter(
    (r) => !user || r.riderId === user.uid || user.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Ride History</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Review past trips, transparent pricing receipts, and replay completed journey routes.
          </p>
        </div>

        {myRides.length === 0 ? (
          <div className="p-12 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-500 space-y-3">
            <Car className="w-10 h-10 text-neutral-600 mx-auto" />
            <p className="text-sm font-semibold text-neutral-300">No journeys recorded yet</p>
            <p className="text-neutral-500">Your completed and past rides will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myRides.map((ride) => (
              <div
                key={ride.id}
                className="p-5 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">{ride.id}</span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400">
                      {new Date(ride.requestedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <span className="text-base font-bold font-mono text-white">₹{ride.finalFare}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate">{ride.pickup.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-300">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{ride.destination.address}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-3">
                    <span className="capitalize">{ride.vehicleType}</span>
                    <span>·</span>
                    <span>{ride.driverName || 'Driver'}</span>
                    {ride.riderRating && (
                      <span className="flex items-center text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400 mr-1" />
                        {ride.riderRating} ★
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedRideForReplay(ride)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Replay Route</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Route Replay Map Modal */}
      {selectedRideForReplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Route Replay · {selectedRideForReplay.id}</h3>
                <p className="text-[11px] text-neutral-400">
                  {selectedRideForReplay.estimatedDistanceKm} km · Fare: ₹{selectedRideForReplay.finalFare}
                </p>
              </div>
              <button
                onClick={() => setSelectedRideForReplay(null)}
                className="p-1.5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 w-full h-[50vh] relative">
              <MapboxMap
                pickup={selectedRideForReplay.pickup}
                destination={selectedRideForReplay.destination}
                routeGeometry={selectedRideForReplay.routeGeometry}
                isDraggablePickup={false}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
