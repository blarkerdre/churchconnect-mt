import { describe, it, expect, vi } from "vitest";
vi.mock("react", () => ({ useCallback: (f) => f, useMemo: (f) => f() }));
let current = null;
vi.mock("@/contexts/TenantContext", () => ({ useTenant: () => ({ tenantId: current }) }));
import { useTenantQuery, NO_TENANT } from "@/hooks/useTenantQuery";
const fakeQuery = () => ({ calls: [], eq(c, v) { this.calls.push([c, v]); return this; } });
describe("scopeQuery", () => {
  it("matches no church when none is selected", () => {
    current = null;
    const result = { current: useTenantQuery() };
    expect(result.current.scopeQuery(fakeQuery()).calls).toEqual([["tenant_id", NO_TENANT]]);
  });
  it("limits to the selected church", () => {
    current = "abc";
    const result = { current: useTenantQuery() };
    expect(result.current.scopeQuery(fakeQuery()).calls).toEqual([["tenant_id", "abc"]]);
  });
});
