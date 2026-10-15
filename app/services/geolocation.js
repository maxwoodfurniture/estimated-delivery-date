/**
 * Geolocation service.
 * Resolves a shopper's location from their IP address or a US ZIP code.
 * Results are cached in memory (see cache.server.js).
 */

import deliveryConfig from "../config/delivery.json";
import { ipLocationCache, postalCodeLocationCache } from "./cache.server.js";
import { isPrivateIP, normalizeIP } from "./ip-address.js";

/**
 * @typedef {Object} GeoLocation
 * @property {string} city
 * @property {string} region - State code or name
 * @property {string} postalCode
 * @property {string} countryCode - ISO country code
 * @property {string} source - Which service provided the data
 */

const US_ZIP_PATTERN = /^(\d{5})(?:-?\d{4})?$/;

// Client IP headers, most trusted first.
const CLIENT_IP_HEADERS = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "x-client-ip",
  "x-cluster-client-ip",
];

// HTTPS providers that allow commercial use. Set IPINFO_TOKEN for higher limits.
const GEOLOCATION_SERVICES = [
  {
    name: "ipapi.co",
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parse: (data) =>
      data.error
        ? null
        : {
            city: data.city,
            region: data.region_code,
            postalCode: data.postal,
            countryCode: data.country_code,
          },
  },
  {
    name: "ipinfo.io",
    url: (ip) => {
      const token = process.env.IPINFO_TOKEN;
      return `https://ipinfo.io/${ip}/json${token ? `?token=${token}` : ""}`;
    },
    parse: (data) =>
      data.bogon || !data.city
        ? null
        : {
            city: data.city,
            region: data.region,
            postalCode: data.postal,
            countryCode: data.country,
          },
  },
];

async function fetchJson(url, timeoutMilliseconds) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMilliseconds),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Look up a public IP address. Returns null for missing or private IPs,
 * because providers would otherwise geolocate the server itself.
 * @param {string|null} ipAddress
 * @returns {Promise<GeoLocation|null>}
 */
export async function getLocationFromIP(ipAddress) {
  const ip = normalizeIP(ipAddress);
  if (isPrivateIP(ip)) return null;

  const cached = ipLocationCache.get(ip);
  if (cached !== undefined) return cached;

  for (const service of GEOLOCATION_SERVICES) {
    try {
      const data = await fetchJson(
        service.url(encodeURIComponent(ip)),
        deliveryConfig.timeoutsMs.geolocation,
      );
      const location = service.parse(data);
      if (location?.postalCode) {
        const result = { ...location, source: service.name };
        ipLocationCache.set(ip, result);
        return result;
      }
    } catch (error) {
      console.warn(`[Geolocation] ${service.name} failed: ${error.message}`);
    }
  }

  return null;
}

/**
 * Best-guess client IP from proxy/CDN headers.
 * @param {Request} request
 * @returns {string|null}
 */
export function getClientIP(request) {
  for (const header of CLIENT_IP_HEADERS) {
    const ip = normalizeIP(request.headers.get(header));
    if (ip && !isPrivateIP(ip)) return ip;
  }
  return null;
}

/**
 * Normalize "29401", "29401-1234" or "294011234" to five digits.
 * @returns {string|null}
 */
export function normalizeUsPostalCode(value) {
  const match = US_ZIP_PATTERN.exec((value ?? "").trim());
  return match ? match[1] : null;
}

/**
 * Look up city and state for a US ZIP code (zippopotam.us, no key needed).
 * @param {string} postalCode - Five-digit ZIP
 * @returns {Promise<GeoLocation|null>}
 */
export async function getLocationFromPostalCode(postalCode) {
  const cached = postalCodeLocationCache.get(postalCode);
  if (cached !== undefined) return cached;

  try {
    const data = await fetchJson(
      `https://api.zippopotam.us/us/${postalCode}`,
      deliveryConfig.timeoutsMs.postalCodeLookup,
    );
    const place = data.places?.[0];
    if (!place) return null;

    const result = {
      city: place["place name"],
      region: place["state abbreviation"],
      postalCode,
      countryCode: data["country abbreviation"],
      source: "zippopotam.us",
    };
    postalCodeLocationCache.set(postalCode, result);
    return result;
  } catch (error) {
    console.warn(`[Geolocation] ZIP lookup failed: ${error.message}`);
    return null;
  }
}
