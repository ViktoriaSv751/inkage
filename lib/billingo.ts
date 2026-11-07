/* Invoices for web (Stripe) sales through Billingo API v3, ported from Calligra (lib/billingo.ts there). Server only.
   Vercel env: BILLINGO_API_KEY, BILLINGO_BLOCK_ID (the invoice pad), BILLINGO_VAT (default "AAM" = alanyi adómentes),
   optionally BILLINGO_VAT_NON_EU and BILLINGO_VAT_B2B. Without BILLINGO_API_KEY nothing is invoiced.
   The same seller and pad as Calligra (Sóti Viktória Vivien e.v.), so both apps count toward Billingo's monthly
   document limit. public.invoices is reached through the inv_* functions with the db secret, no service key.
   Every sale is a row (the lock and the memory): the webhook records it and tries at once; /api/pay-cron retries. */
import { createHash } from 'node:crypto';
import { appSecret, userClient } from './server';
import { PLAN, isPlan } from './pricing';

const API = "https://api.billingo.hu/v3";
const EU = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);
const LOCK_MS = 5 * 60e3;

export const invoicingOn = () => !!process.env.BILLINGO_API_KEY && !!process.env.BILLINGO_BLOCK_ID && !!appSecret('db');

export type Buyer = { name: string; email: string; country: string; postCode: string; city: string; address: string; taxId?: string };
export type Sale = { buyer: Buyer; item: string; comment: string; amount: number; currency: string; paidAt: string; plan?: string };

/* the invoice line in the invoice's language */
export function invoiceItem(plan: string, lang: 'hu' | 'en'): string | null {
  if (!isPlan(plan)) return null;
  const p = PLAN[plan];
  return lang === 'hu' ? `InkAge ${p.name} csomag: ${p.n} digitális tetoválás-előnézet` : `InkAge ${p.name} package: ${p.n} digital tattoo previews`;
}
type Row = { session_id: string; payment_intent: string | null; status: string; payload: Sale; partner_id: number | null; doc_id: number | null;
  attempts: number; last_error: string | null; note: string | null; locked_at: string | null; updated_at: string };

/* ---- Billingo ---- */
async function billingo(method: string, path: string, body?: unknown) {
  const r = await fetch(API + path, {
    method,
    headers: { "x-api-key": process.env.BILLINGO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`billingo ${method} ${path} ${r.status}: ${JSON.stringify(j).slice(0, 300)}`), { status: r.status });
  return j;
}

/* Billingo's own key for the sale: short, and the same on every try */
const vendorId = (session: string) => "cs-" + createHash("sha256").update(session).digest("hex").slice(0, 24);

async function findDoc(session: string): Promise<number | null> {
  try { return Number((await billingo("GET", `/documents/vendor/${vendorId(session)}`)).id) || null; }
  catch (e) { if ((e as { status?: number }).status === 404) return null; throw e; }
}

/* one unit of a currency in forint, as Billingo has it from the MNB */
async function hufRate(cur: string) {
  const j = await billingo("GET", `/currencies?from=${encodeURIComponent(cur)}&to=HUF`);
  const v = Number(j.conversation_rate ?? j.conversion_rate);
  if (!(v > 0)) throw new Error("no HUF rate for " + cur + ": " + JSON.stringify(j).slice(0, 120));
  return v;
}

/* the calendar day in Hungary, as Billingo wants it (YYYY-MM-DD) */
const huDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(d);

function vatKey(b: Buyer) {
  const base = process.env.BILLINGO_VAT || "AAM";
  if (b.taxId) return process.env.BILLINGO_VAT_B2B || base;
  return (!EU.has(b.country) && process.env.BILLINGO_VAT_NON_EU) || base;
}

/* ---- public.invoices (inv_* functions with the db secret) ---- */
async function inv<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await userClient().rpc(fn, { p_key: appSecret('db'), ...args });
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
const save = (s: string, set: Partial<Row>) => inv('inv_save', { p_session: s, p_set: set });
const rows = (what: 'pi' | 'session' | 'open' | 'bad', ref?: string) => inv<Row[]>('inv_rows', { p_what: what, p_ref: ref ?? null }).then((r) => r || []);

/* the row for this request only, or null when another request holds it (or there is nothing to do) */
async function claim(session: string): Promise<Row | null> {
  const r = await inv<Row[]>('inv_claim', { p_session: session });
  return r?.[0] ?? null;
}

/* ---- the work ---- */

/* the webhook: write the sale down once (a repeated webhook changes nothing), then try to invoice it */
export async function recordSale(a: { session: string; paymentIntent: string | null; sale: Sale; note?: string }) {
  await inv('inv_record', { p_session: a.session, p_pi: a.paymentIntent, p_payload: a.sale, p_note: a.note ?? null });
  if (!a.note) await work(a.session).catch(() => {});
}

/* a refund from Stripe: a full one cancels the invoice (storno), a partial one is left to the owner */
export async function refundSale(paymentIntent: string, full: boolean) {
  const r = (await rows('pi', paymentIntent))[0];
  if (!r) return false;
  if (!full) { await save(r.session_id, { note: "partial_refund" }); return true; }
  if (["cancel_pending", "canceled", "void"].includes(r.status)) return true;
  /* a sale invoiced by hand is cancelled by hand too */
  if (r.status === "manual") { await save(r.session_id, { note: "manual_refund" }); return true; }
  await save(r.session_id, { status: "cancel_pending", attempts: 0, last_error: null });
  await work(r.session_id).catch(() => {});
  return true;
}

/* one attempt on one row; any error is written on the row and thrown */
async function work(session: string) {
  const r = await claim(session);
  if (!r) return;
  try {
    if (r.status === "cancel_pending") await cancel(r);
    else await issue(r);
  } catch (e) {
    await save(session, { status: r.status === "cancel_pending" ? "cancel_pending" : "failed", attempts: r.attempts + 1, last_error: String((e as Error).message || e).slice(0, 500), locked_at: null });
    throw e;
  }
}

async function issue(r: Row) {
  const s = r.payload, b = s.buyer;
  let doc = r.doc_id || (await findDoc(r.session_id));
  if (!doc) {
    let partner = r.partner_id;
    if (!partner) {
      partner = Number((await billingo("POST", "/partners", {
        name: b.name,
        /* Stripe leaves out what a country's addresses don't have; Billingo wants every field */
        address: { country_code: b.country, post_code: b.postCode || "-", city: b.city || "-", address: b.address || "-" },
        emails: b.email ? [b.email] : [],
        ...(b.taxId ? { taxcode: b.taxId, tax_type: b.country === "HU" ? "HAS_TAX_NUMBER" : "FOREIGN" } : { tax_type: b.country === "HU" ? "NO_TAX_NUMBER" : "FOREIGN" }),
      })).id);
      await save(r.session_id, { partner_id: partner });
    }
    const day = huDay(new Date(s.paidAt));
    const cur = s.currency.toUpperCase();
    const lang = b.country === "HU" ? "hu" : "en";
    doc = Number((await billingo("POST", "/documents", {
      /* a foreign-currency invoice must carry the HUF rate: Billingo's own MNB rate (its field is spelled "conversation") */
      ...(cur === "HUF" ? {} : { conversion_rate: await hufRate(cur) }),
      vendor_id: vendorId(r.session_id),
      partner_id: partner,
      block_id: Number(process.env.BILLINGO_BLOCK_ID),
      type: "invoice",
      fulfillment_date: day,
      due_date: day,
      payment_method: "online_bankcard",
      language: lang,
      currency: cur,
      electronic: true,
      paid: true,
      settings: { order_number: r.session_id.slice(0, 50) },
      items: [{ name: (s.plan && invoiceItem(s.plan, lang)) || s.item, unit_price: s.amount, unit_price_type: "gross", quantity: 1, unit: "db", vat: vatKey(b), comment: "" }],
    })).id);
    /* the e-invoice goes to the buyer by e-mail; a failed send doesn't undo the invoice */
    if (b.email) await billingo("POST", `/documents/${doc}/send`, { emails: [b.email] }).catch(() => {});
  }
  await save(r.session_id, { status: "done", doc_id: doc, last_error: null, locked_at: null });
}

async function cancel(r: Row) {
  const doc = r.doc_id || (await findDoc(r.session_id));
  /* refunded before an invoice was made: nothing to cancel, and none will be made */
  if (!doc) { await save(r.session_id, { status: "void", last_error: null, locked_at: null }); return; }
  try {
    await billingo("POST", `/documents/${doc}/cancel`, { cancellation_reason: "Refund", ...(r.payload.buyer.email ? { cancellation_recipients: r.payload.buyer.email } : {}) });
  } catch (e) {
    /* already cancelled in Billingo (by hand, or by a try whose answer got lost) */
    const st = await billingo("GET", `/documents/${doc}`).catch(() => null);
    if (st?.cancelled !== true) throw e;
  }
  await save(r.session_id, { status: "canceled", doc_id: doc, last_error: null, locked_at: null });
}

/* ---- the 5-minute run ---- */

/* waits longer after each failed try: 5, 10, 20 minutes … at most 6 hours */
const due = (r: Row) => Date.now() - new Date(r.updated_at).getTime() >= Math.min(5 * 60e3 * 2 ** Math.max(0, r.attempts - 1), 6 * 3600e3);

const NOTE: Record<string, string> = {
  tax: "Adót tartalmazó eladás: a számlát kézzel kell kiállítani a Billingóban.",
  manual_refund: "Visszatérítés egy kézzel számlázott eladásra: a számlát kézzel kell sztornózni a Billingóban.",
  partial_refund: "Részleges visszatérítés: a helyesbítő számlát kézzel kell kiállítani a Billingóban.",
  address: "Hiányzik a vevő címe: kérd el tőle e-mailben, és állítsd ki a számlát (Stripe-ből a vevő e-mail-címe).",
};

/* a buyer address an invoice can carry: a street line and a town (a post code only where the country has one) */
export const addressOk = (b: Buyer) => !!(b.name.trim() && b.address.trim() && b.city.trim() && b.country.trim());

/* a held or new sale, issued now with the address the owner got from the buyer */
export async function issueLater(a: { session: string; paymentIntent: string | null; sale: Sale }) {
  const cur = (await rows('session', a.session))[0];
  if (!cur) return recordSale(a);
  if (!['manual', 'pending', 'failed'].includes(cur.status)) throw new Error('ez a számla már elkészült vagy sztornózva van: ' + cur.status);
  await save(a.session, { payload: a.sale, status: "pending", note: null, attempts: 0, last_error: null, locked_at: null });
  await work(a.session).catch(() => {});
}

/* retries what is due, and returns what needs the owner: a try that failed three times or more, or a note */
export async function retryInvoices(): Promise<{ retried: number; alerts: { key: string; title: string; body: string }[] }> {
  if (!invoicingOn()) return { retried: 0, alerts: [] };
  const open = await rows('open');
  let retried = 0;
  for (const r of open.filter(due)) { retried++; await work(r.session_id).catch(() => {}); }
  const bad = await rows('bad');
  const alerts = bad
    .filter((r) => r.note || ["failed", "cancel_pending"].includes(r.status))
    .map((r) => {
      const what = `${r.payload.amount} ${r.payload.currency.toUpperCase()} · ${r.payload.item} · ${r.payload.buyer.country}`;
      if (r.note) return { key: `${r.session_id}:${r.note}`, title: "🧾 Számla: kézi teendő", body: `${NOTE[r.note] || r.note} (${what})` };
      const verb = r.status === "cancel_pending" ? "sztornó" : "számla";
      return { key: `${r.session_id}:${r.status}:${r.attempts >= 10 ? 10 : 3}`, title: `⚠️ Nem készül el a ${verb}`, body: `${r.attempts}. próba is hibás: ${String(r.last_error || "").slice(0, 160)} (${what})` };
    });
  return { retried, alerts };
}

/* Read-only check of the Billingo set-up (no invoice is made): the key works, which company it belongs to, the invoice
   pads it sees and whether BILLINGO_BLOCK_ID is one of them. For /api/admin/billingo-check. */
export async function billingoCheck() {
  const env = {
    key: !!process.env.BILLINGO_API_KEY, block: process.env.BILLINGO_BLOCK_ID || null, vat: process.env.BILLINGO_VAT || "AAM (alapérték)",
    vatNonEu: process.env.BILLINGO_VAT_NON_EU || null, vatB2b: process.env.BILLINGO_VAT_B2B || null, dbSecret: !!appSecret('db'),
  };
  if (!env.key) return { ok: false, env, error: "nincs BILLINGO_API_KEY" };
  const out: Record<string, unknown> = { env, invoicingOn: invoicingOn() };
  try {
    const o = await billingo("GET", "/organization");
    out.organization = { name: o.name, tax_code: o.tax_code ?? o.taxcode, address: o.address };
  } catch (e) { out.organization_error = String(e).slice(0, 300); }
  try {
    const b = await billingo("GET", "/document-blocks?per_page=100");
    const list = ((b.data ?? b) as { id: number; name?: string; prefix?: string; type?: string }[]).map((x) => ({ id: x.id, name: x.name, prefix: x.prefix, type: x.type }));
    out.blocks = list;
    out.blockFound = list.some((x) => String(x.id) === String(env.block));
  } catch (e) { out.blocks_error = String(e).slice(0, 300); }
  out.ok = !out.organization_error && !out.blocks_error && out.blockFound === true && env.dbSecret;
  return out;
}

/* one issued invoice as Billingo keeps it (read-only), for checking a live invoice field by field */
export async function billingoDoc(id: number) {
  const d = await billingo("GET", `/documents/${id}`);
  let nav: unknown = null;
  try { nav = await billingo("GET", `/documents/${id}/online-szamla`); } catch (e) { nav = String(e).slice(0, 200); }
  return {
    invoice_number: d.invoice_number, type: d.type, state: d.state, payment_status: d.payment_status, payment_method: d.payment_method,
    invoice_date: d.invoice_date, fulfillment_date: d.fulfillment_date, due_date: d.due_date, currency: d.currency, conversion_rate: d.conversion_rate,
    gross_total: d.gross_total, net_total: d.net_total, language: d.language, electronic: d.electronic, block_id: d.block_id,
    partner: d.partner ? { name: d.partner.name, address: d.partner.address, emails: d.partner.emails, tax_type: d.partner.tax_type } : null,
    items: (d.items || []).map((i: Record<string, unknown>) => ({ name: i.product_name ?? i.name, quantity: i.quantity, unit: i.unit, net: i.net_amount, gross: i.gross_amount, vat: i.vat, comment: i.comment })),
    summary: d.summary, nav,
  };
}
