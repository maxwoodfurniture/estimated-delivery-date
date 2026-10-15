/**
 * FedEx carrier implementation
 * Uses the FedEx Rate API for transit time estimates.
 * https://developer.fedex.com/api/en-us/catalog/rate/docs.html
 */

import deliveryConfig from "../../config/delivery.json";
import {
  addBusinessDays,
  businessDaysBetween,
  parseIsoDate,
  toIsoDate,
} from "../dates.js";
import { BaseCarrier } from "./base-carrier.js";
import { CARRIERS, FEDEX_SERVICE_TYPES } from "./types.js";

const FEDEX_SANDBOX_URL = "https://apis-sandbox.fedex.com";
const FEDEX_PRODUCTION_URL = "https://apis.fedex.com";
const MILLISECONDS_PER_SECOND = 1000;

// FedEx reports ground transit as words, e.g. "THREE_DAYS".
const TRANSIT_TIME_WORDS = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
  FOUR_DAYS: 4,
  FIVE_DAYS: 5,
  SIX_DAYS: 6,
  SEVEN_DAYS: 7,
  EIGHT_DAYS: 8,
  NINE_DAYS: 9,
  TEN_DAYS: 10,
};

export class FedExCarrier extends BaseCarrier {
  constructor(credentials, useSandbox = false) {
    super(credentials);
    this.carrierName = CARRIERS.FEDEX;
    this.baseUrl = useSandbox ? FEDEX_SANDBOX_URL : FEDEX_PRODUCTION_URL;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  validateCredentials() {
    return !!(
      this.credentials?.apiKey &&
      this.credentials?.secretKey &&
      this.credentials?.accountNumber
    );
  }

  failure(error) {
    return { success: false, error, carrier: this.carrierName };
  }

  /** OAuth 2.0 client-credentials token, cached until shortly before expiry. */
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.credentials.apiKey,
        client_secret: this.credentials.secretKey,
      }),
      signal: AbortSignal.timeout(deliveryConfig.timeoutsMs.carrier),
    });

    if (!response.ok) {
      throw new Error(`FedEx OAuth failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const lifetimeSeconds =
      data.expires_in - deliveryConfig.fedex.tokenExpirySafetySeconds;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + lifetimeSeconds * MILLISECONDS_PER_SECOND;
    return this.accessToken;
  }

  /**
   * @param {import('./types.js').TransitTimeRequest} request
   * @returns {Promise<import('./types.js').TransitTimeResponse>}
   */
  async getTransitTime(request) {
    if (!this.validateCredentials()) {
      return this.failure("FedEx credentials not configured");
    }

    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}/rate/v1/rates/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-locale": "en_US",
        },
        body: JSON.stringify(this.buildRateRequest(request)),
        signal: AbortSignal.timeout(deliveryConfig.timeoutsMs.carrier),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return this.failure(
          errorData.errors?.[0]?.message ||
            `FedEx Rate API HTTP ${response.status}`,
        );
      }

      return this.parseRateResponse(await response.json(), request.shipDate);
    } catch (error) {
      return this.failure(error.message);
    }
  }

  buildRateRequest(request) {
    const { origin, destination, shipDate } = request;
    return {
      accountNumber: { value: this.credentials.accountNumber },
      requestedShipment: {
        shipper: {
          address: {
            streetLines: origin.street ? [origin.street] : undefined,
            city: origin.city,
            stateOrProvinceCode: origin.state,
            postalCode: origin.postalCode,
            countryCode: origin.countryCode,
          },
        },
        recipient: {
          address: {
            city: destination.city,
            stateOrProvinceCode: destination.state,
            postalCode: destination.postalCode,
            countryCode: destination.countryCode,
          },
        },
        shipDateStamp: toIsoDate(shipDate),
        pickupType: "USE_SCHEDULED_PICKUP",
        serviceType: request.serviceType || FEDEX_SERVICE_TYPES.GROUND,
        packagingType: "YOUR_PACKAGING",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {
            weight: {
              units: "LB",
              value: deliveryConfig.fedex.packageWeightLb,
            },
          },
        ],
      },
    };
  }

  /** FedEx has reported transit time in several shapes; try each. */
  parseTransitDays(rateReply) {
    const { commit, operationalDetail } = rateReply;

    const numericDays = Number(commit?.transitTime?.transitDays);
    if (numericDays > 0) return numericDays;

    const word =
      operationalDetail?.transitTime || commit?.transitDays?.minimumTransitTime;
    if (TRANSIT_TIME_WORDS[word]) return TRANSIT_TIME_WORDS[word];

    const description =
      commit?.transitDays?.description || commit?.transitTime?.description;
    const digits = /(\d+)/.exec(description ?? "");
    return digits ? Number(digits[1]) : null;
  }

  parseRateResponse(data, shipDate) {
    const rateReply = data.output?.rateReplyDetails?.[0];
    if (!rateReply) return this.failure("No rate details in response");

    const committedDate = parseIsoDate(rateReply.commit?.dateDetail?.dayFormat);
    const transitDays =
      this.parseTransitDays(rateReply) ??
      (committedDate ? businessDaysBetween(shipDate, committedDate) : null);

    if (!transitDays) return this.failure("No transit time in response");

    const deliveryDateMin =
      committedDate ?? addBusinessDays(shipDate, transitDays);
    const extraDays = committedDate
      ? deliveryConfig.deliveryWindow.carrierCommittedExtraDays
      : deliveryConfig.deliveryWindow.estimatedExtraDays;

    return {
      success: true,
      deliveryDateMin,
      deliveryDateMax: addBusinessDays(deliveryDateMin, extraDays),
      transitDays,
      serviceName: rateReply.serviceName || "FedEx Ground",
      carrier: this.carrierName,
    };
  }
}
