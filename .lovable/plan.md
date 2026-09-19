# Final GitHub attribution rewrite so every commit shows your name

## What the screenshots confirm

The commit list shows `lovable-dev[bot] and blarkerdre committed`, and the repository sidebar still lists two contributors. The earlier email-based rewrite did not cover every stored identity. Also, the new “Update plan” and “Changes” commits were created after the rewrite through Lovable’s Git sync, which officially authors synced commits as `lovable-dev[bot]` and co-attributes the connected member.

## Reliable approach

1. Finish all Lovable edits before running the rewrite; otherwise the next synced edit creates another bot-authored commit.
2. Rewrite the **author and committer of every commit unconditionally**, instead of relying on a list of bot email addresses.
3. Verify locally that there is only one author and one committer before pushing.
4. Force-push the rewritten history, then make no further Lovable changes until the OC1 screenshots are captured.

## Script

Run the following directly in a terminal on your computer. Replace `YOUR_GITHUB_EMAIL` with an email verified on your GitHub account. If your email is private, copy the exact noreply address shown at https://github.com/settings/emails.

```bash
rm -rf churchconnect-mt-rewrite
git clone https://github.com/blarkerdre/churchconnect-mt.git churchconnect-mt-rewrite
cd churchconnect-mt-rewrite

git filter-repo --force --commit-callback '
commit.author_name = b"Adeniyi Olusegun Kugbiyi"
commit.author_email = b"YOUR_GITHUB_EMAIL"
commit.committer_name = b"Adeniyi Olusegun Kugbiyi"
commit.committer_email = b"YOUR_GITHUB_EMAIL"
'

echo "Authors:"
git log --format='%an <%ae>' | sort -u
echo "Committers:"
git log --format='%cn <%ce>' | sort -u

git remote add origin https://github.com/blarkerdre/churchconnect-mt.git
git push --force --all origin
git push --force --tags origin
```

Before the rewrite, install `git-filter-repo` if the command is unavailable:

```bash
brew install git-filter-repo
# or
python3 -m pip install git-filter-repo
```

## What you should see on GitHub

- The two verification commands must each print exactly one line: `Adeniyi Olusegun Kugbiyi <your verified email>`.
- The commit list should show **Adeniyi Olusegun Kugbiyi** only, not “lovable-dev[bot] and blarkerdre committed”.
- The contributor sidebar may remain cached temporarily after the commit list is correct. Refresh it later; the commit list is the immediate source of truth.

## After the rewrite

- Send me a screenshot of the commit list immediately after the force-push.
- I will verify it and recapture the repository screenshots for the OC1 evidence pack.
- Do not make another Lovable edit before capture. Any future synced commit will use the bot identity again; this is how Lovable Git sync records its generated commits.

## Notes

- This is a force-push; since you are the only contributor, no other collaborator clone needs updating.
- No application code changes are made.
