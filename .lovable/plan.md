

## Update QR Code URL to Be Environment-Aware

### Problem
The QR code URL is hardcoded to `https://churchmanagementsuite.org/register` (the live/production domain). In the test/preview environment, it should point to the preview URL instead.

### Solution
Use `window.location.origin` to dynamically generate the registration URL based on the current environment:
- **Live**: `https://churchmanagementsuite.org/register` (when accessed from the live domain)
- **Preview/Test**: `https://id-preview--de8d3061-cc44-4ec4-9843-a7713896e3bc.lovable.app/register`

### Change
**`src/components/members/RegistrationQRCode.jsx`** — Replace the hardcoded URL with:
```js
const registrationUrl = `${window.location.origin}/register`;
```

This single-line change ensures the QR code always points to whichever environment you're currently using.

