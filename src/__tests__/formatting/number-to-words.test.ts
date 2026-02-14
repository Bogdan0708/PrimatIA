import { describe, it, expect } from "vitest";
import { numberToWordsRo } from "@/lib/formatting/number-to-words";

describe("numberToWordsRo", () => {
  it("handles zero", () => {
    expect(numberToWordsRo(0)).toBe("zero lei");
  });

  it("handles single digits", () => {
    expect(numberToWordsRo(1)).toBe("unu lei");
    expect(numberToWordsRo(5)).toBe("cinci lei");
    expect(numberToWordsRo(9)).toBe("nouă lei");
  });

  it("handles teens", () => {
    expect(numberToWordsRo(10)).toBe("zece lei");
    expect(numberToWordsRo(11)).toBe("unsprezece lei");
    expect(numberToWordsRo(15)).toBe("cincisprezece lei");
    expect(numberToWordsRo(19)).toBe("nouăsprezece lei");
  });

  it("handles tens", () => {
    expect(numberToWordsRo(20)).toBe("douăzeci lei");
    expect(numberToWordsRo(25)).toBe("douăzeci și cinci lei");
    expect(numberToWordsRo(99)).toBe("nouăzeci și nouă lei");
  });

  it("handles hundreds with correct Romanian grammar", () => {
    expect(numberToWordsRo(100)).toBe("o sută lei");
    expect(numberToWordsRo(200)).toBe("două sute lei");
    expect(numberToWordsRo(300)).toBe("trei sute lei");
    expect(numberToWordsRo(150)).toBe("o sută cincizeci lei");
    expect(numberToWordsRo(999)).toBe("nouă sute nouăzeci și nouă lei");
  });

  it("handles thousands with feminine forms", () => {
    expect(numberToWordsRo(1000)).toBe("o mie lei");
    expect(numberToWordsRo(2000)).toBe("două mii lei");
    expect(numberToWordsRo(3000)).toBe("trei mii lei");
    expect(numberToWordsRo(5000)).toBe("cinci mii lei");
  });

  it("handles complex thousands", () => {
    expect(numberToWordsRo(1234)).toBe(
      "o mie două sute treizeci și patru lei"
    );
    expect(numberToWordsRo(10500)).toBe("zece mii cinci sute lei");
    expect(numberToWordsRo(100000)).toBe("o sută mii lei");
  });

  it("handles millions with de connector", () => {
    expect(numberToWordsRo(1000000)).toBe("un milion de lei");
    expect(numberToWordsRo(2000000)).toBe("două milioane de lei");
    expect(numberToWordsRo(5000000)).toBe("cinci milioane de lei");
  });

  it("handles millions without de when followed by other parts", () => {
    expect(numberToWordsRo(1000001)).toBe("un milion unu lei");
    expect(numberToWordsRo(1001000)).toBe("un milion o mie lei");
    expect(numberToWordsRo(2500000)).toBe(
      "două milioane cinci sute mii lei"
    );
  });

  it("handles bani (decimals)", () => {
    expect(numberToWordsRo(0.5)).toBe("cincizeci bani");
    // Actually let's check: zero lei + bani
    expect(numberToWordsRo(0.01)).toBe("una bani");
    expect(numberToWordsRo(1.50)).toBe("unu lei și cincizeci bani");
    expect(numberToWordsRo(99.99)).toBe(
      "nouăzeci și nouă lei și nouăzeci și nouă bani"
    );
  });

  it("handles the chitanță example: 1234.56", () => {
    expect(numberToWordsRo(1234.56)).toBe(
      "o mie două sute treizeci și patru lei și cincizeci și șase bani"
    );
  });

  it("handles large amounts", () => {
    expect(numberToWordsRo(999999999)).toBe(
      "nouă sute nouăzeci și nouă milioane nouă sute nouăzeci și nouă mii nouă sute nouăzeci și nouă lei"
    );
  });

  it("handles negative numbers", () => {
    expect(numberToWordsRo(-100)).toBe("minus o sută lei");
  });

  // Feminine forms for thousands: "una sută mii" (100 thousands uses feminine for 1/2)
  it("handles feminine forms in thousands correctly", () => {
    // "una sută" when used as part of thousands
    expect(numberToWordsRo(100000)).toBe("o sută mii lei");
    expect(numberToWordsRo(200000)).toBe("două sute mii lei");
    expect(numberToWordsRo(21000)).toBe("douăzeci și una mii lei");
  });
});
