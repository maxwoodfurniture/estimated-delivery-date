/**
 * FedEx carrier implementation
 * Uses FedEx Rate API for transit time estimates
 * https://developer.fedex.com/api/en-us/catalog/rate/docs.html
 */

import { BaseCarrier } from "./base-carrier.js";
import { CARRIERS, FEDEX_SERVICE_TYPES } from "./types.js";

// FedEx API endpoints
const FEDEX_SANDBOX_URL = "https://apis-sandbox.fedex.com";
const FEDEX_PRODUCTION_URL = "https://apis.fedex.com";

export class FedExCarrier extends BaseCarrier {
  constructor(credentials, useSandbox = false) {
    super(credentials);
    this.carrierName = CARRIERS.FEDEX;
    this.baseUrl = useSandbox ? FEDEX_SANDBOX_URL : FEDEX_PRODUCTION_URL;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  validateCredentials() {
    return !!(
      this.credentials?.apiKey &&
      this.credentials?.secretKey &&
      this.credentials?.accountNumber
    );
  }

  /**
   * Get OAuth 2.0 access token from FedEx
   * Tokens are cached until expiry
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.credentials.apiKey,
        client_secret: this.credentials.secretKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FedEx OAuth failed: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000);

    return this.accessToken;
  }

  /**
   * Get transit time using FedEx Rate API
   * @param {import('./types.js').TransitTimeRequest} request
   * @returns {Promise<import('./types.js').TransitTimeResponse>}
   */
  async getTransitTime(request) {
    try {
      if (!this.validateCredentials()) {
        return {
          success: false,
          error: "FedEx credentials not configured",
          carrier: this.carrierName,
        };
      }

      const token = await this.getAccessToken();
      const serviceType = request.serviceType || FEDEX_SERVICE_TYPES.GROUND;

      // Calculate ship date (today or next business day)
      const shipDate = request.shipDate || this.getNextBusinessDay(new Date());

      const rateRequest = {
        accountNumber: {
          value: this.credentials.accountNumber,
        },
        requestedShipment: {
          shipper: {
            address: {
              streetLines: request.origin.street
                ? [request.origin.street]
                : undefined,
              city: request.origin.city,
              stateOrProvinceCode: request.origin.state,
              postalCode: request.origin.postalCode,
              countryCode: request.origin.countryCode,
            },
          },
          recipient: {
            address: {
              city: request.destination.city,
              stateOrProvinceCode: request.destination.state,
              postalCode: request.destination.postalCode,
              countryCode: request.destination.countryCode,
            },
          },
          shipDateStamp: this.formatDate(shipDate),
          pickupType: "USE_SCHEDULED_PICKUP",
          serviceType: serviceType,
          packagingType: "YOUR_PACKAGING",
          rateRequestType: ["ACCOUNT", "LIST"],
          requestedPackageLineItems: [
            {
              weight: {
                units: "LB",
                value: 1, // Default weight for estimate
              },
            },
          ],
        },
      };

      const response = await fetch(`${this.baseUrl}/rate/v1/rates/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-locale": "en_US",
        },
        body: JSON.stringify(rateRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("FedEx Rate API error:", errorData);
        return {
          success: false,
          error: errorData.errors?.[0]?.message || "Failed to get rate quote",
          carrier: this.carrierName,
        };
      }

      const data = await response.json();
      return this.parseRateResponse(data, shipDate);
    } catch (error) {
      console.error("FedEx carrier error:", error);
      return {
        success: false,
        error: error.message,
        carrier: this.carrierName,
      };
    }
  }

  /**
   * Parse FedEx rate response to extract transit time info
   */
  parseRateResponse(data, shipDate) {
    try {
      const rateReply = data.output?.rateReplyDetails?.[0];

      if (!rateReply) {
        return {
          success: false,
          error: "No rate details in response",
          carrier: this.carrierName,
        };
      }

      // Get transit time from the commit info
      const commit = rateReply.commit;
      const transitDays =
        commit?.transitTime?.transitDays ||
        this.parseTransitDays(commit?.transitTime?.description);

      // Calculate delivery dates
      const deliveryDateMin = this.addBusinessDays(shipDate, transitDays || 3);
      const deliveryDateMax = this.addBusinessDays(
        shipDate,
        (transitDays || 3) + 2,
      );

      // If FedEx provides specific delivery date, use it
      if (commit?.dateDetail?.dayFormat) {
        const fedexDeliveryDate = new Date(commit.dateDetail.dayFormat);
        return {
          success: true,
          deliveryDateMin: fedexDeliveryDate,
          deliveryDateMax: this.addBusinessDays(fedexDeliveryDate, 1),
          transitDays:
            transitDays ||
            this.calculateBusinessDays(shipDate, fedexDeliveryDate),
          serviceName: rateReply.serviceName || "FedEx Ground",
          carrier: this.carrierName,
        };
      }

      return {
        success: true,
        deliveryDateMin,
        deliveryDateMax,
        transitDays: transitDays || 5,
        serviceName: rateReply.serviceName || "FedEx Ground",
        carrier: this.carrierName,
      };
    } catch (error) {
      console.error("Error parsing FedEx response:", error);
      return {
        success: false,
        error: "Failed to parse rate response",
        carrier: this.carrierName,
      };
    }
  }

  /**
   * Parse transit days from description string
   */
  parseTransitDays(description) {
    if (!description) return null;
    const match = description.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Format date as YYYY-MM-DD for FedEx API
   */
  formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  /**
   * Get the next business day (skip weekends)
   */
  getNextBusinessDay(date) {
    const result = new Date(date);
    result.setDate(result.getDate() + 1);

    while (result.getDay() === 0 || result.getDay() === 6) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  /**
   * Add business days to a date (skip weekends)
   */
  addBusinessDays(startDate, days) {
    const result = new Date(startDate);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }

    return result;
  }

  /**
   * Calculate business days between two dates
   */
  calculateBusinessDays(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);

    while (current < endDate) {
      current.setDate(current.getDate() + 1);
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        count++;
      }
    }

    return count;
  }
}
