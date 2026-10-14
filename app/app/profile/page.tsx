'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { LangPicker } from '../../LangPicker';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { anonId, cloud, local, lsGet, lsSet, Preview, track, shares, revokeGuestShare } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
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
  const [tab, setTab] = useState<'previews' | 'skin' | 'invite' | 'settings'>('previews');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Preview[] | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const [fbKind, setFbKind] = useState<'bug' | 'idea' | 'question'>('idea');
  const [fbMsg, setFbMsg] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbBusy, setFbBusy] = useState(false);
  useEffect(() => {
    if (me.user) sb()?.rpc('my_invites').then(({ data }) => setJoined((data as any)?.joined ?? null));
  }, [me.user]);
  const sendFeedback = async () => {
    setFbBusy(true);
    const { data } = (await sb()?.rpc('send_feedback', { p_kind: fbKind, p_message: fbMsg.trim(), p_email: fbEmail || me.user?.email || '', p_anon: anonId(), p_page: `${navigator.userAgent.slice(0, 120)}` })) || {};
    setFbBusy(false);
    if (data) {
      setFbMsg('');
      track('feedback_sent', { kind: fbKind });
      toast(t('Thank you! We read every message.', 'Köszönjük! Minden üzenetet elolvasunk.'));
    } else toast(t('Could not send. Try again in a bit.', 'Nem sikerült elküldeni. Próbáld újra kicsit később.'));
  };
  // your data, as a file (previews' details; images stay in the app)
  const exportData = async () => {
    const data = {
      exported_at: new Date().toISOString(),
      account: me.user ? { email: me.user.email, plan: me.plan } : null,
      answers: ob,
      previews: (mine || []).map((p) => ({ created_at: p.created_at, placement: p.placement, size: p.size, score: p.score, notes: p.notes, favorite: p.favorite, folder: p.collection, done_at: p.doneAt ?? null, source: p.source })),
    };
    track('data_export');
    await shareOrDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'inkage-adataim.json');
  };
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
    if (me.user) sb()?.rpc('save_profile', { p_onboarding: next, p_lang: ui.lang })?.then(() => {}, () => {});
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
      // vote links made on this device without an account
      for (const x of shares.all()) if (x.kind !== 'preview') await revokeGuestShare(x.id).catch(() => false);
      const { error } = await s.rpc('erase_my_account');
      if (error) throw error;
      lsSet('ink_shares', []);
      lsSet('ink_posts', []);
      const mine = await local.all().catch(() => []);
      for (const p of mine) await local.remove(p.id);
      ['ink_onboarding', 'ink_ref', 'ink_folders'].forEach((k) => lsSet(k, null));
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
  const displayName = (() => {
    const n = (me.user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
    return n ? n.replace(/\b\w/g, (c) => c.toUpperCase()) : t('My profile', 'Profilom');
  })();
  const planName = me.plan === 'lifetime' ? 'Lifetime' : me.plan === 'weekly' ? 'Pro' : t('Free', 'Ingyenes');

  return (
    <div className="pf">
      <div className="pf-tools">
        {me.user && (
          <button className="iconbtn" aria-label={t('Share invite link', 'Meghívó link megosztása')} onClick={invite}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />
            </svg>
          </button>
        )}
        <button className="iconbtn" aria-label={t('Settings', 'Beállítások')} onClick={() => setTab('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div className="pf-id">
        <div className="pf-avatar">
          <span>{me.user ? initial : '✦'}</span>
          <i className={`pf-badge ${me.user ? 'on' : ''}`} aria-hidden="true">
            {me.user ? (
              <svg viewBox="0 0 24 24">
                <path d="M6 12.5l4 4L18 8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M12 6v12M6 12h12" />
              </svg>
            )}
          </i>
        </div>
        <h1>{me.user ? displayName : t('Guest', 'Vendég')}</h1>
        <p className="pf-sub">{me.user ? me.user.email : t('Sign in to keep your designs on every device', 'Jelentkezz be, hogy minden eszközön meglegyenek a terveid')}</p>
        {me.user ? (
          <button className="pf-edit" onClick={() => setTab('skin')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
            </svg>
            {t('Edit profile', 'Szerkesztés')}
          </button>
        ) : (
          <Link className="pf-edit dark" href={ui.lang === 'en' ? '/belepes?lang=en' : '/belepes'}>
            {ui.t('common.signin')}
          </Link>
        )}
        <div className="pf-stats">
          <div>
            <b>{mine ? mine.length : '–'}</b>
            <span>{t('saved', 'mentve')}</span>
          </div>
          <div>
            <b>{avg ?? '–'}</b>
            <span>{t('avg. score', 'átlag pont')}</span>
          </div>
          <div>
            <b>{me.user ? Math.max(0, me.remaining ?? 0) : '–'}</b>
            <span>{t('left today', 'maradt ma')}</span>
          </div>
          <div>
            <b>{me.bonus ?? 0}</b>
            <span>{t('bonus', 'bónusz')}</span>
          </div>
        </div>
      </div>

      <div className="pf-tabs" role="tablist">
        {(
          [
            ['previews', t('Previews', 'Előnézetek'), <path key="a" d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />],
            ['skin', t('Skin & lifestyle', 'Bőr és életmód'), <path key="b" d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />],
            ['invite', t('Invite', 'Meghívás'), <path key="c" d="M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" />],
            ['settings', t('Settings', 'Beállítások'), <path key="d" d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />],
          ] as const
        ).map(([k, label, icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-label={label} title={label} className={tab === k ? 'on' : ''} onClick={() => setTab(k as any)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {icon}
            </svg>
            <span className="pf-tab-l">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'previews' && (
        <div className="pf-panel">
          {mine === null ? (
            <div className="pf-grid">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="pf-tile skel" />
              ))}
            </div>
          ) : mine.length ? (
            <>
              <div className="pf-grid">
                {mine.slice(0, 8).map((p) => (
                  <Link key={p.id} href={`/app/gallery?id=${p.id}`} className="pf-tile">
                    {(p.images.y50 || p.images.y30 || p.images.fresh) && <img src={p.images.y50 || p.images.y30 || p.images.fresh} alt="" loading="lazy" />}
                    <span className="pf-tile-l">
                      <b>{placeName(p.placement, ui.lang)}</b>
                      {typeof p.score === 'number' && <small>{p.score}/100</small>}
                    </span>
                  </Link>
                ))}
              </div>
              {(best || topPlace) && (
                <p className="muted small" style={{ margin: '14px 2px 0' }}>
                  {best && t(`Your best-aging design: ${placeName(best.placement, 'en').toLowerCase()}, ${best.size}. `, `A legjobban öregedő terved: ${placeName(best.placement, 'hu').toLowerCase()}, ${best.size}. `)}
                  {topPlace && t(`Most tried spot: ${placeName(topPlace, 'en').toLowerCase()}.`, `Leggyakrabban kipróbált hely: ${placeName(topPlace, 'hu').toLowerCase()}.`)}
                </p>
              )}
              <Link className="btn ghost wide" href="/app/gallery" style={{ marginTop: 14 }}>
                {t('Open gallery', 'Galéria megnyitása')}
              </Link>
            </>
          ) : (
            <div className="pf-empty">
              <b>{t('No previews yet', 'Még nincs előnézeted')}</b>
              <p>{t('Your designs will appear here, ready to compare.', 'Itt jelennek meg a terveid, összehasonlításra készen.')}</p>
              <Link className="btn" href="/app">
                {t('Make my first preview', 'Elkészítem az elsőt')}
              </Link>
            </div>
          )}
        </div>
      )}

      {tab === 'skin' && (
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
        <b style={{ display: 'block', fontSize: 14, margin: '14px 0 6px' }}>{t('Your age (makes the 30 and 50-year images more accurate)', 'Életkorod (pontosabb lesz a 30 és 50 éves kép)')}</b>
        <div className="row" style={{ gap: 6 }}>
          {['18-24', '25-34', '35-44', '45-54', '55+'].map((v) => (
            <button key={v} className={`chip ${ob?.age === v ? 'on' : ''}`} onClick={() => saveOb({ age: ob?.age === v ? '' : v })}>
              {v}
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

      )}
      {tab === 'invite' && (
      <div className="card" style={{ marginTop: 12 }}>
        <h2>{ui.t('profile.invite')}</h2>
        <p className="muted">{ui.t('profile.inviteSub')}</p>
        {me.user ? (
          <>
            <input className="text" id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} style={{ fontSize: 14, marginBottom: 10, color: 'var(--ink-2)' }} />
            <button className="btn wide" onClick={invite}>
              {t('Share invite link', 'Meghívó link megosztása')}
            </button>
            {joined !== null && (
              <p className="small muted" style={{ margin: '10px 0 0', textAlign: 'center' }}>
                {joined > 0
                  ? t(`${joined} friend${joined === 1 ? '' : 's'} joined · ${me.bonus ?? 0} bonus previews`, `${joined} barátod csatlakozott · ${me.bonus ?? 0} bónusz előnézet`)
                  : t('No one has joined with your link yet.', 'Még senki nem csatlakozott a linkeddel.')}
              </p>
            )}
          </>
        ) : (
          <button className="btn ghost wide" onClick={() => openAuth(t('Sign in to get your invite link.', 'Jelentkezz be a meghívó linkedért.'))}>
            {t('Sign in to get your link', 'Bejelentkezés a linkért')}
          </button>
        )}
      </div>

      )}
      {tab === 'settings' && (
        <>
      <div className="card" style={{ marginTop: 12 }}>
        <h2>{t('Help & feedback', 'Súgó és visszajelzés')}</h2>
        <div className="faq">
          {(
            [
              ['How accurate is the preview?', 'Mennyire pontos az előnézet?', 'It is an AI simulation based on how ink and skin usually age (spreading, fading, sun, skin changes). Real results depend on your artist, your skin and aftercare — use it to compare options, not as a guarantee.', 'MI-szimuláció, ami azon alapul, hogyan öregszik általában a tinta és a bőr (szétterülés, fakulás, nap, bőrváltozás). A valós eredmény a tetoválótól, a bőrödtől és az utókezeléstől függ – lehetőségek összevetésére használd, ne garanciaként.'],
              ['What happens to my photos?', 'Mi történik a fotóimmal?', 'They are used to make your preview. As a guest they stay on this device; signed in, they are stored privately in your account. Shared links only contain the two small images you chose to share. You can delete everything here in Profile.', 'Az előnézet elkészítéséhez használjuk őket. Vendégként ezen az eszközön maradnak, bejelentkezve privát módon a fiókodban. A megosztott link csak a két kis képet tartalmazza, amit megosztottál. Itt a Profilban mindent törölhetsz.'],
              ['The tattoo landed on my clothes / looks wrong', 'Ruhára került / rossz lett a tetoválás', 'Tap “Not right? Make it again” under the result and tick what went wrong — the next try avoids exactly that. A close, sharp daylight photo of bare skin gives the best results.', 'Koppints az eredmény alatt a „Nem lett jó? Újracsináljuk” gombra, és jelöld be, mi a baj – az új próbálkozás pont ezt kerüli el. A közeli, éles, nappali fényes fotó csupasz bőrről adja a legjobb eredményt.'],
              ['Is it free?', 'Ingyenes?', 'Yes, while we are in beta. There is a daily limit so it stays free for everyone.', 'Igen, a tesztidőszak alatt. Van egy napi keret, hogy mindenkinek ingyenes maradhasson.'],
            ] as const
          ).map(([qe, qh, ae, ah]) => (
            <details key={qe}>
              <summary>{t(qe, qh)}</summary>
              <p>{t(ae, ah)}</p>
            </details>
          ))}
        </div>
        <div className="seg" role="radiogroup" style={{ marginTop: 14 }}>
          {(
            [
              ['idea', t('Idea', 'Ötlet')],
              ['bug', t('Something’s broken', 'Hiba')],
              ['question', t('Question', 'Kérdés')],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={fbKind === k} className={fbKind === k ? 'on' : ''} onClick={() => setFbKind(k)}>
              {l}
            </button>
          ))}
        </div>
        <textarea className="notes" id="feedback" rows={3} maxLength={2000} style={{ marginTop: 10 }} placeholder={t('Tell us what you think or what went wrong…', 'Írd meg, mit gondolsz, vagy mi nem működött…')} value={fbMsg} onChange={(e) => setFbMsg(e.target.value)} />
        {!me.user && <input className="text" id="feedback-email" type="email" placeholder={t('Your e-mail, if you want a reply (optional)', 'E-mail-címed, ha választ kérsz (nem kötelező)')} value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} style={{ marginTop: 8 }} />}
        <button className="btn wide" style={{ marginTop: 10 }} disabled={fbBusy || fbMsg.trim().length < 3} onClick={sendFeedback}>
          {fbBusy ? '…' : t('Send', 'Küldés')}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <LangPicker
          lang={ui.lang}
          variant="row"
          onPick={(l) => {
            ui.setLang(l);
            if (me.user) sb()?.rpc('save_profile', { p_onboarding: me.onboarding ?? null, p_lang: l })?.then(() => {}, () => {});
          }}
        />
        {!installed && (
          <button className="list-row" onClick={install}>
            <span>
              {ui.t('profile.install')}
              <small>{t('Opens full screen, like a normal app', 'Teljes képernyőn nyílik, mint egy rendes app')}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        <Link className="list-row" href={ui.lang === 'hu' ? '/tudastar' : '/tudastar?lang=en'}>
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
        <button className="list-row" onClick={exportData}>
          <span>
            {t('Download my data', 'Adataim letöltése')}
            <small>{t('Your previews’ details and answers, as a file', 'Az előnézeteid adatai és a válaszaid, fájlban')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
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

        </>
      )}

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
    </div>
  );
}
