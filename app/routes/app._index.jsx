/**
 * App Home Page
 * Dashboard showing app status and quick setup guidance
 */

import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getAppSettings } from "../services/delivery-estimate.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getAppSettings(session.shop);

  // Determine setup status
  const hasWarehouse = !!(
    settings?.warehouseCity && settings?.warehousePostalCode
  );
  const hasCredentials = !!(settings?.fedexApiKey && settings?.fedexSecretKey);
  const isEnabled = settings?.isEnabled ?? false;

  return {
    shop: session.shop,
    hasWarehouse,
    hasCredentials,
    isEnabled,
    isConfigured: hasWarehouse && hasCredentials,
  };
};

export default function Index() {
  const { hasWarehouse, hasCredentials, isEnabled, isConfigured } =
    useLoaderData();

  return (
    <s-page heading="Estimated Delivery Date">
      <s-button slot="primary-action" href="/app/settings">
        Configure Settings
      </s-button>

      {/* Status Banner */}
      {isConfigured && isEnabled ? (
        <s-banner status="success">
          Your delivery estimate widget is active and will appear on product
          pages.
        </s-banner>
      ) : (
        <s-banner status="warning">
          Complete the setup below to enable delivery estimates on your product
          pages.
        </s-banner>
      )}

      {/* Setup Checklist */}
      <s-section heading="Setup Checklist">
        <s-stack direction="block" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background={hasWarehouse ? "subdued" : "surface"}
          >
            <s-stack direction="inline" gap="base" align="center">
              <s-text>{hasWarehouse ? "✅" : "⬜"}</s-text>
              <s-stack direction="block" gap="tight">
                <s-text fontWeight="bold">Configure Warehouse Location</s-text>
                <s-text variant="subdued">
                  Set up your fulfillment center address for accurate transit
                  calculations
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background={hasCredentials ? "subdued" : "surface"}
          >
            <s-stack direction="inline" gap="base" align="center">
              <s-text>{hasCredentials ? "✅" : "⬜"}</s-text>
              <s-stack direction="block" gap="tight">
                <s-text fontWeight="bold">Add FedEx API Credentials</s-text>
                <s-text variant="subdued">
                  Connect your FedEx developer account for real-time transit
                  estimates
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="surface"
          >
            <s-stack direction="inline" gap="base" align="center">
              <s-text>📦</s-text>
              <s-stack direction="block" gap="tight">
                <s-text fontWeight="bold">Add Widget to Your Theme</s-text>
                <s-text variant="subdued">
                  Use the Shopify theme customizer to add the delivery estimate
                  block to product pages
                </s-text>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Preview Section */}
      <s-section heading="Widget Preview">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="tight">
            <s-text fontWeight="bold">Arrives Feb 10 - Feb 12</s-text>
            <s-stack direction="inline" gap="tight" align="center">
              <s-text>📦</s-text>
              <s-text variant="subdued">
                Deliver to <s-link href="#">Summerville, United States</s-link>
              </s-text>
            </s-stack>
          </s-stack>
        </s-box>
        <s-text variant="subdued">
          This is how the delivery estimate will appear on your product pages.
          Dates and location are detected automatically for each visitor.
        </s-text>
      </s-section>

      {/* How It Works */}
      <s-section slot="aside" heading="How It Works">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text fontWeight="bold">1. Automatic Location Detection</s-text>
            <br />
            We detect your customer's location using their IP address - no
            permissions required.
          </s-paragraph>

          <s-paragraph>
            <s-text fontWeight="bold">2. Real-Time Transit Calculation</s-text>
            <br />
            FedEx Ground transit times are calculated from your warehouse to the
            customer's location.
          </s-paragraph>

          <s-paragraph>
            <s-text fontWeight="bold">3. Smart Handling Time</s-text>
            <br />
            Your processing time and cutoff hours are factored into the
            estimate.
          </s-paragraph>
        </s-stack>
      </s-section>

      {/* Resources */}
      <s-section slot="aside" heading="Resources">
        <s-unordered-list>
          <s-list-item>
            <s-link href="https://developer.fedex.com/" target="_blank">
              FedEx Developer Portal
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/apps/online-store/theme-app-extensions"
              target="_blank"
            >
              Theme App Extensions Guide
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
