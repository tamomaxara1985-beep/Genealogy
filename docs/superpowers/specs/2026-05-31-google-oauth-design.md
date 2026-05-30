# Google OAuth Design

**Date:** 2026-05-31
**Scope:** Add Google OAuth alongside existing NextAuth v5 Credentials provider

## Goal

Users can sign in with Google. Existing email/password accounts merge silently on first Google sign-in. `session.user.id` remains a consistent MongoDB `_id` across both auth methods.

## Approach

JWT callback upsert — no database adapter, no new dependencies. Extends the existing `jwt` callback pattern in `lib/auth.ts`.

## Auth Flows

| Scenario | Outcome |
|---|---|
| Google sign-in, no existing account | Create User (name, email, image, no password) → `token.id = _id` |
| Google sign-in, email matches existing account | Find by email → `token.id = existing _id` |
| Credentials user later signs in with Google | Same email lookup → returns same `_id`, transparent merge |
| Google-only user tries Credentials | `authorize` sees `password === undefined` → returns null → login error |

## Files Changed

### `lib/auth.ts`

1. Import `Google` from `"next-auth/providers/google"` and add to `providers` array before `Credentials`.
2. Extend `jwt` callback:
   - If `account?.provider === "google"`: upsert user by email, set `token.id` to MongoDB `_id`.
   - Else if `user` present (Credentials path): existing `token.id = user.id` logic unchanged.
   - `account` is only present on first sign-in — no DB hit on token refresh.

```ts
async jwt({ token, user, account }) {
  if (account?.provider === "google") {
    await connectDB();
    let dbUser = await User.findOne({ email: token.email });
    if (!dbUser) {
      dbUser = await User.create({
        name: token.name,
        email: token.email,
        image: token.picture,
      });
    }
    token.id = dbUser._id.toString();
  } else if (user) {
    token.id = user.id;
  }
  return token;
},
```

### `app/(auth)/login/page.tsx`

Add above the credentials form:
- "Continue with Google" outline button → `signIn("google", { callbackUrl: "/dashboard" })`
- Visual divider (`Separator` + "or" label) between Google button and form

No changes to `CardHeader`, form logic, or error handling.

### `.env.local`

```
AUTH_GOOGLE_ID=<client-id>
AUTH_GOOGLE_SECRET=<client-secret>
```

NextAuth v5 reads these env var names automatically when using `Google()` provider.

## Files Not Changed

- `lib/models/User.ts` — `password` already optional; model supports OAuth users as-is
- `app/api/auth/[...nextauth]/route.ts` — no change needed
- `app/api/auth/register/route.ts` — no change needed
- `types/index.ts` — no change needed

## Google Cloud Console Setup

Before testing, add authorized redirect URI:
- Dev: `http://localhost:3000/api/auth/callback/google`
- Prod: `https://<domain>/api/auth/callback/google`

## Error Handling

- Google OAuth failure (user cancels, etc.): NextAuth redirects to `/login?error=...` — already handled by custom `pages.signIn`.
- Duplicate email on `User.create`: guarded by `findOne` check before create. MongoDB unique index on email is a final safety net.
- Google-only user attempts Credentials login: `authorize` returns `null` → existing "Invalid email or password" message shown — acceptable UX.
