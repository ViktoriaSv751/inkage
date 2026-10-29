import { NextResponse, type NextRequest } from "next/server";
import { asAdmin } from "@/lib/admin/server";
import { addCompetitor, searchApps } from "@/lib/admin/competitors";

export const dynamic = "force-dynamic";

/* search the App Store (GET ?q=) and add an app to the watched competitors (POST {app_id}) */
export async function GET(req: NextRequest) {
  return asAdmin(async () => {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ results: [] });
    return NextResponse.json({ results: await searchApps(q) });
  });
}
export async function POST(req: Request) {
  return asAdmin(async () => {
    const { app_id } = (await req.json().catch(() => ({}))) as { app_id?: string };
    if (!app_id || !/^\d{5,12}$/.test(app_id)) return NextResponse.json({ ok: false, error: "Érvénytelen App Store-azonosító." }, { status: 400 });
    try { await addCompetitor(app_id); return NextResponse.json({ ok: true }); } catch (e) { return NextResponse.json({ ok: false, error: String((e as Error)?.message || e) }, { status: 400 }); }
  });
}
