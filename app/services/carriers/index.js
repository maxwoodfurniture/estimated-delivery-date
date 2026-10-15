/**
 * Carrier service factory.
 * Carrier instances are cached per shop so OAuth tokens survive between
 * requests. A credential change produces a new instance.
 */

import { createHash } from "node:crypto";
import { FedExCarrier } from "./fedex-carrier.js";
import { CARRIERS } from "./types.js";

export { CARRIERS, FEDEX_SERVICE_TYPES } from "./types.js";
export { FedExCarrier } from "./fedex-carrier.js";
export { BaseCarrier } from "./base-carrier.js";

const CARRIER_CLASSES = {
  [CARRIERS.FEDEX]: FedExCarrier,
};

/** @type {Map<string, {fingerprint: string, carrier: import('./base-carrier.js').BaseCarrier}>} */
const carrierInstances = new Map();

function fingerprintCredentials(credentials, useSandbox) {
  return createHash("sha256")
    .update(JSON.stringify({ ...credentials, useSandbox }))
    .digest("hex");
}

/**
 * Create a carrier instance based on carrier type.
 * @param {string} carrierType - Value from CARRIERS
 * @param {import('./types.js').CarrierCredentials} credentials
 * @param {boolean} useSandbox
 */
export function createCarrier(carrierType, credentials, useSandbox = false) {
  const CarrierClass = CARRIER_CLASSES[carrierType];
  if (!CarrierClass) {
    throw new Error(`Unsupported carrier: ${carrierType}`);
  }
  return new CarrierClass(credentials, useSandbox);
}

/**
 * Reuse one carrier instance per shop and carrier while credentials match.
 */
export function getCarrierForShop(
  shop,
  carrierType,
  credentials,
  useSandbox = false,
) {
  const key = `${shop}:${carrierType}`;
  const fingerprint = fingerprintCredentials(credentials, useSandbox);
  const existing = carrierInstances.get(key);
  if (existing?.fingerprint === fingerprint) return existing.carrier;

  const carrier = createCarrier(carrierType, credentials, useSandbox);
  carrierInstances.set(key, { fingerprint, carrier });
  return carrier;
}

/** Drop cached carriers for a shop, e.g. after uninstall. */
export function forgetCarriersForShop(shop) {
  for (const key of carrierInstances.keys()) {
    if (key.startsWith(`${shop}:`)) carrierInstances.delete(key);
  }
}
