/**
 * Carrier-agnostic type definitions for shipping services
 * This allows easy addition of new carriers (UPS, USPS, etc.) in the future
 */

/**
 * @typedef {Object} Address
 * @property {string} [street] - Street address (optional for destination)
 * @property {string} city - City name
 * @property {string} state - State/Province code (e.g., "SC", "CA")
 * @property {string} postalCode - Postal/ZIP code
 * @property {string} countryCode - ISO country code (e.g., "US", "CA")
 */

/**
 * @typedef {Object} TransitTimeRequest
 * @property {Address} origin - Shipping origin (warehouse)
 * @property {Address} destination - Shipping destination (customer)
 * @property {Date} [shipDate] - Planned ship date (defaults to next business day based on handling time)
 * @property {string} [serviceType] - Carrier-specific service type (e.g., "FEDEX_GROUND")
 */

/**
 * @typedef {Object} TransitTimeResponse
 * @property {boolean} success - Whether the request was successful
 * @property {string} [error] - Error message if unsuccessful
 * @property {Date} [deliveryDateMin] - Earliest estimated delivery date
 * @property {Date} [deliveryDateMax] - Latest estimated delivery date
 * @property {number} [transitDays] - Number of transit days
 * @property {string} [serviceName] - Human-readable service name
 * @property {string} carrier - Carrier identifier (e.g., "fedex", "ups")
 */

/**
 * @typedef {Object} CarrierCredentials
 * @property {string} [apiKey] - API key
 * @property {string} [secretKey] - Secret key
 * @property {string} [accountNumber] - Account number
 */

export const CARRIERS = {
  FEDEX: "fedex",
  UPS: "ups",
  USPS: "usps",
};

export const FEDEX_SERVICE_TYPES = {
  GROUND: "FEDEX_GROUND",
  EXPRESS_SAVER: "FEDEX_EXPRESS_SAVER",
  TWO_DAY: "FEDEX_2_DAY",
  OVERNIGHT: "STANDARD_OVERNIGHT",
  PRIORITY_OVERNIGHT: "PRIORITY_OVERNIGHT",
};
