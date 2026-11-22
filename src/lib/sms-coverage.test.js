import { describe, it, expect } from "vitest";
import { smsSendCoverage, MMS_UNITS } from "./sms-coverage";
describe("smsSendCoverage", () => {
  it("enough free texts", () => { const c = smsSendCoverage({ limit: 100, used: 40, recipients: 50 }); expect(c.blocked).toBe(false); expect(c.fromFree).toBe(50); });
  it("uses top-up credits after free", () => { const c = smsSendCoverage({ limit: 100, used: 90, credits: 20, recipients: 25 }); expect(c.fromCredits).toBe(15); expect(c.blocked).toBe(false); });
  it("blocks when short and no overage", () => { const c = smsSendCoverage({ limit: 100, used: 100, credits: 5, recipients: 10 }); expect(c.short).toBe(5); expect(c.blocked).toBe(true); });
  it("charges overage when plan allows", () => { const c = smsSendCoverage({ limit: 100, used: 100, credits: 0, allowOverage: true, recipients: 10 }); expect(c.overage).toBe(10); expect(c.blocked).toBe(false); });
  it("long messages still count one text per person, like the server", () => { const c = smsSendCoverage({ limit: 100, used: 40, recipients: 40, segments: 2 }); expect(c.needed).toBe(40); expect(c.blocked).toBe(false); });
  it("blocks only when people outnumber texts left", () => { const c = smsSendCoverage({ limit: 100, used: 40, recipients: 61, segments: 3 }); expect(c.short).toBe(1); expect(c.blocked).toBe(true); });
});

it("picture texts use 3 units per person", () => {
  expect(MMS_UNITS).toBe(3);
  const r = smsSendCoverage({ limit: 100, used: 0, credits: 0, recipients: 10, unitsEach: MMS_UNITS });
  expect(r.needed).toBe(30);
  expect(smsSendCoverage({ limit: 20, used: 0, recipients: 10, unitsEach: MMS_UNITS }).blocked).toBe(true);
});
