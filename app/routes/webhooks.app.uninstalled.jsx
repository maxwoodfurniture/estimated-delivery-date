import { authenticate } from "../shopify.server";
import db from "../db.server";
import { forgetCarriersForShop } from "../services/carriers/index.js";

// Settings are kept so a reinstall restores them. The shop/redact
// compliance webhook deletes them 48 hours after uninstall.

export const action = async ({ request }) => {
  const { shop, session } = await authenticate.webhook(request);

  forgetCarriersForShop(shop);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
