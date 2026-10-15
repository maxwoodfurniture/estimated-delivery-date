/**
 * App Settings Page
 * Warehouse location, handling times, carrier credentials and display options.
 * Carrier secrets are write-only: the page never receives saved values.
 */

import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import deliveryConfig from "../config/delivery.json";
import {
  getAppSettings,
  hasCarrierCredentials,
  parseSettingsForm,
  saveAppSettings,
  toPublicSettings,
} from "../services/settings.server.js";

const INTENTS = {
  SAVE: "save",
  CLEAR_CREDENTIALS: "clearCredentials",
};

const CREDENTIAL_FIELDS = deliveryConfig.carrierCredentialFields;

const EMPTY_CREDENTIALS = Object.fromEntries(
  CREDENTIAL_FIELDS.map((field) => [field, ""]),
);

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const savedSettings = await getAppSettings(session.shop);

  return {
    settings: toPublicSettings(savedSettings),
    hasCredentials: hasCarrierCredentials(savedSettings),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === INTENTS.CLEAR_CREDENTIALS) {
    const existing = await getAppSettings(session.shop);
    if (existing) {
      await saveAppSettings(
        session.shop,
        Object.fromEntries(CREDENTIAL_FIELDS.map((field) => [field, null])),
      );
    }
    return { success: true, message: "FedEx credentials removed" };
  }

  if (intent === INTENTS.SAVE) {
    const { data, errors } = parseSettingsForm(formData);
    if (errors.length > 0) {
      return { success: false, errors };
    }
    await saveAppSettings(session.shop, data);
    return { success: true, message: "Settings saved" };
  }

  return { success: false, errors: ["Unknown action"] };
};

export default function Settings() {
  const { settings, hasCredentials } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [formData, setFormData] = useState(settings);
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS);
  const [showCredentialFields, setShowCredentialFields] = useState(false);

  const isSubmitting = fetcher.state !== "idle";
  const errors = fetcher.data?.errors ?? [];

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      shopify.toast.show(fetcher.data.message);
      setCredentials(EMPTY_CREDENTIALS);
      setShowCredentialFields(false);
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleChange = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const handleCredentialChange = (field, value) => {
    setCredentials((previous) => ({ ...previous, [field]: value }));
  };

  const toggleProcessingDay = (dayIndex, checked) => {
    const current = formData.processingDays;
    const next = checked
      ? [...current, dayIndex].sort((first, second) => first - second)
      : current.filter((day) => day !== dayIndex);
    handleChange("processingDays", next);
  };

  const handleSubmit = () => {
    const data = new FormData();
    data.append("intent", INTENTS.SAVE);

    Object.entries(formData).forEach(([key, value]) => {
      if (key === "processingDays") {
        value.forEach((day) => data.append(`processingDay${day}`, "on"));
      } else {
        data.append(key, String(value ?? ""));
      }
    });
    Object.entries(credentials).forEach(([key, value]) => {
      if (value) data.append(key, value);
    });

    fetcher.submit(data, { method: "POST" });
  };

  const handleClearCredentials = () => {
    fetcher.submit({ intent: INTENTS.CLEAR_CREDENTIALS }, { method: "POST" });
  };

  const credentialsVisible = !hasCredentials || showCredentialFields;

  return (
    <s-page heading="Delivery Estimate Settings">
      <s-button
        slot="primary-action"
        onClick={handleSubmit}
        {...(isSubmitting ? { loading: true } : {})}
      >
        Save Settings
      </s-button>

      {errors.length > 0 && (
        <s-banner tone="critical" heading="Settings not saved">
          <s-unordered-list>
            {errors.map((error) => (
              <s-list-item key={error}>{error}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      )}

      <s-section heading="Warehouse Location">
        <s-paragraph>
          Enter your warehouse or fulfillment center address. This is where
          orders ship from.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          <s-text-field
            label="Street Address (Optional)"
            value={formData.warehouseStreet}
            onInput={(event) =>
              handleChange("warehouseStreet", event.target.value)
            }
            placeholder="123 Warehouse Way"
          />

          <s-stack direction="inline" gap="base">
            <s-text-field
              label="City"
              value={formData.warehouseCity}
              onInput={(event) =>
                handleChange("warehouseCity", event.target.value)
              }
              placeholder="Charleston"
              required
            />
            <s-text-field
              label="State"
              value={formData.warehouseState}
              onInput={(event) =>
                handleChange("warehouseState", event.target.value)
              }
              placeholder="SC"
              required
            />
          </s-stack>

          <s-stack direction="inline" gap="base">
            <s-text-field
              label="ZIP Code"
              value={formData.warehousePostalCode}
              onInput={(event) =>
                handleChange("warehousePostalCode", event.target.value)
              }
              placeholder="29401"
              required
            />
            <s-select
              label="Country"
              value={formData.warehouseCountryCode}
              onChange={(event) =>
                handleChange("warehouseCountryCode", event.target.value)
              }
            >
              {deliveryConfig.supportedCountries.map((country) => (
                <s-option key={country.code} value={country.code}>
                  {country.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>

          <s-select
            label="Warehouse Timezone"
            value={formData.warehouseTimezone}
            onChange={(event) =>
              handleChange("warehouseTimezone", event.target.value)
            }
            details="Cutoff time is measured in this timezone"
          >
            {deliveryConfig.timezones.map((zone) => (
              <s-option key={zone.value} value={zone.value}>
                {zone.label}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      </s-section>

      <s-section heading="Processing & Handling">
        <s-paragraph>
          Configure how long it takes to process and ship an order after
          it&apos;s placed.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-number-field
              label="Handling Time (Business Days)"
              value={String(formData.handlingTimeDays)}
              onInput={(event) =>
                handleChange(
                  "handlingTimeDays",
                  Number.parseInt(event.target.value, 10),
                )
              }
              min={deliveryConfig.limits.handlingTimeDaysMin}
              max={deliveryConfig.limits.handlingTimeDaysMax}
              details="Days needed to process an order before shipping"
            />
            <s-text-field
              label="Daily Cutoff Time (24h)"
              value={formData.cutoffTime}
              onInput={(event) =>
                handleChange("cutoffTime", event.target.value)
              }
              placeholder="14:00"
              details="Orders after this time ship the next processing day"
            />
          </s-stack>

          <s-stack direction="block" gap="small-200">
            <s-text type="strong">Days Your Facility Processes Orders</s-text>
            <s-stack direction="inline" gap="base">
              {deliveryConfig.weekdays.map((dayName, dayIndex) => (
                <s-checkbox
                  key={dayName}
                  label={dayName}
                  checked={formData.processingDays.includes(dayIndex)}
                  onChange={(event) =>
                    toggleProcessingDay(dayIndex, event.currentTarget.checked)
                  }
                />
              ))}
            </s-stack>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="FedEx API Credentials">
        <s-paragraph>
          Optional. Without credentials, estimates use a ZIP-zone
          approximation. Get credentials from the{" "}
          <s-link href="https://developer.fedex.com/" target="_blank">
            FedEx Developer Portal
          </s-link>
          .
        </s-paragraph>

        {hasCredentials && !showCredentialFields && (
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text>FedEx credentials are saved.</s-text>
            <s-button
              variant="tertiary"
              onClick={() => setShowCredentialFields(true)}
            >
              Replace
            </s-button>
            <s-button
              variant="tertiary"
              tone="critical"
              onClick={handleClearCredentials}
            >
              Remove
            </s-button>
          </s-stack>
        )}

        {credentialsVisible && (
          <s-stack direction="block" gap="base">
            <s-password-field
              label="FedEx API Key"
              value={credentials.fedexApiKey}
              onInput={(event) =>
                handleCredentialChange("fedexApiKey", event.target.value)
              }
              autocomplete="off"
            />
            <s-password-field
              label="FedEx Secret Key"
              value={credentials.fedexSecretKey}
              onInput={(event) =>
                handleCredentialChange("fedexSecretKey", event.target.value)
              }
              autocomplete="off"
            />
            <s-text-field
              label="FedEx Account Number"
              value={credentials.fedexAccountNumber}
              onInput={(event) =>
                handleCredentialChange("fedexAccountNumber", event.target.value)
              }
              autocomplete="off"
            />
            {hasCredentials && (
              <s-text color="subdued">
                Leave a field blank to keep its saved value.
              </s-text>
            )}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Display Options">
        <s-stack direction="block" gap="base">
          <s-checkbox
            label="Enable delivery estimates on product pages"
            checked={formData.isEnabled}
            onChange={(event) =>
              handleChange("isEnabled", event.currentTarget.checked)
            }
          />
          <s-checkbox
            label='Show exact dates (e.g., "Feb 10 - 12") instead of transit days (e.g., "3-5 business days")'
            checked={formData.showExactDates}
            onChange={(event) =>
              handleChange("showExactDates", event.currentTarget.checked)
            }
          />
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Setup Guide">
        <s-ordered-list>
          <s-list-item>Enter your warehouse address and timezone</s-list-item>
          <s-list-item>Set your processing and handling time</s-list-item>
          <s-list-item>Optionally add FedEx API credentials</s-list-item>
          <s-list-item>Add the app block to your product template</s-list-item>
        </s-ordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
