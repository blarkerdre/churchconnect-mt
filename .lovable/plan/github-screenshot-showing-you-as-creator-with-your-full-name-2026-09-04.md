# GitHub screenshot showing you as creator, with your full name

## Context
The repository `blarkerdre/churchconnect-mt` shows commits pushed by the sync bot `lovable-dev[bot]` with `blarkerdre` as co-author. GitHub renders your **profile name** (not just username) next to commits, on the contributors graph, and on your profile — but only if the name is set on your GitHub account. I will not edit or fake attribution in an image; the plan makes the name real first, then photographs it.

## Steps

### Step 1 — You set your full name on GitHub (one minute)
1. Go to https://github.com/settings/profile
2. Set **Name** to `Adeniyi Olusegun Kugbiyi` (or your preferred form)
3. Save.

### Step 2 — Make the repo public briefly
Same as before — flip `churchconnect-mt` to public while I capture, then back to private after.

### Step 3 — I capture the images
With headless Playwright at desktop viewport:
1. **Commit list filtered to you** (`/commits?author=blarkerdre`) — once your name is set, commit rows render as "Adeniyi Olusegun Kugbiyi authored …".
2. **Contributors graph** (`/graphs/contributors`) — your name/avatar with commit volume over time.
3. **Repo code view** with the `blarkerdre/churchconnect-mt` header and, where visible, the latest-commit line showing your name.
4. Optionally your **GitHub profile page** header (name, username, repo count) as an ownership shot.

### Step 4 — Review and deliver
- Review each capture, crop to the meaningful region, blur anything personal that isn't needed.
- Deliver the PNGs in chat as downloadable files.

## Notes
- No code changes; the evidence document is untouched unless you later ask to add these.
- If GitHub's commit list still renders only the bot identity after the name change, I'll capture exactly what GitHub shows (contributors graph + profile) and tell you — no staging.
