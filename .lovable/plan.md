# Show your name on every GitHub commit

## What is happening now

Commits pushed by the Lovable–GitHub sync are authored by `lovable-dev[bot]`, with your GitHub account recorded only as co-author. GitHub therefore renders the bot name on the commit list, and your name appears in smaller "co-authored" text.

This is set by the sync service, not by anything in the project code — so it cannot be changed by editing files here. There are two things to do: fix the history that already exists, and set expectations for future commits.

## Step 1 — Rewrite the existing history (done by you, locally)

This is a destructive rewrite, so it must run on your own machine against your clone, not inside Lovable. I will give you the exact commands; you run them.

1. Clone the repo fresh: `git clone https://github.com/blarkerdre/churchconnect-mt`
2. Install `git-filter-repo` (`brew install git-filter-repo` or `pip install git-filter-repo`).
3. Run a mailmap rewrite that maps `lovable-dev[bot]` to `Adeniyi Olusegun Kugbiyi <your-github-email>` for both author and committer on every commit.
4. Verify with `git log --format='%an <%ae>' | sort -u` — only your name should remain.
5. Force-push: `git push --force origin main`.

Result: every commit in the repository reads your name, including on the contributors graph and the commit list.

## Step 2 — Keep it that way

After the rewrite, any new commit made by the Lovable sync will again be authored by the bot. Two ways to handle that:

- **Preferred for evidence purposes:** stop pushing from Lovable to that repository (or work in a branch), and make your own commits locally so authorship stays yours.
- **Otherwise:** re-run the same rewrite before you capture screenshots or submit evidence.

I will note plainly in the OC1 pack which commits are yours; I will not alter any screenshot to change attribution.

## Step 3 — Recapture the evidence images

Once the rewrite is pushed, I recapture the repository landing page, the commit list, and the contributors graph so the OC1 document shows your full name as author throughout, and regenerate the OC1 document with the new figures.

## Notes

- No application code changes.
- A force-push rewrites commit IDs; anyone else with a clone must re-clone. Since you are the sole contributor, this is safe.
- Your GitHub profile name is already set to `Adeniyi Olusegun Kugbiyi`, so no profile change is needed.
