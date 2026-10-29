import { NextResponse } from "next/server";
import { asAdmin } from "@/lib/admin/server";
import { replyTo } from "@/lib/admin/social";
import { replyStore } from "@/lib/admin/stores";
import { replySupport } from "@/lib/admin/support";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* "Válasz" in the inbox: the reply goes out on the platform or store itself (by e-mail for the website's messages), then the item is marked answered */
export async function POST(req: Request) {
  return asAdmin(async () => {
    const b = (await req.json().catch(() => ({}))) as { source?: string; id?: string; text?: string };
    const text = String(b.text || "").trim();
    if (!b.source || !b.id || !text) return NextResponse.json({ ok: false, error: "Hiányzik a válasz szövege." }, { status: 400 });
    try {
      if (b.source === "apple" || b.source === "google") await replyStore(b.source, b.id, text.slice(0, 5000));
      /* a message from the website's form: the answer goes back by e-mail */
      else if (b.source === "support") await replySupport(b.id, text.slice(0, 20000));
      else await replyTo(b.source, b.id, text.slice(0, 2000));
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String((e as Error)?.message || e).slice(0, 240) }, { status: 502 });
    }
  });
}
