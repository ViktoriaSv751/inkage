/* The Irányítóközpont's service worker (scope /admin): phone notifications and a quick, offline-tolerant start.
   A push arrives empty; the worker asks the dashboard (signed in) for every signal since its last look and shows
   each once: nothing twice, nothing lost (above ten, one summary line says how many more wait on the bell). */
const CACHE = "inkage-admin-v3";
const STATE = "inkage-admin-state";

self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/admin"]).catch(() => null))); });
self.addEventListener("activate", (e) => { e.waitUntil(Promise.all([self.clients.claim(), caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("inkage-admin-") && k !== CACHE && k !== STATE).map((k) => caches.delete(k))))])); });

/* the page itself: the network if it answers within 1.2 s, otherwise the last copy at once (the fresh one still replaces
   it for the next opening), and the last copy when offline; the build's own files: cache first */
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (e.request.mode === "navigate" && u.pathname.startsWith("/admin")) {
    const net = fetch(e.request).then((r) => { const c = r.clone(); if (r.ok) caches.open(CACHE).then((x) => x.put("/admin", c)); return r; });
    e.respondWith(caches.match("/admin").then((hit) => {
      if (!hit) return net;
      return Promise.race([net.catch(() => hit), new Promise((res) => setTimeout(() => res(hit), 1200))]);
    }));
    return;
  }
  if (u.pathname.startsWith("/_next/static/") || u.pathname.startsWith("/fonts/") || u.pathname.startsWith("/brand/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const c = r.clone(); if (r.ok) caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })));
  }
});

/* the time of the last look, kept in the worker's own small cache (a worker has no localStorage) */
async function lastLook() { try { const r = await (await caches.open(STATE)).match("/__admin_last"); return r ? await r.text() : ""; } catch { return ""; } }
async function setLastLook(t) { try { await (await caches.open(STATE)).put("/__admin_last", new Response(t)); } catch {} }

const ICON = "/icons/icon-192.png";
const SUM = { inbox: "komment, vélemény", index: "oldal kiesett a Google-ből", run: "hibás futás", sync: "hibás lehúzás", rising: "robbanó poszt", account: "hibás kapcsolat" };
const NO_MERGE = new Set(["heartbeat", "errors", "sigfail", "test", "milestone", "record"]);
self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    const since = await lastLook();
    let j = null, status = 0;
    try { const r = await fetch("/api/admin/push?latest=1" + (since ? "&since=" + encodeURIComponent(since) : ""), { credentials: "include", cache: "no-store" }); status = r.status; j = r.ok ? await r.json() : null; } catch {}
    /* signed out (or the session expired): say so instead of a generic line */
    if (!j) return self.registration.showNotification("InkAge", { body: status === 404 || status === 401 ? "Új jelzés vár. Lépj be újra az irányítóközpontba, hogy lásd." : "Új jelzés az irányítóközpontban.", icon: ICON, badge: ICON, tag: "inkage", data: { url: "/admin" } });
    if (j.now) await setLastLook(j.now);
    const shown = new Set((await self.registration.getNotifications()).map((n) => n.tag));
    const items = (j.items || []).filter((x) => !shown.has(x.kind + ":" + x.key));
    if (!items.length) return self.registration.showNotification("InkAge", { body: "Az irányítóközpont jelzései frissültek.", icon: ICON, badge: ICON, tag: "inkage", data: { url: "/admin" }, silent: true });
    /* three or more of one kind (new comments, say) become one line: "5 új jelzés: komment" */
    const by = {}; for (const x of items) (by[x.kind] = by[x.kind] || []).push(x);
    const merged = [];
    for (const k of Object.keys(by)) { if (by[k].length >= 3 && !NO_MERGE.has(k)) merged.push({ kind: k, key: "sum:" + (j.now || Date.now()), title: "InkAge", body: `${by[k].length} új: ${SUM[k] || "jelzés"}`, url: by[k][0].url, sum: true }); else merged.push(...by[k]); }
    const show = merged.slice(0, 10), more = merged.length - show.length + (Number(j.more) || 0);
    for (const x of show.reverse()) await self.registration.showNotification(x.title || "InkAge", { body: x.body || "", icon: ICON, badge: ICON, tag: x.kind + ":" + x.key, data: { url: x.url || "/admin", kind: x.kind, key: x.sum ? "" : x.key },
      /* buttons where the phone has them (Android); an iPhone shows none, and a tap still opens the right place */
      actions: [{ action: "open", title: x.kind === "inbox" ? "Válasz" : "Megnyitom" }, ...(x.sum ? [] : [{ action: "done", title: "Kész" }])] });
    if (more > 0) await self.registration.showNotification("InkAge", { body: `És még ${more} jelzés: nyisd meg a csengőt.`, icon: ICON, badge: ICON, tag: "inkage-more", data: { url: "/admin" } });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const nd = e.notification.data || {};
  if (e.action === "done") { if (nd.key) e.waitUntil(fetch("/api/admin/push?ack=1", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: nd.kind, key: nd.key }) }).catch(() => null)); return; }
  const url = nd.url || "/admin";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => new URL(x.url).pathname.startsWith("/admin"));
    if (w) { w.navigate(url).catch(() => null); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
