/**
 * Carrier service factory
 * Creates carrier instances based on carrier type
 */

import { FedExCarrier } from "./fedex-carrier.js";
import { CARRIERS } from "./types.js";

export { CARRIERS, FEDEX_SERVICE_TYPES } from "./types.js";
export { FedExCarrier } from "./fedex-carrier.js";
export { BaseCarrier } from "./base-carrier.js";

/**
 * Create a carrier instance based on carrier type
 * @param {string} carrierType - Carrier type from CARRIERS enum
 * @param {import('./types.js').CarrierCredentials} credentials - Carrier API credentials
 * @param {boolean} useSandbox - Whether to use sandbox/test environment
 * @returns {import('./base-carrier.js').BaseCarrier}
 */
export function createCarrier(carrierType, credentials, useSandbox = false) {
  switch (carrierType) {
    case CARRIERS.FEDEX:
      return new FedExCarrier(credentials, useSandbox);

    // Future carriers can be added here:
    // case CARRIERS.UPS:
    //   return new UPSCarrier(credentials, useSandbox);
    // case CARRIERS.USPS:
    //   return new USPSCarrier(credentials, useSandbox);

    default:
      throw new Error(`Unsupported carrier: ${carrierType}`);
  }
}

/**
 * Get list of supported carriers
 * @returns {string[]}
 */
export function getSupportedCarriers() {
  return [CARRIERS.FEDEX];
  // When more carriers are added: return Object.values(CARRIERS);
}
