/**
 * Geolocation service for automatically determining user location
 * Uses public IP-based geolocation APIs - no browser permissions required
 *
 * This service provides fallback mechanisms to ensure reliable location detection
 */

/**
 * @typedef {Object} GeoLocation
 * @property {string} city - City name
 * @property {string} region - State/Province code
 * @property {string} postalCode - Postal/ZIP code
 * @property {string} countryCode - ISO country code
 * @property {number} [latitude] - Latitude
 * @property {number} [longitude] - Longitude
 * @property {string} source - Which service provided the data
 */

// List of free geolocation APIs to try (in order of preference)
const GEOLOCATION_SERVICES = [
  {
    name: "ip-api",
    url: (ip) =>
      `http://ip-api.com/json/${ip || ""}?fields=status,city,region,zip,countryCode,lat,lon`,
    parse: (data) => {
      if (data.status !== "success") return null;
      return {
        city: data.city,
        region: data.region,
        postalCode: data.zip,
        countryCode: data.countryCode,
        latitude: data.lat,
        longitude: data.lon,
      };
    },
  },
  {
    name: "ipapi.co",
    url: (ip) => `https://ipapi.co/${ip || "json"}/json/`,
    parse: (data) => {
      if (data.error) return null;
      return {
        city: data.city,
        region: data.region_code,
        postalCode: data.postal,
        countryCode: data.country_code,
        latitude: data.latitude,
        longitude: data.longitude,
      };
    },
  },
  {
    name: "ipinfo.io",
    url: (ip) => `https://ipinfo.io/${ip || ""}/json`,
    parse: (data) => {
      if (!data.city) return null;
      const [lat, lon] = (data.loc || "").split(",").map(Number);
      return {
        city: data.city,
        region: data.region,
        postalCode: data.postal,
        countryCode: data.country,
        latitude: lat || undefined,
        longitude: lon || undefined,
      };
    },
  },
];

/**
 * Get location from IP address using public geolocation APIs
 * Tries multiple services with fallback
 *
 * @param {string} [ipAddress] - IP address to geolocate (uses requester's IP if not provided)
 * @returns {Promise<GeoLocation|null>}
 */
export async function getLocationFromIP(ipAddress) {
  // Clean up the IP address (handle IPv6-mapped IPv4, proxied IPs, etc.)
  const cleanIP = cleanIPAddress(ipAddress);

  for (const service of GEOLOCATION_SERVICES) {
    try {
      const response = await fetch(service.url(cleanIP), {
        headers: {
          Accept: "application/json",
        },
        // Timeout after 3 seconds per service
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        console.warn(
          `Geolocation service ${service.name} returned ${response.status}`,
        );
        continue;
      }

      const data = await response.json();
      const location = service.parse(data);

      if (location && location.postalCode) {
        return {
          ...location,
          source: service.name,
        };
      }
    } catch (error) {
      console.warn(
        `Geolocation service ${service.name} failed:`,
        error.message,
      );
      continue;
    }
  }

  console.error("All geolocation services failed");
  return null;
}

/**
 * Clean up IP address for geolocation lookup
 * Handles various IP formats from different proxy/CDN setups
 */
function cleanIPAddress(ip) {
  if (!ip) return "";

  // Handle comma-separated IPs (from X-Forwarded-For)
  if (ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  // Handle IPv6-mapped IPv4 (::ffff:192.168.1.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // Don't look up localhost/private IPs
  if (isPrivateIP(ip)) {
    return "";
  }

  return ip;
}

/**
 * Check if an IP is private/local (can't be geolocated)
 */
function isPrivateIP(ip) {
  if (!ip) return true;

  // IPv4 private ranges
  if (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip === "::1"
  ) {
    return true;
  }

  return false;
}

/**
 * Get client IP from request headers
 * Handles various proxy/CDN setups (Cloudflare, nginx, etc.)
 *
 * @param {Request} request - The incoming request
 * @returns {string|null}
 */
export function getClientIP(request) {
  const headers = request.headers;

  // Try different headers in order of reliability
  const ipHeaders = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // nginx
    "x-forwarded-for", // Standard proxy header
    "x-client-ip", // Various proxies
    "true-client-ip", // Akamai
    "x-cluster-client-ip", // Various load balancers
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // X-Forwarded-For may contain multiple IPs, take the first
      const ip = value.split(",")[0].trim();
      if (ip && !isPrivateIP(ip)) {
        return ip;
      }
    }
  }

  return null;
}

/**
 * Get a default fallback location (used when geolocation fails)
 * Defaults to a central US location
 *
 * @returns {GeoLocation}
 */
export function getDefaultLocation() {
  return {
    city: "Kansas City",
    region: "MO",
    postalCode: "64106",
    countryCode: "US",
    source: "default",
  };
}

/**
 * Look up city and state from a US postal code
 * Uses the free ZipCodeAPI service
 *
 * @param {string} postalCode - US ZIP code
 * @returns {Promise<GeoLocation|null>}
 */
export async function getLocationFromPostalCode(postalCode) {
  if (!postalCode) return null;

  // Clean the postal code (remove spaces, dashes, etc.)
  const cleanZip = postalCode.replace(/[^0-9]/g, "").substring(0, 5);

  if (cleanZip.length !== 5) {
    console.warn(`Invalid postal code format: ${postalCode}`);
    return null;
  }

  try {
    // Try zippopotam.us (free, no API key required)
    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`Postal code lookup failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      return null;
    }

    const place = data.places[0];

    return {
      city: place["place name"],
      region: place["state abbreviation"],
      postalCode: cleanZip,
      countryCode: data["country abbreviation"],
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
      source: "postal-code-lookup",
    };
  } catch (error) {
    console.warn(`Postal code lookup failed for ${cleanZip}:`, error.message);
    return null;
  }
}
