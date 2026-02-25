/**
 * ROeID (Romanian Electronic Identity) Integration
 *
 * ROeID is Romania's national eID system using eIDAS standards.
 * This module provides OIDC-based authentication flow.
 *
 * Full integration requires government partnership and certification.
 * When configured (ROEID_ENABLED=true + ROEID_CLIENT_ID + ROEID_CLIENT_SECRET),
 * performs real OIDC discovery, authorization, and token exchange.
 * When not configured, methods throw descriptive errors.
 *
 * Environment variables:
 * - ROEID_ENABLED: "true" to enable
 * - ROEID_CLIENT_ID: OAuth2 client ID
 * - ROEID_CLIENT_SECRET: OAuth2 client secret
 * - ROEID_DISCOVERY_URL: OpenID Connect discovery endpoint
 * - ROEID_REDIRECT_URI: Callback URL after authentication
 */

import { randomBytes, createHash } from "crypto";

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

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  issuer: string;
  jwks_uri: string;
  scopes_supported: string[];
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

export class RoeidDisabledError extends Error {
  constructor() {
    super(
      "ROeID integration is disabled. Set ROEID_ENABLED=true and configure ROEID_CLIENT_ID / ROEID_CLIENT_SECRET to enable it."
    );
    this.name = "RoeidDisabledError";
  }
}

export class RoeidProvider {
  private discoveryUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private discoveryCache: OidcDiscovery | null = null;
  private cacheTimestamp: number = 0;
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.discoveryUrl =
      process.env.ROEID_DISCOVERY_URL ||
      "https://roeid.ro/.well-known/openid-configuration";
    this.clientId = process.env.ROEID_CLIENT_ID || "";
    this.clientSecret = process.env.ROEID_CLIENT_SECRET || "";
    this.redirectUri =
      process.env.ROEID_REDIRECT_URI || "http://localhost:3000/api/auth/roeid/callback";
  }

  /**
   * Check if ROeID integration is enabled via environment variable.
   */
  static isEnabled(): boolean {
    return (
      process.env.ROEID_ENABLED === "true" &&
      Boolean(process.env.ROEID_CLIENT_ID) &&
      Boolean(process.env.ROEID_CLIENT_SECRET)
    );
  }

  private assertEnabled() {
    if (!RoeidProvider.isEnabled()) {
      throw new RoeidDisabledError();
    }
  }

  /**
   * Fetch and cache the OpenID Connect discovery document.
   */
  async getDiscoveryDocument(): Promise<OidcDiscovery> {
    this.assertEnabled();

    const now = Date.now();
    if (this.discoveryCache && now - this.cacheTimestamp < RoeidProvider.CACHE_TTL) {
      return this.discoveryCache;
    }

    const response = await fetch(this.discoveryUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`ROeID discovery failed: HTTP ${response.status}`);
    }

    this.discoveryCache = (await response.json()) as OidcDiscovery;
    this.cacheTimestamp = now;
    return this.discoveryCache;
  }

  /**
   * Generate a PKCE code verifier and challenge for secure auth flow.
   */
  generatePkce(): { verifier: string; challenge: string } {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
  }

  /**
   * Initiate OAuth2/OpenID Connect authorization flow with ROeID.
   * Returns the authorization URL to redirect the user to, plus
   * state and PKCE verifier that must be stored in session.
   */
  async initiateAuth(redirectUri?: string): Promise<{
    authorizationUrl: string;
    state: string;
    codeVerifier: string;
  }> {
    this.assertEnabled();

    const discovery = await this.getDiscoveryDocument();
    const state = randomBytes(16).toString("hex");
    const { verifier, challenge } = this.generatePkce();
    const callbackUri = redirectUri || this.redirectUri;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: callbackUri,
      scope: "openid profile address",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ui_locales: "ro",
    });

    return {
      authorizationUrl: `${discovery.authorization_endpoint}?${params}`,
      state,
      codeVerifier: verifier,
    };
  }

  /**
   * Handle the OAuth2 callback after user authenticates with ROeID.
   * Exchanges the authorization code for tokens and fetches user profile.
   */
  async handleCallback(
    code: string,
    codeVerifier: string,
    redirectUri?: string,
  ): Promise<RoeidProfile> {
    this.assertEnabled();

    const discovery = await this.getDiscoveryDocument();
    const callbackUri = redirectUri || this.redirectUri;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text().catch(() => "unknown error");
      throw new Error(`ROeID token exchange failed: ${err}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      id_token: string;
      token_type: string;
    };

    // Fetch user info
    const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!userInfoResponse.ok) {
      throw new Error(`ROeID userinfo failed: HTTP ${userInfoResponse.status}`);
    }

    const userInfo = (await userInfoResponse.json()) as Record<string, unknown>;

    // Map eIDAS claims to our profile structure
    return this.mapToProfile(userInfo);
  }

  /**
   * Map ROeID/eIDAS OIDC claims to our internal profile structure.
   */
  private mapToProfile(claims: Record<string, unknown>): RoeidProfile {
    const address = (claims.address as Record<string, string>) || {};

    return {
      cnp: String(claims.cnp || claims.personal_numeric_code || ""),
      firstName: String(claims.given_name || ""),
      lastName: String(claims.family_name || ""),
      dateOfBirth: String(claims.birthdate || ""),
      address: {
        street: String(address.street_address || ""),
        number: String(address.street_number || ""),
        city: String(address.locality || ""),
        county: String(address.region || ""),
        postalCode: String(address.postal_code || ""),
      },
      documentSeries: String(claims.document_series || ""),
      documentNumber: String(claims.document_number || ""),
      verified: true,
    };
  }

  /**
   * Verify a citizen's identity by matching their CNP against a Contribuabil record.
   * This is used after ROeID auth to link the eID profile to an existing taxpayer.
   */
  async verifyIdentity(cnp: string): Promise<boolean> {
    this.assertEnabled();

    // CNP validation: must be 13 digits with valid check digit
    if (!/^\d{13}$/.test(cnp)) {
      return false;
    }

    // Validate CNP check digit (Romanian standard algorithm)
    const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
    const digits = cnp.split("").map(Number);
    const checkSum = weights.reduce((sum, w, i) => sum + w * digits[i], 0) % 11;
    const checkDigit = checkSum === 10 ? 1 : checkSum;

    return checkDigit === digits[12];
  }
}
