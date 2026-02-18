/**
 * ROeID Authentication Provider
 *
 * Integrates ROeID as an authentication option for the citizen portal.
 * Currently scaffold-only — methods throw NotImplementedError.
 */

import { RoeidProvider, type RoeidProfile, RoeidNotImplementedError } from "../roeid";

export interface RoeidAuthResult {
  profile: RoeidProfile;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * ROeID authentication provider for the citizen portal.
 * When ROEID_ENABLED=true, the login page shows the ROeID button.
 */
export class RoeidAuthProvider {
  private provider: RoeidProvider;

  constructor() {
    this.provider = new RoeidProvider();
  }

  /**
   * Check if ROeID authentication is available.
   */
  static isAvailable(): boolean {
    return RoeidProvider.isEnabled();
  }

  /**
   * Start the ROeID login flow.
   * Returns a URL to redirect the citizen to ROeID for authentication.
   */
  async startLogin(callbackUrl: string): Promise<string> {
    return this.provider.initiateAuth(callbackUrl);
  }

  /**
   * Complete the ROeID login flow.
   * Processes the callback from ROeID and returns auth result.
   */
  async completeLogin(code: string): Promise<RoeidAuthResult> {
    void code;
    throw new RoeidNotImplementedError("completeLogin");
  }

  /**
   * Link a citizen's ROeID profile to their Contribuabil record by CNP.
   * Used when a citizen authenticates via ROeID for the first time.
   */
  async linkToContribuabil(
    tenantId: string,
    citizenUserId: string,
    profile: RoeidProfile
  ): Promise<{ linked: boolean; contribuabilId?: string }> {
    void tenantId;
    void citizenUserId;
    void profile;
    throw new RoeidNotImplementedError("linkToContribuabil");
  }
}
