'use client';
/* Native (Capacitor) bridge. The store apps are a thin shell around the live web app; everything
   here is a no-op in a normal browser, so the web keeps working exactly as before. */
import { sb } from './sb';

export const NATIVE_SCHEME = 'app.inkage';
export const AUTH_CALLBACK = `${NATIVE_SCHEME}://auth`;

type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string };
const cap = (): Cap | undefined => (typeof window !== 'undefined' ? (window as any).Capacitor : undefined);
export const isNative = () => !!cap()?.isNativePlatform?.();
export const platform = (): 'ios' | 'android' | 'web' => (isNative() ? ((cap()?.getPlatform?.() as any) || 'web') : 'web');

/** OAuth in the system browser (Google blocks sign-in inside embedded web views), back via app.inkage://auth. */
export async function nativeOAuth(provider: 'google' | 'apple'): Promise<string | null> {
  const s = sb();
  if (!s) return 'Not available';
  const { data, error } = await s.auth.signInWithOAuth({ provider, options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true } });
  if (error || !data?.url) return error?.message || 'Sign-in failed';
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
  return null;
}

async function finishAuth(url: string) {
  const s = sb();
  if (!s) return;
  const u = new URL(url.replace(`${NATIVE_SCHEME}://`, 'https://x/'));
  const p = new URLSearchParams(u.hash.replace(/^#/, '') || u.search.replace(/^\?/, ''));
  const access_token = p.get('access_token'), refresh_token = p.get('refresh_token');
  try {
    if (access_token && refresh_token) await s.auth.setSession({ access_token, refresh_token });
    else if (p.get('code')) await s.auth.exchangeCodeForSession(p.get('code')!);
  } finally {
    const { Browser } = await import('@capacitor/browser');
    Browser.close().catch(() => {});
  }
  location.replace('/app/profile');
}

/** Called once when the app starts inside the native shell. */
export async function initNative() {
  if (!isNative()) return;
  document.documentElement.classList.add('native', `native-${platform()}`);
  const [{ App }, { Share }] = await Promise.all([import('@capacitor/app'), import('@capacitor/share')]);

  // native share sheet for links (Android web views have no navigator.share)
  const nav = navigator as any;
  nav.share = async (d: { title?: string; text?: string; url?: string; files?: File[] }) => {
    if (d?.files?.length) throw Object.assign(new Error('files'), { name: 'NotAllowedError' });
    await Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: d.title });
  };
  nav.canShare = (d?: { files?: File[] }) => !d?.files?.length;

  // deep links: sign-in callback, shared vote links and invite links open inside the app
  App.addListener('appUrlOpen', ({ url }) => {
    if (url.startsWith(`${NATIVE_SCHEME}://auth`)) return void finishAuth(url);
    try {
      const u = new URL(url);
      if (/inkage/.test(u.host)) location.assign(u.pathname + u.search + u.hash);
    } catch {}
  });
  // Android back button: go back inside the app, leave it only from the start screen
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && location.pathname !== '/app') history.back();
    else App.minimizeApp().catch(() => {});
  });
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Default }).catch(() => {}));
  import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}));
}

/** Save/share a generated file (PDF, calendar, image, ZIP) through the native share sheet. */
export async function nativeShareFile(blob: Blob, filename: string): Promise<boolean> {
  if (!isNative()) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const safe = filename.replace(/[^\w.\-]+/g, '_');
  const w = await Filesystem.writeFile({ path: safe, data, directory: Directory.Cache });
  try {
    await Share.share({ title: filename, files: [w.uri], dialogTitle: filename });
  } catch (e: any) {
    if (!/cancel/i.test(String(e?.message || e))) throw e;
  }
  return true;
}

/* ---- native push (FCM on Android, APNs on iOS) ---- */
export async function nativePushState(): Promise<'on' | 'off' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const p = await PushNotifications.checkPermissions();
    return p.receive === 'granted' ? 'on' : p.receive === 'denied' ? 'denied' : 'off';
  } catch {
    return 'unsupported';
  }
}

let listening = false;
const waiting: ((v: 'on' | 'off') => void)[] = [];
export async function nativePushEnable(): Promise<'on' | 'off' | 'denied' | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const p = await PushNotifications.requestPermissions();
  if (p.receive !== 'granted') return p.receive === 'denied' ? 'denied' : 'off';
  if (platform() === 'android')
    await PushNotifications.createChannel({ id: 'default', name: 'InkAge', description: 'Votes and healing reminders', importance: 4, visibility: 1 }).catch(() => {});
  if (!listening) {
    listening = true;
    PushNotifications.addListener('registration', async (t) => {
      const plat = platform();
      await sb()?.rpc('push_save', { p_sub: { endpoint: `${plat === 'ios' ? 'apns' : 'fcm'}:${t.value}`, platform: plat, token: t.value }, p_ua: navigator.userAgent.slice(0, 200) });
      waiting.splice(0).forEach((f) => f('on'));
    });
    PushNotifications.addListener('registrationError', () => waiting.splice(0).forEach((f) => f('off')));
    PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const url = (a.notification.data as any)?.url;
      if (url) location.assign(String(url).replace(/^https?:\/\/[^/]+/, ''));
    });
  }
  return new Promise((resolve) => {
    waiting.push(resolve);
    PushNotifications.register().catch(() => waiting.splice(0).forEach((f) => f('off')));
    setTimeout(() => waiting.includes(resolve) && (waiting.splice(waiting.indexOf(resolve), 1), resolve('off')), 15000);
  });
}

/** On start: if allowed, refresh the device token silently. */
export async function nativePushSync() {
  if ((await nativePushState()) === 'on') await nativePushEnable().catch(() => {});
}
