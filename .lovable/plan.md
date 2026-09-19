# Remove Lovable from GitHub attribution

## Goal
Make GitHub show only **Adeniyi Olusegun Kugbiyi** on commits, Contributors, and “Built by”, without changing any application files, wording, assets, or connected services.

## Plan

1. **Stop Lovable edits before rewriting**
   - Perform the rewrite from a fresh local clone.
   - Make future changes locally through GitHub, so the bot is not added again.

2. **Back up both repositories**
   - Create mirror backups of `churchconnect-mt` and `church-connect` before changing history.

3. **Rewrite every commit identity**
   - Use `git filter-repo` across every branch and tag.
   - Set both author and committer on every commit to:
     - `Adeniyi Olusegun Kugbiyi`
     - your verified GitHub email
   - Preserve commit messages, dates, and file contents.

4. **Remove stale references and force-push**
   - Delete obsolete remote branches/tags that still point to bot-authored commits.
   - Force-push all rewritten branches and tags for both repositories.

5. **Verify locally before accepting the result**
   - Author and committer checks must each return exactly one identity.
   - Search all reachable refs for `lovable-dev[bot]` and `gpt-engineer-app[bot]`; both must return no results.

6. **Verify GitHub after its cache refreshes**
   - Commit pages show only Adeniyi Olusegun Kugbiyi.
   - Contributors shows one contributor.
   - “Built by” shows one avatar.
   - Check both repositories because the profile screenshot shows activity from each.

## Deliverable
Provide one copy-and-paste local script with safety checks and a short runbook. It will stop before force-pushing unless every rewritten commit has the correct author and committer.

## Important consequence
All commit hashes will change. Existing clones and open pull requests become obsolete and must be recreated. No application code or functionality will be changed.
