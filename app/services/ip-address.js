/**
 * IP address helpers. Pure functions, no I/O.
 */

const IPV4_MAPPED_IPV6_PREFIX = "::ffff:";

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^0\./,
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1?$/, // loopback and unspecified
  /^f[cd][0-9a-f]{2}:/i, // unique local fc00::/7
  /^fe[89ab][0-9a-f]:/i, // link local fe80::/10
];

/** Strip a list (first entry wins) and IPv4-mapped IPv6 prefix. */
export function normalizeIP(value) {
  if (!value) return "";
  let ip = value.split(",")[0].trim();
  if (ip.toLowerCase().startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
    ip = ip.slice(IPV4_MAPPED_IPV6_PREFIX.length);
  }
  return ip;
}

/** True for loopback, private, link-local and other non-routable addresses. */
export function isPrivateIP(ip) {
  if (!ip || ip === "localhost") return true;
  const patterns = ip.includes(":")
    ? PRIVATE_IPV6_PATTERNS
    : PRIVATE_IPV4_PATTERNS;
  return patterns.some((pattern) => pattern.test(ip));
}
