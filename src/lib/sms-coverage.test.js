import { describe, it, expect } from "vitest";
import { smsSendCoverage } from "./sms-coverage";
describe("smsSendCoverage", () => {
  it("enough free texts", () => { const c = smsSendCoverage({ limit: 100, used: 40, recipients: 50 }); expect(c.blocked).toBe(false); expect(c.fromFree).toBe(50); });
  it("uses top-up credits after free", () => { const c = smsSendCoverage({ limit: 100, used: 90, credits: 20, recipients: 25 }); expect(c.fromCredits).toBe(15); expect(c.blocked).toBe(false); });
  it("blocks when short and no overage", () => { const c = smsSendCoverage({ limit: 100, used: 100, credits: 5, recipients: 10 }); expect(c.short).toBe(5); expect(c.blocked).toBe(true); });
  it("charges overage when plan allows", () => { const c = smsSendCoverage({ limit: 100, used: 100, credits: 0, allowOverage: true, recipients: 10 }); expect(c.overage).toBe(10); expect(c.blocked).toBe(false); });
  it("two-text messages count double", () => { expect(smsSendCoverage({ limit: 100, used: 0, recipients: 30, segments: 2 }).needed).toBe(60); });
});
