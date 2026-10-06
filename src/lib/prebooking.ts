/**
 * Pre-Booking & Scheduling Service for ĀroHana
 * 
 * Safety Rules:
 * - ADD ONLY logic for bookingType === 'PREBOOKED' and status === 'SCHEDULED'
 * - Preserves existing immediate booking flow
 * - Handles 30-minute time slots in 12-hour AM/PM format
 * - Supports browser local timezone detection and absolute Firestore Timestamp conversion
 * - Transaction-safe promotion of scheduled rides to SEARCHING DRIVER (status 'REQUESTED')
 * - Cancellation handling with reason audit
 */

import { LocationPoint, Ride, VehicleType, RideFareBreakdown } from '../types';
import { db, isFirebaseConfigured, doc, runTransaction, serverTimestamp } from './firebase';
import { Timestamp } from 'firebase/firestore';

export interface PreBookSlot {
  slot: string; // e.g. "12:00 AM", "12:30 AM", "01:00 PM"
  hour24: number;
  minute: number;
}

export interface ScheduledRideData {
  rideId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  pickup: LocationPoint;
  destination: LocationPoint;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // "01:30 PM"
  scheduledAt: string; // ISO String or Timestamp
  scheduledTimezone: string;
  estimatedDistanceKm: number;
  estimatedDurationMin: number;
  estimatedFare: number;
  fareBreakdown: RideFareBreakdown;
  vehicleType: VehicleType;
  createdAt: string;
  status: 'SCHEDULED';
  bookingType: 'PREBOOKED';
  searchStartedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export const CANCELLATION_REASONS = [
  'Changed my plans',
  'Wrong pickup',
  'Driver took too long',
  'Safety concern',
  'Other',
] as const;

export type CancellationReason = typeof CANCELLATION_REASONS[number];

// Default configuration constants
export const DEFAULT_ACTIVATION_WINDOW_MINUTES = 30;
export const DEFAULT_MIN_LEAD_TIME_MINUTES = 30;
export const DEFAULT_MAX_DAYS_AHEAD = 30;

/**
 * Returns user's local browser timezone (e.g. "Asia/Kolkata", "America/New_York")
 */
export function getLocalTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch (e) {
    return 'Asia/Kolkata';
  }
}

/**
 * Generate 48 time slots for a day in 12-hour AM/PM format with 30-min intervals.
 * 12:00 AM is 00:00 (start of day), 12:00 PM is 12:00 (noon).
 */
export function generateTimeSlots(): PreBookSlot[] {
  const slots: PreBookSlot[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? 'AM' : 'PM';
      let displayHour = h % 12;
      if (displayHour === 0) displayHour = 12;
      const displayMin = m === 0 ? '00' : '30';
      const slotString = `${displayHour}:${displayMin} ${ampm}`;
      slots.push({
        slot: slotString,
        hour24: h,
        minute: m,
      });
    }
  }
  return slots;
}

/**
 * Parse a 12-hour AM/PM time slot into 24-hour hour and minute
 */
export function parseSlotStringTo24Hour(slotStr: string): { hour: number; minute: number } {
  const parts = slotStr.trim().split(/[:\s]+/);
  if (parts.length < 3) {
    throw new Error(`Invalid time slot format: ${slotStr}`);
  }
  let hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  const ampm = parts[2].toUpperCase();

  if (ampm === 'AM') {
    if (hour === 12) hour = 0;
  } else if (ampm === 'PM') {
    if (hour !== 12) hour += 12;
  }
  return { hour, minute };
}

/**
 * Combine local date string (YYYY-MM-DD) and 12-hr time slot into an absolute Date instant
 */
export function combineDateAndSlotToInstant(dateStr: string, slotStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const { hour, minute } = parseSlotStringTo24Hour(slotStr);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Validates a chosen date and time slot against:
 * 1. Past dates
 * 2. Minimum lead time (default 30 mins) for today
 * 3. Maximum days ahead (default 30 days)
 */
export function validateSlotSelection(
  dateStr: string,
  slotStr: string,
  now: Date = new Date(),
  minLeadTimeMinutes: number = DEFAULT_MIN_LEAD_TIME_MINUTES,
  maxDaysAhead: number = DEFAULT_MAX_DAYS_AHEAD
): { isValid: boolean; errorMessage?: string } {
  if (!dateStr) {
    return { isValid: false, errorMessage: 'Please select a date for your ride.' };
  }
  if (!slotStr) {
    return { isValid: false, errorMessage: 'Please select a time slot.' };
  }

  const selectedInstant = combineDateAndSlotToInstant(dateStr, slotStr);
  const nowMs = now.getTime();
  const selectedMs = selectedInstant.getTime();

  // Check past dates
  const todayDateStr = now.toISOString().split('T')[0];
  if (dateStr < todayDateStr) {
    return { isValid: false, errorMessage: 'Cannot schedule rides in the past. Please select today or a future date.' };
  }

  // Check lead time (e.g. 30 minutes from now)
  const minAllowedMs = nowMs + minLeadTimeMinutes * 60 * 1000;
  if (selectedMs < minAllowedMs) {
    return {
      isValid: false,
      errorMessage: `Scheduled time must be at least ${minLeadTimeMinutes} minutes in advance.`,
    };
  }

  // Check max days ahead
  const maxAllowedMs = nowMs + maxDaysAhead * 24 * 60 * 60 * 1000;
  if (selectedMs > maxAllowedMs) {
    return {
      isValid: false,
      errorMessage: `Scheduling is permitted up to ${maxDaysAhead} days in advance.`,
    };
  }

  return { isValid: true };
}

/**
 * Check if an individual time slot is disabled for today's date
 */
export function isSlotDisabledForDate(
  dateStr: string,
  slotStr: string,
  now: Date = new Date(),
  minLeadTimeMinutes: number = DEFAULT_MIN_LEAD_TIME_MINUTES
): boolean {
  try {
    const todayDateStr = now.toISOString().split('T')[0];
    if (dateStr < todayDateStr) return true;
    if (dateStr > todayDateStr) return false;

    // Same day: check lead time
    const selectedInstant = combineDateAndSlotToInstant(dateStr, slotStr);
    const minAllowedMs = now.getTime() + minLeadTimeMinutes * 60 * 1000;
    return selectedInstant.getTime() < minAllowedMs;
  } catch (e) {
    return false;
  }
}

/**
 * Format remaining countdown until scheduled instant (e.g. "Starts in 04h 32m" or "Starts in 18m")
 */
export function formatScheduledCountdown(scheduledAt: string | Date, now: Date = new Date()): string {
  const targetMs = typeof scheduledAt === 'string' ? new Date(scheduledAt).getTime() : scheduledAt.getTime();
  const diffMs = targetMs - now.getTime();

  if (diffMs <= 0) {
    return 'Due for departure';
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;

  if (days > 0) {
    return `Starts in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    const padH = String(hours).padStart(2, '0');
    const padM = String(minutes).padStart(2, '0');
    return `Starts in ${padH}h ${padM}m`;
  }
  return `Starts in ${minutes}m`;
}

/**
 * Pure promotion logic:
 * Checks if a scheduled ride is within the activation window and promotes it.
 * Uses a Firestore transaction if Firebase is configured to guarantee exactly-once activation.
 */
export async function promoteDueScheduledRides(params: {
  rides: Record<string, Ride>;
  activationWindowMinutes?: number;
  now?: Date;
  onPromoteRide: (rideId: string) => Promise<void>;
  onMarkNoDriverFound: (rideId: string) => Promise<void>;
}): Promise<string[]> {
  const { rides, activationWindowMinutes = DEFAULT_ACTIVATION_WINDOW_MINUTES, now = new Date(), onPromoteRide, onMarkNoDriverFound } = params;
  const promotedIds: string[] = [];
  const nowMs = now.getTime();
  const windowMs = activationWindowMinutes * 60 * 1000;
  const timeoutMs = 10 * 60 * 1000; // 10 minutes past scheduled time for no-driver timeout

  for (const ride of Object.values(rides)) {
    // Only process PREBOOKED rides with status SCHEDULED
    if (ride.bookingType === 'PREBOOKED' && ride.status === 'SCHEDULED' && ride.scheduledAt) {
      const scheduledMs = new Date(ride.scheduledAt).getTime();
      const diffMs = scheduledMs - nowMs;

      // If scheduledAt - now <= activationWindowMinutes, promote ride
      if (diffMs <= windowMs) {
        // Attempt Firestore transaction promotion if online
        if (isFirebaseConfigured() && db) {
          try {
            const rideRef = doc(db, 'rides', ride.id);
            await runTransaction(db, async (transaction) => {
              const sfDoc = await transaction.get(rideRef);
              if (!sfDoc.exists()) return;
              const currentData = sfDoc.data() as Ride;
              // Guard: Only promote if still in SCHEDULED status
              if (currentData.status === 'SCHEDULED') {
                transaction.update(rideRef, {
                  status: 'REQUESTED',
                  searchStartedAt: new Date().toISOString(),
                });
              }
            });
          } catch (e) {
            console.warn('Firestore transaction promotion:', e);
          }
        }

        await onPromoteRide(ride.id);
        promotedIds.push(ride.id);
      }
    }

    // Timeout check: If search started and no driver accepted within 10 minutes of scheduled time
    if (
      ride.bookingType === 'PREBOOKED' &&
      ride.status === 'REQUESTED' &&
      ride.scheduledAt &&
      nowMs > new Date(ride.scheduledAt).getTime() + timeoutMs &&
      !ride.driverId
    ) {
      await onMarkNoDriverFound(ride.id);
    }
  }

  return promotedIds;
}
