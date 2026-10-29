import { NextResponse } from "next/server";
import { asAdmin, callAdmin } from "@/lib/admin/server";
import { notifyOne, vapid } from "@/lib/admin/push";

export const dynamic = "force-dynamic";

/* the phone's notifications: GET the public key (and the newest signals for the service worker),
   POST a device's subscription (or ?test=1 for a test notification), DELETE to switch a device off.
   These are admin-only functions without a token argument: callAdmin, with her own session. */
export async function GET(req: Request) {
  return asAdmin(async () => {
    const q = new URL(req.url).searchParams;
    /* the worker: everything kept since its last look (?since=), at most 20 at once, and how many more there are */
    if (q.has("latest")) {
      const since = q.get("since"), ok = since && !Number.isNaN(Date.parse(since));
      const r = await callAdmin<{ items: unknown[]; more: number; now: string }>("admin_push_latest", { p_since: ok ? new Date(since!).toISOString() : null })
        .catch(() => ({ items: [], more: 0, now: new Date().toISOString() }));
      return NextResponse.json({ ok: true, ...r }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ ok: true, key: (await vapid()).pub }, { headers: { "cache-control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return asAdmin(async () => {
    /* one test: kept once and sent once (the device shows it from the list, no second push) */
    if (new URL(req.url).searchParams.has("test")) {
      const sent = await notifyOne("test", new Date().toISOString(), "InkAge · próba", "Így jön minden fontos jelzés: robbanó poszt, új vélemény, rekordnap, hiba.", "/admin");
      return NextResponse.json({ ok: true, sent });
    }
    const b = (await req.json().catch(() => ({}))) as { sub?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; ua?: string };
    if (!b.sub?.endpoint || !/^https:\/\//.test(b.sub.endpoint)) return NextResponse.json({ ok: false, error: "Hiányzik a feliratkozás." }, { status: 400 });
    try { await callAdmin("admin_push_save", { p_sub: b.sub, p_ua: String(b.ua || "").slice(0, 200) }); }
    catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: Request) {
  return asAdmin(async () => {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
    if (b.endpoint) await callAdmin("admin_push_delete", { p_endpoint: b.endpoint }).catch(() => null);
    return NextResponse.json({ ok: true });
  });
}
