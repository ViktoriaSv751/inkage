import { NextResponse } from "next/server";
import { asAdmin, callAdmin } from "@/lib/admin/server";
import { payRun, stripe, stripeKey, syncStripe } from "@/lib/admin/pay";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type D = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** The Bevétel pages' actions that need Stripe (everything else is a database function the page calls itself):
    refund a web purchase (Stripe returns the money; its charge.refunded notice then marks the purchase; InkAge has no
    invoicing), make or switch off a partner code, and read Stripe now. Each one goes into the Napló. InkAge takes no
    payments yet: without STRIPE_SECRET_KEY every Stripe action answers plainly that the key is missing. */
export async function POST(req: Request) {
  return asAdmin(async () => {
    const b = (await req.json().catch(() => ({}))) as D;
    try {
      if (b.action === "sync") return NextResponse.json({ ok: true, result: await payRun() });
      if (!stripeKey()) return bad("Nincs Stripe-kulcs (STRIPE_SECRET_KEY a Vercelben).", 501);
      if (b.action === "refund") {
        const p = await callAdmin<D | null>("admin_pay_get", { p_id: Number(b.id) });
        if (!p || p.store !== "stripe") return bad("Csak weboldalas (Stripe) fizetés téríthető vissza innen. Az App Store és a Google Play maga intézi.");
        if (p.refunded_at) return bad("Ez már vissza van térítve.");
        const s = await stripe<D>(`checkout/sessions/${encodeURIComponent(p.transaction_id)}`);
        if (!s.payment_intent) return bad("Ehhez a fizetéshez nincs terhelés (például 100%-os kupon), nincs mit visszaadni.");
        const amount = b.amount ? Math.round(Number(b.amount) * 100) : undefined;
        const form: Record<string, string> = { payment_intent: String(s.payment_intent), "metadata[by]": "admin", "metadata[reason]": String(b.reason || "").slice(0, 200) };
        if (amount) form.amount = String(amount);
        if (b.why && ["duplicate", "fraudulent", "requested_by_customer"].includes(b.why)) form.reason = b.why;
        const r = await stripe<D>("refunds", { form });
        await callAdmin("admin_audit_add", { p_action: "pay_refund", p_target: String(p.id), p_detail: { refund: r.id, amount: (r.amount ?? 0) / 100, reason: b.reason || null, revoke: !!b.revoke } });
        if (b.revoke) await callAdmin("admin_pay_revoke", { p_id: Number(p.id) });
        return NextResponse.json({ ok: true, refund: r.id, status: r.status });
      }
      if (b.action === "code") {
        const code = String(b.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
        const pct = Math.max(1, Math.min(100, Math.round(Number(b.percent) || 0)));
        if (code.length < 3) return bad("A kód legalább 3 betű vagy szám.");
        const c = await stripe<D>("coupons", { form: { percent_off: String(pct), duration: "once", name: `${code} (${b.partner || "partner"})`.slice(0, 40) } });
        const pr = await stripe<D>("promotion_codes", { form: { coupon: c.id, code, ...(b.max ? { max_redemptions: String(Math.round(Number(b.max))) } : {}) } });
        await callAdmin("admin_pay_code_save", { p_code: code, p_partner: String(b.partner || "").slice(0, 80) || null, p_percent: pct, p_commission: b.commission != null && b.commission !== "" ? Number(b.commission) / 100 : null,
          p_coupon: c.id, p_promo: pr.id, p_note: String(b.note || "").slice(0, 200) || null, p_active: true, p_account: b.account ? Number(b.account) : null });
        return NextResponse.json({ ok: true, code, promo: pr.id });
      }
      if (b.action === "code_active") {
        const code = String(b.code || "").toUpperCase();
        const row = ((await callAdmin<D>("admin_pay_pricing", { p_days: 3650 }))?.codes || []).find((x: D) => x.code === code);
        if (!row) return bad("Nincs ilyen kód.");
        if (row.stripe_promo) await stripe(`promotion_codes/${row.stripe_promo}`, { form: { active: b.active ? "true" : "false" } });
        await callAdmin("admin_pay_code_save", { p_code: code, p_partner: row.partner, p_percent: row.percent, p_commission: row.commission, p_note: row.note, p_active: !!b.active, p_account: row.account_id });
        return NextResponse.json({ ok: true });
      }
      if (b.action === "stripe") return NextResponse.json({ ok: true, result: await syncStripe() });
      return bad("Ismeretlen művelet.");
    } catch (e) {
      return bad(String((e as Error)?.message || e).slice(0, 300), 502);
    }
  });
}
