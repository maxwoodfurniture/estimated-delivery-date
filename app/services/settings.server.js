/**
 * App settings persistence and validation.
 * Carrier secrets never leave this module in data bound for the browser.
 */

import prisma from "../db.server.js";
import deliveryConfig from "../config/delivery.json";
import { isValidTime } from "./dates.js";

const { defaults, limits } = deliveryConfig;
const DAYS_IN_WEEK = 7;
const US_ZIP_PATTERN = /^\d{5}$/;

export const CREDENTIAL_FIELDS = deliveryConfig.carrierCredentialFields;

/** "1,2,3" -> [1, 2, 3]. Falls back to defaults when empty or invalid. */
export function parseProcessingDays(value) {
  const days = String(value ?? "")
    .split(",")
    .map((day) => Number.parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day < DAYS_IN_WEEK);
  return days.length > 0 ? days : [...defaults.processingDays];
}

export function hasCarrierCredentials(settings) {
  return CREDENTIAL_FIELDS.every((field) => !!settings?.[field]);
}

export async function getAppSettings(shop) {
  return prisma.appSettings.findUnique({ where: { shop } });
}

export async function deleteAppSettings(shop) {
  return prisma.appSettings.deleteMany({ where: { shop } });
}

export async function saveAppSettings(shop, data) {
  return prisma.appSettings.upsert({
    where: { shop },
    update: data,
    create: { shop, ...data },
  });
}

/** Settings safe to send to the admin UI: no carrier secrets. */
export function toPublicSettings(savedSettings) {
  const source = savedSettings ?? {};
  return {
    warehouseStreet: source.warehouseStreet ?? "",
    warehouseCity: source.warehouseCity ?? "",
    warehouseState: source.warehouseState ?? "",
    warehousePostalCode: source.warehousePostalCode ?? "",
    warehouseCountryCode:
      source.warehouseCountryCode ?? defaults.warehouseCountryCode,
    warehouseTimezone: source.warehouseTimezone ?? defaults.warehouseTimezone,
    handlingTimeDays: source.handlingTimeDays ?? defaults.handlingTimeDays,
    processingDays: savedSettings
      ? parseProcessingDays(source.processingDays)
      : [...defaults.processingDays],
    cutoffTime: source.cutoffTime ?? defaults.cutoffTime,
    isEnabled: source.isEnabled ?? defaults.isEnabled,
    showExactDates: source.showExactDates ?? defaults.showExactDates,
  };
}

const text = (formData, field) => String(formData.get(field) ?? "").trim();

/**
 * Validate the settings form.
 * Blank credential fields are left out so saved credentials are kept.
 * @returns {{ data: object, errors: string[] }}
 */
export function parseSettingsForm(formData) {
  const errors = [];
  const allowedCountries = deliveryConfig.supportedCountries.map(
    (country) => country.code,
  );
  const allowedTimezones = deliveryConfig.timezones.map((zone) => zone.value);

  const data = {
    warehouseStreet: text(formData, "warehouseStreet") || null,
    warehouseCity: text(formData, "warehouseCity"),
    warehouseState: text(formData, "warehouseState").toUpperCase(),
    warehousePostalCode: text(formData, "warehousePostalCode"),
    warehouseCountryCode: text(formData, "warehouseCountryCode"),
    warehouseTimezone: text(formData, "warehouseTimezone"),
    handlingTimeDays: Number.parseInt(text(formData, "handlingTimeDays"), 10),
    processingDays: parseProcessingDays(
      Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
        formData.get(`processingDay${day}`) ? day : null,
      )
        .filter((day) => day !== null)
        .join(","),
    ).join(","),
    cutoffTime: text(formData, "cutoffTime"),
    isEnabled: formData.get("isEnabled") === "true",
    showExactDates: formData.get("showExactDates") === "true",
  };

  if (!data.warehouseCity) errors.push("Warehouse city is required.");
  if (!data.warehouseState) errors.push("Warehouse state is required.");
  if (!US_ZIP_PATTERN.test(data.warehousePostalCode)) {
    errors.push("Warehouse postal code must be a 5-digit ZIP code.");
  }
  if (!allowedCountries.includes(data.warehouseCountryCode)) {
    errors.push("Choose a supported warehouse country.");
  }
  if (!allowedTimezones.includes(data.warehouseTimezone)) {
    errors.push("Choose a warehouse timezone.");
  }
  if (
    !Number.isInteger(data.handlingTimeDays) ||
    data.handlingTimeDays < limits.handlingTimeDaysMin ||
    data.handlingTimeDays > limits.handlingTimeDaysMax
  ) {
    errors.push(
      `Handling time must be ${limits.handlingTimeDaysMin}-${limits.handlingTimeDaysMax} days.`,
    );
  }
  if (!isValidTime(data.cutoffTime)) {
    errors.push("Cutoff time must be HH:MM in 24-hour format.");
  }

  for (const field of CREDENTIAL_FIELDS) {
    const value = text(formData, field);
    if (value) data[field] = value;
  }

  return { data, errors };
}
