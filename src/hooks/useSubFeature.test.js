import { describe, it, expect } from "vitest";
import { isTenantFeatureEnabled } from "./useSubFeature";
import { resolveSteps } from "@/components/tour/tours";

const off = (paths) => ({ settings: { disabled_features: paths } });

describe("church feature switches", () => {
  it("a switched-off page reports as off", () => {
    expect(isTenantFeatureEnabled(off(["/testimony"]), "/testimony")).toBe(false);
    expect(isTenantFeatureEnabled(off(["/testimony"]), "/events")).toBe(true);
  });
  it("Home Cell flag off turns /wsf off", () => {
    expect(isTenantFeatureEnabled({ settings: { features: { wsf_enabled: false } } }, "/wsf")).toBe(false);
  });
  it("tour for a switched-off feature has no steps", () => {
    const t = off(["/testimony"]);
    expect(resolveSteps("testimony-v1", { isFeatureEnabled: (p) => isTenantFeatureEnabled(t, p) })).toHaveLength(0);
  });
  it("certificates step is skipped when certificates are off", () => {
    const t = off(["/certificates"]);
    const steps = resolveSteps("my-profile-v1", { isFeatureEnabled: (p) => isTenantFeatureEnabled(t, p) });
    expect(steps.some((s) => s.title === "Certificates")).toBe(false);
    expect(steps.length).toBeGreaterThan(0);
  });
});

describe("guided tour switch", () => {
  it("tour switch off reports /tour as off", () => {
    expect(isTenantFeatureEnabled(off(["/tour"]), "/tour")).toBe(false);
    expect(isTenantFeatureEnabled(off([]), "/tour")).toBe(true);
  });
});
