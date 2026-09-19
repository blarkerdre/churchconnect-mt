# Remove all Lovable traces from GitHub

## Goal
Make both GitHub repositories show only **Adeniyi Olusegun Kugbiyi** as author, committer, contributor, and builder, while removing Lovable/GPT Engineer references from every branch, tag, filename, file revision, commit message, and repository-facing description.

The cleanup will be performed from a fresh local clone, not through the Lovable editor, so the cleanup itself does not create another bot-authored commit.

## Confirmed repository traces
The current repository contains more than attribution metadata:

- commit author/committer records that produce `lovable-dev[bot] and blarkerdre committed`;
- tracked `.lovable/` planning files and `public/lovable-uploads/` asset paths;
- Lovable and GPT Engineer text in source, comments, preview-host checks, social-image URLs, and trust-page copy;
- runtime dependencies on Lovable-managed email and connector services;
- a Base44-branded README and `base44-app` package name;
- a second repository, `church-connect`, contributing one additional historical commit on the GitHub profile.

Because some brand strings currently identify live services, blindly replacing text would break email, SMS/voice, preview authentication, and fallback links. Those dependencies must be removed or replaced before the history scrub.

## Plan

1. **Freeze editor-based Git sync**
   - Make no more project edits through Lovable after the local migration starts.
   - Work from GitHub/local development going forward, as selected.
   - Create a private mirror backup before rewriting either repository.

2. **Create a brand-neutral current codebase locally**
   - Replace the Base44 README with Church Management Suite documentation and rename the package.
   - Remove the tracked `.lovable/` directory from the public repository.
   - Rename `public/lovable-uploads/` to a ChurchConnect-owned asset path and update all references.
   - Replace externally hosted social images with ChurchConnect-owned assets and use the custom domain for application links.
   - Rewrite user-facing trust text and internal comments without platform branding.
   - Remove editor-preview-only authentication and hostname handling from the local/GitHub edition.

3. **Replace runtime-specific Lovable dependencies before deleting their identifiers**
   - Replace managed email imports and branded environment-variable names with a directly controlled email provider.
   - Replace connector-gateway SMS/voice calls with direct provider calls under ChurchConnect-owned credentials.
   - Keep the current database/auth/storage endpoint, which is already exposed as a neutral backend URL, while removing editor-only adapters.
   - Verify sign-in, email, SMS/voice, social metadata, push subscription, and the trust page after replacements.
   - This step needs the replacement email and communications-provider credentials before literal zero-reference cleanup can be completed without disabling those features.

4. **Rewrite every Git object, not only the latest branch**
   - Use `git filter-repo` on fresh mirror clones of `churchconnect-mt` and `church-connect`.
   - Set the author and committer of every commit to:
     - `Adeniyi Olusegun Kugbiyi`
     - the verified GitHub email supplied locally
   - Sanitize commit messages, paths, text blobs, tags, and refs containing `lovable`, `lovable-dev`, `gpt-engineer`, `gptengineer`, or Base44 branding.
   - Preserve commit dates and commit count where possible; hashes will necessarily change.
   - Remove obsolete remote branches and tags so hidden refs cannot keep the old history reachable.

5. **Force-push and clean repository presentation**
   - Push rewritten branches and tags to both repositories.
   - Set repository descriptions, topics, homepage links, release notes, and GitHub Pages/custom-domain settings to ChurchConnect-owned wording and URLs.
   - Remove any bot/integration access from repository settings after sync is no longer needed.

6. **Verify before evidence capture**
   - Local checks must return no matches across all refs for the prohibited names.
   - Author and committer checks must each return exactly one identity: Adeniyi Olusegun Kugbiyi with the verified email.
   - GitHub commit pages must show one person, Contributors must show one contributor, and the “Built by” row must show one avatar.
   - Check both repositories and allow GitHub’s contributor cache time to refresh; cached UI results are not accepted until commit-object checks are clean.
   - Capture fresh GitHub screenshots only after these checks pass.

## Deliverable
Provide one local cleanup script plus a short runbook. The script will stop before destructive pushes unless all identity and zero-reference checks pass, and it will require explicit confirmation for each repository.

## Important consequence
This is a destructive history rewrite: all commit hashes change, existing clones and open pull requests become obsolete, and collaborators must clone again. Literal removal of every repository reference cannot preserve Lovable-managed email/connector code; replacement provider credentials are therefore a prerequisite for a fully functioning, zero-reference repository.
