

## Security Assessment: Public Registration Form (`/register`)

### Current Risk Areas

**1. No Rate Limiting (HIGH)**
Anyone can spam the `/register` endpoint and flood the `members` and `followups` tables with garbage data. There's no CAPTCHA, throttling, or abuse prevention.

**2. No Input Validation (MEDIUM)**
- No length limits on text fields (first_name, last_name, notes, address, etc.) — an attacker could insert megabytes of text
- No format validation on email or phone beyond basic HTML `type="email"`
- No sanitization of free-text fields (notes, address) — potential for stored XSS if any admin view renders content unsafely

**3. Broad Anon INSERT Policy (MEDIUM)**
The RLS policy `Public can register as member` allows anonymous inserts with only `gdpr_consent = true` as a guard. An attacker can insert arbitrary data into most columns including `membership_status`, `church_unit`, and `notes`.

**4. Followup Auto-Creation (LOW-MEDIUM)**
Anonymous users can also insert into `followups` (limited to First Timer/New Convert + Pending status). A spam attack on registration would also flood the followups table.

**5. No Data Validation at DB Level (LOW)**
No constraints on field lengths or formats at the database level — the RLS policy is the only gate.

### Recommended Mitigations

| Fix | Approach |
|-----|----------|
| Rate limiting | Add a backend function (edge function) as a proxy for registration, with IP-based rate limiting (e.g., 5 registrations per IP per hour) |
| Input validation | Add client-side length limits + server-side validation via the edge function |
| CAPTCHA | Add a simple honeypot field or integrate a CAPTCHA service |
| DB constraints | Add column length constraints (e.g., `first_name VARCHAR(100)`) via migration |
| Move insert logic server-side | Route registration through an edge function instead of direct anon table access — this lets you validate, rate-limit, and sanitize in one place |

### Recommendation

The strongest improvement would be **moving registration to an edge function** that:
- Validates and sanitizes all inputs
- Rate-limits by IP
- Inserts into both `members` and `followups` server-side using the service role key
- Removes the need for anon INSERT policies entirely

This eliminates the broad anon access and centralizes security controls.

