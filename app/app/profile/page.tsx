'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { LangPicker } from '../../LangPicker';
import { tx } from '@/lib/i18n';
import { api, sb } from '@/lib/sb';
import { anonId, cloud, local, lsGet, lsSet, Preview, track, shares, revokeGuestShare } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { placeName } from '../create/steps';
import type { OnboardingAnswers } from '../create/Onboarding';
import { MyShares } from './MyShares';
import { UvCard } from './UvCard';
import { PushRow } from './PushRow';

const ADMIN = ['vviktoriasoti@gmail.com'];

export default function ProfilePage() {
  const { ui, me, openAuth, toast, refreshMe, profile, setProfile } = useApp();
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
  // account: name, picture, e-mail, password (name and picture live in the app state, so the top bar updates too)
  const meta = profile;
  const [editOpen, setEditOpen] = useState(false);
  const [nameIn, setNameIn] = useState('');
  const [emailIn, setEmailIn] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [pwShow, setPwShow] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [accBusy, setAccBusy] = useState('');
  const [notifyOn, setNotifyOn] = useState(true);
  useEffect(() => setNotifyOn(me.notifyVotes !== false), [me.notifyVotes]);
  const openEdit = () => {
    setNameIn(meta.name);
    setEmailIn(me.user?.email || '');
    setPw({ cur: '', next: '', again: '' });
    setPwErr('');
    setEditOpen(true);
  };
  const saveName = async () => {
    const name = nameIn.trim().slice(0, 60);
    setAccBusy('name');
    const { error } = (await sb()?.auth.updateUser({ data: { full_name: name } })) || {};
    setAccBusy('');
    if (error) return toast(t('Could not save your name. Try again.', 'Nem sikerült menteni a nevet. Próbáld újra.'));
    setProfile({ name });
    toast(t('Saved', 'Mentve'));
  };
  const saveEmail = async () => {
    const e = emailIn.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast(t('That e-mail address does not look right.', 'Ez az e-mail-cím nem tűnik helyesnek.'));
    if (e === (me.user?.email || '').toLowerCase()) return;
    setAccBusy('email');
    const { error } = (await sb()?.auth.updateUser({ email: e }, { emailRedirectTo: `${location.origin}/app/profile` })) || {};
    setAccBusy('');
    if (error) return toast(/registered|exists|already/i.test(error.message) ? t('This e-mail is already used by another account.', 'Ezt az e-mail-címet már egy másik fiók használja.') : t('Could not change the e-mail. Try again.', 'Nem sikerült módosítani az e-mail-címet. Próbáld újra.'));
    setProfile({ pendingEmail: e });
    toast(t('Check both inboxes and confirm the change.', 'Nézd meg mindkét postafiókot, és erősítsd meg a módosítást.'));
  };
  /** What is wrong with the new password, or '' when it is fine. */
  const pwProblem = (p: string) =>
    p.length < 8
      ? t('At least 8 characters.', 'Legalább 8 karakter legyen.')
      : !/[a-zA-ZÀ-ž]/.test(p) || !/\d/.test(p)
        ? t('Use letters and at least one number.', 'Legyen benne betű és legalább egy szám.')
        : '';
  const savePassword = async () => {
    const s = sb();
    if (!s || !me.user?.email) return;
    setPwErr('');
    if (meta.hasPassword && !pw.cur) return setPwErr(t('Enter your current password.', 'Add meg a jelenlegi jelszavad.'));
    const bad = pwProblem(pw.next);
    if (bad) return setPwErr(bad);
    if (pw.next !== pw.again) return setPwErr(t('The two new passwords do not match.', 'A két új jelszó nem egyezik.'));
    if (meta.hasPassword && pw.cur === pw.next) return setPwErr(t('The new password must differ from the current one.', 'Az új jelszó legyen más, mint a jelenlegi.'));
    setAccBusy('pw');
    // the current password is checked first: someone at an unlocked phone cannot take over the account
    if (meta.hasPassword) {
      const { error } = await s.auth.signInWithPassword({ email: me.user.email, password: pw.cur });
      if (error) {
        setAccBusy('');
        return setPwErr(t('The current password is not right.', 'A jelenlegi jelszó nem helyes.'));
      }
    }
    const { error } = await s.auth.updateUser({ password: pw.next });
    setAccBusy('');
    if (error) return setPwErr(/same|different/i.test(error.message) ? t('The new password must differ from the current one.', 'Az új jelszó legyen más, mint a jelenlegi.') : t('Could not change the password. Sign in again and retry.', 'Nem sikerült módosítani a jelszót. Lépj be újra, és próbáld meg ismét.'));
    setPw({ cur: '', next: '', again: '' });
    setProfile({ hasPassword: true });
    toast(t('Password changed', 'Jelszó módosítva'));
  };
  const pickAvatar = async (file: File) => {
    if (!me.user) return;
    setAccBusy('avatar');
    try {
      const { shrink } = await import('@/lib/store');
      const url = URL.createObjectURL(await import('@/lib/client').then((m) => m.decodable(file)));
      const blob = await shrink(url, 512, 0.86);
      URL.revokeObjectURL(url);
      const path = `${me.user.id}/profile/avatar.jpg`;
      const s = sb()!;
      const up = await s.storage.from('previews').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      await s.auth.updateUser({ data: { avatar_path: path } });
      const signed = (await s.storage.from('previews').createSignedUrl(path, 60 * 60 * 24)).data?.signedUrl ?? null;
      setProfile({ avatar: signed ? `${signed}&v=${Date.now()}` : null });
      toast(t('Profile picture updated', 'Profilkép frissítve'));
    } catch {
      toast(t('Could not upload the picture. Try another one.', 'Nem sikerült feltölteni a képet. Próbálj másikat.'));
    }
    setAccBusy('');
  };
  const removeAvatar = async () => {
    if (!me.user) return;
    const s = sb()!;
    await s.storage.from('previews').remove([`${me.user.id}/profile/avatar.jpg`]);
    await s.auth.updateUser({ data: { avatar_path: null } });
    setProfile({ avatar: null });
  };

  useEffect(() => {
    if (me.user) sb()?.rpc('my_invites').then(({ data }) => setJoined((data as any)?.joined ?? null));
  }, [me.user]);
  const sendFeedback = async () => {
    setFbBusy(true);
    const r = await api('/api/feedback', { kind: fbKind, message: fbMsg.trim(), email: fbEmail || me.user?.email || '', anon: anonId(), page: `app · ${navigator.userAgent.slice(0, 110)}` });
    const data = r.ok;
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
      shares: shares.all(),
      previews: (mine || []).map((p) => ({ id: p.id, mode: p.mode ?? 'new', created_at: p.created_at, placement: p.placement, size: p.size, score: p.score, notes: p.notes, favorite: p.favorite, folder: p.collection, done_at: p.doneAt ?? null, source: p.source })),
    };
    track('data_export');
    setBusy(true);
    try {
      const { zipSync, strToU8 } = await import('fflate');
      const files: Record<string, Uint8Array> = { 'adataim.json': strToU8(JSON.stringify(data, null, 2)) };
      for (const p of mine || []) {
        const day = p.created_at.slice(0, 10);
        const all: [string, string | undefined][] = [...Object.entries(p.images), ...Object.entries(p.removal || {}), ['design', p.design], ...(p.real || []).map((r, i) => [`valodi-${i + 1}`, r.src] as [string, string])];
        for (const [k, src] of all) {
          if (!src) continue;
          try {
            const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
            files[`elonezetek/${day}-${p.id.slice(0, 6)}/${k}.${k === 'design' ? 'png' : 'jpg'}`] = buf;
          } catch {}
        }
      }
      const zip = zipSync(files, { level: 0 });
      await shareOrDownload(new Blob([zip], { type: 'application/zip' }), 'inkage-adataim.zip');
    } catch {
      await shareOrDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'inkage-adataim.json');
    }
    setBusy(false);
  };
  const [ob, setOb] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    (async () => {
      const c: Preview[] = [];
      if (me.user) for (let from = 0; ; from += 120) {
        const page = await cloud.all(from, 120).catch(() => [] as Preview[]);
        c.push(...page);
        if (page.length < 120) break;
      }
      const l = await local.all().catch(() => []);
      setMine([...c, ...l]);
    })();
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
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true || !!(window as any).Capacitor?.isNativePlatform?.());
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
    // only this device: signing out here must not sign you out (and empty the gallery) on your other devices
    await sb()?.auth.signOut({ scope: 'local' });
    location.replace(`/belepes${qOf(ui.lang)}`);
  };

  const eraseAll = async () => {
    const s = sb();
    if (!s || !me.user) return;
    setBusy(true);
    try {
      const uid = me.user.id;
      // vote links made on this device without an account
      for (const x of shares.all()) if (x.kind !== 'preview') await revokeGuestShare(x.id).catch(() => false);
      const { error } = await s.rpc('erase_my_account');
      if (error) throw error;
      for (const bucket of ['previews', 'shares']) {
        const { data: dirs } = await s.storage.from(bucket).list(uid, { limit: 1000 });
        for (const d of dirs || []) {
          const { data: files } = await s.storage.from(bucket).list(`${uid}/${d.name}`, { limit: 1000 });
          const paths = (files || []).map((f) => `${uid}/${d.name}/${f.name}`);
          if (paths.length) await s.storage.from(bucket).remove(paths);
        }
      }

      lsSet('ink_shares', []);
      lsSet('ink_posts', []);
      const mine = await local.all().catch(() => []);
      for (const p of mine) await local.remove(p.id);
      ['ink_onboarding', 'ink_ref', 'ink_folders', 'ink_recent_photos'].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      await s.auth.signOut({ scope: 'local' });
      setErase(false);
      location.replace(`/${qOf(ui.lang)}`);
      toast(t('Your account and data were deleted.', 'A fiókodat és az adataidat töröltük.'));
    } catch {
      toast(t('Deleting failed. Try again or email us.', 'A törlés nem sikerült. Próbáld újra, vagy írj nekünk.'));
    }
    setBusy(false);
  };

  const initial = (meta.name || me.user?.email || '?').slice(0, 1).toUpperCase();
  const displayName = meta.name || (() => {
    const n = (me.user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
    return n ? n.replace(/\b\w/g, (c) => c.toUpperCase()) : t('My profile', 'Profilom');
  })();

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
          {meta.avatar ? <img src={meta.avatar} alt="" /> : <span>{me.user ? initial : '✦'}</span>}
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
        <h1>{me.user ? displayName : ''}</h1>
        <p className="pf-sub">{me.user ? (meta.pendingEmail ? `${me.user.email} → ${meta.pendingEmail} (${t('to confirm', 'megerősítésre vár')})` : me.user.email) : t('Sign in to keep your designs on every device', 'Jelentkezz be, hogy minden eszközön meglegyenek a terveid')}</p>
        {me.user ? (
          <div className="pf-acts">
            <button className="pf-edit" onClick={openEdit}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
              </svg>
              {t('Edit profile', 'Szerkesztés')}
            </button>
            <button className="pf-edit" onClick={signOut}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>
              {t('Sign out', 'Kijelentkezés')}
            </button>
            <button className="pf-edit danger" onClick={() => setErase(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
              </svg>
              {t('Delete account', 'Fiók törlése')}
            </button>
          </div>
        ) : (
          <Link className="pf-edit dark" href={`/belepes${qOf(ui.lang)}`}>
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
            <span>{t('left this month', 'maradt e hónapban')}</span>
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
                    {(p.images.fresh || p.images.y50) && <img src={p.images.fresh || p.images.y50} alt="" loading="lazy" />}
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

      {tab === 'previews' && <MyShares />}

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
      {tab === 'skin' && <UvCard />}
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
              ['What happens to my photos?', 'Mi történik a fotóimmal?', 'They are used to make your preview and are stored privately in your account. Shared links only contain the small images you chose to share. You can delete everything here in Profile.', 'Az előnézet elkészítéséhez használjuk őket, és privát módon a fiókodban tároljuk. A megosztott link csak azokat a kis képeket tartalmazza, amiket megosztottál. Itt a Profilban mindent törölhetsz.'],
              ['The tattoo landed on my clothes / looks wrong', 'Ruhára került / rossz lett a tetoválás', 'Tap “Not right? Make it again” under the result and tick what went wrong — the next try avoids exactly that. A close, sharp daylight photo of bare skin gives the best results.', 'Koppints az eredmény alatt a „Nem lett jó? Újracsináljuk” gombra, és jelöld be, mi a baj – az új próbálkozás pont ezt kerüli el. A közeli, éles, nappali fényes fotó csupasz bőrről adja a legjobb eredményt.'],
              ['Is it free?', 'Ingyenes?', 'Yes, after you sign up. You get 30 previews a month.', 'Igen, regisztráció után. Havonta 30 előnézet jár.'],
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
          onPick={async (l) => {
            // saved to the account first (e-mails in that language), then the app reloads in it
            if (me.user) await Promise.resolve(sb()?.rpc('save_profile', { p_onboarding: me.onboarding ?? null, p_lang: l })).catch(() => {});
            ui.setLang(l);
          }}
        />
        {me.user && (
          <label className="list-row" style={{ cursor: 'pointer' }}>
            <span>
              {t('Tell me when friends vote', 'Szólj, ha szavaznak a linkemre')}
              <small>{t('E-mail and phone notification, at most once an hour per link', 'E-mail és telefonos értesítés, linkenként legfeljebb óránként egyszer')}</small>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={notifyOn}
              onChange={async (e) => {
                const on = e.target.checked;
                setNotifyOn(on);
                const { error } = (await sb()?.rpc('set_notify_votes', { p_on: on })) || {};
                if (error) {
                  setNotifyOn(!on);
                  toast(t('Could not save. Try again.', 'Nem sikerült menteni. Próbáld újra.'));
                }
              }}
            />
          </label>
        )}
        {me.user && <PushRow onInstallHelp={install} />}
        {!installed && (
          <button className="list-row" onClick={install}>
            <span>
              {ui.t('profile.install')}
              <small>{t('Opens full screen, like a normal app', 'Teljes képernyőn nyílik, mint egy rendes app')}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        <Link className="list-row" href={`/tudastar${qOf(ui.lang)}`}>
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
            {busy ? t('Packing your data…', 'Adatok csomagolása…') : t('Download my data', 'Adataim letöltése')}
            <small>{t('All previews with images, notes and answers, as a ZIP', 'Minden előnézet képekkel, jegyzetekkel és válaszokkal, ZIP-ben')}</small>
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

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} label={t('Edit profile', 'Profil szerkesztése')}>
        <h2>{t('Edit profile', 'Profil szerkesztése')}</h2>
        <div className="acc-avatar">
          <div className="pf-avatar sm">{meta.avatar ? <img src={meta.avatar} alt="" /> : <span>{initial}</span>}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label className="chipbtn" style={{ cursor: 'pointer' }}>
              {accBusy === 'avatar' ? t('Uploading…', 'Feltöltés…') : t('Upload a picture', 'Kép feltöltése')}
              <input type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])} />
            </label>
            {meta.avatar && (
              <button className="chipbtn" onClick={removeAvatar}>
                {t('Remove', 'Eltávolítás')}
              </button>
            )}
          </div>
        </div>
        <label className="acc-field">
          <span>{t('Name', 'Név')}</span>
          <div className="acc-row">
            <input className="text" value={nameIn} maxLength={60} onChange={(e) => setNameIn(e.target.value)} placeholder={t('Your name', 'A neved')} />
            <button className="btn" disabled={accBusy === 'name' || nameIn.trim() === meta.name} onClick={saveName}>
              {t('Save', 'Mentés')}
            </button>
          </div>
        </label>
        <label className="acc-field">
          <span>{t('E-mail', 'E-mail-cím')}</span>
          <div className="acc-row">
            <input className="text" type="email" value={emailIn} onChange={(e) => setEmailIn(e.target.value)} />
            <button className="btn" disabled={accBusy === 'email' || emailIn.trim() === (me.user?.email || '')} onClick={saveEmail}>
              {t('Change', 'Módosítás')}
            </button>
          </div>
          {meta.pendingEmail ? (
            <small className="acc-pending">
              {t(`Waiting for confirmation: ${meta.pendingEmail}. Open the link we sent to both addresses; until then you sign in with the current one.`, `Megerősítésre vár: ${meta.pendingEmail}. Nyisd meg a linket, amit mindkét címre elküldtünk; addig a mostanival lépsz be.`)}
            </small>
          ) : (
            <small className="muted">{t('We send a confirmation link to both addresses.', 'Mindkét címre küldünk egy megerősítő linket.')}</small>
          )}
        </label>
        <div className="acc-field">
          <span>{meta.hasPassword ? t('Change password', 'Jelszó módosítása') : t('Set a password', 'Jelszó beállítása')}</span>
          {!meta.hasPassword && <small className="muted">{t('You sign in with Google or Apple. With a password you can also sign in with your e-mail.', 'Google-lel vagy Apple-lel lépsz be. Jelszóval az e-mail-címeddel is be tudsz lépni.')}</small>}
          <div className="acc-pw">
            {meta.hasPassword && (
              <input className="text" type={pwShow ? 'text' : 'password'} autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} placeholder={t('Current password', 'Jelenlegi jelszó')} aria-label={t('Current password', 'Jelenlegi jelszó')} />
            )}
            <input className="text" type={pwShow ? 'text' : 'password'} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder={t('New password (8+ characters, a number)', 'Új jelszó (min. 8 karakter, egy szám)')} aria-label={t('New password', 'Új jelszó')} />
            <input className="text" type={pwShow ? 'text' : 'password'} autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} placeholder={t('New password again', 'Új jelszó még egyszer')} aria-label={t('New password again', 'Új jelszó még egyszer')} />
            <label className="acc-show">
              <input type="checkbox" checked={pwShow} onChange={(e) => setPwShow(e.target.checked)} /> {t('Show passwords', 'Jelszavak mutatása')}
            </label>
            {pw.next && !pwErr && pwProblem(pw.next) && <small className="muted">{pwProblem(pw.next)}</small>}
            {pw.again && pw.next !== pw.again && !pwErr && <small className="muted">{t('The two new passwords do not match yet.', 'A két új jelszó még nem egyezik.')}</small>}
            {pwErr && <p className="acc-err" role="alert">{pwErr}</p>}
            <button className="btn wide" disabled={accBusy === 'pw' || !pw.next || !pw.again || (meta.hasPassword && !pw.cur)} onClick={savePassword}>
              {accBusy === 'pw' ? t('Saving…', 'Mentés…') : meta.hasPassword ? t('Change password', 'Jelszó módosítása') : t('Set password', 'Jelszó beállítása')}
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={erase} onClose={() => setErase(false)} label={ui.t('profile.erase')}>
        <h2>{ui.t('profile.erase')}</h2>
        <p className="sub">{ui.t('profile.eraseConfirm')}</p>
        <input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('DELETE', 'TÖRLÉS')} autoCapitalize="characters" />
        <button className="btn wide red" disabled={![...['DELETE', 'TÖRLÉS', 'TORLES'], t('DELETE', 'TÖRLÉS').toUpperCase()].includes(confirm.trim().toUpperCase()) || busy} onClick={eraseAll}>
          {busy ? '…' : t('Delete everything', 'Mindent törlök')}
        </button>
      </Sheet>
    </div>
  );
}
