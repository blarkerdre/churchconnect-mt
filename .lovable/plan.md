

## Add Tenant Logo to All Form Dialogs

### Approach
Create a small reusable `TenantDialogHeader` component that renders the tenant logo alongside the dialog title. Then replace the `DialogHeader` pattern in all ~39 dialog/form components.

### New Component: `src/components/ui/TenantDialogHeader.jsx`
A wrapper that renders:
```jsx
<DialogHeader>
  <div className="flex items-center gap-3">
    {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />}
    <DialogTitle>{children}</DialogTitle>
  </div>
</DialogHeader>
```
Uses `useTenant()` to get `currentTenant?.logo_url`. Falls back gracefully (no image) if no logo is set.

### Files to update (~39 dialog components)
Replace `<DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>` with `<TenantDialogHeader>...</TenantDialogHeader>` in:

1. `src/components/members/MemberFormDialog.jsx`
2. `src/components/members/BulkImportDialog.jsx`
3. `src/components/members/RegistrationQRCode.jsx`
4. `src/components/members/WelcomeQuestions.jsx`
5. `src/components/followups/FollowupFormDialog.jsx`
6. `src/components/followups/FollowupDetailPanel.jsx`
7. `src/components/followups/FollowupMessageDialog.jsx`
8. `src/components/followups/OverdueReminder.jsx`
9. `src/components/events/EventFormDialog.jsx`
10. `src/components/events/RegistrationsDialog.jsx`
11. `src/components/attendance/SessionFormDialog.jsx`
12. `src/components/attendance/SelfCheckIn.jsx`
13. `src/components/attendance/CheckInPanel.jsx`
14. `src/components/comms/AnnouncementForm.jsx`
15. `src/components/comms/EmailAlertForm.jsx`
16. `src/components/comms/MessagingPane.jsx`
17. `src/components/sms/SMSDialog.jsx`
18. `src/components/sms/SMSHistoryDialog.jsx`
19. `src/components/sms/InvalidRecipientsPreview.jsx`
20. `src/components/pastoralcare/PastoralCareFormDialog.jsx`
21. `src/components/pastoralcare/PastoralCareRequestDialog.jsx`
22. `src/components/pastoralcare/BulkAssignDialog.jsx`
23. `src/components/pastoralcare/MemberPastoralHistory.jsx`
24. `src/components/transportation/TransportBookingDialog.jsx`
25. `src/components/transportation/TransportDetailPanel.jsx`
26. `src/components/certificates/IssueCertificateDialog.jsx`
27. `src/components/certificates/CertificateTemplateSettings.jsx`
28. `src/components/exams/ExamSessionManager.jsx`
29. `src/components/exams/TakeExamDialog.jsx`
30. `src/components/exams/SubjectManager.jsx`
31. `src/components/exams/WoFBIRegistrationQRCode.jsx`
32. `src/components/exams/CourseResultsView.jsx`
33. `src/components/wsf/WSFCentreFormDialog.jsx`
34. `src/components/wsf/WSFAttendanceFormDialog.jsx`
35. `src/components/wsf/WSFCentreMembersDialog.jsx`
36. `src/components/settings/BookOfTheMonthSettings.jsx`
37. `src/components/users/BulkUnitAssignDialog.jsx`
38. `src/components/tenants/TenantUsersDialog.jsx`
39. `src/components/analytics/ReEngagementDialog.jsx`

### How each edit looks
Before:
```jsx
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
...
<DialogHeader>
  <DialogTitle>Some Title</DialogTitle>
</DialogHeader>
```

After:
```jsx
import { DialogTitle } from "@/components/ui/dialog"; // remove DialogHeader from import
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
...
<TenantDialogHeader>Some Title</TenantDialogHeader>
```

For dialogs that have icons or complex content inside `DialogTitle`, the icon stays inside the children.

### Files changed
- **New**: `src/components/ui/TenantDialogHeader.jsx` — reusable logo + title header
- **Updated**: ~39 dialog components — swap to `TenantDialogHeader`

