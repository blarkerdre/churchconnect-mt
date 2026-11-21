import { normalizePhone } from "@/lib/phone-utils";

// Split CSV text into rows, honouring quotes (commas/newlines inside quotes, "" escapes).
export function splitCsv(text) {
  const rows = []; let row = []; let cur = ""; let q = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur.trim()); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cur.trim()); cur = "";
      if (row.some(c => c)) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur.trim());
  if (row.some(c => c)) rows.push(row);
  return rows;
}

const key = (h) => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES = {
  first: ["firstname", "first", "forename", "givenname"],
  last: ["lastname", "last", "surname", "familyname"],
  name: ["name", "fullname"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "mobile", "mobilenumber", "phonenumber", "cell", "cellphone", "telephone", "tel", "number"],
  tags: ["tags", "tag", "groups"],
  notes: ["notes", "note", "comments"],
};

// Phone for contact imports: bare 10-digit (or 1+10) North American numbers get +1.
export function normalizeContactPhone(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t.startsWith("+")) {
    const d = t.replace(/\D/g, "");
    if (/^[2-9]\d{9}$/.test(d)) return "+1" + d;
    if (/^1[2-9]\d{9}$/.test(d)) return "+" + d;
  }
  return normalizePhone(t);
}

export function parseContactsCsv(text) {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(key);
  const find = (k) => headers.findIndex(h => ALIASES[k].includes(h));
  const i = Object.fromEntries(Object.keys(ALIASES).map(k => [k, find(k)]));
  const get = (cols, n) => (n >= 0 ? cols[n] || "" : "");
  const out = [];
  for (const cols of rows.slice(1)) {
    let first = get(cols, i.first), last = get(cols, i.last);
    if (!first && !last && i.name >= 0) {
      const parts = get(cols, i.name).split(/\s+/).filter(Boolean);
      first = parts.shift() || ""; last = parts.join(" ");
    }
    const rawPhone = get(cols, i.phone);
    const phone = rawPhone ? (normalizeContactPhone(rawPhone) || rawPhone) : null;
    const email = get(cols, i.email).toLowerCase() || null;
    if (!email && !phone) continue;
    out.push({
      first_name: first || null,
      last_name: last || null,
      email,
      phone,
      tags: get(cols, i.tags).split(",").map(t => t.trim()).filter(Boolean),
      notes: get(cols, i.notes) || null,
      source: "csv",
    });
  }
  return out;
}
