'use client';
import { tx, qOf } from '@/lib/tr';
import { authErrorCode } from '@/lib/auth-help';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, sb } from '@/lib/sb';
import { useLang } from '@/lib/i18n';
import { lsGet, lsSet, migrateLocal, track } from '@/lib/store';
import { AgeGate } from './AgeGate';

export type Me = {
  user: { id: string; email?: string } | null;
  plan?: string;
  remaining?: number;
  limit?: number;
  bonus?: number;
  onboarding?: any;
  notifyVotes?: boolean;
};
/** What the person set on their account (name, picture) and an e-mail change still waiting for confirmation.
    Kept here, so the top bar, the profile and the edit sheet always show the same thing. */
export type Profile = { name: string; avatar: string | null; pendingEmail: string | null; hasPassword: boolean };
const NO_PROFILE: Profile = { name: '', avatar: null, pendingEmail: null, hasPassword: false };

type Cfg = { ai: boolean; auth: boolean; payments: boolean; nativePush?: { android: boolean; ios: boolean } };

type Ctx = {
  me: Me;
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  loadProfile: () => Promise<void>;
  cfg: Cfg | null;
  refreshMe: () => Promise<Me>;
  toast: (msg: string) => void;
  openAuth: (reason?: string) => void;
  authOpen: boolean;
  authReason: string;
  closeAuth: () => void;
  ui: ReturnType<typeof useLang>;
};

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const ui = useLang();
  const [me, setMe] = useState<Me>({ user: null });
  const [profile, setProfileState] = useState<Profile>(NO_PROFILE);
  const setProfile = useCallback((p: Partial<Profile>) => setProfileState((x) => ({ ...x, ...p })), []);
  const loadProfile = useCallback(async () => {
    const s = sb();
    const u = s ? (await s.auth.getUser().catch(() => null))?.data.user : null;
    if (!s || !u) return setProfileState(NO_PROFILE);
    const md: any = u.user_metadata || {};
    // the name the person set is kept in profiles: a Google / Apple sign-in rewrites user_metadata.full_name every time
    const { data: pr } = await s.from('profiles').select('display_name').eq('id', u.id).maybeSingle();
    let avatar: string | null = null;
    if (md.avatar_path) avatar = (await s.storage.from('previews').createSignedUrl(md.avatar_path, 60 * 60 * 24)).data?.signedUrl ?? null;
    // Google / Apple sign-ins have no password until the person sets one
    const providers: string[] = (u.app_metadata as any)?.providers || [(u.app_metadata as any)?.provider].filter(Boolean);
    setProfileState({ name: String((pr as any)?.display_name || md.full_name || md.name || '').trim(), avatar, pendingEmail: (u as any).new_email || null, hasPassword: providers.includes('email') });
  }, []);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [msg, setMsg] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState('');
  const timer = useRef<any>();
  const migrated = useRef(false);
  // an account is needed to use the app: no session → the sign-in page
  const [gate, setGate] = useState<'checking' | 'in' | 'out'>('checking');
  const toLogin = useCallback(() => {
    setGate('out');
    const q = qOf(ui.lang);
    // a Google / Apple sign-in that failed comes back with #error=… – show why on the sign-in page
    const failed = authErrorCode(new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1)));
    location.replace(`/belepes${q}${failed ? `${q ? '&' : '?'}err=${encodeURIComponent(failed)}` : ''}`);
  }, [ui.lang]);

  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 3200);
  }, []);

  const meRef = useRef<Me>({ user: null });
  const refreshMe = useCallback(async () => {
    const r = await api<Me>('/api/me');
    let data: Me = r.ok ? r.data : { user: null };
    if (!data.user) {
      // there are no guest accounts: while this device holds a session, it is that account –
      // a slow or failed /api/me never shows a signed-out screen
      const u = (await sb()?.auth.getSession().catch(() => null))?.data.session?.user;
      if (u) data = { ...meRef.current, ...(r.ok ? data : {}), user: { id: u.id, email: u.email } };
    }
    meRef.current = data;
    setMe(data);
    if (data.user) loadProfile();
    else setProfileState(NO_PROFILE);
    if (data.user && !migrated.current) {
      migrated.current = true;
      // referral captured on landing
      const ref = lsGet<string | null>('ink_ref', null);
      if (ref && ref !== data.user.id) {
        sb()?.rpc('apply_referral', { p_ref: ref }).then(({ data: ok }) => {
          lsSet('ink_ref', null);
          if (ok) {
            toast(tx(ui.lang, 'Bonus: you got an extra free preview 🎉', 'Bónusz: kaptál egy ingyenes előnézetet 🎉'));
            api<Me>('/api/me').then((x) => x.ok && setMe(x.data));
          }
        });
      }
      // guest previews → account
      migrateLocal(data.user.id).then((n) => n && toast(tx(ui.lang, `${n} saved design${n > 1 ? 's' : ''} moved to your account`, `${n} terv átkerült a fiókodba`)));
      // once per account: a welcome e-mail
      api('/api/welcome', { lang: ui.lang }).catch(() => {});
      // vote links made on this device → account (so they can be listed and closed anywhere)
      api('/api/guest-share?claim=1', {}).catch(() => {});
      // onboarding answers → profile
      const ob = lsGet<any>('ink_onboarding', null);
      if (ob && !data.onboarding) sb()?.rpc('save_profile', { p_onboarding: ob, p_lang: ui.lang })?.then(() => {}, () => {});
    }
    return data;
  }, [toast, ui.lang, loadProfile]);

  useEffect(() => {
    api<Cfg>('/api/config').then((r) => setCfg(r.ok ? r.data : { ai: false, auth: false, payments: false }));
    const s0 = sb();
    // the app only shows once the account is known – never a guest screen first
    const enter = () => refreshMe().then(() => setGate('in'), () => setGate('in'));
    if (!s0) enter();
    else
      s0.auth
        .getSession()
        .then(async ({ data }) => {
          if (!data.session) return toLogin();
          // a session ended elsewhere (signed out on another device, expired) is not a sign-in: check it with the server
          const { error } = await s0.auth.getUser();
          if (error && (error.status === 401 || error.status === 403 || /session/i.test(error.message))) {
            const r = await s0.auth.refreshSession().catch(() => ({ error }));
            if (r.error) {
              await s0.auth.signOut({ scope: 'local' }).catch(() => {});
              return toLogin();
            }
          }
          await enter();
        })
        .catch(() => enter());
    const sub = sb()?.auth.onAuthStateChange((evt, session) => {
      if (evt === 'SIGNED_IN' && session) setTimeout(() => refreshMe().then(() => setGate('in'), () => setGate('in')), 0);
      // a confirmed e-mail change (or a name / picture saved on another tab) arrives as USER_UPDATED
      if (evt === 'USER_UPDATED') setTimeout(() => refreshMe(), 0);
      if (evt === 'SIGNED_OUT') {
        meRef.current = { user: null };
        toLogin();
      }
      if (evt === 'SIGNED_IN') {
        if ((window as any).Capacitor?.isNativePlatform?.()) import('@/lib/native').then((m) => m.nativePushSync()).catch(() => {});
        else import('@/lib/push').then((m) => m.syncPush()).catch(() => {});
      }
    });
    // service worker for the installable app
    if ((window as any).Capacitor?.isNativePlatform?.()) import('@/lib/native').then((m) => m.initNative()).catch(() => {});
    else if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(() => import('@/lib/push').then((m) => m.syncPush())).catch(() => {});
    track('app_open', { path: location.pathname });
    // any "new design" link starts empty: photo and design slots cleared (recent photos stay)
    const fresh = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a[href="/app"]');
      if (a) try { sessionStorage.setItem('ink_fresh', '1'); } catch {}
    };
    document.addEventListener('click', fresh, true);
    // error reporting: what broke and where (max 5 per visit, no personal data)
    let sent = 0;
    const report = (msg: string, src?: string) => {
      if (sent >= 5 || !msg || /ResizeObserver|Script error|extension:\/\//.test(msg + (src || ''))) return;
      sent++;
      track('client_error', { msg: msg.slice(0, 200), src: (src || '').slice(0, 120), path: location.pathname, ua: navigator.userAgent.slice(0, 120) });
    };
    const onErr = (e: ErrorEvent) => report(String(e.message), `${e.filename || ''}:${e.lineno || ''}`);
    const onRej = (e: PromiseRejectionEvent) => report(String((e.reason && (e.reason.message || e.reason)) || 'rejection'));
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      sub?.data.subscription.unsubscribe();
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
      document.removeEventListener('click', fresh, true);
    };
  }, [refreshMe]);

  return (
    <AppCtx.Provider
      value={{
        me,
        profile,
        setProfile,
        loadProfile,
        cfg,
        refreshMe,
        toast,
        ui,
        authOpen,
        authReason,
        openAuth: (r = '') => {
          setAuthReason(r);
          setAuthOpen(true);
        },
        closeAuth: () => setAuthOpen(false),
      }}
    >
      {gate === 'in' ? children : <div className="gate-wait" aria-busy="true" />}
      {gate === 'in' && <AgeGate lang={ui.lang} userId={me.user?.id || null} />}
      <div className={`toast ${msg ? 'show' : ''}`} role="status" aria-live="polite">
        {msg}
      </div>
    </AppCtx.Provider>
  );
}
