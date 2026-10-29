import { NextResponse } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { asAdmin } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

/* "Kulcsok csak a szervernek": the server shows the database that it holds ADMIN_SERVER_TOKEN (a Vercel environment
   variable); from then on the keys can be read only with that token, never from a browser session. */
export async function POST() {
  return asAdmin(async () => {
    const tok = process.env.ADMIN_SERVER_TOKEN;
    if (!tok || !/^[0-9a-f]{64}$/.test(tok)) return NextResponse.json({ ok: false, error: "A Vercelben még nincs beállítva az ADMIN_SERVER_TOKEN (vagy az új telepítés még nem futott le)." }, { status: 400 });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_server_lock_t`, { method: "POST", headers: { apikey: SUPABASE_KEY, "content-type": "application/json" }, body: JSON.stringify({ p_token: tok }), cache: "no-store" });
    const ok = r.ok && (await r.json()) === true;
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: "A Vercelben megadott token nem egyezik az itt kapottal." }, { status: ok ? 200 : 400 });
  });
}
