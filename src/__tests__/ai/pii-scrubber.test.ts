import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "@/lib/ai/pii-scrubber";

describe("PII scrubber", () => {
  it("redacts common sensitive identifiers before AI calls", () => {
    const input =
      "NUME: Popescu PRENUME: Ion CNP 1900101123456 email ion@example.com telefon 0722123456 IBAN RO49AAAA1B31007593840000";

    const output = redactSensitiveText(input);

    expect(output).not.toContain("1900101123456");
    expect(output).not.toContain("ion@example.com");
    expect(output).not.toContain("0722123456");
    expect(output).not.toContain("RO49AAAA1B31007593840000");
    expect(output).toContain("[REDACTED_CNP]");
    expect(output).toContain("[REDACTED_EMAIL]");
    expect(output).toContain("[REDACTED_PHONE]");
    expect(output).toContain("[REDACTED_IBAN]");
  });
});
