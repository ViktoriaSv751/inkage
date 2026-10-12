# InkAge – See your tattoo in 50 years

Web app (Next.js 14). The user uploads a photo of themselves and a tattoo design (a Pinterest screenshot works), picks the placement and size, and gets 5 images: **fresh, healed (1 yr), 10, 30, 50 years**. One tap turns them into a 9:16 time-lapse video for TikTok.

- **Demo mode** (no keys set): works immediately, previews are a quick local simulation.
- **Live mode**: OpenAI image editing, email-code sign-in (Supabase), Stripe payments.
- **Business model**: 1 free "fresh" preview per account; aging and the video are paid (weekly subscription or lifetime one-time payment). Limits: weekly 20 previews / 7 days, lifetime 40 / 30 days. Photos are never stored on the server.

---

## Going live (~20 minutes)

### 1. Supabase (database + sign-in)
1. https://supabase.com/dashboard → **New project** → name: `InkAge`, region: Frankfurt (eu-central-1).
2. **SQL Editor** → paste and run the full contents of `supabase/schema.sql`.
3. **Project Settings → API**: copy the `Project URL`, the `anon` key and the `service_role` key.
4. **Authentication → Email Templates → Magic Link**: add `Your code: {{ .Token }}` to the email (so users can sign in from inside TikTok's in-app browser too).
5. **Authentication → URL Configuration**: Site URL = your Vercel address (e.g. `https://inkage.vercel.app`).
6. Recommended for launch: **Authentication → SMTP** – set up your own email sender (e.g. Resend), because Supabase's built-in sender only allows a few emails per hour.

### 2. OpenAI (image generation)
1. https://platform.openai.com → API keys → create a new key.
2. Settings → Billing: top up some credit and set a monthly limit.
3. The `gpt-image-1` model may require organization verification (Settings → Organization → Verify).
4. Cost: a full preview set is 5 images; at medium quality that is roughly $0.20–0.35 per user.

### 3. Stripe (payments)
1. https://dashboard.stripe.com → **Product catalog** → new product "InkAge Pro":
   - Price 1: $5.99, **recurring, weekly** → copy its `price_…` ID (WEEKLY)
   - Price 2: $49.99, **one-time** → copy its `price_…` ID (LIFETIME)
2. Developers → API keys → `Secret key` (sk_live_… or sk_test_… for testing).
3. Settings → Billing → **Customer portal**: enable it (this lets subscribers cancel).
4. The webhook comes after step 4 (it needs the live URL).

### 4. Vercel (hosting)
1. Upload this folder to a new GitHub repo (or `npx vercel` from inside the folder).
2. https://vercel.com/new → import the repo → Framework: Next.js.
3. Environment variables (see `.env.example`):

| Key | Value |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | anon key |
| SUPABASE_SERVICE_ROLE_KEY | service_role key (secret!) |
| OPENAI_API_KEY | sk-… |
| OPENAI_IMAGE_MODEL | gpt-image-1 |
| APP_SECRET | any long random string |
| STRIPE_SECRET_KEY | sk_… |
| STRIPE_PRICE_WEEKLY | price_… |
| STRIPE_PRICE_LIFETIME | price_… |
| STRIPE_WEBHOOK_SECRET | (step 5) |
| NEXT_PUBLIC_PRICE_WEEKLY_LABEL | $5.99 / week |
| NEXT_PUBLIC_PRICE_LIFETIME_LABEL | $49.99 once |

4. Deploy.

### 5. Stripe webhook
1. Stripe → Developers → Webhooks → **Add endpoint**: `https://YOUR-DOMAIN/api/stripe-webhook`
2. Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `charge.refunded`
3. Copy the `whsec_…` signing secret → Vercel env `STRIPE_WEBHOOK_SECRET` → **Redeploy**.

### 6. Test before you post on TikTok
- Sign in with your own email → 1 free preview → the aging stages are blurred and locked.
- Pay with Stripe test mode (card `4242 4242 4242 4242`) → the 4 aging stages generate → make the video.
- If everything works, switch Stripe keys and prices to live.

## Local run
```
npm install
cp .env.example .env.local   # fill in, or leave empty for demo mode
npm run dev
```


