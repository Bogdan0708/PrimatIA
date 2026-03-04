import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock otplib before importing totp module
vi.mock("otplib", () => ({
  generateSecret: () => "JBSWY3DPEHPK3PXP",
  verifySync: vi.fn(),
}));

import { generateTOTPSecret, generateTOTPKeyURI, verifyTOTPToken } from "@/lib/totp";
import { verifySync } from "otplib";

describe("TOTP helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateTOTPSecret", () => {
    it("returns a non-empty string", () => {
      const secret = generateTOTPSecret();
      expect(secret).toBeTruthy();
      expect(typeof secret).toBe("string");
    });
  });

  describe("generateTOTPKeyURI", () => {
    it("returns a valid otpauth URI", () => {
      const uri = generateTOTPKeyURI("admin@primaria.ro", "JBSWY3DPEHPK3PXP");
      expect(uri).toMatch(/^otpauth:\/\/totp\//);
      expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
      expect(uri).toContain("issuer=Primar");
      expect(uri).toContain("algorithm=SHA1");
      expect(uri).toContain("digits=6");
      expect(uri).toContain("period=30");
    });

    it("encodes email in the label", () => {
      const uri = generateTOTPKeyURI("user@test.ro", "SECRET123");
      expect(uri).toContain(encodeURIComponent("PrimarIA:user@test.ro"));
    });
  });

  describe("verifyTOTPToken", () => {
    it("returns true for valid token", () => {
      vi.mocked(verifySync).mockReturnValue({ valid: true, delta: 0 } as never);
      expect(verifyTOTPToken("SECRET", "123456")).toBe(true);
      expect(verifySync).toHaveBeenCalledWith({
        token: "123456",
        secret: "SECRET",
        period: 30,
        digits: 6,
      });
    });

    it("returns false for invalid token", () => {
      vi.mocked(verifySync).mockReturnValue({ valid: false, delta: 0 } as never);
      expect(verifyTOTPToken("SECRET", "000000")).toBe(false);
    });

    it("returns false when otplib throws", () => {
      vi.mocked(verifySync).mockImplementation(() => {
        throw new Error("Invalid input");
      });
      expect(verifyTOTPToken("BAD", "000000")).toBe(false);
    });
  });
});
