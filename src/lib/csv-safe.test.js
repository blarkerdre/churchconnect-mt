import { describe, it, expect } from "vitest";
import { csvSafeCell } from "./csv-safe";

describe("csvSafeCell", () => {
  it("neutralises cells starting with a formula character", () => {
    expect(csvSafeCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvSafeCell("+1")).toBe(`"'+1"`);
    expect(csvSafeCell("-2")).toBe(`"'-2"`);
    expect(csvSafeCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });
  it("leaves ordinary text unchanged apart from quoting", () => {
    expect(csvSafeCell("John, Smith")).toBe(`"John, Smith"`);
    expect(csvSafeCell(null)).toBe(`""`);
  });
});
