

## Problem: Duplicate Auth State Causes Redirect Loop

**Root cause**: `useCurrentUser()` creates independent auth state (its own `useState` + `onAuthStateChange` listener) every time it's called. Both `RoleProvider` and `ProtectedRoute` call it separately, creating two independent auth subscriptions. There's a race condition where `ProtectedRoute`'s instance may momentarily have `user=null` + `loading=false` before the session restores, triggering `<Navigate to="/" />`.

## Plan

### 1. Create a shared AuthProvider context
Create `src/components/AuthProvider.tsx` that wraps the entire app and provides a single source of truth for `{ user, loading }` via React context. This replaces the standalone `useCurrentUser()` hook pattern.

- Move the `getSession()` + `onAuthStateChange` logic into this single provider
- Set up the listener BEFORE calling `getSession()` (per Supabase best practices)
- Export a `useAuth()` hook that reads from this context

### 2. Update RoleProvider
- Replace its internal `useCurrentUser()` call with the new shared `useAuth()` context hook
- No other logic changes needed

### 3. Update ProtectedRoute
- Replace its internal `useCurrentUser()` call with the same shared `useAuth()` hook
- This ensures it reads the exact same user/loading state as RoleProvider — no race condition

### 4. Wrap App with AuthProvider
- In `App.tsx`, wrap everything inside `<AuthProvider>` so all components share one auth state

### 5. Update other consumers of `useCurrentUser()`
- `useCurrentProfile()` and `useUserRoles()` in `useAuth.ts` also call `useCurrentUser()` — update them to use the shared context hook instead

### Technical Details

The key change is going from N independent subscriptions to 1 shared subscription:

```text
BEFORE:
  RoleProvider → useCurrentUser() → own useState + onAuthStateChange
  ProtectedRoute → useCurrentUser() → own useState + onAuthStateChange
  (race condition: ProtectedRoute may see null user first → redirect)

AFTER:
  AuthProvider (single subscription) → context
  RoleProvider → useAuth() → reads context
  ProtectedRoute → useAuth() → reads same context
  (no race: both see the same state simultaneously)
```

**Files to create**: `src/components/AuthProvider.tsx`
**Files to edit**: `src/hooks/useAuth.ts`, `src/components/RoleProvider.tsx`, `src/components/ProtectedRoute.tsx`, `src/App.tsx`

