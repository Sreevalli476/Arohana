import React, { useMemo } from 'react';
import {
  generateTimeSlots,
  getLocalTimezoneName,
  isSlotDisabledForDate,
  validateSlotSelection,
  PreBookSlot,
} from '../lib/prebooking';
import { Calendar, Clock, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PreBookSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
  selectedSlot: string; // "12:00 AM", "01:30 PM", etc.
  onSlotChange: (slot: string) => void;
  minLeadTimeMinutes?: number;
  maxDaysAhead?: number;
}

export const PreBookSlotPicker: React.FC<PreBookSlotPickerProps> = ({
  selectedDate,
  onDateChange,
  selectedSlot,
  onSlotChange,
  minLeadTimeMinutes = 30,
  maxDaysAhead = 30,
}) => {
  const localTimezone = useMemo(() => getLocalTimezoneName(), []);

  // Compute minimum and maximum allowed date strings
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const maxDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + maxDaysAhead);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [maxDaysAhead]);

  const allSlots = useMemo(() => generateTimeSlots(), []);

  // Validate the current selection
  const validation = useMemo(() => {
    return validateSlotSelection(selectedDate, selectedSlot, new Date(), minLeadTimeMinutes, maxDaysAhead);
  }, [selectedDate, selectedSlot, minLeadTimeMinutes, maxDaysAhead]);

  // Group slots into time-of-day buckets for high-clarity UX
  const slotGroups = useMemo(() => {
    const groups: { title: string; period: string; slots: PreBookSlot[] }[] = [
      { title: 'Early Morning', period: '12:00 AM – 05:30 AM', slots: [] },
      { title: 'Morning', period: '06:00 AM – 11:30 AM', slots: [] },
      { title: 'Afternoon', period: '12:00 PM – 04:30 PM', slots: [] },
      { title: 'Evening & Night', period: '05:00 PM – 11:30 PM', slots: [] },
    ];

    allSlots.forEach((s) => {
      if (s.hour24 < 6) groups[0].slots.push(s);
      else if (s.hour24 < 12) groups[1].slots.push(s);
      else if (s.hour24 < 17) groups[2].slots.push(s);
      else groups[3].slots.push(s);
    });

    return groups;
  }, [allSlots]);

  return (
    <div className="space-y-4 rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
      {/* Header with Timezone */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Schedule Date & Time
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-400 font-mono">
          <Globe className="w-3 h-3 text-amber-400" />
          <span>{localTimezone}</span>
        </div>
      </div>

      {/* Date Selector */}
      <div>
        <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Select Travel Date</span>
          </span>
          <span className="text-[10px] text-neutral-500 font-normal">
            Max {maxDaysAhead} days in advance
          </span>
        </label>
        <input
          type="date"
          value={selectedDate}
          min={todayStr}
          max={maxDateStr}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-amber-500 text-xs text-white font-medium focus:outline-none transition-colors"
        />
      </div>

      {/* Time Slot Picker */}
      <div>
        <label className="block text-[11px] font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Select 30-Minute Slot (12-Hour AM/PM)</span>
          </span>
          <span className="text-[10px] text-amber-400 font-normal">
            Min {minLeadTimeMinutes}m advance notice
          </span>
        </label>

        {/* Scrollable slots container */}
        <div className="max-h-56 overflow-y-auto pr-1 space-y-3 rounded-xl bg-neutral-950 border border-neutral-800/80 p-3">
          {slotGroups.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-neutral-500 px-1 font-semibold uppercase tracking-wider">
                <span>{group.title}</span>
                <span className="text-neutral-600 font-mono text-[9px]">{group.period}</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {group.slots.map((s) => {
                  const isDisabled = isSlotDisabledForDate(
                    selectedDate,
                    s.slot,
                    new Date(),
                    minLeadTimeMinutes
                  );
                  const isSelected = selectedSlot === s.slot;

                  return (
                    <button
                      key={s.slot}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onSlotChange(s.slot)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center transition-all select-none ${
                        isSelected
                          ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/30 ring-2 ring-amber-400'
                          : isDisabled
                          ? 'bg-neutral-900/40 text-neutral-600 cursor-not-allowed border border-neutral-800/30'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-amber-500/40'
                      }`}
                      title={isDisabled ? 'Slot unavailable (must be >= 30 mins in advance)' : s.slot}
                    >
                      {s.slot}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Message or Confirmation */}
      {validation.isValid ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>
            Scheduled for <strong className="text-white">{selectedDate}</strong> at{' '}
            <strong className="text-white">{selectedSlot}</strong> ({localTimezone})
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>{validation.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
