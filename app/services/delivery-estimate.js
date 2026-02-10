/**
 * Delivery Estimate Service
 * Combines carrier services, geolocation, and app settings to provide delivery estimates
 */

import prisma from "../db.server.js";
import {
  createCarrier,
  CARRIERS,
  FEDEX_SERVICE_TYPES,
} from "./carriers/index.js";
import {
  getLocationFromIP,
  getDefaultLocation,
  getLocationFromPostalCode,
} from "./geolocation.js";

/**
 * @typedef {Object} DeliveryEstimate
 * @property {boolean} success - Whether the estimate was successful
 * @property {string} [error] - Error message if unsuccessful
 * @property {string} [deliveryDateMin] - Earliest delivery date (formatted string)
 * @property {string} [deliveryDateMax] - Latest delivery date (formatted string)
 * @property {string} [displayText] - Human-readable delivery text (e.g., "Arrives Feb 10 - Feb 12")
 * @property {string} [location] - Destination location text (e.g., "Summerville, United States")
 * @property {number} [transitDays] - Estimated transit days
 */

/**
 * Get delivery estimate for a shop and customer IP
 *
 * @param {string} shop - Shopify shop domain
 * @param {string} [customerIP] - Customer's IP address for geolocation
 * @param {string} [postalCode] - Override postal code (if customer provided one)
 * @returns {Promise<DeliveryEstimate>}
 */
export async function getDeliveryEstimate(shop, customerIP, postalCode) {
  try {
    // Get app settings for this shop
    const settings = await getAppSettings(shop);

    if (!settings) {
      return {
        success: false,
        error: "App not configured for this shop",
      };
    }

    if (!settings.isEnabled) {
      return {
        success: false,
        error: "Delivery estimates are disabled",
      };
    }

    // Get customer location
    let destination;
    if (postalCode) {
      // Look up city and state from postal code
      destination = await getLocationFromPostalCode(postalCode);

      if (!destination) {
        // If lookup fails, use just the postal code
        console.warn(
          `Could not resolve location for postal code: ${postalCode}`,
        );
        destination = {
          postalCode,
          city: "",
          region: "",
          countryCode: "US",
        };
      }
    } else {
      // Geolocate from IP
      destination = await getLocationFromIP(customerIP);
      if (!destination) {
        destination = getDefaultLocation();
      }
    }

    // Build origin from warehouse settings
    const origin = {
      street: settings.warehouseStreet || undefined,
      city: settings.warehouseCity,
      state: settings.warehouseState,
      postalCode: settings.warehousePostalCode,
      countryCode: settings.warehouseCountryCode,
    };

    // Calculate ship date based on handling time, cutoff, and processing days
    const shipDate = calculateShipDate(
      settings.handlingTimeDays,
      settings.cutoffTime,
      settings.processingDays,
    );

    // Only try FedEx API if credentials are configured
    let transitResult = null;

    if (
      settings.fedexApiKey &&
      settings.fedexSecretKey &&
      settings.fedexAccountNumber
    ) {
      try {
        console.log("[Delivery Estimate] Using FedEx API (sandbox mode)");

        // Create carrier and get transit time (use sandbox by default for testing)
        const carrier = createCarrier(
          CARRIERS.FEDEX,
          {
            apiKey: settings.fedexApiKey,
            secretKey: settings.fedexSecretKey,
            accountNumber: settings.fedexAccountNumber,
          },
          true,
        ); // Use sandbox mode

        transitResult = await carrier.getTransitTime({
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

        if (transitResult.success) {
          console.log("[Delivery Estimate] FedEx API succeeded:", {
            transitDays: transitResult.transitDays,
            deliveryDate: transitResult.deliveryDateMin,
          });
        }
      } catch (error) {
        console.warn(
          "[Delivery Estimate] FedEx API error, using fallback:",
          error.message,
        );
        transitResult = { success: false };
      }
    } else {
      console.log(
        "[Delivery Estimate] FedEx credentials not configured, using fallback",
      );
    }

    if (!transitResult || !transitResult.success) {
      // Try fallback estimate based on distance zones
      console.log("[Delivery Estimate] Using fallback zone-based estimation");
      return generateFallbackEstimate(origin, destination, shipDate, settings);
    }

    // Format the response
    const locationText = formatLocation(destination);
    const dateText = settings.showExactDates
      ? formatDateRange(
          transitResult.deliveryDateMin,
          transitResult.deliveryDateMax,
        )
      : formatTransitDays(transitResult.transitDays);

    return {
      success: true,
      deliveryDateMin: transitResult.deliveryDateMin?.toISOString(),
      deliveryDateMax: transitResult.deliveryDateMax?.toISOString(),
      displayText: `Arrives ${dateText}`,
      location: locationText,
      transitDays: transitResult.transitDays,
    };
  } catch (error) {
    console.error("Error getting delivery estimate:", error);
    return {
      success: false,
      error: "Failed to calculate delivery estimate",
    };
  }
}

/**
 * Get app settings for a shop
 * @param {string} shop - Shop domain
 */
export async function getAppSettings(shop) {
  return await prisma.appSettings.findUnique({
    where: { shop },
  });
}

/**
 * Save app settings for a shop
 * @param {string} shop - Shop domain
 * @param {Object} data - Settings data
 */
export async function saveAppSettings(shop, data) {
  return await prisma.appSettings.upsert({
    where: { shop },
    update: {
      ...data,
      updatedAt: new Date(),
    },
    create: {
      shop,
      ...data,
    },
  });
}

/**
 * Calculate the ship date based on handling time, cutoff, and processing days
 */
function calculateShipDate(
  handlingDays,
  cutoffTime,
  processingDaysStr = "1,2,3,4,5",
) {
  // Parse processing days (0=Sun, 1=Mon, ..., 6=Sat)
  const processingDays = processingDaysStr
    .split(",")
    .map((d) => parseInt(d, 10))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6);

  // Default to Mon-Fri if empty
  if (processingDays.length === 0) {
    processingDays.push(1, 2, 3, 4, 5);
  }

  const now = new Date();
  const [cutoffHour, cutoffMinute] = cutoffTime.split(":").map(Number);

  // Create cutoff time for today
  const cutoff = new Date(now);
  cutoff.setHours(cutoffHour, cutoffMinute, 0, 0);

  // Start with today's date
  let shipDate = new Date(now);

  // If we're past cutoff, start from tomorrow
  if (now >= cutoff) {
    shipDate.setDate(shipDate.getDate() + 1);
  }

  // Move to next processing day if current day is not a processing day
  while (!processingDays.includes(shipDate.getDay())) {
    shipDate.setDate(shipDate.getDate() + 1);
  }

  // Add handling days (only count processing days)
  let daysAdded = 0;
  while (daysAdded < handlingDays) {
    shipDate.setDate(shipDate.getDate() + 1);
    // Only count processing days
    if (processingDays.includes(shipDate.getDay())) {
      daysAdded++;
    }
  }

  // If ship date falls on non-processing day, move to next processing day
  while (!processingDays.includes(shipDate.getDay())) {
    shipDate.setDate(shipDate.getDate() + 1);
  }

  return shipDate;
}

/**
 * Generate a fallback estimate when carrier API fails
 * Uses zone-based estimation
 */
function generateFallbackEstimate(origin, destination, shipDate, settings) {
  // Estimate transit days based on postal code zones
  const transitDays = estimateTransitDays(
    origin.postalCode,
    destination.postalCode,
  );

  const deliveryDateMin = addBusinessDays(shipDate, transitDays);
  const deliveryDateMax = addBusinessDays(shipDate, transitDays + 2);

  const locationText = formatLocation(destination);
  const dateText = settings.showExactDates
    ? formatDateRange(deliveryDateMin, deliveryDateMax)
    : formatTransitDays(transitDays);

  return {
    success: true,
    deliveryDateMin: deliveryDateMin.toISOString(),
    deliveryDateMax: deliveryDateMax.toISOString(),
    displayText: `Arrives ${dateText}`,
    location: locationText,
    transitDays,
    isFallback: true,
  };
}

/**
 * Estimate transit days based on US postal code zones
 * This is a rough approximation when the carrier API is unavailable
 */
function estimateTransitDays(originZip, destZip) {
  if (!originZip || !destZip) return 5; // Default to 5 days

  // Get the first 3 digits (sectional center)
  const originSCF = parseInt(originZip.substring(0, 3), 10);
  const destSCF = parseInt(destZip.substring(0, 3), 10);

  // Very rough zone estimation based on SCF distance
  const scfDiff = Math.abs(originSCF - destSCF);

  if (scfDiff < 50) return 2; // Same region: 2 days
  if (scfDiff < 200) return 3; // Nearby region: 3 days
  if (scfDiff < 400) return 4; // Cross-region: 4 days
  if (scfDiff < 600) return 5; // Cross-country: 5 days
  return 6; // Coast-to-coast: 6 days
}

/**
 * Add business days to a date
 */
function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;

  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      added++;
    }
  }

  return result;
}

/**
 * Format a date range for display
 * e.g., "Feb 10 - Feb 12" or "Feb 10 - 12" if same month
 */
function formatDateRange(minDate, maxDate) {
  const options = { month: "short", day: "numeric" };
  const minStr = minDate.toLocaleDateString("en-US", options);

  if (minDate.getMonth() === maxDate.getMonth()) {
    return `${minStr} - ${maxDate.getDate()}`;
  }

  const maxStr = maxDate.toLocaleDateString("en-US", options);
  return `${minStr} - ${maxStr}`;
}

/**
 * Format transit days for display
 * e.g., "3-5 business days"
 */
function formatTransitDays(days) {
  const max = days + 2;
  return `${days}-${max} business days`;
}

/**
 * Format location for display
 * e.g., "Summerville, United States"
 */
function formatLocation(location) {
  if (location.city && location.region) {
    return `${location.city}, ${location.region}`;
  }

  if (location.city) {
    return location.city;
  }

  return location.region || location.countryCode;
}
