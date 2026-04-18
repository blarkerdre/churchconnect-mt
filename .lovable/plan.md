
The user reports that clicking either "Refer to Unit Leader" or "Refer to Home Cell Leader" hangs the app. Earlier we already fixed an infinite-refetch loop in `ReferralTimeline.jsx` by stabilizing query keys. The issue persists after splitting the buttons, so something new is wrong.

Let me investigate the actual state of the files now.
