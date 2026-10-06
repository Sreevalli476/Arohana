import React, { useState } from 'react';
import { AlertCircle, X, Check } from 'lucide-react';

interface CancelRideModalProps {
  isOpen: boolean;
  rideId: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export const CANCELLATION_REASONS = [
  'Driver took too long',
  'Driver asked to cancel',
  'Changed my plans',
  'Wrong pickup',
  'Safety concern',
  'Other',
] as const;

export const CancelRideModal: React.FC<CancelRideModalProps> = ({
  isOpen,
  rideId,
  onConfirm,
  onClose,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleConfirmCancel = async () => {
    setLoading(true);
    const finalReason = selectedReason === 'Other' && customReason.trim()
      ? `Other: ${customReason.trim()}`
      : selectedReason;

    await onConfirm(finalReason);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative text-neutral-100 space-y-5">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cancel Ride?</h3>
            <p className="text-xs text-neutral-400">Please let us know why you are cancelling</p>
          </div>
        </div>

        <p className="text-xs text-neutral-300">
          Cancelling will immediately release your assigned driver, conclude live location sharing, and stop active trip tracking.
        </p>

        {/* Reasons List */}
        <div className="space-y-2 text-xs">
          {CANCELLATION_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedReason === reason
                  ? 'bg-rose-500/10 border-rose-500 text-white font-semibold'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <span>{reason}</span>
              <input
                type="radio"
                name="cancellationReason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => setSelectedReason(reason)}
                className="hidden"
              />
              {selectedReason === reason && <Check className="w-4 h-4 text-rose-400" />}
            </label>
          ))}

          {selectedReason === 'Other' && (
            <textarea
              placeholder="Specify reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full h-16 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 mt-2"
            />
          )}
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
          >
            Keep Ride
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-950/50 disabled:opacity-50"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
};
