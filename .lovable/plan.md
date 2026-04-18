
The user reports "Refer to Unit Leader" is not working. Let me investigate the current state of `SignPostDialog.jsx` and `FollowupDetailPanel.jsx` to see what's happening with the unit leader path.
<lov-tool-use id="toolu_vrtx_01P3625bi3CW29YBnNqXYwFM" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/followups/SignPostDialog.jsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BNWMYqzf7aciRZsVWoi9as" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/followups/FollowupDetailPanel.jsx\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017TZdAYvzzgMUReHDXcmHGz" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/followups/SignPostDialog.jsx\"}">
</lov-tool-use>
Let me check FollowupDetailPanel to see how the buttons trigger the dialog and confirm flow:
<lov-tool-use id="toolu_vrtx_01CvsnHh5wuuav8JY9S1Sz3k" name="code--search_files" integration-id="code" data="{\"query\": \"SignPostDialog|signPostType|signPostOpen\", \"include_patterns\": \"src/components/followups/FollowupDetailPanel.jsx\"}">
</lov-tool-use>
Now I need to understand what specifically isn't working. The user says "Refer to unit leader is not working." Let me think:

1. The button click sets `signPostType` to `"unit_leader"` and opens dialog.
2. Inside the dialog, `useEffect` syncs `type` to `defaultType` when opens.
3. User picks a unit, then a leader, hits Sign-Post.

Possible issues:
- The user might click "Refer to Unit Leader" but the dialog opens on the "Home Cell" tab because of state sync timing (the previous `signPostType` value). Actually `setType(defaultType)` runs only when `open` is true. But the React state is async — when the user opens dialog, `defaultType` prop is the latest, so this should work.
- Possibly the user is clicking and nothing visible happens? But session replay shows the user landed on Church Unit dropdown — suggesting dialog opens fine and they're on the unit_leader path.

Let me check what might actually be failing on submit. Look at `unit_leader_assignments` table — does it exist with that schema?
<lov-tool-use id="toolu_vrtx_01UhbdxkBGSTJEKst8ubqtCW" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='unit_leader_assignments'\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PvcPUQ9RPVPMGE1XXWUzZy" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT unit_name, count(*) FROM public.unit_leader_assignments GROUP BY unit_name\"}">
</lov-tool-use>
Schema and data look fine. Let me check the RLS policies on `followup_referrals` for the INSERT path — particularly `is_followup_team_member`:
<lov-tool-use id="toolu_vrtx_013PhPpNKwk3BsBPVJScQVek" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='is_followup_team_member'\"}">
</lov-tool-use>
OK. Now let me also examine the previously approved FollowupDetailPanel button section to understand context, especially where it shows the buttons (could the dialog not even open due to mobile clip?). Let me check around line 320-360:
<lov-tool-use id="toolu_vrtx_01QMLH5Va4mAAJ6TZP919dUt" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/followups/FollowupDetailPanel.jsx\", \"lines\": \"320-360\"}">
</lov-tool-use>
The user reports "Refer to unit leader is not working". I need clarification — is the dialog not opening, or does submission fail? Looking at session replay: user clicked "Home Cell Centre" first (got "no centres" toast), then went to "Church Unit" dropdown. So they're already in the dialog on the unit_leader path.

The most likely issue: when the user clicks "Refer to Unit Leader", the dialog opens but `defaultType` may not have synced — OR — once user picks a unit and leader, the `handleSubmit` could fail silently. Let me ask for clarification rather than guess.

<lov-plan>
## Diagnosis

I read `SignPostDialog.jsx` and the trigger in `FollowupDetailPanel.jsx`. The button correctly sets `signPostType="unit_leader"` and opens the dialog. Inside the dialog, `useEffect` syncs `type` to `defaultType` on open, so the Unit tab should be active.

The Sign-Post button submits to `followup_referrals` with `referral_type: "unit_leader"`, `target_unit_name`, and `assigned_leader_id`. Database side, the table exists and `unit_leader_assignments` has data for several units.

**"Not working" is ambiguous** — there are three different failure points worth distinguishing before I change code:

1. **Dialog opens on the wrong tab** (Home Cell instead of Unit Leader) — would happen if `defaultType` prop doesn't propagate.
2. **No leaders show after picking a unit** — would happen if the `unit-leaders` query returns empty (the user's tenant may not have a leader for the unit they pick).
3. **Submit silently fails / hangs** — likely an RLS denial. The `followup_referrals` INSERT policy requires the current user to be either an admin OR a "follow-up team member" (in `unit_leader_assignments` for unit `Follow-up`, or with `church_unit` containing "follow-up"). A regular Follow-up unit *member* who isn't an admin and isn't in those tables would get a silent insert error.

## Proposed fix (pending your confirmation of the actual symptom)

### If symptom = #3 (RLS silent failure on submit)
- In `handleSubmit`, after the `await ... .insert(payload)` returns an error, the existing `catch` does show a toast, but if RLS rejects with no rows, Supabase returns an `error` so the toast should fire. Verify it does.
- Add a precise console.log of `error` and `payload` so the next message reveals the real cause.
- If RLS is indeed rejecting non-admin Follow-up members, broaden the INSERT policy to allow any unit leader of the Follow-up unit *or* members whose `church_unit` contains "follow-up" *or* admins (it already does this, but the user's row may be missing). The likely real fix is data, not code.

### If symptom = #2 (no leaders shown)
- Add a hint under the empty state: "Tip: assign a leader in User Management → Assignments." (Already shown — so this is probably not it.)

### If symptom = #1 (wrong tab opens)
- The current `useEffect([open, defaultType])` does correctly call `setType(defaultType)` after mount when `open` flips true. But if the dialog was previously opened on Home Cell and closed, the next click on "Refer to Unit Leader" will: render with stale `type="home_cell_leader"` for one frame, then the effect runs and switches to `unit_leader`. Initialize `type` with `defaultType` and also reset on `open` toggle to false — this is mostly fine. To be safe, change `useState(defaultType)` to use a `key` reset by re-mounting `<DialogContent>` per-open, or set `type` synchronously when `open` becomes true via a derived state pattern.

## What I need from you

Please tell me which of these matches what you see when you click **Refer to Unit Leader**:

- (a) Dialog opens but on the **Home Cell** tab instead of Unit Leader.
- (b) Dialog opens on Unit Leader, you pick a unit, but **no leaders** appear.
- (c) Dialog opens, you fill it out, click **Sign-Post**, but **nothing happens** (no success toast, no error).
- (d) Dialog opens, you click Sign-Post, and you see a **specific error toast** — please share the text.
- (e) The button does **nothing at all** when clicked.

Once you confirm, I'll apply the targeted fix. No DB changes unless (c)/(d) point to RLS.
