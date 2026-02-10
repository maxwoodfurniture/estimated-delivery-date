/**
 * Base carrier class - all carrier implementations should extend this
 * This provides a consistent interface for different shipping carriers
 */

export class BaseCarrier {
  constructor(credentials) {
    this.credentials = credentials;
    this.carrierName = "base";
  }

  /**
   * Get OAuth access token for API authentication
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    throw new Error("getAccessToken must be implemented by subclass");
  }

  /**
   * Get transit time estimate
   * @param {import('./types.js').TransitTimeRequest} request
   * @returns {Promise<import('./types.js').TransitTimeResponse>}
   */
  async getTransitTime(request) {
    throw new Error("getTransitTime must be implemented by subclass");
  }

  /**
   * Validate credentials are properly configured
   * @returns {boolean}
   */
  validateCredentials() {
    throw new Error("validateCredentials must be implemented by subclass");
  }

  /**
   * Get the carrier identifier
   * @returns {string}
   */
  getCarrierName() {
    return this.carrierName;
  }
}
