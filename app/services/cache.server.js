/**
 * Process-wide in-memory TTL caches (module singletons).
 *
 * Fine for a single instance. If the app scales horizontally, swap the
 * backing store for a shared one; callers only use get/set.
 */

import deliveryConfig from "../config/delivery.json";

const MILLISECONDS_PER_SECOND = 1000;

class TtlCache {
  constructor({ ttlSeconds, maxEntries }) {
    this.ttlMilliseconds = ttlSeconds * MILLISECONDS_PER_SECOND;
    this.maxEntries = maxEntries;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.entries.size >= this.maxEntries) {
      // Map keeps insertion order, so the first key is the oldest.
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMilliseconds,
    });
  }
}

const { maxEntries, ttlSeconds } = deliveryConfig.cache;

export const ipLocationCache = new TtlCache({
  ttlSeconds: ttlSeconds.ipLocation,
  maxEntries,
});

export const postalCodeLocationCache = new TtlCache({
  ttlSeconds: ttlSeconds.postalCodeLocation,
  maxEntries,
});

export const carrierTransitCache = new TtlCache({
  ttlSeconds: ttlSeconds.carrierTransit,
  maxEntries,
});
