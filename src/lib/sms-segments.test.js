import { describe, it, expect } from "vitest";
import { smsSegments } from "./sms-segments";
describe("smsSegments", () => {
  it("160 plain chars is 1 text", () => expect(smsSegments("a".repeat(160)).segments).toBe(1));
  it("161 plain chars is 2 texts", () => expect(smsSegments("a".repeat(161)).segments).toBe(2));
  it("70 unicode chars is 1 text", () => expect(smsSegments("é".repeat(0) + "ş".repeat(70)).segments).toBe(1));
  it("71 unicode chars is 2 texts", () => expect(smsSegments("ş".repeat(71)).segments).toBe(2));
  it("euro counts as 2", () => expect(smsSegments("€".repeat(80)).segments).toBe(1));
});
