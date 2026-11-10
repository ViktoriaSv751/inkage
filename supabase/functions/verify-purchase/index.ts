// InkAge: checks an App Store or Google Play purchase with Apple / Google, then adds the package's previews to the buyer's
// account (public.pay_grant_store, service role only). Called by the iOS / Android app right after a purchase
// (lib/store-billing.ts). Ported 2026-11-10 from Calligra's verify-purchase, which passed App Review.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT   JSON key of a service account invited in Play Console (View financial data), for Android
// APPLE_APP_ID is optional (InkAge's public App Store id is the default). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignedDataVerifier, Environment } from "npm:@apple/app-store-server-library@3.1.0";
import { Buffer } from "node:buffer";

const BUNDLE_ID = "app.inkage"; /* the same id on iOS and Android */
const PRODUCTS: Record<string, string> = { "app.inkage.mini": "mini", "app.inkage.plus": "plus", "app.inkage.studio": "studio" };
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

let roots: Buffer[] | null = null;
async function appleRoots() {
  if (roots) return roots;
  const urls = ["https://www.apple.com/certificateauthority/AppleRootCA-G3.cer", "https://www.apple.com/appleca/AppleIncRootCertificate.cer"];
  roots = await Promise.all(urls.map(async (u) => Buffer.from(await (await fetch(u)).arrayBuffer())));
  return roots;
}

async function verifyApple(jws: string, uid: string) {
  const appId = Number(Deno.env.get("APPLE_APP_ID") || 6824442476); /* InkAge on the App Store (public id) */
  const rc = await appleRoots();
  /* App Review and TestFlight buy in the sandbox, customers in production: a valid signature from either is accepted */
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const v = new SignedDataVerifier(rc, true, env, BUNDLE_ID, appId);
      const t = await v.verifyAndDecodeTransaction(jws);
      if (t.bundleId !== BUNDLE_ID) throw new Error("bundle");
      if (t.appAccountToken && t.appAccountToken.toLowerCase() !== uid.toLowerCase()) throw new Error("account");
      if (t.revocationDate) throw new Error("revoked");
      return { tx: String(t.transactionId), product: String(t.productId), amount: t.price ? t.price / 1000 : undefined, currency: t.currency, country: t.storefront, sandbox: env === Environment.SANDBOX };
    } catch (e) {
      const m = (e as Error).message;
      if (m === "account" || m === "revoked") throw e;
    }
  }
  throw new Error("apple_invalid");
}

async function googleToken() {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT") || "{}");
  if (!sa.client_email || !sa.private_key) throw new Error("google_not_configured");
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" }), body = b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`)));
  const jwt = `${head}.${body}.${btoa(String.fromCharCode(...sig)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("google_auth");
  return j.access_token as string;
}
async function verifyGoogle(productId: string, token: string) {
  const at = await googleToken();
  const u = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${BUNDLE_ID}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
  const r = await fetch(u, { headers: { authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error("google_invalid");
  const p = await r.json();
  if (p.purchaseState !== 0) throw new Error("google_not_purchased");
  return { tx: String(p.orderId || token), product: productId, country: p.regionCode as string | undefined, sandbox: p.purchaseType === 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("authorization") || "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ ok: false, error: "unauthorized" }, 401);

    const b = await req.json();
    let r: { tx: string; product: string; amount?: number; currency?: string; country?: string; sandbox?: boolean };
    if (b.store === "apple" && b.jws) r = await verifyApple(String(b.jws), user.id);
    else if (b.store === "google" && b.purchaseToken && b.productId) r = await verifyGoogle(String(b.productId), String(b.purchaseToken));
    else return json({ ok: false, error: "bad_request" }, 400);

    const plan = PRODUCTS[r.product];
    if (!plan) return json({ ok: false, error: "unknown_product" }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("pay_grant_store", {
      p_user: user.id, p_store: b.store, p_tx: r.tx, p_plan: plan, /* a sandbox (App Review, TestFlight, Play test) purchase adds previews but no money to the revenue pages */
      p_amount: r.sandbox ? null : r.amount ?? null, p_currency: r.sandbox ? null : r.currency ?? null,
      p_meta: { country: r.country, lang: b.lang, device: b.store === "apple" ? "iPhone app" : "Android app", note: r.sandbox ? "sandbox" : undefined },
    });
    if (error) return json({ ok: false, error: "grant_failed" }, 500);
    return json({ ok: true, plan, duplicate: !!data?.duplicate, credits: data?.credits });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 80) }, 400);
  }
});
