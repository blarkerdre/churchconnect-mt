

## Problem
Anonymous users accessing `/register` are being redirected to the login page. The route definition is correct (it's outside `ProtectedRoute`), so the issue is likely one of two things:

1. **The `AuthProvider` wraps all routes** including `/register`. While it doesn't redirect, the `loading: true` initial state combined with slow session resolution could cause a flash, but shouldn't redirect.

2. **More likely**: The Supabase client automatically detects no session and the `onAuthStateChange` fires, but this alone shouldn't redirect since `PublicRegistration` doesn't use `useAuth()`.

After closer inspection, the routing is actually fine in the code. The `/register` route renders `PublicRegistration` directly without any auth wrapper. 

**The most probable cause**: The user might be hitting a cached version or the preview URL path isn't `/register`. But to be safe, I'll ensure the route is bulletproof by moving it completely outside the `AuthProvider` wrapper so there's zero dependency on auth state.

## Plan

### 1. Move `/register` route outside `AuthProvider` in `src/App.jsx`
- Restructure so `/register` is rendered before the `AuthProvider`-wrapped routes
- This guarantees zero auth interference for anonymous QR form users

```text
Router
├── /register → PublicRegistration (NO AuthProvider)
└── AuthProvider
    ├── /auth
    ├── /reset-password
    └── /* (ProtectedRoute → Layout → app routes)
```

### Technical Change — `src/App.jsx`
- Create a top-level `Routes` that renders `/register` directly
- Wrap remaining routes in `AuthProvider` as before
- `PublicRegistration` already doesn't import or use `useAuth`, so no other changes needed

