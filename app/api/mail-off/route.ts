import { appSecret, userClient, verifyToken } from '@/lib/server';

export const dynamic = 'force-dynamic';

const page = (title: string, body: string) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>InkAge</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font:16px/1.5 -apple-system,Helvetica,Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box"><div style="max-width:420px"><h1 style="font-size:26px;letter-spacing:-.02em">${title}</h1>${body}</div></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
const check = (req: Request) => {
  const t = new URL(req.url).searchParams.get('t') || '';
  const v = verifyToken<{ uid: string; off: number; exp: number }>(t);
  return v?.off && v.exp > Date.now() ? { uid: v.uid, t } : null;
};
const BAD = 'This link is no longer valid. / Ez a link már nem érvényes.';

/** The reminder's unsubscribe link. Opening it only asks (mail scanners open links); the button, or the mail app's own
    one-click unsubscribe, does it. */
export async function GET(req: Request) {
  const v = check(req);
  if (!v) return page('InkAge', `<p>${BAD}</p>`);
  return page('Ne küldjünk emlékeztetőt? / Stop reminders?', `<form method="post" action="/api/mail-off?t=${encodeURIComponent(v.t)}"><button style="margin-top:12px;padding:14px 26px;border:0;border-radius:12px;background:#fff;color:#000;font:700 16px -apple-system,Helvetica,Arial,sans-serif;cursor:pointer">Igen, ne küldjetek / Yes, stop them</button></form>`);
}

export async function POST(req: Request) {
  const v = check(req);
  if (!v) return page('InkAge', `<p>${BAD}</p>`);
  await userClient().rpc('mail_opt_out', { p_secret: appSecret('db'), p_user: v.uid });
  return page('Kész. / Done.', '<p>Több emlékeztetőt nem küldünk.<br>We won’t send more reminders.</p>');
}
