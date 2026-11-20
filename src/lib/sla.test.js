import { describe, it, expect } from "vitest";
import { buildCommercialTokens } from "./sla";
const mods = [{ key: "members", label: "Members" }, { key: "events", label: "Events" }];
describe("SLA commercial terms", () => {
  it("uses the church's own SMS price over the plan price", () => {
    const t = buildCommercialTokens({ tenant: { billing_currency: "USD", sms_unit_price_override: 0.9 }, plan: { currency: "USD", overage_price_sms: 0.05 } });
    expect(t.sms_unit_price).toBe("US$0.90 per SMS");
  });
  it("ignores a plan SMS price in a different currency", () => {
    const t = buildCommercialTokens({ tenant: { billing_currency: "USD" }, plan: { currency: "GBP", overage_price_sms: 0.05 } });
    expect(t.sms_unit_price).toBe("Not agreed");
  });
  it("shows Not agreed when no subscription or setup fee exists", () => {
    const t = buildCommercialTokens({});
    expect(t.monthly_subscription).toBe("Not agreed");
    expect(t.setup_fee).toBe("Not agreed");
  });
  it("lists only switched-on features", () => {
    const t = buildCommercialTokens({ tenant: { settings: { disabled_features: ["/events"] } }, featureModules: mods });
    expect(t.selected_features).toBe("Members");
  });
  it("shows setup fee and paid status", () => {
    const t = buildCommercialTokens({ subscription: { amount: 49, currency: "GBP", setup_fee_amount: 250, setup_fee_paid: true, billing_interval: "month" } });
    expect(t.setup_fee).toBe("£250.00");
    expect(t.setup_fee_status).toBe("Paid");
    expect(t.monthly_subscription).toBe("£49.00");
  });
});
