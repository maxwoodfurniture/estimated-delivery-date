# Estimated Delivery Date

Shopify app that shows "Deliver to Summerville, SC: Arrives Feb 10 - 12" on product pages. It uses the shopper's location, the warehouse's processing schedule, and FedEx Ground transit times, with a ZIP-zone fallback when FedEx is not configured.

See [ARCHITECTURE.md](ARCHITECTURE.md), [CHANGELOG.md](CHANGELOG.md) and [TECH_DEBT.md](TECH_DEBT.md).

## Setup

1. Install the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/getting-started).
2. `npm install`
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to a Postgres database. A local Postgres works, or use the Railway database's public URL.
4. `npm run dev`

## Configure

1. In the app, open **Settings**. Enter the warehouse address, timezone, handling time, cutoff and processing days.
2. Optionally add FedEx API credentials.
3. In the theme editor, add the **Estimated Delivery Date** block to the product template.

The storefront calls the app through the app proxy at `/apps/delivery`, declared in `shopify.app.toml`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development through Shopify CLI |
| `npm test` | Unit tests (Node built-in runner) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run deploy` | Push app config and extensions to Shopify |
| `npm run setup` | Generate Prisma client and apply migrations |

## Deploy to Railway

1. Create a Railway project with a Postgres database and a service connected to this repo.
2. On the app service, set these variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SCOPES`
   - `SHOPIFY_APP_URL` = the service's public URL
   - optional: `FEDEX_USE_SANDBOX`, `IPINFO_TOKEN`
3. Generate a public domain for the service.
4. Replace the old host in `shopify.app.toml` (application URL, redirect URLs, app proxy URL) with that domain. Then run `npm run deploy`.

`railway.json` handles the rest. It builds from the Dockerfile, runs migrations before each deploy, and waits for `/healthz` to answer before sending traffic.

Set `FEDEX_USE_SANDBOX=true` only with sandbox credentials.
