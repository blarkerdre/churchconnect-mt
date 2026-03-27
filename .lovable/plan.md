

## Add Church Logo to QR Codes + Labels

### What changes

Both `RegistrationQRCode.jsx` and `WoFBIRegistrationQRCode.jsx` will be updated to:

1. **Embed the church logo in the center of the QR code** using `qrcode.react`'s built-in `imageSettings` prop on `QRCodeSVG`. This overlays the tenant's logo (or the default Winners Chapel logo) in the middle of the QR pattern. The high error correction level (`H`) already in use supports up to 30% coverage, so the logo won't break scanning.

2. **Add a visible label above the QR code** — the church/tenant name displayed prominently so printed QR codes are clearly branded. Labels:
   - Member Registration: **"{Church Name} — Member Registration"**
   - WoFBI: **"{Church Name} — WoFBI Registration"**

3. **Include the label in the downloaded PNG** so printed copies also show the branding text beneath/above the QR.

### Technical approach

- Get `currentTenant` from `useTenant()` context (already available — provides `currentTenant.logo_url` and `currentTenant.name`)
- Use `QRCodeSVG`'s `imageSettings={{ src, height: 48, width: 48, excavate: true }}` to embed the logo
- Fall back to `/winners-logo.png` (the default logo already used elsewhere) when no tenant logo exists
- Update the download function to draw the label text on the canvas above/below the QR code
- Update download filename to include tenant slug (e.g., `mega-church-registration-qr.png`)

### Files changed

- **`src/components/members/RegistrationQRCode.jsx`** — add logo overlay + church name label
- **`src/components/exams/WoFBIRegistrationQRCode.jsx`** — add logo overlay + church name label

