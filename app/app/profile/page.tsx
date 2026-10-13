'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { cloud, local, lsGet, lsSet, Preview, track } from '@/lib/store';
import { placeName } from '../create/steps';
import type { OnboardingAnswers } from '../create/Onboarding';

const ADMIN = ['vviktoriasoti@gmail.com'];

export default function ProfilePage() {
  const { ui, me, openAuth, toast, refreshMe } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [howto, setHowto] = useState(false);
  const [erase, setErase] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Preview[] | null>(null);
  const [ob, setOb] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    Promise.all([me.user ? cloud.all().catch(() => []) : Promise.resolve([]), local.all().catch(() => [])]).then(([c, l]) => setMine([...c, ...l]));
    setOb((me.onboarding as OnboardingAnswers) || lsGet<OnboardingAnswers | null>('ink_onboarding', null));
  }, [me.user, me.onboarding]);

  // your numbers
  const scored = (mine || []).filter((p) => typeof p.score === 'number');
  const avg = scored.length ? Math.round(scored.reduce((a, p) => a + (p.score || 0), 0) / scored.length) : null;
  const best = scored.reduce<Preview | null>((b, p) => (!b || (p.score || 0) > (b.score || 0) ? p : b), null);
  const topPlace = (() => {
    const n: Record<string, number> = {};
    (mine || []).forEach((p) => (n[p.placement] = (n[p.placement] || 0) + 1));
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  })();

  // skin & lifestyle: used for every new preview (sun exposure changes how fast ink fades)
  const saveOb = (patch: Partial<OnboardingAnswers>) => {
    const next = { ...(ob || ({} as OnboardingAnswers)), ...patch } as OnboardingAnswers;
    setOb(next);
    lsSet('ink_onboarding', next);
    if (me.user) sb()?.rpc('save_profile', { p_onboarding: next, p_lang: ui.lang });
    toast(t('Saved — new previews use this', 'Mentve – az új előnézetek ezt használják'));
  };

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    const h = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const link = me.user ? `${location.origin}/?ref=${me.user.id}` : '';
  const invite = async () => {
    track('invite_share');
    try {
      const nav: any = navigator;
      if (nav.share) await nav.share({ url: link, title: 'InkAge', text: t('See how your tattoo will look in 50 years 👀', 'Nézd meg, hogy néz ki a tetoválásod 50 év múlva 👀') });
      else {
        await navigator.clipboard.writeText(link);
        toast(ui.t('profile.copied'));
      }
    } catch {}
  };

  const install = async () => {
    if (installEvt) {
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') {
        setInstalled(true);
        track('pwa_installed');
      }
      setInstallEvt(null);
    } else setHowto(true);
  };

  const signOut = async () => {
    await sb()?.auth.signOut();
    await refreshMe();
    toast(t('Signed out', 'Kijelentkeztél'));
  };

  const eraseAll = async () => {
    const s = sb();
    if (!s || !me.user) return;
    setBusy(true);
    try {
      const uid = me.user.id;
      for (const bucket of ['previews', 'shares']) {
        const { data: dirs } = await s.storage.from(bucket).list(uid, { limit: 1000 });
        for (const d of dirs || []) {
          const { data: files } = await s.storage.from(bucket).list(`${uid}/${d.name}`, { limit: 100 });
          const paths = (files || []).map((f) => `${uid}/${d.name}/${f.name}`);
          if (paths.length) await s.storage.from(bucket).remove(paths);
        }
      }
      const { error } = await s.rpc('erase_my_account');
      if (error) throw error;
      const mine = await local.all().catch(() => []);
      for (const p of mine) await local.remove(p.id);
      ['ink_onboarding', 'ink_ref'].forEach((k) => lsSet(k, null));
      await s.auth.signOut();
      await refreshMe();
      setErase(false);
      toast(t('Your account and data were deleted.', 'A fiókodat és az adataidat töröltük.'));
    } catch {
      toast(t('Deleting failed. Try again or email us.', 'A törlés nem sikerült. Próbáld újra, vagy írj nekünk.'));
    }
    setBusy(false);
  };

  const initial = (me.user?.email || '?').slice(0, 1).toUpperCase();
  const planName = me.plan === 'lifetime' ? 'Lifetime' : me.plan === 'weekly' ? 'Pro' : t('Free', 'Ingyenes');

  return (
    <>
      <h1>{ui.t('profile.title')}</h1>

      <div className="card">
        <div className="prof-head">
          <div className="avatar">{me.user ? initial : '✦'}</div>
          <div style={{ minWidth: 0 }}>
            <b>{me.user ? me.user.email : t('Guest', 'Vendég')}</b>
            <span className="small muted">{me.user ? `${planName} ${t('plan', 'csomag')}` : t('Sign in to keep your designs on every device', 'Jelentkezz be, hogy minden eszközön meglegyenek a terveid')}</span>
          </div>
        </div>
        {me.user ? (
          <div className="statrow">
            <div className="stat">
              <b>{Math.max(0, me.remaining ?? 0)}</b>
              <span>{t('previews left', 'előnézet maradt')}</span>
            </div>
            <div className="stat">
              <b>{me.bonus ?? 0}</b>
              <span>{t('bonus from invites', 'meghívási bónusz')}</span>
            </div>
            <div className="stat">
              <b>{planName.slice(0, 4)}</b>
              <span>{t('plan', 'csomag')}</span>
            </div>
          </div>
        ) : (
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => openAuth()}>
            {ui.t('common.signin')}
          </button>
        )}
      </div>

      {mine && mine.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2>{t('Your previews', 'Az előnézeteid')}</h2>
          <div className="statrow">
            <div className="stat">
              <b>{mine.length}</b>
              <span>{t('saved', 'mentve')}</span>
            </div>
            <div className="stat">
              <b>{avg ?? '–'}</b>
              <span>{t('average score', 'átlagos pontszám')}</span>
            </div>
            <div className="stat">
              <b>{best?.score ?? '–'}</b>
              <span>{t('best score', 'legjobb pontszám')}</span>
            </div>
          </div>
          {(best || topPlace) && (
            <p className="muted small" style={{ margin: '12px 0 0' }}>
              {best && t(`Your best-aging design: ${placeName(best.placement, 'en').toLowerCase()}, ${best.size}. `, `A legjobban öregedő terved: ${placeName(best.placement, 'hu').toLowerCase()}, ${best.size}. `)}
              {topPlace && t(`Most tried spot: ${placeName(topPlace, 'en').toLowerCase()}.`, `Leggyakrabban kipróbált hely: ${placeName(topPlace, 'hu').toLowerCase()}.`)}
            </p>
          )}
          <Link className="btn ghost wide" href="/app/gallery" style={{ marginTop: 12 }}>
            {t('Open gallery', 'Galéria megnyitása')}
          </Link>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h2>{t('Skin & lifestyle', 'Bőr és életmód')}</h2>
        <p className="muted small">{t('Sun is the #1 reason ink fades. This makes every aging preview match your life.', 'A nap a fakulás első számú oka. Ez alapján igazítjuk az öregedést a te életedhez.')}</p>
        <b style={{ display: 'block', fontSize: 14, margin: '10px 0 6px' }}>{t('How much sun does your skin get?', 'Mennyi nap éri a bőröd?')}</b>
        <div className="seg" role="radiogroup">
          {(
            [
              ['low', t('Little', 'Kevés')],
              ['medium', t('Some', 'Közepes')],
              ['high', t('A lot', 'Sok')],
            ] as const
          ).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={(ob?.sun || 'medium') === v} className={(ob?.sun || 'medium') === v ? 'on' : ''} onClick={() => saveOb({ sun: v })}>
              {l}
            </button>
          ))}
        </div>
        <button
          className="list-row"
          style={{ marginTop: 8 }}
          onClick={() => {
            location.href = '/app?again=1';
          }}
        >
          <span>
            {t('Answer the starting questions again', 'A kezdő kérdések újra')}
            <small>{t('Body area, size, style and goals', 'Testrész, méret, stílus és célok')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h2>{ui.t('profile.invite')}</h2>
        <p className="muted">{ui.t('profile.inviteSub')}</p>
        {me.user ? (
          <>
            <input className="text" id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} style={{ fontSize: 14, marginBottom: 10, color: 'var(--ink-2)' }} />
            <button className="btn wide" onClick={invite}>
              {t('Share invite link', 'Meghívó link megosztása')}
            </button>
          </>
        ) : (
          <button className="btn ghost wide" onClick={() => openAuth(t('Sign in to get your invite link.', 'Jelentkezz be a meghívó linkedért.'))}>
            {t('Sign in to get your link', 'Bejelentkezés a linkért')}
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="list-row">
          <span>{ui.t('profile.lang')}</span>
          <div className="seg" role="radiogroup">
            {(['en', 'hu'] as const).map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={ui.lang === l}
                className={ui.lang === l ? 'on' : ''}
                onClick={() => {
                  ui.setLang(l);
                  if (me.user) sb()?.rpc('save_profile', { p_onboarding: me.onboarding ?? null, p_lang: l });
                }}
              >
                {l === 'en' ? 'English' : 'Magyar'}
              </button>
            ))}
          </div>
        </div>
        {!installed && (
          <button className="list-row" onClick={install}>
            <span>
              {ui.t('profile.install')}
              <small>{t('Opens full screen, like a normal app', 'Teljes képernyőn nyílik, mint egy rendes app')}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        <Link className="list-row" href="/learn">
          <span>{t('Tattoo aging guides', 'Útmutatók a tetoválás öregedéséről')}</span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link className="list-row" href="/terms">
          <span>{t('Terms', 'Felhasználási feltételek')}</span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link className="list-row" href="/privacy">
          <span>{t('Privacy', 'Adatvédelem')}</span>
          <span aria-hidden="true">›</span>
        </Link>
        {me.user?.email && ADMIN.includes(me.user.email.toLowerCase()) && (
          <Link className="list-row" href="/admin">
            <span>{t('Admin dashboard', 'Admin felület')}</span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        {me.user && (
          <>
            <button className="list-row" onClick={signOut}>
              <span>{ui.t('common.signout')}</span>
            </button>
            <button className="list-row" onClick={() => setErase(true)}>
              <span className="danger">{ui.t('profile.erase')}</span>
            </button>
          </>
        )}
      </div>

      <p className="disclaimer">InkAge · {t('AI simulations for inspiration, not a guarantee.', 'MI-szimulációk inspirációnak, nem garancia.')}</p>

      <Sheet open={howto} onClose={() => setHowto(false)} label={ui.t('profile.install')}>
        <h2>{ui.t('profile.install')}</h2>
        {ios ? (
          <ol className="perks">
            <li>{t('Tap the Share button in Safari (the square with an arrow).', 'Koppints a Megosztás gombra a Safariban (négyzet nyíllal).')}</li>
            <li>{t('Choose “Add to Home Screen”.', 'Válaszd a „Főképernyőhöz adás” lehetőséget.')}</li>
            <li>{t('Tap “Add”.', 'Koppints a „Hozzáadás” gombra.')}</li>
          </ol>
        ) : (
          <ol className="perks">
            <li>{t('Open the browser menu (⋮).', 'Nyisd meg a böngésző menüjét (⋮).')}</li>
            <li>{t('Choose “Install app” or “Add to Home screen”.', 'Válaszd az „Alkalmazás telepítése” vagy „Hozzáadás a kezdőképernyőhöz” lehetőséget.')}</li>
          </ol>
        )}
        <button className="btn wide" onClick={() => setHowto(false)}>
          {ui.t('common.done')}
        </button>
      </Sheet>

      <Sheet open={erase} onClose={() => setErase(false)} label={ui.t('profile.erase')}>
        <h2>{ui.t('profile.erase')}</h2>
        <p className="sub">{ui.t('profile.eraseConfirm')}</p>
        <input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoCapitalize="characters" />
        <button className="btn wide red" disabled={confirm.trim().toUpperCase() !== 'DELETE' || busy} onClick={eraseAll}>
          {busy ? '…' : t('Delete everything', 'Mindent törlök')}
        </button>
      </Sheet>
    </>
  );
}
