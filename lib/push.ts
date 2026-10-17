'use client';
import { sb } from './sb';

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
function urlB64(s: string) {
  const b = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}
/** The only key source: the server's (the sender signs with the matching private key). */
async function serverKey(): Promise<string> {
  const { data } = (await sb()?.rpc('vapid_public_key')) || {};
  return (data as string) || '';
}
const sameKey = (sub: PushSubscription, key: string) => {
  const a = sub.options?.applicationServerKey;
  if (!a) return false;
  const x = new Uint8Array(a as ArrayBuffer), y = urlB64(key);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
async function reg() {
  const r = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return r;
}
async function subscribe(key: string) {
  const r = await reg();
  const old = await r.pushManager.getSubscription();
  if (old && sameKey(old, key)) return old;
  if (old) await old.unsubscribe().catch(() => {});
  return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) });
}
async function save(sub: PushSubscription) {
  await sb()?.rpc('push_save', { p_sub: sub.toJSON(), p_ua: navigator.userAgent.slice(0, 200) });
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios() && !standalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const r = await navigator.serviceWorker.getRegistration();
    return (await r?.pushManager.getSubscription()) && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/** Ask permission (must be called from a tap) and register this device for the signed-in user. */
export async function enablePush(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios() && !standalone() ? 'needs-install' : 'unsupported';
  // ask first, straight from the tap (Safari only allows it inside the user gesture)
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const key = await serverKey();
  if (!key) return 'off';
  await save(await subscribe(key));
  return 'on';
}

export async function disablePush(): Promise<void> {
  try {
    const r = await navigator.serviceWorker.getRegistration();
    const s = await r?.pushManager.getSubscription();
    if (s) {
      await sb()?.rpc('push_remove', { p_endpoint: s.endpoint });
      await s.unsubscribe();
    }
  } catch {}
}

/** On every app start: keep this device's subscription on the current key and saved for the signed-in user. */
export async function syncPush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const { data } = (await sb()?.auth.getSession()) || {};
    if (!data?.session) return;
    const key = await serverKey();
    if (!key) return;
    await save(await subscribe(key));
  } catch {}
}

/** Phone reminders for the healing plan: 9:00 local time on each step day. */
export async function scheduleCare(start: string, steps: { day: number; text: string }[], title: (d: number) => string) {
  const items = steps.map((s) => {
    const d = new Date(start + 'T09:00:00');
    d.setDate(d.getDate() + s.day);
    return { at: d.toISOString(), title: title(s.day), body: s.text, url: '/app/gallery' };
  });
  const { data, error } = (await sb()?.rpc('push_schedule', { p_kind: 'aftercare', p_items: items })) || {};
  return error ? -1 : (data as number) || 0;
}
