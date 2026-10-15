# Architecture

Shopify embedded app that shows an estimated delivery date on product pages.

## Request flow

```
Product page (theme app block)
  └─ delivery-date.js  GET /apps/delivery/api/delivery-estimate[?postalCode=]
       └─ Shopify app proxy (signs request)
            └─ app/routes/app_.proxy.$.js        verifies signature
                 └─ services/delivery-estimate.js
                      ├─ settings.server.js       shop settings (Prisma)
                      ├─ geolocation.js           IP or ZIP -> location (cached)
                      ├─ dates.js                 ship date in warehouse timezone
                      └─ carriers/                FedEx transit (cached)
                           or zone fallback from ZIP prefixes
```

## Components

| Path | Role |
| --- | --- |
| `app/config/delivery.json` | All tunables: defaults, limits, timeouts, cache TTLs, zone thresholds, timezones. |
| `app/services/delivery-estimate.js` | Orchestrates an estimate. Defines `ESTIMATE_CODES` and HTTP status mapping. |
| `app/services/settings.server.js` | Settings persistence, validation, and the public (secret-free) view. |
| `app/services/geolocation.js` | IP lookup (ipapi.co, ipinfo.io) and ZIP lookup (zippopotam.us). |
| `app/services/dates.js` | Pure calendar-date math. Dates are UTC-midnight values, so server timezone never matters. |
| `app/services/ip-address.js` | Pure IP normalization and private-range checks. |
| `app/services/cache.server.js` | Module-singleton TTL caches. |
| `app/services/carriers/` | Carrier interface, FedEx implementation, per-shop carrier instances. |
| `app/routes/app_.proxy.$.js` | Storefront endpoint. Outside the admin layout. |
| `app/routes/app.settings.jsx` | Admin settings. Credentials are write-only. |
| `app/routes/webhooks.*` | Uninstall, scopes update, compliance. |
| `extensions/delivery-date-block/` | Theme app block: Liquid markup, deferred JS custom element, CSS. |

## Key decisions

- **Server first, progressive enhancement.** The block renders a fallback line in Liquid. JavaScript replaces it with the estimate.
- **No guessed locations.** If the IP cannot be resolved to a US location, the shopper is asked for a ZIP code.
- **Warehouse timezone drives the cutoff.** Stored per shop as an IANA name.
- **Carrier is optional.** Without FedEx credentials, a ZIP-prefix zone estimate is used.
- **Caching is in memory.** Correct for one instance. See TECH_DEBT.md for scaling.
- **Widget result codes are duplicated** in `delivery-date.js` because theme assets cannot import app code. Keep both lists in sync.

## Hosting

Railway, two services in one project:

| Service | Notes |
| --- | --- |
| App | Built from `Dockerfile`. `railway.json` runs `prisma migrate deploy` before each deploy and gates traffic on `/healthz`. One replica, because caches are in memory. |
| Postgres | Railway's Postgres template. The app reads it through `DATABASE_URL` over private networking. |

## Environment

See `.env.example`.
