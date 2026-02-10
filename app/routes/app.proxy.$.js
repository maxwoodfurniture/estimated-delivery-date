/**
 * App Proxy catch-all endpoint
 * Handles requests from: https://shop.myshopify.com/apps/delivery/*
 *
 * Shopify automatically adds these query params:
 * - shop: The shop domain
 * - logged_in_customer_id: If customer is logged in
 * - path_prefix, timestamp, signature: For verification
 */

import { getDeliveryEstimate } from "../services/delivery-estimate.js";
import { getClientIP } from "../services/geolocation.js";

const getCorsHeaders = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300",
});

export const loader = async ({ request, params }) => {
  const headers = getCorsHeaders();

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const url = new URL(request.url);
    const path = params["*"]; // Captures everything after /app/proxy/

    // Only handle delivery estimate requests
    if (!path || !path.includes("api/delivery-estimate")) {
      return new Response(
        JSON.stringify({ success: false, error: "Not found" }),
        { status: 404, headers },
      );
    }

    // Shopify app proxy automatically adds these params
    const shop = url.searchParams.get("shop");
    const postalCode = url.searchParams.get("postalCode");

    if (!shop) {
      return new Response(
        JSON.stringify({ success: false, error: "Shop parameter required" }),
        { status: 400, headers },
      );
    }

    const clientIP = getClientIP(request);

    console.log(
      `[App Proxy] Delivery estimate request - shop: ${shop}, IP: ${clientIP || "unknown"}, postal: ${postalCode || "none"}`,
    );

    const estimate = await getDeliveryEstimate(shop, clientIP, postalCode);

    return new Response(JSON.stringify(estimate), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("App proxy error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to calculate delivery estimate. Please try again later.",
      }),
      { status: 200, headers },
    );
  }
};
