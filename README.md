# InkAge – See your tattoo in 50 years

Web app (Next.js 14, Supabase, Vercel). Upload a photo of the spot and any design, and see it fresh, healed and at 10, 30 and 50 years on your own skin. Also: existing-tattoo aging, laser removal preview (3, 6, 10 sessions), longevity score, vote links, video, artist PDF.

- **Free beta**: every feature is free; a daily allowance (30 previews per account, more with invite bonuses) keeps AI costs in check. No payments in the app.
- **Languages**: Hungarian (default) and English. **Themes**: light and dark (switch top right).

## Setup

### 1. Supabase
1. New project (eu-central-1). **SQL Editor** → run `supabase/schema.sql` (exported from the live project: tables, RLS policies, storage buckets and all functions).
2. Fill `private.config`: `webhook_secret` (the value the server derives in `lib/server.ts` → `appSecret('db')`) and `admin_emails`.
3. **Authentication**: enable e-mail + password; optionally Google and Apple (the sign-in page shows them either way and explains when they are off).
4. **URL Configuration**: Site URL = your domain; add `https://YOUR-DOMAIN/uj-jelszo` and `https://YOUR-DOMAIN/app/profile` to Redirect URLs.
5. Recommended: **Authentication → SMTP** with your own sender (e.g. Resend).

### 2. AI
`GEMINI_API_KEY` (or `OPENAI_API_KEY`) for image editing. `/api/health` checks the models daily (Vercel cron).

### 3. E-mail (Resend)
| Key | What for |
|---|---|
| RESEND_API_KEY | all app e-mails |
| MAIL_FROM | e.g. `InkAge <hello@your-domain>` – must be a verified domain in Resend |
| CONTACT_EMAIL | where contact-form and in-app feedback are forwarded |
| ALERT_EMAIL | health alerts |
| SITE_URL | links in e-mails (default `https://inkage.vercel.app`) |
| ADMIN_EMAILS | comma-separated; can notify the waitlist from `/admin` |

What gets sent: newsletter double opt-in (`/api/newsletter`, unsubscribe via `?unsub=token`), welcome mail on first sign-in, "someone voted" (max once an hour per link, can be turned off in Settings), contact/feedback forwarding, waitlist "we're back".

### 4. Vercel
Import the repo (Framework: Next.js). `npm run build` first pre-renders every site photo into `public/img` (`scripts/prebuild-images.mjs`), so pages load them as static files.

## Local run
```
npm install
npm run dev
```
