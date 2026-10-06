/**
 * Unit tests for Time-Slot Pre-Booking
 * Tests:
 * 1. 12:00 AM (start of day)
 * 2. 12:30 AM (early morning)
 * 3. 12:00 PM (noon)
 * 4. 11:30 PM (end of day)
 * 5. Day rollover
 * 6. Past slot check for today & lead-time validation
 */

import {
  generateTimeSlots,
  parseSlotStringTo24Hour,
  combineDateAndSlotToInstant,
  validateSlotSelection,
  isSlotDisabledForDate,
  formatScheduledCountdown,
} from './prebooking';

export function runPrebookingUnitTests(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      results.push(`✅ PASS: ${desc}`);
    } else {
      results.push(`❌ FAIL: ${desc}`);
      allPassed = false;
    }
  }

  try {
    // 1. Slot count check (48 half-hour slots per 24 hours)
    const slots = generateTimeSlots();
    assert(slots.length === 48, 'generateTimeSlots returns 48 slots');

    // 2. Test 12:00 AM (00:00 - start of day)
    const t12am = parseSlotStringTo24Hour('12:00 AM');
    assert(t12am.hour === 0 && t12am.minute === 0, '12:00 AM parses to hour 0, minute 0');
    const d12am = combineDateAndSlotToInstant('2026-10-10', '12:00 AM');
    assert(d12am.getHours() === 0 && d12am.getMinutes() === 0, 'combineDateAndSlotToInstant(2026-10-10, 12:00 AM) is 00:00 on Oct 10');

    // 3. Test 12:30 AM (00:30)
    const t1230am = parseSlotStringTo24Hour('12:30 AM');
    assert(t1230am.hour === 0 && t1230am.minute === 30, '12:30 AM parses to hour 0, minute 30');
    const d1230am = combineDateAndSlotToInstant('2026-10-10', '12:30 AM');
    assert(d1230am.getHours() === 0 && d1230am.getMinutes() === 30, 'combineDateAndSlotToInstant(2026-10-10, 12:30 AM) is 00:30 on Oct 10');

    // 4. Test 12:00 PM (12:00 - noon)
    const t12pm = parseSlotStringTo24Hour('12:00 PM');
    assert(t12pm.hour === 12 && t12pm.minute === 0, '12:00 PM parses to hour 12, minute 0 (noon)');
    const d12pm = combineDateAndSlotToInstant('2026-10-10', '12:00 PM');
    assert(d12pm.getHours() === 12 && d12pm.getMinutes() === 0, 'combineDateAndSlotToInstant(2026-10-10, 12:00 PM) is 12:00 noon on Oct 10');

    // 5. Test 11:30 PM (23:30 - end of day)
    const t1130pm = parseSlotStringTo24Hour('11:30 PM');
    assert(t1130pm.hour === 23 && t1130pm.minute === 30, '11:30 PM parses to hour 23, minute 30');
    const d1130pm = combineDateAndSlotToInstant('2026-10-10', '11:30 PM');
    assert(d1130pm.getHours() === 23 && d1130pm.getMinutes() === 30, 'combineDateAndSlotToInstant(2026-10-10, 11:30 PM) is 23:30 on Oct 10');

    // 6. Day rollover test: 11:30 PM on Oct 10 vs 12:00 AM on Oct 11 is exactly 30 minutes apart
    const dOct11Start = combineDateAndSlotToInstant('2026-10-11', '12:00 AM');
    const diffMs = dOct11Start.getTime() - d1130pm.getTime();
    assert(diffMs === 30 * 60 * 1000, 'Day rollover: Oct 10 11:30 PM to Oct 11 12:00 AM is exactly 30 minutes apart');

    // 7. Test 1:00 AM vs 1:00 PM
    const d1am = combineDateAndSlotToInstant('2026-10-10', '1:00 AM');
    const d1pm = combineDateAndSlotToInstant('2026-10-10', '1:00 PM');
    assert(d1pm.getTime() - d1am.getTime() === 12 * 60 * 60 * 1000, '1:00 AM and 1:00 PM on same date are distinct by 12 hours');

    // 8. Past slot check for today:
    // If current time is 10:00 AM, 9:30 AM should be disabled, 10:15 AM should be disabled (under 30m lead), 11:00 AM should be allowed
    const fakeNow = new Date('2026-10-10T10:00:00');
    const pastSlotDisabled = isSlotDisabledForDate('2026-10-10', '9:30 AM', fakeNow, 30);
    assert(pastSlotDisabled === true, 'Slot 9:30 AM is disabled when current time is 10:00 AM on same day');

    const underLeadTimeDisabled = isSlotDisabledForDate('2026-10-10', '10:15 AM', fakeNow, 30);
    assert(underLeadTimeDisabled === true, 'Slot 10:15 AM is disabled when minimum lead time is 30 minutes');

    const futureSlotEnabled = isSlotDisabledForDate('2026-10-10', '11:00 AM', fakeNow, 30);
    assert(futureSlotEnabled === false, 'Slot 11:00 AM is enabled when current time is 10:00 AM (>30 min lead)');

    // 9. Countdown formatting test
    const futureDate = new Date(fakeNow.getTime() + 4 * 3600 * 1000 + 32 * 60 * 1000);
    const countdown = formatScheduledCountdown(futureDate, fakeNow);
    assert(countdown === 'Starts in 04h 32m', 'Countdown formats correctly: Starts in 04h 32m');

  } catch (err: any) {
    results.push(`💥 Exception during tests: ${err.message}`);
    allPassed = false;
  }

  return { passed: allPassed, results };
}
