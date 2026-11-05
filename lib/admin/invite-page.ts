import { NextResponse } from "next/server";

export const PF = { tiktok: "TikTok", instagram: "Instagram" } as const;
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/* a small page of its own, in English (the partners are abroad); also used by the callback for the result */
export function invitePage(title: string, body: string, button?: { href: string; label: string }, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · InkAge</title><style>
:root{color-scheme:light dark;--bg:#faf8f4;--fg:#1d1b18;--mut:#6b655c;--card:#fff;--line:#e7e1d6;--btn:#1d1b18;--btnfg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--fg:#f3efe7;--mut:#a59d90;--card:#1d1b18;--line:#2e2b26;--btn:#f3efe7;--btnfg:#141311}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:440px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px 24px}
h1{font-size:22px;margin:0 0 12px}p{margin:0 0 12px;color:var(--mut)}ul{margin:0 0 16px;padding-left:20px;color:var(--mut)}
a.b{display:block;text-align:center;background:var(--btn);color:var(--btnfg);text-decoration:none;font-weight:600;border-radius:12px;padding:14px;margin-top:8px}
.brand{font-weight:700;letter-spacing:.02em;margin-bottom:18px}</style></head><body><main><div class="brand">InkAge</div><h1>${esc(title)}</h1>${body}${button ? `<a class="b" href="${esc(button.href)}">${esc(button.label)}</a>` : ""}</main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

