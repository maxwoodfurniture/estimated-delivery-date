/**
 * Health check for Railway. Confirms the server is up and the database
 * answers. Railway only routes traffic to a deploy once this returns 200.
 */

import prisma from "../db.server";

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HEADERS = { "Cache-Control": "no-store" };

export const loader = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response("ok", { status: HTTP_OK, headers: HEADERS });
  } catch (error) {
    console.error("[Health] Database check failed:", error.message);
    return new Response("database unavailable", {
      status: HTTP_SERVICE_UNAVAILABLE,
      headers: HEADERS,
    });
  }
};
