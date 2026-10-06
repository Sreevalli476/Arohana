import React, { useState, useEffect } from 'react';
import { Ride } from '../types';
import { formatScheduledCountdown, CANCELLATION_REASONS, CancellationReason } from '../lib/prebooking';
import {
  Clock,
  Calendar,
  MapPin,
  Navigation,
  XCircle,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Shield,
  Car,
} from 'lucide-react';

interface MyScheduledRidesProps {
  scheduledRides: Ride[];
  onViewRoute: (ride: Ride) => void;
  onCancelScheduledRide: (rideId: string, reason: string) => Promise<void>;
}

export const MyScheduledRides: React.FC<MyScheduledRidesProps> = ({
  scheduledRides,
  onViewRoute,
  onCancelScheduledRide,
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [selectedRideForCancel, setSelectedRideForCancel] = useState<Ride | null>(null);
  const [selectedReason, setSelectedReason] = useState<CancellationReason>(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);

  // Update countdown clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmCancel = async () => {
    if (!selectedRideForCancel) return;
    setIsSubmittingCancel(true);
    const finalReason = selectedReason === 'Other' && customReason.trim() ? customReason.trim() : selectedReason;
    try {
      await onCancelScheduledRide(selectedRideForCancel.id, finalReason);
      setSelectedRideForCancel(null);
      setCustomReason('');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (scheduledRides.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-2">
        <Clock className="w-8 h-8 text-neutral-600 mx-auto" />
        <p className="text-xs font-semibold text-neutral-300">No Scheduled Rides</p>
        <p className="text-[11px] text-neutral-500">
          Book ahead using "Pre-Book Ride" to reserve travel slots up to 30 days in advance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>My Scheduled Rides ({scheduledRides.length})</span>
        </h4>
        <span className="text-[10px] text-neutral-500">Auto-activating 30m prior</span>
      </div>

      <div className="space-y-2.5">
        {scheduledRides.map((ride) => {
          const countdown = ride.scheduledAt
            ? formatScheduledCountdown(ride.scheduledAt, now)
            : 'Scheduled';

          const isDue = countdown === 'Due for departure';

          return (
            <div
              key={ride.id}
              className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all text-xs space-y-2.5"
            >
              {/* Top Row: Date, Time & Countdown Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px]">
                    {ride.scheduledDate || 'Upcoming'} · {ride.scheduledTime || ''}
                  </span>
                  <span className="text-[10px] text-neutral-400 capitalize">
                    {ride.vehicleType}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold ${
                    isDue
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-neutral-950 text-emerald-400 border border-neutral-800'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{countdown}</span>
                </div>
              </div>

              {/* Pickup & Destination */}
              <div className="space-y-1.5 pl-1">
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                  <p className="text-neutral-300 text-[11px] truncate">
                    <strong className="text-white">Pickup: </strong>
                    {ride.pickup.name || ride.pickup.address}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <p className="text-neutral-300 text-[11px] truncate">
                    <strong className="text-white">Drop: </strong>
                    {ride.destination.name || ride.destination.address}
                  </p>
                </div>
              </div>

              {/* Fare & Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <div>
                  <span className="text-[10px] text-neutral-500 block">Estimated Fare</span>
                  <span className="text-sm font-extrabold text-amber-400">₹{ride.finalFare}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onViewRoute(ride)}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white font-semibold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-amber-400" />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => setSelectedRideForCancel(ride)}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-800 text-neutral-400 hover:text-rose-300 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancellation Confirmation Modal */}
      {selectedRideForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4 text-xs text-neutral-200">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-white">Cancel Scheduled Ride</h4>
            </div>

            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Please choose a reason for cancelling your scheduled ride on{' '}
              <strong className="text-white">{selectedRideForCancel.scheduledDate}</strong> at{' '}
              <strong className="text-white">{selectedRideForCancel.scheduledTime}</strong>:
            </p>

            {/* Reason Radio Group */}
            <div className="space-y-1.5">
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'bg-amber-500/10 border-amber-500 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="scheduledCancelReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs font-medium">{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Specify your reason..."
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={() => setSelectedRideForCancel(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
              >
                Keep Ride
              </button>
              <button
                type="button"
                disabled={isSubmittingCancel}
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-950/50"
              >
                {isSubmittingCancel ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
