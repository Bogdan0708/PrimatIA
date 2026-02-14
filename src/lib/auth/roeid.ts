/**
 * ROeID (Romanian Electronic Identity) Integration Scaffold
 *
 * ROeID is Romania's national eID system using eIDAS standards.
 * Full integration requires government partnership and certification.
 * This module provides the infrastructure scaffold for future integration.
 */

export interface RoeidAddress {
  street: string;
  number: string;
  city: string;
  county: string;
  postalCode: string;
}

export interface RoeidProfile {
  cnp: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: RoeidAddress;
  documentSeries: string;
  documentNumber: string;
  verified: boolean;
}

export class RoeidNotImplementedError extends Error {
  constructor(method: string) {
    super(
      `ROeID: Metoda '${method}' nu este încă implementată. ` +
        `Integrarea completă cu ROeID necesită parteneriat cu autoritățile guvernamentale și certificare eIDAS. ` +
        `Contactați echipa de dezvoltare pentru mai multe detalii.`
    );
    this.name = "RoeidNotImplementedError";
  }
}

export class RoeidProvider {
  private discoveryUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.discoveryUrl =
      process.env.ROEID_DISCOVERY_URL ||
      "https://roeid.ro/.well-known/openid-configuration";
    this.clientId = process.env.ROEID_CLIENT_ID || "";
    this.clientSecret = process.env.ROEID_CLIENT_SECRET || "";
  }

  /**
   * Check if ROeID integration is enabled via environment variable.
   */
  static isEnabled(): boolean {
    return process.env.ROEID_ENABLED === "true";
  }

  /**
   * Initiate OAuth2/OpenID Connect authorization flow with ROeID.
   * Returns the authorization URL to redirect the user to.
   *
   * @throws {RoeidNotImplementedError} - Integration not yet available
   */
  async initiateAuth(redirectUri: string): Promise<string> {
    void redirectUri;
    throw new RoeidNotImplementedError("initiateAuth");
  }

  /**
   * Handle the OAuth2 callback after user authenticates with ROeID.
   * Exchanges the authorization code for user profile data.
   *
   * @throws {RoeidNotImplementedError} - Integration not yet available
   */
  async handleCallback(code: string): Promise<RoeidProfile> {
    void code;
    throw new RoeidNotImplementedError("handleCallback");
  }

  /**
   * Verify a citizen's identity using their CNP via ROeID.
   *
   * @throws {RoeidNotImplementedError} - Integration not yet available
   */
  async verifyIdentity(cnp: string): Promise<boolean> {
    void cnp;
    throw new RoeidNotImplementedError("verifyIdentity");
  }

  /**
   * Get the OpenID Connect discovery document from ROeID.
   *
   * @throws {RoeidNotImplementedError} - Integration not yet available
   */
  async getDiscoveryDocument(): Promise<Record<string, unknown>> {
    void this.discoveryUrl;
    void this.clientId;
    void this.clientSecret;
    throw new RoeidNotImplementedError("getDiscoveryDocument");
  }
}
