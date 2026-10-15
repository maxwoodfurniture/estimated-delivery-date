/**
 * Delivery Estimate Service
 * Combines shop settings, shopper location and carrier transit time into a
 * delivery window for the storefront widget.
 */

import deliveryConfig from "../config/delivery.json";
import { carrierTransitCache } from "./cache.server.js";
import {
  CARRIERS,
  FEDEX_SERVICE_TYPES,
  getCarrierForShop,
} from "./carriers/index.js";
import {
  addBusinessDays,
  addDays,
  businessDaysBetween,
  formatDateRange,
  getZonedNow,
  nextWorkingDay,
  parseTimeToMinutes,
  toIsoDate,
} from "./dates.js";
import {
  getLocationFromIP,
  getLocationFromPostalCode,
  normalizeUsPostalCode,
} from "./geolocation.js";
import {
  getAppSettings,
  hasCarrierCredentials,
  parseProcessingDays,
} from "./settings.server.js";

/** Result codes. The storefront widget mirrors these. */
export const ESTIMATE_CODES = {
  OK: "OK",
  DISABLED: "DISABLED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  NEEDS_POSTAL_CODE: "NEEDS_POSTAL_CODE",
  INVALID_POSTAL_CODE: "INVALID_POSTAL_CODE",
  ERROR: "ERROR",
};

export const ESTIMATE_HTTP_STATUS = {
  [ESTIMATE_CODES.OK]: 200,
  [ESTIMATE_CODES.NEEDS_POSTAL_CODE]: 200,
  [ESTIMATE_CODES.INVALID_POSTAL_CODE]: 400,
  [ESTIMATE_CODES.DISABLED]: 404,
  [ESTIMATE_CODES.NOT_CONFIGURED]: 404,
  [ESTIMATE_CODES.ERROR]: 500,
};

const SUPPORTED_DESTINATION_COUNTRY = "US";
const SECTIONAL_CENTER_DIGITS = 3;
const { deliveryWindow, fallbackZones, displayLocale } = deliveryConfig;

const isFedExSandboxEnabled = () => process.env.FEDEX_USE_SANDBOX === "true";

function failure(code, error) {
  return { success: false, code, error };
}

/**
 * @param {{ shop: string, clientIP?: string|null, postalCode?: string|null }} request
 */
export async function getDeliveryEstimate({ shop, clientIP, postalCode }) {
  try {
    const settings = await getAppSettings(shop);
    if (!settings?.warehousePostalCode) {
      return failure(ESTIMATE_CODES.NOT_CONFIGURED, "App not configured");
    }
    if (!settings.isEnabled) {
      return failure(ESTIMATE_CODES.DISABLED, "Delivery estimates are disabled");
    }

    const destinationResult = await resolveDestination(clientIP, postalCode);
    if (!destinationResult.success) return destinationResult;
    const { destination } = destinationResult;

    const origin = {
      street: settings.warehouseStreet || undefined,
      city: settings.warehouseCity,
      state: settings.warehouseState,
      postalCode: settings.warehousePostalCode,
      countryCode: settings.warehouseCountryCode,
    };
    const shipDate = calculateShipDate(settings);

    const transit =
      (await getCarrierTransit(shop, settings, origin, destination, shipDate)) ??
      estimateFallbackTransit(origin, destination, shipDate);

    return buildEstimate(transit, destination, shipDate, settings);
  } catch (error) {
    console.error("[Delivery Estimate] Unexpected error:", error);
    return failure(ESTIMATE_CODES.ERROR, "Failed to calculate delivery estimate");
  }
}

async function resolveDestination(clientIP, postalCode) {
  if (postalCode) {
    const zip = normalizeUsPostalCode(postalCode);
    if (!zip) {
      return failure(
        ESTIMATE_CODES.INVALID_POSTAL_CODE,
        "Enter a valid 5-digit ZIP code",
      );
    }
    const destination = (await getLocationFromPostalCode(zip)) ?? {
      city: "",
      region: "",
      postalCode: zip,
      countryCode: SUPPORTED_DESTINATION_COUNTRY,
    };
    return { success: true, destination };
  }

  // No guessing: without a usable location, ask the shopper for a ZIP.
  const destination = await getLocationFromIP(clientIP);
  if (destination?.countryCode !== SUPPORTED_DESTINATION_COUNTRY) {
    return failure(ESTIMATE_CODES.NEEDS_POSTAL_CODE, "Enter your ZIP code");
  }
  return { success: true, destination };
}

/**
 * Ship date in the warehouse's timezone, honoring cutoff, processing days and
 * handling time. Exported for tests.
 */
export function calculateShipDate(settings, now = new Date()) {
  const processingDays = parseProcessingDays(settings.processingDays);
  const timeZone =
    settings.warehouseTimezone || deliveryConfig.defaults.warehouseTimezone;
  const cutoffMinutes =
    parseTimeToMinutes(settings.cutoffTime) ??
    parseTimeToMinutes(deliveryConfig.defaults.cutoffTime);

  const { date: today, minutesSinceMidnight } = getZonedNow(timeZone, now);
  const firstPossibleDay =
    minutesSinceMidnight >= cutoffMinutes ? addDays(today, 1) : today;

  return addBusinessDays(
    nextWorkingDay(firstPossibleDay, processingDays),
    settings.handlingTimeDays,
    processingDays,
  );
}

async function getCarrierTransit(shop, settings, origin, destination, shipDate) {
  if (!hasCarrierCredentials(settings)) return null;

  const useSandbox = isFedExSandboxEnabled();
  const cacheKey = [
    shop,
    CARRIERS.FEDEX,
    useSandbox,
    origin.postalCode,
    destination.postalCode,
    toIsoDate(shipDate),
  ].join("|");

  const cached = carrierTransitCache.get(cacheKey);
  if (cached) return cached;

  const carrier = getCarrierForShop(
    shop,
    CARRIERS.FEDEX,
    {
      apiKey: settings.fedexApiKey,
      secretKey: settings.fedexSecretKey,
      accountNumber: settings.fedexAccountNumber,
    },
    useSandbox,
  );

  const result = await carrier.getTransitTime({
    origin,
    destination: {
      city: destination.city,
      state: destination.region,
      postalCode: destination.postalCode,
      countryCode: destination.countryCode,
    },
    shipDate,
    serviceType: FEDEX_SERVICE_TYPES.GROUND,
  });

  if (!result.success) {
    console.warn(`[Delivery Estimate] FedEx fallback: ${result.error}`);
    return null;
  }

  carrierTransitCache.set(cacheKey, result);
  return result;
}

/** Rough US zone estimate from the first three ZIP digits. */
export function estimateTransitDaysByZone(originZip, destinationZip) {
  const originCenter = Number.parseInt(
    String(originZip ?? "").slice(0, SECTIONAL_CENTER_DIGITS),
    10,
  );
  const destinationCenter = Number.parseInt(
    String(destinationZip ?? "").slice(0, SECTIONAL_CENTER_DIGITS),
    10,
  );
  if (Number.isNaN(originCenter) || Number.isNaN(destinationCenter)) {
    return fallbackZones.unknownTransitDays;
  }

  const distance = Math.abs(originCenter - destinationCenter);
  const zone = fallbackZones.thresholds.find(
    (threshold) => distance < threshold.maxSectionalCenterDistance,
  );
  return zone ? zone.transitDays : fallbackZones.maxTransitDays;
}

function estimateFallbackTransit(origin, destination, shipDate) {
  const transitDays = estimateTransitDaysByZone(
    origin.postalCode,
    destination.postalCode,
  );
  const deliveryDateMin = addBusinessDays(shipDate, transitDays);
  return {
    deliveryDateMin,
    deliveryDateMax: addBusinessDays(
      deliveryDateMin,
      deliveryWindow.estimatedExtraDays,
    ),
    transitDays,
    isFallback: true,
  };
}

function buildEstimate(transit, destination, shipDate, settings) {
  const { deliveryDateMin, deliveryDateMax } = transit;
  const minimumDays = businessDaysBetween(shipDate, deliveryDateMin);
  const maximumDays = businessDaysBetween(shipDate, deliveryDateMax);
  const dateText = settings.showExactDates
    ? formatDateRange(deliveryDateMin, deliveryDateMax, displayLocale)
    : `${minimumDays}-${maximumDays} business days`;

  return {
    success: true,
    code: ESTIMATE_CODES.OK,
    displayText: `Arrives ${dateText}`,
    location: formatLocation(destination),
    deliveryDateMin: toIsoDate(deliveryDateMin),
    deliveryDateMax: toIsoDate(deliveryDateMax),
    transitDays: transit.transitDays,
    isFallback: !!transit.isFallback,
  };
}

/** "Summerville, SC", or whatever parts are known. */
function formatLocation(location) {
  const parts = [location.city, location.region].filter(Boolean);
  return parts.length > 0
    ? parts.join(", ")
    : location.postalCode || location.countryCode;
}
