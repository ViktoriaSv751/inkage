/* A reply to a message written on the website's "Írj nekünk" form: by e-mail (Resend), in the writer's language,
   with the original message quoted, from the address the other InkAge e-mails use. Server-only. */
import { call, callAdmin, env } from "./server";

const esc = (t: string) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const para = (t: string) => esc(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;line-height:1.55">${p.replace(/\n/g, "<br>")}</p>`).join("");

export async function replySupport(item: string, text: string) {
  const m = await call<{ email: string; body: string; lang: string | null; author: string | null; created_at: string } | null>("admin_r_support_item", { p_item: item });
  if (!m?.email) throw new Error("Ehhez az üzenethez nincs e-mail-cím.");
  const key = env().RESEND_API_KEY;
  if (!key) throw new Error("Nincs RESEND_API_KEY: a válasz nem tud kimenni.");
  const hu = String(m.lang || "").startsWith("hu");
  const when = new Date(m.created_at).toLocaleString(hu ? "hu-HU" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Budapest" });
  const html = `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#17140F">
<div style="max-width:560px;margin:0 auto;padding:28px 22px">
  <div style="font-family:Georgia,serif;font-size:26px;margin-bottom:18px">InkAge</div>
  ${para(text)}
  <div style="margin-top:22px;padding:12px 14px;border-left:3px solid #E4DED3;color:#5C564C;font-size:13px">
    <div style="margin-bottom:6px">${hu ? `Az üzeneted (${esc(when)}):` : `Your message (${esc(when)}):`}</div>${para(m.body).replace(/margin:0 0 12px/g, "margin:0 0 8px")}
  </div>
  <div style="margin-top:22px;color:#8F887C;font-size:12px">${hu ? "Erre a levélre válaszolva is írhatsz nekünk." : "You can reply to this e-mail to write to us."} · inkage.app</div>
</div></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env().RESEND_FROM || "InkAge <hello@inkage.app>", reply_to: env().SUPPORT_EMAIL || "support@inkage.app", to: [m.email],
      subject: hu ? "Válasz az InkAge-üzenetedre" : "Re: your message to InkAge", html, text: `${text}\n\n— ${hu ? "Az üzeneted" : "Your message"} (${when}):\n${m.body}` }),
  }).catch(() => null);
  if (!r?.ok) throw new Error(`Nem ment ki a levél (${r ? r.status : "időtúllépés"}).`);
  await callAdmin("admin_audit_note", { p_action: "uzenet.valasz", p_target: "support:" + item, p_detail: { hossz: text.length } }).catch(() => null);
}
