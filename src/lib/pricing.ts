import { PricingConfig, RideFareBreakdown, VehicleType } from '../types';

export const DEFAULT_PRICING: Record<VehicleType, PricingConfig> = {
  bike: {
    vehicleType: 'bike',
    name: 'ĀroHana Moto',
    baseFare: 25,
    perKmRate: 8,
    perMinRate: 1.0,
    maxSurgeCapPercent: 25,
    demandThresholdRatio: 1.2,
    capacity: 1,
    description: 'Fast, agile, eco-friendly solo ride through traffic',
  },
  auto: {
    vehicleType: 'auto',
    name: 'ĀroHana Auto',
    baseFare: 35,
    perKmRate: 12,
    perMinRate: 1.2,
    maxSurgeCapPercent: 25,
    demandThresholdRatio: 1.2,
    capacity: 3,
    description: 'Everyday pocket-friendly commute for up to 3 people',
  },
  sedan: {
    vehicleType: 'sedan',
    name: 'ĀroHana Comfort',
    baseFare: 60,
    perKmRate: 16,
    perMinRate: 1.5,
    maxSurgeCapPercent: 25,
    demandThresholdRatio: 1.2,
    capacity: 4,
    description: 'Spacious AC sedans with top-rated professional drivers',
  },
  suv: {
    vehicleType: 'suv',
    name: 'ĀroHana XL',
    baseFare: 90,
    perKmRate: 22,
    perMinRate: 2.0,
    maxSurgeCapPercent: 25,
    demandThresholdRatio: 1.2,
    capacity: 6,
    description: 'Premium spacious 6-seater for family and airport luggage',
  },
};

/**
 * Calculates fair surge pricing:
 * fare = base + perKm*km + perMin*min
 * rawSurge = based on demand/supply ratio exceeding threshold
 * appliedSurge = min(rawSurge, maxSurge%)
 * Final fare must NEVER exceed base * (1 + maxSurgeCapPercent / 100) + distance/time fare
 * or total base * (1 + cap). Specifically the user requested:
 * "appliedSurge = min(rawSurge, maxSurge%), default cap 25%. Final fare must never exceed base*(1+cap). Re-check the cap in a Firestore rule and again at booking time."
 */
export function calculateFare(
  vehicleType: VehicleType,
  distanceKm: number,
  durationMin: number,
  demandSupplyRatio: number = 1.0,
  pricingOverrides?: Partial<PricingConfig>
): RideFareBreakdown {
  const config = {
    ...DEFAULT_PRICING[vehicleType],
    ...(pricingOverrides || {}),
  };

  const baseFare = config.baseFare;
  const distanceFare = Math.round(distanceKm * config.perKmRate);
  const timeFare = Math.round(durationMin * config.perMinRate);
  const unscaledSubtotal = baseFare + distanceFare + timeFare;

  // Calculate raw surge from demand/supply
  let rawSurgePercent = 0;
  if (demandSupplyRatio > config.demandThresholdRatio) {
    // E.g. ratio = 1.8, threshold = 1.2 -> surge = (1.8 - 1.2) * 50% = 30%
    rawSurgePercent = Math.round((demandSupplyRatio - config.demandThresholdRatio) * 50);
  }

  // Hard clamp applied surge to maxSurgeCapPercent
  const maxCap = config.maxSurgeCapPercent;
  const appliedSurgePercent = Math.max(0, Math.min(rawSurgePercent, maxCap));
  const isCapped = rawSurgePercent > maxCap;

  // Surge applies transparently
  const surgeAmount = Math.round(unscaledSubtotal * (appliedSurgePercent / 100));
  const calculatedFare = unscaledSubtotal + surgeAmount;

  // The maximum allowed fare guaranteed under the consumer protection cap
  const maxAllowedFare = Math.round(unscaledSubtotal * (1 + maxCap / 100));

  // Enforce absolute cap
  const finalFare = Math.min(calculatedFare, maxAllowedFare);

  return {
    baseFare,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin: Math.round(durationMin),
    distanceFare,
    timeFare,
    rawSurgePercent,
    appliedSurgePercent,
    surgeAmount,
    finalFare,
    maxAllowedFare,
    isCapped,
  };
}
