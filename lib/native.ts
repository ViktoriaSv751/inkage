'use client';
/* Native (Capacitor) bridge. The store apps are a thin shell around the live web app; everything
   here is a no-op in a normal browser, so the web keeps working exactly as before. */
import { sb } from './sb';
import { oauthParams, authErrorCode } from './auth-help';

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
  (await import('./apple-token')).markOAuthStart(provider);
  const { data, error } = await s.auth.signInWithOAuth({ provider, options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true, queryParams: oauthParams(provider) } });
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
  const failed = authErrorCode(p);
  if (failed) {
    const { Browser } = await import('@capacitor/browser');
    Browser.close().catch(() => {});
    return void location.replace(`/belepes?err=${encodeURIComponent(failed)}`);
  }
  try {
    if (access_token && refresh_token) {
      const { data } = await s.auth.setSession({ access_token, refresh_token });
      if (data.user) await (await import('./apple-token')).saveAppleToken(s, data.user.id, p.get('provider_refresh_token'));
    }
    else if (p.get('code')) await s.auth.exchangeCodeForSession(p.get('code')!);
  } finally {
    const { Browser } = await import('@capacitor/browser');
    Browser.close().catch(() => {});
  }
  (await import('./splash')).markSplash('in');
  location.replace('/app/gallery');
}

/** Called once when the app starts inside the native shell. */
let started = false;
export async function initNative() {
  if (!isNative() || started) return;
  started = true;
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
  // the app was closed while the sign-in page was open: it starts with the callback address
  // (only once per address: after finishing, the page reloads and the launch address is still the same)
  App.getLaunchUrl()
    .then((l) => {
      const url = l?.url;
      if (!url?.startsWith(`${NATIVE_SCHEME}://auth`)) return;
      try {
        if (sessionStorage.getItem('ink_auth_done') === url) return;
        sessionStorage.setItem('ink_auth_done', url);
      } catch {
        return;
      }
      finishAuth(url);
    })
    .catch(() => {});
  // a tapped healing-plan reminder opens the gallery
  import('@capacitor/local-notifications')
    .then(({ LocalNotifications }) =>
      LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
        const u = (a?.notification?.extra as any)?.url;
        location.assign(typeof u === 'string' && u.startsWith('/') ? u : '/app/gallery');
      })
    )
    .catch(() => {});
  // Android back button: go back inside the app, leave it only from the start screen
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && location.pathname !== '/app') history.back();
    else App.minimizeApp().catch(() => {});
  });
  // the status bar follows the app's theme (dark unless light was chosen): light text on black, or dark on white
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    const paint = () => {
      const light = document.documentElement.dataset.theme === 'light';
      StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: light ? '#ffffff' : '#000000' }).catch(() => {});
    };
    paint();
    window.addEventListener('ink-theme', paint);
  });
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

/** Native camera / photo library picker (one sheet with both), instead of the web view's file input. */
export async function nativePickPhoto(lang: string): Promise<Blob | null> {
  if (!isNative()) return null;
  const hu = lang === 'hu';
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const p = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.DataUrl,
      quality: 90,
      width: 2400,
      correctOrientation: true,
      promptLabelHeader: hu ? 'Fotó' : 'Photo',
      promptLabelPhoto: hu ? 'Választás a fotók közül' : 'Choose from photos',
      promptLabelPicture: hu ? 'Fénykép készítése' : 'Take a photo',
      promptLabelCancel: hu ? 'Mégse' : 'Cancel',
    });
    if (!p.dataUrl) return null;
    return await (await fetch(p.dataUrl)).blob();
  } catch {
    return null; // cancelled or permission refused
  }
}

/** Healing-plan reminders as native local notifications (no server, work offline). Returns how many were set. */
export async function scheduleCareLocal(startDate: string, items: { day: number; text: string }[], title: (day: number) => string): Promise<number> {
  if (!isNative()) return 0;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions().catch(() => ({ display: 'denied' as const }));
  if (perm.display !== 'granted') return 0;
  const base = new Date(`${startDate}T09:00:00`);
  const now = Date.now();
  const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] as { id: number }[] }));
  const old = pending.notifications.filter((n) => n.id >= 7000 && n.id < 7100);
  if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) }).catch(() => {});
  const list = items
    .map((s) => ({ s, at: new Date(base.getTime() + s.day * 86400000) }))
    .filter(({ at }) => at.getTime() > now)
    .map(({ s, at }) => ({ id: 7000 + s.day, title: title(s.day), body: s.text, schedule: { at }, extra: { url: '/app/gallery' } }));
  if (!list.length) return 0;
  await LocalNotifications.schedule({ notifications: list });
  return list.length;
}
