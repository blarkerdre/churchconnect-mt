

## Create Downloadable DOCX: User Signup and Sign-In Process

### What will be created
A professionally formatted Word document (.docx) documenting the complete user signup, sign-in, and password reset process for the ChurchConnect platform. The document will cover:

1. **Sign Up Process** — step-by-step guide for creating an account (full name, email, password, email verification, 60-second cooldown)
2. **Sign In Process** — how to log in with credentials, password visibility toggle
3. **Forgot Password / Reset** — requesting a reset link and setting a new password
4. **Church Registration (Onboarding)** — the 4-step wizard for registering a new church (Church Info, Admin Account, Features, Review & Launch)
5. **Tenant-Specific Access** — using tenant-branded URLs (`/t/{slug}/auth`)

### Technical approach
- Use the `docx` npm library via a script in `/tmp/`
- Generate the document to `/mnt/documents/user-signup-signin-guide.docx`
- Include branded styling (navy headings, clear sections, numbered steps)
- QA by converting to images and inspecting

### Output
- `/mnt/documents/user-signup-signin-guide.docx`

