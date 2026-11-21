import { describe, it, expect } from "vitest";
import { parseContactsCsv, normalizeContactPhone } from "./contact-csv";

describe("contact CSV import", () => {
  it("reads Mobile / quoted First Name headers with BOM", () => {
    const csv = '\uFEFFMobile,"First Name","Last Name",Email\n"(647) 529-1767",Oluwaseun,Fadahunsi,a@b.com\n"(289) 941-3823",,,\n';
    const rows = parseContactsCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ first_name: "Oluwaseun", last_name: "Fadahunsi", phone: "+16475291767", email: "a@b.com" });
    expect(rows[1].phone).toBe("+12899413823");
  });
  it("keeps UK local numbers as +44", () => {
    expect(normalizeContactPhone("07761364815")).toBe("+447761364815");
  });
});
