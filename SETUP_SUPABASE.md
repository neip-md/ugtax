# UGtax — Supabase auth + profiles setup

Login/signup and profile persistence are built in but **dormant until you point
the app at a Supabase project**. Without the two env vars below, UGtax runs
exactly as before: fully client-side, no accounts, and the auth UI hides itself.

Everything below is a one-time, ~5-minute setup on your **neip** Supabase.

---

## 1. Create the project

1. In your neip Supabase account, **New project** (Free/Hobby tier is fine).
   Pick an EU region (e.g. `eu-central-1`) to match where the app is used.
2. Wait for it to provision.

## 2. Apply the schema

Open **SQL Editor** → paste the contents of
[`supabase/migrations/0001_auth_profiles_filings.sql`](supabase/migrations/0001_auth_profiles_filings.sql)
→ **Run**.

This creates `profiles` and `filings`, enables row-level security (each user
only ever sees their own rows), and adds a trigger that auto-creates a profile
row on signup.

> Using the Supabase CLI instead? `supabase link --project-ref <ref>` then
> `supabase db push`.

## 3. Turn on email confirmation

**Authentication → Providers → Email**: make sure **Confirm email** is ON
(default). This is what sends the signup confirmation email.

**Authentication → URL Configuration**:
- **Site URL:** `https://ugtax.de`
- **Redirect URLs:** add `https://ugtax.de/auth/confirm` and, for local dev,
  `http://localhost:3000/auth/confirm`.

**(Recommended) Server-side confirmation link.** In
**Authentication → Email Templates → Confirm signup**, set the link to:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

The `/auth/confirm` route already handles both this `token_hash` flow and the
default `?code=` PKCE link, so it works either way — but the template above is
the most reliable for server-side sessions.

> **Email sending:** UGtax uses Supabase's built-in mailer (no custom SMTP).
> Fine for the low signup volume here. It is rate-limited, so if signups ever
> scale, revisit custom SMTP under **Authentication → Emails → SMTP** - no code
> change needed either way.

## 4. Wire the env vars

From **Project Settings → API**, copy the **Project URL** and the **anon /
publishable** key.

**Local:** create `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

**Vercel:** Project → Settings → Environment Variables → add the same two for
Production (and Preview), then redeploy.

## 5. Verify

```
npm run dev
```

1. Header shows **Log in** (top right).
2. `/signup` → create an account → "check your email" screen.
3. Click the emailed link → lands on **/profile**.
4. Fill company data → **Save to my profile** → reload → values persist.
5. Run a filing → **/results** → **Save filing** → it appears under
   **Saved filings** on `/profile`.
6. Sign out, sign back in on another browser → your data is there.

---

## What was added (for reference)

| Area | Files |
|---|---|
| Supabase clients | `lib/supabase/{client,server,middleware}.ts`, `lib/supabase/use-user.ts` |
| Session refresh | `middleware.ts` (composed with next-intl) |
| Email confirm | `app/auth/confirm/route.ts` |
| Auth pages | `app/[locale]/{login,signup,profile}/page.tsx` |
| Persistence types | `lib/profile.ts` |
| Schema | `supabase/migrations/0001_auth_profiles_filings.sql` |
| UI wiring | `app/[locale]/header.tsx`, `app/[locale]/results/page.tsx`, `messages/{de,en}.json` |

Data model: **1 `profiles` row per user** (company config) + **N `filings`**
(saved year/results snapshots), all RLS-isolated to the owner.
