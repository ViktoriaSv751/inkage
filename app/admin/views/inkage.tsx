"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* InkAge: what only InkAge has. The AI previews of the day and their cost, the
   daily safety cap, the AI models' check, the moderation queues (reported pictures, reported AI results, Explore posts
   waiting for approval), the users' feedback, the "not right?" reasons, the waitlist and the latest errors. Every number
   comes from InkAge's own admin functions (admin_stats, admin_extra, admin_health, admin_reports…), which let in only
   the owner's account. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, fmt } from "../charts";
import { toast } from "../phone";
import { Async, Card, I, Kpi, Lesson, P, api, dt, n, rpc, type D, useRpc } from "../shared";

const CAP = 300; /* the server's limit: AI jobs in any 24 hours */
/* the app's "Nem lett jó?" reasons (app/app/_result/constants.ts REDO_REASONS) */
export const REDO: Record<string, string> = { clothes: "Ruhára vagy a háttérre került", design: "Nem az ő mintája / változtak a részletek", place: "Rossz helyen vagy rossz méretben", anatomy: "Torz a kéz vagy a test", fake: "Nem élethű, matricának tűnik", other: "Nem jelölt okot" };

export function InkAge() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const st = useRpc("admin_stats", undefined, []);
  const ex = useRpc("admin_extra", undefined, []);
  const he = useRpc("admin_health", undefined, []);
  const rep = useRpc("admin_reports", undefined, []);
  const air = useRpc("admin_ai_reports", undefined, []);
  const posts = useRpc("admin_posts", undefined, []);
  const fb = useRpc("admin_feedback", undefined, []);
  const [busy, setBusy] = useState("");
  const s: D = st.d || {}, x: D = ex.d || {};
  /* rough AI cost: ~1 fresh + 4 aging images and the checks per preview */
  const cost = n(s.gen_today) * 0.05 + n(s.aging_today) * 0.04;
  const act = async (key: string, fn: string, args: Record<string, unknown>, ok: string, reload: () => void) => {
    setBusy(key);
    const { error } = await rpc(sb, fn, args);
    setBusy("");
    if (error) toast(error.message); else { toast(ok); reload(); }
  };
  const checkNow = async () => {
    setBusy("health");
    /* with the owner's sign-in: the check makes a real AI call, so /api/health answers only the owner and the cron */
    const r = await api("/api/health").catch(() => null);
    setBusy(""); he.load();
    if (r && !r.ok) toast(r.json?.answer || r.json?.error ? `Hiba: ${r.json.answer || r.json.error}` : "Az ellenőrzés nem futott le.");
  };
  const notifyWaitlist = async () => {
    setBusy("wait");
    const { api } = await import("@/lib/sb");
    const r = await api<{ sent?: number; more?: boolean; error?: string }>("/api/admin-waitlist", {});
    setBusy("");
    toast(r.ok ? `Elküldve: ${r.data.sent}${r.data.more ? " (van még, kattints újra)" : ""}` : r.data.error || "Nem sikerült");
    ex.load();
  };
  const h0: D | undefined = Array.isArray(he.d) ? he.d[0] : undefined;
  const daily: D[] = Array.isArray(s.daily) ? s.daily : [];
  const max = Math.max(1, ...daily.map((d) => n(d.previews)));
  const reports: D[] = Array.isArray(rep.d) ? rep.d : [], aiReports: D[] = Array.isArray(air.d) ? air.d : [], waiting: D[] = Array.isArray(posts.d) ? posts.d : [], feedback: D[] = Array.isArray(fb.d) ? fb.d : [];
  return (
    <div className="g">
      <div className="s12"><Lesson>Ez az oldal csak az InkAge-é: az MI-előnézetek száma és költsége (az elmúlt 24 órában), a biztonsági napi korlát, a moderálás (bejelentett képek, MI-eredmények, Felfedezés-posztok), a visszajelzések és a várólista. A saját és a tesztfiókjaid nem számítanak bele, a törölt előnézetek sem.</Lesson></div>
      <Kpi className="s3" tone="peach" icon={P.spark} l="Előnézet (24 óra)" v={fmt(n(s.gen_today))} sub={`ebből vendég: ${fmt(n(s.guest_today))}`} />
      <Kpi className="s3" tone="butter" icon={P.clock} l="Előnézet 7 nap" v={fmt(n(s.gen_7d))} />
      <Kpi className="s3" tone="pink" icon={P.eye} l="Öregítés-kép (24 óra)" v={fmt(n(s.aging_today))} />
      <Kpi className="s3" tone="sky" icon={P.bolt} l="Becsült MI-költség (24 óra)" v={"$" + cost.toFixed(2)} title="Durva becslés: előnézetenként kb. 1 friss és 4 öregített kép, plusz az ellenőrzések." />
      <Kpi className="s3" tone="lilac" icon={P.users} l="Fiókok" v={fmt(n(s.users))} />
      <Kpi className="s3" tone="peach" icon={P.doc} l="Mentett előnézet" v={fmt(n(s.saved))} title="A galériában lévő előnézetek, a töröltek és a saját / tesztfiókok nélkül" />
      <Kpi className="s3" tone="butter" icon={P.share} l="Megosztó link" v={fmt(n(s.shares))} />
      <Kpi className="s3" tone="pink" icon={P.check} l="Szavazat" v={fmt(n(s.votes))} />

      <Card className="s6" icon={P.system} title="Biztonsági napi korlát" sub={`Ha 24 óra alatt ${CAP} MI-munka gyűlik össze, az új előnézetek szünetelnek, amíg a legrégebbiek ki nem esnek a 24 órás ablakból.`}>
        <Async q={st} h={60}>{() => {
          const v = n(s.gen_today), hot = v > CAP * 0.8;
          return (<div>
            <b style={{ fontSize: 22 }}>{fmt(v)} / {CAP}</b> <span className="mut">MI-munka az elmúlt 24 órában</span>
            <div style={{ height: 10, borderRadius: 10, background: "var(--line, rgba(127,127,127,.2))", overflow: "hidden", marginTop: 10 }}>
              <i style={{ display: "block", height: "100%", width: `${Math.min(100, (v / CAP) * 100)}%`, background: hot ? "var(--bad, #e0483b)" : "var(--gold, #F3D58A)" }} />
            </div>
          </div>);
        }}</Async>
      </Card>
      <Card className="s6" icon={P.bolt} title="MI-modellek" sub="Naponta ellenőrizzük, hogy a használt MI-modellek elérhetők-e és válaszolnak-e (egy apró próbahívással)." right={<button className="adm-ibtn" disabled={busy === "health"} onClick={checkNow}>{I(P.refresh)}{busy === "health" ? "Ellenőrzés…" : "Ellenőrzés most"}</button>}>
        <Async q={he} h={60}>{() => !h0 ? <Empty t="Még nem volt ellenőrzés." /> : (
          <div>
            <span className={"chip " + (h0.ok ? "good" : "bad")}>{h0.ok ? "Működik" : "HIBA"}</span> <span className="mut">{dt(h0.created_at)}</span>
            <small style={{ display: "block", marginTop: 8 }}>Szöveg: {h0.detail?.activeText || "–"} · Kép: {h0.detail?.activeImage || "–"}{h0.detail?.preferredMissing?.length ? ` · hiányzik: ${h0.detail.preferredMissing.join(", ")}` : ""}{String(h0.detail?.answer || "").startsWith("error") ? ` · ${h0.detail.answer}` : ""}</small>
          </div>)}</Async>
      </Card>

      <Card className="s8" icon={P.traffic} title="Előnézetek, utolsó 14 nap">
        <Async q={st} h={150}>{() => !daily.length ? <Empty t="Még nincs előnézet." /> : (
          <div style={{ display: "flex", alignItems: "end", gap: 4, height: 150, paddingTop: 20 }}>
            {daily.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.previews} előnézet, ${n(d.aging)} öregítés`} style={{ flex: 1, height: `${(n(d.previews) / max) * 100}%`, minHeight: 2, background: "var(--gold, #F3D58A)", borderRadius: "6px 6px 0 0", position: "relative" }}>
                <span style={{ position: "absolute", bottom: "100%", left: 0, right: 0, textAlign: "center", fontSize: 11, fontWeight: 700 }}>{d.previews}</span>
              </div>))}
          </div>)}</Async>
      </Card>
      <Card className="s4" icon={P.alert} title="Az elmúlt 24 óra a háttérben" sub="Az elmúlt 24 óra InkAge-számai, amelyeket a többi oldal nem mutat. A saját és a tesztfiókok nem számítanak bele.">
        <Async q={ex} h={150}>{() => (
          <ul className="ann-l">
            <li><span title="Előnézet-generálás az elmúlt 24 órában (fiókkal és fiók nélkül)">Előnézet-generálás</span><b>{fmt(n(x.previews_today))}</b></li>
            <li><span>Kivágás / MI-rajz</span><b>{fmt(n(x.helpers_today))}</b></li>
            <li><span>Hiba</span><b>{fmt(n(x.errors_today))}</b></li>
            <li><span>Bezárás után visszatöltve</span><b>{fmt(n(x.recovered_today))}</b></li>
            <li><span>Várólistán (e-mail)</span><b>{fmt(n(x.waitlist))}</b></li>
          </ul>)}</Async>
        {n(x.waitlist) > 0 && <button className="adm-ibtn gold" style={{ marginTop: 10 }} disabled={busy === "wait"} onClick={notifyWaitlist}>{I(P.mail)}Várólista értesítése: újra lehet előnézetet készíteni</button>}
      </Card>

      <Card className="s6" icon={P.alert} title={`Bejelentett képek (${reports.length})`} sub="24 órán belül válaszolj. 3 bejelentés, vagy egy „kiskorú” bejelentés automatikusan elrejti a képet, amíg nem döntesz.">
        <Async q={rep} h={80}>{() => !reports.length ? <Empty t="Nincs bejelentett kép." /> : (
          <div style={{ display: "grid", gap: 12 }}>{reports.map((r) => (
            <div key={r.share_id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={r.paths?.fresh} alt="" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 10 }} />
              <img src={r.paths?.y50} alt="" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 10 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <b>{r.n} bejelentés{r.hidden ? " · most rejtve" : ""}</b>
                <div className="mut">{(r.items || []).map((i: any) => i.reason + (i.note ? `: ${i.note}` : "")).join(" · ")}</div>
                <div className="adm-row" style={{ marginTop: 6 }}>
                  <button className="adm-ibtn" disabled={!!busy} onClick={() => act("r" + r.share_id, "admin_report_action", { p_share: r.share_id, p_hide: true }, "Eltávolítva", rep.load)}>Eltávolítás</button>
                  <button className="adm-ibtn" disabled={!!busy} onClick={() => act("r" + r.share_id, "admin_report_action", { p_share: r.share_id, p_hide: false }, "Megtartva", rep.load)}>Megtartás</button>
                </div>
              </div>
            </div>))}</div>)}</Async>
      </Card>
      <Card className="s6" icon={P.spark} title={`Bejelentett MI-eredmények (${aiReports.length})`} sub="Az app felhasználói jelentették a saját előnézetüket. Nézd át 24 órán belül, és ezek alapján szigoríts a biztonsági szűrőkön.">
        <Async q={air} h={80}>{() => !aiReports.length ? <Empty t="Nincs bejelentett MI-eredmény." /> : (
          <div style={{ display: "grid", gap: 12 }}>{aiReports.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {r.thumb ? <img src={r.thumb} alt="" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 10 }} /> : <div style={{ width: 70, height: 88, borderRadius: 10, background: "var(--line, #333)" }} />}
              <div style={{ flex: 1, fontSize: 13 }}>
                <b>{r.reason}</b> <span className="mut">{dt(r.created_at)}</span>
                {r.note && <div>{r.note}</div>}
                <button className="adm-ibtn" style={{ marginTop: 6 }} disabled={!!busy} onClick={() => act("a" + r.id, "admin_ai_report_done", { p_id: r.id }, "Átnézve", air.load)}>Átnézve</button>
              </div>
            </div>))}</div>)}</Async>
      </Card>
      <Card className="s6" icon={P.eye} title={`Felfedezés: jóváhagyásra vár (${waiting.length})`} sub="Csak akkor hagyd jóvá, ha nincs rajta arc, meztelenség, kiskorú, személyes adat, vagy más alkotása a sajátjaként.">
        <Async q={posts} h={80}>{() => !waiting.length ? <Empty t="Nincs jóváhagyásra váró poszt." /> : (
          <div style={{ display: "grid", gap: 12 }}>{waiting.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={p.share?.paths?.fresh} alt="" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 10 }} />
              <img src={p.share?.paths?.y50} alt="" style={{ width: 70, height: 88, objectFit: "cover", borderRadius: 10 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <b>{p.caption || "–"}</b>
                <div className="mut">{p.share?.placement} · {dt(p.created_at)}</div>
                <div className="adm-row" style={{ marginTop: 6 }}>
                  <button className="adm-ibtn gold" disabled={!!busy} onClick={() => act("p" + p.id, "moderate_post", { p_id: p.id, p_ok: true }, "Jóváhagyva", posts.load)}>Jóváhagyás</button>
                  <button className="adm-ibtn" disabled={!!busy} onClick={() => act("p" + p.id, "moderate_post", { p_id: p.id, p_ok: false }, "Elutasítva", posts.load)}>Elutasítás</button>
                </div>
              </div>
            </div>))}</div>)}</Async>
      </Card>
      <Card className="s6" icon={P.mail} title={`Visszajelzések (${feedback.length})`} sub="Amit a felhasználók az appból írtak.">
        <Async q={fb} h={80}>{() => !feedback.length ? <Empty t="Még nem jött visszajelzés." /> : (
          <ul className="ann-l">{feedback.map((f, i) => (
            <li key={i}><div><b>{f.kind}</b> <span className="mut">{dt(f.created_at)}{f.email ? ` · ${f.email}` : ""}</span><small style={{ display: "block" }}>{f.message}</small></div></li>))}</ul>)}</Async>
      </Card>

      <Card className="s6" icon={P.refresh} title="„Nem jó?” okok, 30 nap" sub="Amikor valaki újrakezdte az előnézetet, ezt jelölte okként.">
        <Async q={ex} h={60}>{() => !Object.keys(x.redo || {}).length ? <Empty t="Még senki nem kezdte újra." /> : (
          <ul className="ann-l">{Object.entries(x.redo as Record<string, number>).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}><span>{REDO[k] || k}</span><b>{fmt(v)}</b></li>)}</ul>)}</Async>
      </Card>
      <Card className="s6" icon={P.alert} title="Legutóbbi hibák" sub="Az app és a szerver legutóbbi hibái, a hibaüzenettel.">
        <Async q={ex} h={60}>{() => !(x.errors || []).length ? <Empty t="Nem volt hiba." /> : (
          <ul className="ann-l">{(x.errors as D[]).slice(0, 20).map((e, i) => (
            <li key={i}><div><b>{e.name === "server_error" ? "Szerver" : e.name === "client_error" ? "Böngésző" : e.name}</b> <span className="mut">{dt(e.created_at)} · {e.props?.route || e.props?.path || ""}</span><small style={{ display: "block" }}>{String(e.props?.msg || JSON.stringify(e.props || {})).slice(0, 240)}</small></div></li>))}</ul>)}</Async>
      </Card>
    </div>
  );
}
