# Tech Debt and Cleanup

Ordered by risk. Remove items when done and note them in CHANGELOG.md.

## High

- **FedEx credentials stored in plain text.** Encrypt at rest (AES-GCM with a key from the environment) and migrate existing rows.
- **No rate limiting on the proxy endpoint.** Signatures stop direct abuse, but anyone can call `/apps/delivery/...` on the storefront. Caches limit FedEx calls; a per-IP limit would cap geolocation usage.

## Medium

- **In-memory caches and carrier instances.** `railway.json` pins one replica. Before raising it, move caches to a shared store (Postgres table or Redis).
- **Docker image not built locally.** The multi-stage Dockerfile was written without a local Docker run. The first Railway build is its test.
- **Free geolocation tiers.** ipapi.co and ipinfo.io have daily limits without a paid token. Set `IPINFO_TOKEN` or move to a paid provider before high traffic.
- **US destinations only.** Postal lookup and validation are US-specific.
- **FedEx Ground only, 1 lb package.** Large furniture may ship freight with different transit. Consider per-product service type or a handling-time buffer.
- **FedEx response parsing** tries several known field shapes. Confirm against production responses and simplify.
- **No route or integration tests.** Only pure helpers are tested.

## Low

- Widget result codes are duplicated between `delivery-estimate.js` and `delivery-date.js`.
- Holidays are not excluded from processing or transit days.
