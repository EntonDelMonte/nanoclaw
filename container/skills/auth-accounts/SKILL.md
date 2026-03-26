---
name: auth-accounts
description: Authentication implementation for Next.js/Node.js apps — NextAuth v5, Lucia Auth, and Supabase Auth. Covers sessions, JWT, magic links, OAuth, password reset, email verification, user profiles, and CSRF protection.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Auth & Accounts

Production-grade auth for Next.js/Node apps. Pick one provider and follow the pattern.

---

## Provider Decision Matrix

| Scenario | Use |
|----------|-----|
| Next.js + own DB (Postgres/SQLite) | Lucia Auth (full control, minimal magic) |
| Next.js + Supabase | Supabase Auth (built-in, free tier generous) |
| Next.js + any OAuth-heavy app | NextAuth v5 / Auth.js |
| Node.js non-Next app | Lucia Auth or custom with jose |

---

## Option A — Supabase Auth (Simplest)

```bash
npm i @supabase/supabase-js @supabase/ssr
```

```ts
// lib/supabase/server.ts — server client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

```ts
// app/actions/auth.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm` }
  })
  if (error) return { error: error.message }
  redirect('/check-email')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

Magic link (passwordless):
```ts
await supabase.auth.signInWithOtp({
  email: 'user@example.com',
  options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm` }
})
```

---

## Option B — Lucia Auth (Full Control)

```bash
npm i lucia @lucia-auth/adapter-drizzle  # or @lucia-auth/adapter-prisma
```

```ts
// lib/auth.ts
import { Lucia } from 'lucia'
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle'
import { db, sessions, users } from './db'

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users)

export const lucia = new Lucia(adapter, {
  sessionCookie: { attributes: { secure: process.env.NODE_ENV === 'production' } },
  getUserAttributes: (attrs) => ({ email: attrs.email, name: attrs.name })
})

export type Auth = typeof lucia
```

```ts
// lib/session.ts — validate session on every server request
import { lucia } from './auth'
import { cookies } from 'next/headers'
import { cache } from 'react'

export const validateRequest = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null
  if (!sessionId) return { user: null, session: null }
  const result = await lucia.validateSession(sessionId)
  // Refresh expiring sessions
  if (result.session?.fresh) {
    const cookie = lucia.createSessionCookie(result.session.id)
    cookies().set(cookie.name, cookie.value, cookie.attributes)
  }
  return result
})
```

---

## OAuth Setup (NextAuth v5 / Auth.js)

```bash
npm i next-auth@beta
```

```ts
// auth.ts (project root)
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({ clientId: process.env.AUTH_GITHUB_ID!, clientSecret: process.env.AUTH_GITHUB_SECRET! }),
    Google({ clientId: process.env.AUTH_GOOGLE_ID!, clientSecret: process.env.AUTH_GOOGLE_SECRET! }),
  ],
  callbacks: {
    session: ({ session, token }) => ({ ...session, user: { ...session.user, id: token.sub! } }),
  },
})

// app/api/auth/[...nextauth]/route.ts
export { handlers as GET, handlers as POST } from '@/auth'
```

Required `.env`:
```
AUTH_SECRET=<openssl rand -hex 32>
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

---

## Password Reset Flow

```
1. User submits email on /forgot-password
2. Generate secure token: crypto.randomBytes(32).toString('hex')
3. Hash token with SHA-256, store hash + expiry (1h) in DB
4. Send email with link: /reset-password?token=<raw token>
5. On /reset-password: hash submitted token, compare to DB, check expiry
6. If valid: update password (bcrypt hash), delete reset record, sign user in
7. Invalidate all existing sessions for that user
```

```ts
import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcrypt'

// Generate
const rawToken = randomBytes(32).toString('hex')
const hashedToken = createHash('sha256').update(rawToken).digest('hex')
// Store hashedToken + expires (Date.now() + 3600000) in DB

// Verify
const submittedHash = createHash('sha256').update(rawToken).digest('hex')
const record = await db.query.resetTokens.findFirst({ where: eq(resetTokens.token, submittedHash) })
if (!record || record.expires < Date.now()) throw new Error('Invalid or expired token')
```

---

## Session Management

### Cookie sessions (recommended for SSR)
- HttpOnly + Secure + SameSite=Lax
- Rotate session ID on privilege escalation (login, password change)
- Short absolute expiry (7 days) + sliding window (extend on activity)

### JWT considerations
- Use only for stateless APIs or microservices
- Short expiry (15min access token) + longer refresh token (7 days in HttpOnly cookie)
- Never store JWTs in localStorage (XSS risk)
- Store refresh token in DB to enable revocation

### CSRF Protection
- SameSite=Lax covers most CSRF for same-site apps
- For APIs accepting cross-origin POST: use CSRF token (double-submit cookie or synchronizer pattern)
- Next.js Server Actions are CSRF-safe by default (origin header check)

---

## User Profile Management

### Settings page structure
```
/settings
  /settings/profile    — name, bio, avatar
  /settings/account    — email change, password change
  /settings/billing    — subscription, invoices (link to Stripe portal)
  /settings/danger     — delete account
```

### Avatar upload pattern
```ts
// Use Supabase Storage or Cloudflare R2
const { data } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.webp`, file, { upsert: true, contentType: 'image/webp' })
const publicUrl = supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl
await db.update(users).set({ avatarUrl: publicUrl }).where(eq(users.id, userId))
```

### Email change flow (requires re-verification)
```
1. User submits new email
2. Send confirmation to NEW email with signed token
3. On confirm: update email in DB + auth provider
4. Notify OLD email that email was changed (security alert)
```

---

## Protecting Routes (Next.js middleware)

```ts
// middleware.ts
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session
  const isProtected = nextUrl.pathname.startsWith('/dashboard')

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${nextUrl.pathname}`, req.url))
  }
})

export const config = { matcher: ['/dashboard/:path*', '/settings/:path*'] }
```

---

## Required ENV Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never expose to client

# Auth.js / NextAuth
AUTH_SECRET=                  # openssl rand -hex 32

# Email (for password reset, verification)
RESEND_API_KEY=               # or SENDGRID_API_KEY / SMTP_*

# App
NEXT_PUBLIC_APP_URL=https://example.com
```
