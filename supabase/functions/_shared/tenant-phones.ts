// Restricts outbound calls/messages to phone numbers already recorded for the
// tenant (members, first timers, contacts, drivers). Comparison uses the last
// 9 digits so local (07…) and international (+44…) formats both match.

const key = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

export async function loadTenantPhoneSet(client: any, tenantId: string): Promise<Set<string>> {
  const set = new Set<string>();
  const add = (rows: any[] | null, cols: string[]) => {
    for (const r of rows || []) for (const c of cols) {
      const k = key(r?.[c] || "");
      if (k.length >= 7) set.add(k);
    }
  };
  const [m, f, c, t] = await Promise.all([
    client.from("members").select("phone, emergency_contact_phone").eq("tenant_id", tenantId).limit(20000),
    client.from("first_timers").select("phone").eq("tenant_id", tenantId).limit(20000),
    client.from("contacts").select("phone").eq("tenant_id", tenantId).limit(20000),
    client.from("transportation").select("driver_phone").eq("tenant_id", tenantId).limit(20000),
  ]);
  add(m.data, ["phone", "emergency_contact_phone"]);
  add(f.data, ["phone"]);
  add(c.data, ["phone"]);
  add(t.data, ["driver_phone"]);
  return set;
}

export function isTenantPhone(set: Set<string>, phone: string): boolean {
  const k = key(phone);
  return k.length >= 7 && set.has(k);
}
