

## Update: Form Consent Text Across All Registration Forms

### Change

Replace all GDPR consent checkbox text with the new wording and link in 3 files:

**New text:**
> By completing this form, you agree that WMA-WCI will use, process and retain your personal data in accordance with our [Privacy Policy](https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf). You have the right to withdraw this consent at any time.

### Files to change

1. **`src/pages/PublicRegistration.jsx`** (line 328-331) — replace consent label text
2. **`src/pages/PublicWoFBIRegistration.jsx`** (line 221-231) — replace consent label text and update link
3. **`src/pages/MyProfile.jsx`** (line 794-797) — replace consent label text

All three currently have different wording. They will all be unified to the same new text with the same privacy policy link.

No backend or database changes needed.

