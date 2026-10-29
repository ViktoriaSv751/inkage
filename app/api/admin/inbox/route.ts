import { NextResponse } from "next/server";
import { asAdmin } from "@/lib/admin/server";
import { moderate } from "@/lib/admin/social";

export const dynamic = "force-dynamic";

/* hide, show again or like a comment on the platform itself, from the inbox */
export async function POST(req: Request) {
  return asAdmin(async () => {
    const b = (await req.json().catch(() => ({}))) as { source?: string; id?: string; action?: "hide" | "unhide" | "like" };
    if (!b.source || !b.id || !["hide", "unhide", "like"].includes(String(b.action))) return NextResponse.json({ ok: false, error: "Hiányos kérés." }, { status: 400 });
    try { await moderate(b.source, b.id, b.action!); return NextResponse.json({ ok: true }); }
    catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e).slice(0, 200) }, { status: 502 }); }
  });
}
