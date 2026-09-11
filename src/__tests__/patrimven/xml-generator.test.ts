import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildF3001Xml,
  buildF3002Xml,
  buildF3003Xml,
  buildF3101Xml,
  validateXml,
} from "@/lib/patrimven/xml-generator";
import {
  sampleF3001Records,
  sampleF3001Meta,
  sampleF3002Records,
  sampleF3002Meta,
  sampleF3003Records,
  sampleF3003Meta,
  sampleF3101Records,
  sampleF3101Meta,
  sampleRecordWithoutCui,
  sampleRecordWithInvalidCui,
} from "./sample-inputs";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", name), "utf8").trim();

describe("PatrimVen XML generator — golden files", () => {
  it("F3001 matches the golden file", () => {
    expect(buildF3001Xml(sampleF3001Records, sampleF3001Meta).trim()).toBe(
      fixture("f3001.expected.xml")
    );
  });

  it("F3002 matches the golden file", () => {
    expect(buildF3002Xml(sampleF3002Records, sampleF3002Meta).trim()).toBe(
      fixture("f3002.expected.xml")
    );
  });

  it("F3003 matches the golden file", () => {
    expect(buildF3003Xml(sampleF3003Records, sampleF3003Meta).trim()).toBe(
      fixture("f3003.expected.xml")
    );
  });

  it("F3101 matches the golden file", () => {
    expect(buildF3101Xml(sampleF3101Records, sampleF3101Meta).trim()).toBe(
      fixture("f3101.expected.xml")
    );
  });
});

describe("PatrimVen XML generator — validateXml", () => {
  it("accepts a well-formed F3001 export", () => {
    const xml = buildF3001Xml(sampleF3001Records, sampleF3001Meta);
    expect(validateXml(xml, "F3001")).toEqual({ valid: true, errors: [] });
  });

  it("accepts a well-formed F3002 export", () => {
    const xml = buildF3002Xml(sampleF3002Records, sampleF3002Meta);
    expect(validateXml(xml, "F3002")).toEqual({ valid: true, errors: [] });
  });

  it("accepts a well-formed F3003 export", () => {
    const xml = buildF3003Xml(sampleF3003Records, sampleF3003Meta);
    expect(validateXml(xml, "F3003")).toEqual({ valid: true, errors: [] });
  });

  it("accepts a well-formed F3101 export", () => {
    const xml = buildF3101Xml(sampleF3101Records, sampleF3101Meta);
    expect(validateXml(xml, "F3101")).toEqual({ valid: true, errors: [] });
  });
});

describe("PatrimVen XML generator — CUI guard", () => {
  it("rejects a declarant with an invalid CUI checksum", () => {
    expect(() =>
      buildF3001Xml([sampleRecordWithInvalidCui], sampleF3001Meta)
    ).toThrow(/CUI/);
  });

  it("does not validate or throw for a declarant without a CUI (natural person, CNP only)", () => {
    expect(() =>
      buildF3001Xml([sampleRecordWithoutCui], sampleF3001Meta)
    ).not.toThrow();
  });
});
