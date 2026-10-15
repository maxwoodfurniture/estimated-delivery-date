# Changelog

All notable changes to the Estimated Delivery Date app. Versions follow
[Semantic Versioning](https://semver.org/). The app started from the
[Shopify React Router app template](https://github.com/Shopify/shopify-app-template-react-router/blob/main/CHANGELOG.md).

## 1.2.0 - 2026-10-15

### Changed
- Hosting moved from Render to Railway. `railway.json` sets the Dockerfile build, a pre-deploy migration step, a health check and one replica.
- Database moved from SQLite to Postgres via `DATABASE_URL`. Migrations were replaced with a single Postgres baseline. Existing SQLite data is not carried over.
- Dockerfile is now multi-stage on Node 22. Dev dependencies stay out of the runtime image, and the app runs as a non-root user.
- Migrations run in Railway's pre-deploy step instead of at container start. Removed the `docker-start` script.

### Added
- `/healthz` route that checks the database.

### Removed
- Unused `getSupportedCarriers` export, SQLite ignore rules, and console logging in the scopes webhook.

## 1.1.0 - 2026-10-15

### Security
- App proxy requests are verified with Shopify's proxy signature. The shop now comes from the signed request.
- Removed the unauthenticated `/api/delivery-estimate` route that let anyone query any shop.
- The settings page no longer sends saved FedEx credentials to the browser. Credentials are write-only, and blank fields keep saved values.
- Estimate responses use `Cache-Control: private, no-store` so shared caches cannot serve one shopper's location to another.
- Added mandatory compliance webhooks. `shop/redact` deletes the shop's settings and sessions.

### Fixed
- The proxy route no longer sits under the admin layout, which required admin authentication on storefront requests.
- Cutoff time is evaluated in the warehouse timezone (new setting) instead of the server clock.
- Delivery dates no longer shift by a day because of UTC conversion.
- Private IP detection no longer treats public `172.2.x.x` addresses as private.
- Geolocation no longer looks up the server's own IP when the shopper IP is unknown.
- FedEx sandbox mode is controlled by `FEDEX_USE_SANDBOX` instead of always on.
- Admin banners use the `tone` attribute. The save toast no longer fires on every render.
- Theme extension locale file uses the correct structure, so translation keys resolve.

### Changed
- When location is unknown or outside the US, the widget asks for a ZIP code instead of showing a default city.
- Real HTTP status codes on estimate errors, with a `code` field the widget acts on.
- Removed `ip-api.com` (plain HTTP, non-commercial license). `IPINFO_TOKEN` is supported.
- In-memory caches for IP lookups, ZIP lookups and FedEx transit results. FedEx OAuth tokens are reused per shop.
- Settings are validated on the server. Handling time can be zero.
- Only the US is offered as a warehouse country, because destinations are US-only.
- Widget rebuilt as a custom element with deferred JS and CSS assets. It renders a fallback line without JavaScript and remembers the shopper's ZIP.
- Tunables (timeouts, cache TTLs, zone thresholds, timezones, defaults) moved to `app/config/delivery.json`.
- Removed template-only page and console logging of shopper IPs.

### Added
- Unit tests for date and IP helpers (`npm test`, Node's built-in test runner).
- Architecture and tech debt docs, `.env.example`.

## 1.0.0 - 2026-02-10

- Initial release: FedEx Ground transit estimates, ZIP-zone fallback, IP geolocation, theme app block.
