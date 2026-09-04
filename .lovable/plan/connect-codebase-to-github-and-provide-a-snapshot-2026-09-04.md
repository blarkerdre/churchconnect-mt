# Connect codebase to GitHub and provide a snapshot

## Current state
- The workspace git remote points to Lovable private storage, not GitHub.
- No local `.git/config` exists in the project root.
- Two-way GitHub sync is available but not yet enabled for this project.

## Plan
1. Surface the GitHub connect action in the Lovable editor so the project can be linked to a GitHub repository.
2. After linking, Lovable will push the current codebase to the new repo automatically.
3. Provide the user with the resulting GitHub repository URL and instructions to clone or download a ZIP.
4. As a fallback, generate a local ZIP archive of the current codebase immediately so the user has a snapshot while GitHub sync is being set up.

## Outcome
- A public or private GitHub repository containing the full codebase.
- An optional downloadable ZIP snapshot available right away.
