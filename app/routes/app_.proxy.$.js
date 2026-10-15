/**
 * App Proxy endpoint.
 * Storefront URL: https://{shop}/apps/delivery/api/delivery-estimate
 * App URL:        /app/proxy/api/delivery-estimate
 *
 * The trailing underscore in "app_" keeps this route out of the app.jsx
 * layout, which requires admin authentication. Requests are verified with
 * Shopify's app proxy signature instead.
 */

import { authenticate } from "../shopify.server";
import {
  ESTIMATE_CODES,
  ESTIMATE_HTTP_STATUS,
  getDeliveryEstimate,
} from "../services/delivery-estimate.js";
import { getClientIP } from "../services/geolocation.js";

const DELIVERY_ESTIMATE_PATH = "api/delivery-estimate";
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

// Responses depend on the shopper's IP, so shared caches must not store them.
const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store",
};

const jsonResponse = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });

export const loader = async ({ request, params }) => {
  try {
    await authenticate.public.appProxy(request);
  } catch (error) {
    if (error instanceof Response) {
      return jsonResponse(
        { success: false, code: ESTIMATE_CODES.ERROR, error: "Unauthorized" },
        HTTP_UNAUTHORIZED,
      );
    }
    throw error;
  }

  if (params["*"] !== DELIVERY_ESTIMATE_PATH) {
    return jsonResponse(
      { success: false, code: ESTIMATE_CODES.ERROR, error: "Not found" },
      HTTP_NOT_FOUND,
    );
  }

  // "shop" is covered by the verified signature.
  const url = new URL(request.url);
  const estimate = await getDeliveryEstimate({
    shop: url.searchParams.get("shop"),
    clientIP: getClientIP(request),
    postalCode: url.searchParams.get("postalCode"),
  });

  return jsonResponse(estimate, ESTIMATE_HTTP_STATUS[estimate.code]);
};
