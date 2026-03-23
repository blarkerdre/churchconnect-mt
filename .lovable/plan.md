

## Add WoFBI Registration QR Code

The WoFBI registration QR code was planned but not yet added to the Exam Management page. Here's the plan:

### Changes

**New file: `src/components/exams/WoFBIRegistrationQRCode.jsx`**
- Reuse the same pattern as `RegistrationQRCode.jsx` (QR dialog with copy link + download PNG)
- URL points to `/exam-management` (members see the registration view automatically)
- Updated title/description for WoFBI context

**Update: `src/pages/ExamManagement.jsx`**
- Add a "Registration QR" button in the admin header area
- Wire up `qrOpen` state and render the new dialog
- Import `QrCode` from lucide-react

No database changes needed.

