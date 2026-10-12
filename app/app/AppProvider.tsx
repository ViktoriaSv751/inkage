'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, sb } from '@/lib/sb';
import { useLang } from '@/lib/i18n';
import { lsGet, lsSet, migrateLocal, track } from '@/lib/store';

export type Me = {
  user: { id: string; email?: string } | null;
  plan?: string;
  remaining?: number;
  limit?: number;
  bonus?: number;
  onboarding?: any;
};
type Cfg = { ai: boolean; auth: boolean; payments: boolean };

type Ctx = {
  me: Me;
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
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [msg, setMsg] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState('');
  const timer = useRef<any>();
  const migrated = useRef(false);

  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 3200);
  }, []);

  const refreshMe = useCallback(async () => {
    const r = await api<Me>('/api/me');
    const data = r.ok ? r.data : { user: null };
    setMe(data);
    if (data.user && !migrated.current) {
      migrated.current = true;
      // referral captured on landing
      const ref = lsGet<string | null>('ink_ref', null);
      if (ref && ref !== data.user.id) {
        sb()?.rpc('apply_referral', { p_ref: ref }).then(({ data: ok }) => {
          lsSet('ink_ref', null);
          if (ok) {
            toast(ui.lang === 'hu' ? 'Bónusz: kaptál egy ingyenes előnézetet 🎉' : 'Bonus: you got an extra free preview 🎉');
            api<Me>('/api/me').then((x) => x.ok && setMe(x.data));
          }
        });
      }
      // guest previews → account
      migrateLocal(data.user.id).then((n) => n && toast(ui.lang === 'hu' ? `${n} terv átkerült a fiókodba` : `${n} saved design${n > 1 ? 's' : ''} moved to your account`));
      // onboarding answers → profile
      const ob = lsGet<any>('ink_onboarding', null);
      if (ob && !data.onboarding) sb()?.rpc('save_profile', { p_onboarding: ob, p_lang: ui.lang });
    }
    return data;
  }, [toast, ui.lang]);

  useEffect(() => {
    api<Cfg>('/api/config').then((r) => setCfg(r.ok ? r.data : { ai: false, auth: false, payments: false }));
    refreshMe();
    const sub = sb()?.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') setTimeout(() => refreshMe(), 0);
    });
    // service worker for the installable app
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    track('app_open', { path: location.pathname });
    return () => sub?.data.subscription.unsubscribe();
  }, [refreshMe]);

  return (
    <AppCtx.Provider
      value={{
        me,
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
      {children}
      <div className={`toast ${msg ? 'show' : ''}`} role="status" aria-live="polite">
        {msg}
      </div>
    </AppCtx.Provider>
  );
}
