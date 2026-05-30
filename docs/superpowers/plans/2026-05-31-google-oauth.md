# Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth sign-in alongside existing email/password auth, merging accounts by email.

**Architecture:** JWT callback upsert in `lib/auth.ts` — when `account?.provider === "google"`, find-or-create a MongoDB User by email and store its `_id` in the token. No adapter, no new dependencies. Login page gets a Google button above the credentials form.

**Tech Stack:** NextAuth v5 beta.31, `next-auth/providers/google`, Mongoose, bcryptjs (unchanged)

---

### Task 1: Configure environment and Google Cloud Console

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add Google OAuth credentials to `.env.local`**

Append to the end of `.env.local`:

```
AUTH_GOOGLE_ID=<your-google-client-id>
AUTH_GOOGLE_SECRET=<your-google-client-secret>
```

> **Security note:** Rotate the client secret before using in production — it was exposed in chat history.

- [ ] **Step 2: Add authorized redirect URI in Google Cloud Console**

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Click your OAuth 2.0 client
3. Under "Authorized redirect URIs" add: `http://localhost:3000/api/auth/callback/google`
4. Save

---

### Task 2: Add Google provider and upsert logic to auth config

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace `lib/auth.ts` with updated version**

```ts
import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import User from "./models/User";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google(),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
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
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (0 output).

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add Google OAuth provider with email-based account merge"
```

---

### Task 3: Add Google sign-in button to login page

**Files:**
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace `app/(auth)/login/page.tsx` with updated version**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your FamilyRoots account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className="underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat: add Google sign-in button to login page"
```

---

### Task 4: Smoke test all auth flows

**Prerequisites:** `npm run dev` running, Google redirect URI added in Cloud Console (Task 1 Step 2).

- [ ] **Flow 1: New user via Google**

1. Open `http://localhost:3000/login` in a private/incognito window
2. Click "Continue with Google"
3. Complete Google sign-in with an account that has NO existing FamilyRoots account
4. Expected: redirected to `/dashboard`
5. In MongoDB Atlas, verify a new User document was created with `email`, `name`, `image` and no `password` field

- [ ] **Flow 2: Returning Google user**

1. Sign out, open private window, sign in with same Google account again
2. Expected: redirected to `/dashboard`, no duplicate User created in MongoDB

- [ ] **Flow 3: Existing credentials account merged with Google**

1. Sign out, sign in with email/password credentials (existing account)
2. Note the user's `_id` from session (or MongoDB)
3. Sign out, click "Continue with Google" using the Google account with the same email
4. Expected: redirected to `/dashboard`, `session.user.id` matches the same `_id` as the credentials user — no new User created

- [ ] **Flow 4: Google-only user tries credentials**

1. Sign out, attempt to sign in with email/password using the Google-only account's email + any password
2. Expected: "Invalid email or password" error shown, no redirect

- [ ] **Flow 5: Cancelled Google OAuth**

1. Click "Continue with Google", then cancel/dismiss the Google consent screen
2. Expected: redirected back to `/login` (NextAuth handles this via `pages.signIn`)
