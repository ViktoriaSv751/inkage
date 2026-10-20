'use client';
import { siteOrigin } from '@/lib/site';
import { qOf } from '@/lib/tr';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { cloud, local, lsGet, lsSet, Preview, track, shares } from '@/lib/store';
import type { OnboardingAnswers } from '../create/Onboarding';
import { MyShares } from './MyShares';
import { UvCard } from './UvCard';
import { useInstall } from './_parts/useInstall';
import { useFeedback } from './_parts/useFeedback';
import { useAccount } from './_parts/useAccount';
import { packMyData } from './_parts/dataExport';
import { eraseAccount } from './_parts/eraseAccount';
import { ProfileHeader } from './_parts/ProfileHeader';
import { ProfileTabs, type Tab } from './_parts/ProfileTabs';
import { PreviewsPanel } from './_parts/PreviewsPanel';
import { SkinCard } from './_parts/SkinCard';
import { InviteCard } from './_parts/InviteCard';
import { FeedbackCard } from './_parts/FeedbackCard';
import { SettingsCard } from './_parts/SettingsCard';
import { EditProfileSheet, EraseSheet, InstallSheet, SignOutConfirm } from './_parts/ProfileSheets';

export default function ProfilePage() {
  const { ui, me, toast, profile } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [erase, setErase] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [tab, setTab] = useState<Tab>('previews');
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<Preview[] | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const fb = useFeedback();
  // account: name and picture (they live in the app state, so the top bar updates too); e-mail and password belong
  // to the Google / Apple account the person signs in with
  const meta = profile;
  const acc = useAccount();
  const [notifyOn, setNotifyOn] = useState(true);
  useEffect(() => setNotifyOn(me.notifyVotes !== false), [me.notifyVotes]);

  useEffect(() => {
    if (me.user) sb()?.rpc('my_invites').then(({ data }) => setJoined((data as any)?.joined ?? null));
  }, [me.user]);
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
    await packMyData(data, mine);
    setBusy(false);
  };
  const [ob, setOb] = useState<OnboardingAnswers | null>(null);

  useEffect(() => {
    (async () => {
      const c: Preview[] = [];
      // the newest few first, so the tiles show right away; the rest (for the numbers) after
      if (me.user) {
        const first = await cloud.all(0, 8).catch(() => [] as Preview[]);
        if (first.length) setMine((m) => m || first);
        if (first.length < 8) {
          c.push(...first);
          const l = await local.all().catch(() => []);
          return setMine([...c, ...l]);
        }
      }
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

  // add to home screen (install prompt or the how-to sheet)
  const { installed, ios, howto, setHowto, install } = useInstall();

  const link = me.user ? `${siteOrigin()}/?ref=${me.user.id}` : '';
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

  const [askOut, setAskOut] = useState(false);
  const signOut = () => setAskOut(true);
  const doSignOut = async () => {
    setAskOut(false);
    const { coverSplash, markSplash } = await import('@/lib/splash');
    coverSplash();
    markSplash('out');
    const started = Date.now();
    // only this device: signing out here must not sign you out (and empty the gallery) on your other devices
    await Promise.resolve(sb()?.auth.signOut({ scope: 'local' })).catch(() => {});
    await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))));
    location.replace(`/belepes${qOf(ui.lang)}`);
  };

  const eraseAll = async () => {
    const s = sb();
    if (!s || !me.user) return;
    setBusy(true);
    try {
      const uid = me.user.id;
      await eraseAccount(s, uid);
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
      <ProfileHeader displayName={displayName} initial={initial} mine={mine} avg={avg} invite={invite} setTab={setTab} openEdit={acc.openEdit} signOut={signOut} setErase={setErase} />

      <ProfileTabs tab={tab} setTab={setTab} />

      {tab === 'previews' && <PreviewsPanel mine={mine} best={best} topPlace={topPlace} />}

      {tab === 'previews' && <MyShares />}

      {tab === 'skin' && <SkinCard ob={ob} saveOb={saveOb} />}
      {tab === 'skin' && <UvCard />}
      {tab === 'invite' && <InviteCard link={link} invite={invite} joined={joined} />}
      {tab === 'settings' && (
        <>
          <FeedbackCard fb={fb} />
          <SettingsCard notifyOn={notifyOn} setNotifyOn={setNotifyOn} installed={installed} install={install} busy={busy} exportData={exportData} signOut={signOut} setErase={setErase} />
        </>
      )}

      <p className="disclaimer">InkAge · {t('AI simulations for inspiration, not a guarantee.', 'MI-szimulációk inspirációnak, nem garancia.')}</p>

      <InstallSheet howto={howto} setHowto={setHowto} ios={ios} />

      <EditProfileSheet acc={acc} initial={initial} />

      <SignOutConfirm askOut={askOut} setAskOut={setAskOut} doSignOut={doSignOut} />
      <EraseSheet erase={erase} setErase={setErase} confirm={confirm} setConfirm={setConfirm} busy={busy} eraseAll={eraseAll} />
    </div>
  );
}
