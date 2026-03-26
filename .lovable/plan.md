

## Fix: Tenant Auth Route Missing AuthProvider

### Problem

In `App.jsx` line 183, the tenant auth route is defined as a public route:
```jsx
<Route path="/t/:tenantSlug/auth" element={<Auth />} />
```

But `Auth` calls `useAuth()` which requires `AuthProvider`. Without it, `loading` defaults to `true` and the component shows a blank loading state forever.

### Solution

Wrap the tenant auth route element with `<AuthProvider>`:
```jsx
<Route path="/t/:tenantSlug/auth" element={<AuthProvider><Auth /></AuthProvider>} />
```

Also wrap the root `/auth` route inside `AuthRoutes` the same way (it's already inside `AuthProvider` via line 188, so that one works -- but the tenant-prefixed one is the problem).

### Files Changed

- **`src/App.jsx`** -- wrap `/t/:tenantSlug/auth` route with `<AuthProvider>`

