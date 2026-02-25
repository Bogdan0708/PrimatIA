/**
 * ROeID Authentication Provider
 *
 * Integrates ROeID as an authentication option for the citizen portal.
 * When configured, performs real OIDC flow with PKCE.
 */

import { RoeidProvider, type RoeidProfile } from "../roeid";
import { prisma } from "@/lib/db";
import { hashCnp } from "@/lib/crypto";

export interface RoeidAuthResult {
  profile: RoeidProfile;
  linked: boolean;
  contribuabilId?: string;
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
   * Returns the authorization URL plus state and PKCE verifier
   * that must be stored in the session/cookie.
   */
  async startLogin(callbackUrl: string): Promise<{
    authorizationUrl: string;
    state: string;
    codeVerifier: string;
  }> {
    return this.provider.initiateAuth(callbackUrl);
  }

  /**
   * Complete the ROeID login flow.
   * Processes the callback from ROeID and returns the citizen profile.
   */
  async completeLogin(code: string, codeVerifier: string, redirectUri?: string): Promise<RoeidAuthResult> {
    const profile = await this.provider.handleCallback(code, codeVerifier, redirectUri);
    return { profile, linked: false };
  }

  /**
   * Link a citizen's ROeID profile to their Contribuabil record by CNP.
   * Used when a citizen authenticates via ROeID for the first time.
   */
  async linkToContribuabil(
    tenantId: string,
    citizenUserId: string,
    profile: RoeidProfile,
  ): Promise<{ linked: boolean; contribuabilId?: string }> {
    if (!profile.cnp) {
      return { linked: false };
    }

    // Validate CNP structure
    const isValid = await this.provider.verifyIdentity(profile.cnp);
    if (!isValid) {
      return { linked: false };
    }

    // Find matching Contribuabil by CNP hash
    const cnpHash = hashCnp(profile.cnp, tenantId);
    const contribuabil = await prisma.contribuabil.findFirst({
      where: { tenantId, cnpHash },
      select: { id: true },
    });

    if (!contribuabil) {
      return { linked: false };
    }

    // Link citizen user to contribuabil
    const existingLink = await prisma.citizenContribuabilLink.findFirst({
      where: { citizenUserId, contribuabilId: contribuabil.id },
    });

    if (!existingLink) {
      await prisma.citizenContribuabilLink.create({
        data: {
          citizenUserId,
          contribuabilId: contribuabil.id,
          tenantId,
          verifiedAt: new Date(),
        },
      });
    }

    return { linked: true, contribuabilId: contribuabil.id };
  }
}
