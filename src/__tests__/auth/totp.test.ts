import { describe, expect, it } from "vitest";
import {
  buildOtpAuthUrl,
  formatTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/totp";

describe("TOTP helpers", () => {
  describe("generateTotpSecret", () => {
    it("generates a base32 secret and formats it for manual entry", () => {
      const secret = generateTotpSecret();
      expect(secret).toMatch(/^[A-Z2-7]+$/);
      expect(formatTotpSecret(secret)).toContain(" ");
    });

    it("returns a non-empty string", () => {
      const secret = generateTotpSecret();
      expect(secret).toBeTruthy();
      expect(typeof secret).toBe("string");
    });
  });

  describe("generateTotpCode and verifyTotpCode", () => {
    it("generates and verifies time-based codes", () => {
      const secret = "JBSWY3DPEHPK3PXP";
      const timestampMs = Date.UTC(2026, 2, 9, 12, 0, 0);
      const code = generateTotpCode(secret, timestampMs);

      expect(code).toMatch(/^\d{6}$/);
      expect(verifyTotpCode(secret, code, { timestampMs })).toBe(true);
      expect(verifyTotpCode(secret, "000000", { timestampMs, window: 0 })).toBe(false);
    });

    it("returns false for invalid token", () => {
      expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "000000")).toBe(false);
    });

    it("returns false for invalid input format", () => {
      expect(verifyTotpCode("JBSWY3DPEHPK3PXP", "abc")).toBe(false);
    });
  });

  describe("buildOtpAuthUrl", () => {
    it("returns a valid otpauth URI", () => {
      const url = buildOtpAuthUrl({
        secret: "JBSWY3DPEHPK3PXP",
        issuer: "PrimarIA",
        accountName: "admin@primaria.ro",
      });
      expect(url).toMatch(/^otpauth:\/\/totp\//);
      expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
      expect(url).toContain("issuer=PrimarIA");
      expect(url).toContain("algorithm=SHA1");
      expect(url).toContain("digits=6");
      expect(url).toContain("period=30");
    });

    it("encodes email in the label", () => {
      const url = buildOtpAuthUrl({
        secret: "SECRET123",
        issuer: "PrimarIA",
        accountName: "user@test.ro",
      });
      expect(url).toContain(encodeURIComponent("PrimarIA:user@test.ro"));
    });
  });
});
