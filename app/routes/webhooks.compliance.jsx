/**
 * Mandatory compliance webhooks (customers/data_request, customers/redact,
 * shop/redact).
 *
 * The app stores no customer data, so customer topics need no action.
 * shop/redact fires 48 hours after uninstall and removes everything stored
 * for the shop, including carrier credentials.
 */

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { forgetCarriersForShop } from "../services/carriers/index.js";
import { deleteAppSettings } from "../services/settings.server.js";

const SHOP_REDACT_TOPIC = "SHOP_REDACT";

const normalizeTopic = (topic) =>
  String(topic).toUpperCase().replace("/", "_");

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  if (normalizeTopic(topic) === SHOP_REDACT_TOPIC) {
    await deleteAppSettings(shop);
    await db.session.deleteMany({ where: { shop } });
    forgetCarriersForShop(shop);
  }

  return new Response();
};
