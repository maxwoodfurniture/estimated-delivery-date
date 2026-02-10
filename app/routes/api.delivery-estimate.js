/**
 * Public API endpoint for delivery estimates
 * Called by the theme app extension to get delivery date estimates
 *
 * This endpoint is public (no auth required) to allow storefront access
 */

import { getDeliveryEstimate } from "../services/delivery-estimate.js";
import { getClientIP } from "../services/geolocation.js";

// CORS headers - always included in responses
const getCorsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300", // Cache for 5 minutes
});

/**
 * Handle GET request for delivery estimate
 * Query params:
 *   - shop: Shopify shop domain (required)
 *   - postalCode: Override postal code (optional)
 */
export const loader = async ({ request }) => {
  const headers = getCorsHeaders();

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const postalCode = url.searchParams.get("postalCode");

    if (!shop) {
      return new Response(
        JSON.stringify({ success: false, error: "Shop parameter required" }),
        { status: 400, headers },
      );
    }

    // Get client IP for geolocation
    const clientIP = getClientIP(request);

    console.log(
      `[Delivery Estimate] Request from shop: ${shop}, IP: ${clientIP || "unknown"}`,
    );

    // Get delivery estimate
    const estimate = await getDeliveryEstimate(shop, clientIP, postalCode);

    return new Response(JSON.stringify(estimate), {
      status: estimate.success ? 200 : 200, // Always return 200 to avoid CORS issues
      headers,
    });
  } catch (error) {
    console.error("Delivery estimate API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to calculate delivery estimate. Please try again later.",
      }),
      { status: 200, headers }, // Return 200 with error message to avoid CORS issues
    );
  }
};

/**
 * Handle POST request for delivery estimate with custom location
 * Body:
 *   - shop: Shopify shop domain (required)
 *   - postalCode: Customer postal code (optional)
 *   - city: Customer city (optional)
 *   - state: Customer state (optional)
 */
export const action = async ({ request }) => {
  const headers = getCorsHeaders();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await request.json();
    const { shop, postalCode } = body;

    if (!shop) {
      return new Response(
        JSON.stringify({ success: false, error: "Shop parameter required" }),
        { status: 400, headers },
      );
    }

    // Get client IP as fallback
    const clientIP = getClientIP(request);

    // Get delivery estimate
    const estimate = await getDeliveryEstimate(shop, clientIP, postalCode);

    return new Response(JSON.stringify(estimate), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Delivery estimate API error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to calculate delivery estimate. Please try again later.",
      }),
      { status: 200, headers },
    );
  }
};
