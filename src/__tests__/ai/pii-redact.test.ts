import { describe, it, expect } from "vitest";
import { redactPII } from "@/lib/ai/pii-redact";

describe("redactPII", () => {
  it("redacts Romanian CNP (13 digits starting with 1-8)", () => {
    expect(redactPII("CNP-ul meu este 1900101123456")).toBe(
      "CNP-ul meu este [CNP_REDACTED]"
    );
    expect(redactPII("2851225123456")).toBe("[CNP_REDACTED]");
  });

  it("does not redact numbers that are not valid CNP format", () => {
    expect(redactPII("cod fiscal 12345")).toBe("cod fiscal 12345");
    expect(redactPII("9900101123456")).toBe("9900101123456"); // starts with 9
  });

  it("redacts email addresses", () => {
    expect(redactPII("email: ion@primaria.ro")).toBe(
      "email: [EMAIL_REDACTED]"
    );
    expect(redactPII("contact test.user+tag@gmail.com acum")).toBe(
      "contact [EMAIL_REDACTED] acum"
    );
  });

  it("redacts Romanian phone numbers", () => {
    expect(redactPII("tel: 0722 123 456")).toBe("tel: [PHONE_REDACTED]");
    expect(redactPII("sună la +40 722 123 456")).toBe(
      "sună la [PHONE_REDACTED]"
    );
    expect(redactPII("telefon: 0262-123-456")).toBe(
      "telefon: [PHONE_REDACTED]"
    );
  });

  it("redacts multiple PII types in the same text", () => {
    const input =
      "Contribuabilul cu CNP 1900101123456, email ion@test.ro, tel 0722123456";
    const result = redactPII(input);
    expect(result).toBe(
      "Contribuabilul cu CNP [CNP_REDACTED], email [EMAIL_REDACTED], tel [PHONE_REDACTED]"
    );
  });

  it("preserves text without PII", () => {
    const input = "Care este termenul de plată pentru impozitul pe clădiri?";
    expect(redactPII(input)).toBe(input);
  });
});
