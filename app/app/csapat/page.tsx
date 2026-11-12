'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { track } from '@/lib/store';
import { Confirm } from '../_ui/Sheet';
import { StudioMeter, fmtDay, isNativeApp } from '../_ui/Studio';

/* /app/csapat — a studio's team (2026-11-12). The owner (the account with the subscription) invites by e-mail address:
   that makes a personal link /app/csapat?t=<token> to copy or send from their own mail app (we send nothing). A signed-in
   person who opens the link joins (one team per person); members' previews come from the owner's plan and the owner
   sees who used how many. Seats with the owner: Szalon 1, trial 2, Szalon Pro 5, Klinika 5. RPCs: b2b_team_* (DB). */

type Member = { id: number; email: string; memberEmail: string | null; joined: boolean; acceptedAt: string | null; createdAt: string; path: string | null; usedPeriod: number; usedTotal: number };
type TeamList =
  | { role: 'owner'; company: string | null; status: string; plan: string | null; seats: number; periodStart: string; canInvite: boolean; ownerUsedPeriod: number; members: Member[] }
  | { role: 'member'; company: string | null; ownerEmail: string | null; acceptedAt: string; usedTotal: number }
  | { role: null };
type Peek = { ok: boolean; company?: string | null; taken?: boolean; mine?: boolean; own?: boolean };

export default function TeamPage() {
  const { ui, me, toast, refreshMe } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [list, setList] = useState<TeamList | null>(null);
  const [token, setToken] = useState('');
  const [peek, setPeek] = useState<Peek | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ email: string; path: string } | null>(null);
  const [ask, setAsk] = useState<null | { kind: 'remove'; m: Member } | { kind: 'leave' }>(null);
  const native = isNativeApp();

  const load = useCallback(async () => {
    const s = sb();
    if (!s) return;
    const { data } = await s.rpc('b2b_team_list');
    setList((data as TeamList) || { role: null });
  }, []);

  useEffect(() => {
    const tk = new URLSearchParams(location.search).get('t') || '';
    setToken(tk);
    if (tk) sb()?.rpc('b2b_team_peek', { p_token: tk }).then(({ data }) => setPeek((data as Peek) || { ok: false }), () => setPeek({ ok: false }));
    if (me.user) load();
  }, [me.user, load]);

  const link = (path: string) => `${location.origin}${path}`;
  const copy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(link(path));
      toast(t('Link copied', 'Link másolva'));
    } catch {
      toast(t('Copy the link from the box.', 'Másold ki a linket a mezőből.'));
    }
  };
  const company = list && list.role ? list.company || '' : '';
  const mailto = (to: string, path: string) => {
    const subject = t('Join our studio on InkAge', 'Csatlakozz a szalonunkhoz az InkAge-ben');
    const body = t(
      `Hi! Open this link and sign in to use our studio's InkAge previews:\n${link(path)}`,
      `Szia! Nyisd meg ezt a linket, és jelentkezz be, hogy a szalonunk InkAge-előnézeteit használhasd:\n${link(path)}`
    );
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const invite = async () => {
    const s = sb();
    if (!s || busy) return;
    setBusy(true);
    const { data, error } = await s.rpc('b2b_team_invite', { p_email: email });
    setBusy(false);
    const r = data as { ok: boolean; reason?: string; path?: string } | null;
    if (error || !r) return toast(t('That did not work. Try again.', 'Nem sikerült. Próbáld újra.'));
    if (!r.ok) {
      const why: Record<string, string> = {
        email: t('Check the e-mail address.', 'Nézd meg az e-mail-címet.'),
        own: t('That is your own address.', 'Ez a saját címed.'),
        seats: t('Every seat of your plan is taken.', 'A csomagod minden helye foglalt.'),
        inactive: t('Inviting works while the trial or the subscription is on.', 'Meghívni a próba vagy az előfizetés alatt lehet.'),
        not_owner: t('Only the account with the subscription can invite.', 'Csak az előfizetés fiókja hívhat meg.'),
      };
      return toast(why[r.reason || ''] || t('That did not work. Try again.', 'Nem sikerült. Próbáld újra.'));
    }
    track('team_invite');
    setMade({ email: email.trim(), path: r.path! });
    setEmail('');
    load();
  };

  const join = async () => {
    const s = sb();
    if (!s || busy) return;
    setBusy(true);
    const { data } = await s.rpc('b2b_team_join', { p_token: token });
    setBusy(false);
    const r = data as { ok: boolean; reason?: string } | null;
    if (!r?.ok) {
      const why: Record<string, string> = {
        not_found: t('This invite link is not valid any more.', 'Ez a meghívó link már nem érvényes.'),
        taken: t('Someone already joined with this link. Ask for a new one.', 'Ezzel a linkkel már csatlakozott valaki. Kérj újat.'),
        own: t('This is your own studio’s link.', 'Ez a saját szalonod linkje.'),
        studio: t('This account has its own studio plan, so it cannot join another team.', 'Ennek a fióknak saját szalonos előfizetése van, ezért nem csatlakozhat másik csapathoz.'),
        other_team: t('You are already in a team. Leave it first.', 'Már egy csapat tagja vagy. Előbb lépj ki belőle.'),
        seats: t('The studio’s seats are all taken.', 'A szalon minden helye foglalt.'),
      };
      return toast(why[r?.reason || ''] || t('That did not work. Try again.', 'Nem sikerült. Próbáld újra.'));
    }
    track('team_join');
    toast(t('You joined the team.', 'Csatlakoztál a csapathoz.'));
    history.replaceState(null, '', '/app/csapat');
    setToken('');
    setPeek(null);
    await refreshMe();
    load();
  };

  const confirmed = async () => {
    const s = sb();
    const a = ask;
    setAsk(null);
    if (!s || !a) return;
    if (a.kind === 'remove') {
      await s.rpc('b2b_team_remove', { p_id: a.m.id });
      track('team_remove');
      toast(t('Removed from the team', 'Eltávolítva a csapatból'));
    } else {
      await s.rpc('b2b_team_leave');
      track('team_leave');
      toast(t('You left the team', 'Kiléptél a csapatból'));
    }
    await refreshMe();
    load();
  };

  // ---------------------------------------------------------------- an invite link, before joining
  if (token && peek && list?.role !== 'owner' && !peek.mine) {
    return (
      <div className="pagefade">
        <p className="kicker">{t('Team invite', 'Csapatmeghívó')}</p>
        <h1>{peek.ok ? peek.company || t('A studio', 'Egy szalon') : t('Invite link', 'Meghívó link')}</h1>
        {!peek.ok ? (
          <p className="sub">{t('This invite link is not valid any more. Ask the studio for a new one.', 'Ez a meghívó link már nem érvényes. Kérj újat a szalontól.')}</p>
        ) : peek.taken ? (
          <p className="sub">{t('Someone already joined with this link. Ask the studio for a new one.', 'Ezzel a linkkel már csatlakozott valaki. Kérj újat a szalontól.')}</p>
        ) : peek.own ? (
          <p className="sub">{t('This is your own studio’s invite link. Send it to the person you invited.', 'Ez a saját szalonod meghívó linkje. Küldd el annak, akit meghívtál.')}</p>
        ) : (
          <>
            <p className="sub">
              {t(
                'invited you to their team on InkAge. Your previews will come from the studio’s plan, and the studio sees how many you made.',
                'meghívott a csapatába az InkAge-ben. Az előnézeteid a szalon előfizetéséből jönnek, és a szalon látja, hányat készítettél.'
              )}
            </p>
            <button className="btn wide" onClick={join} disabled={busy}>
              {busy ? t('Joining…', 'Csatlakozás…') : t('Join the team', 'Csatlakozom')}
            </button>
          </>
        )}
      </div>
    );
  }

  if (!list) return <div className="pagefade" aria-busy="true" />;

  // ---------------------------------------------------------------- the owner
  if (list.role === 'owner') {
    const used = list.members.filter((m) => m.joined || m.path).length + 1;
    return (
      <div className="pagefade">
        <p className="kicker">{company || t('Studio', 'Szalon')}</p>
        <h1>{t('Team', 'Csapat')}</h1>
        <p className="sub">
          {list.seats > 1
            ? t(`${used} of ${list.seats} seats in use, you included. Your team’s previews come from your plan.`, `${list.seats} helyből ${used} foglalt, veled együtt. A csapat előnézetei a te előfizetésedből jönnek.`)
            : t('Your plan is for one person: you.', 'A csomagod egy személyre szól: rád.')}
        </p>
        <StudioMeter where="profile" />

        <h3 style={{ marginTop: 20 }}>{t('Who used how many', 'Ki mennyit használt')}</h3>
        <p className="muted small" style={{ margin: '0 0 4px' }}>
          {t(`Since ${fmtDay(ui.lang, list.periodStart)}`, `${fmtDay(ui.lang, list.periodStart)} óta`)}
        </p>
        <div className="team-list">
          <div className="team-row">
            <div>
              <b>{me.user?.email || t('You', 'Te')}</b>
              <small>{t('Account owner', 'Fiókgazda')}</small>
            </div>
            <small>{t(`${list.ownerUsedPeriod} previews`, `${list.ownerUsedPeriod} előnézet`)}</small>
          </div>
          {list.members.map((m) => (
            <div className="team-row" key={m.id}>
              <div>
                <b>{m.memberEmail || m.email}</b>
                <small>
                  {m.joined
                    ? t(`${m.usedPeriod} previews · ${m.usedTotal} in all`, `${m.usedPeriod} előnézet · összesen ${m.usedTotal}`)
                    : t('Invited, not joined yet', 'Meghívva, még nem csatlakozott')}
                </small>
                {!m.joined && m.path && (
                  <span className="row" style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button className="chipbtn" onClick={() => copy(m.path!)}>{t('Copy link', 'Link másolása')}</button>
                    <a className="chipbtn" href={mailto(m.email, m.path)}>{t('Send by e-mail', 'Küldés e-mailben')}</a>
                  </span>
                )}
              </div>
              <button className="chipbtn" onClick={() => setAsk({ kind: 'remove', m })}>
                {m.joined ? t('Remove', 'Eltávolítás') : t('Cancel', 'Visszavonás')}
              </button>
            </div>
          ))}
        </div>

        {made && (
          <div className="team-link" role="status">
            <b>{t(`Invite link for ${made.email}`, `Meghívó link: ${made.email}`)}</b>
            <code>{link(made.path)}</code>
            <div className="row">
              <button className="chipbtn" onClick={() => copy(made.path)}>{t('Copy link', 'Link másolása')}</button>
              <a className="chipbtn" href={mailto(made.email, made.path)}>{t('Send by e-mail', 'Küldés e-mailben')}</a>
            </div>
            <small className="muted">{t('The link works once: the first signed-in person who opens it joins.', 'A link egyszer használható: az első bejelentkezett ember csatlakozik vele, aki megnyitja.')}</small>
          </div>
        )}

        {list.canInvite ? (
          <div className="team-invite">
            <h3 style={{ margin: '12px 0 0' }}>{t('Invite a colleague', 'Kolléga meghívása')}</h3>
            <input type="email" inputMode="email" autoComplete="off" placeholder={t('colleague@example.com', 'kollega@pelda.hu')} value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && invite()} />
            <button className="btn wide" onClick={invite} disabled={busy || !email.includes('@')}>
              {busy ? t('Making the link…', 'Link készül…') : t('Make an invite link', 'Meghívó link készítése')}
            </button>
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: 12 }}>
            {list.status !== 'trial' && list.status !== 'active' && list.status !== 'past_due'
              ? t('Inviting works while the trial or the subscription is on.', 'Meghívni a próba vagy az előfizetés alatt lehet.')
              : list.seats > 1
                ? t('Every seat of your plan is taken.', 'A csomagod minden helye foglalt.')
                : t('Szalon Pro and Klinika have room for 5 people.', 'A Szalon Pro és a Klinika csomagban 5 ember fér el.')}
            {!native && (list.seats <= 1 || used >= list.seats) && (
              <>
                {' '}
                <a href="/szalonoknak#csomagok">{t('Plans', 'Csomagok')}</a>
              </>
            )}
          </p>
        )}
        <Confirm
          open={!!ask}
          title={ask?.kind === 'remove' ? (ask.m.joined ? t('Remove from the team?', 'Eltávolítod a csapatból?') : t('Cancel this invite?', 'Visszavonod a meghívót?')) : ''}
          text={ask?.kind === 'remove' && ask.m.joined ? t('Their previews will come from their own account again. What they made stays counted on yours.', 'Az előnézetei újra a saját fiókjából jönnek. Amit eddig készített, az a tiédben marad elszámolva.') : undefined}
          yes={ask?.kind === 'remove' && ask.m.joined ? t('Remove', 'Eltávolítás') : t('Cancel invite', 'Visszavonás')}
          no={t('Keep', 'Mégse')}
          onYes={confirmed}
          onClose={() => setAsk(null)}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- a member
  if (list.role === 'member') {
    return (
      <div className="pagefade">
        <p className="kicker">{t('Team', 'Csapat')}</p>
        <h1>{company || t('Your studio', 'A szalonod')}</h1>
        <p className="sub">
          {t('You are in this studio’s team. Your previews come from the studio’s plan', 'Ennek a szalonnak a csapatában vagy. Az előnézeteid a szalon előfizetéséből jönnek')}
          {list.ownerEmail ? t(` (account owner: ${list.ownerEmail}).`, ` (fiókgazda: ${list.ownerEmail}).`) : '.'}
        </p>
        <StudioMeter where="profile" />
        <p className="muted small">{t(`You made ${list.usedTotal} previews in this team.`, `Ebben a csapatban ${list.usedTotal} előnézetet készítettél.`)}</p>
        <button className="btn wide ghost" style={{ marginTop: 12 }} onClick={() => setAsk({ kind: 'leave' })}>
          {t('Leave the team', 'Kilépés a csapatból')}
        </button>
        <Confirm
          open={!!ask}
          title={t('Leave the team?', 'Kilépsz a csapatból?')}
          text={t('Your previews will come from your own account again.', 'Az előnézeteid újra a saját fiókodból jönnek.')}
          yes={t('Leave', 'Kilépek')}
          no={t('Stay', 'Maradok')}
          onYes={confirmed}
          onClose={() => setAsk(null)}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- not a studio account
  return (
    <div className="pagefade">
      <p className="kicker">{t('Team', 'Csapat')}</p>
      <h1>{t('Studio teams', 'Szalonos csapat')}</h1>
      <p className="sub">{t('This page is for tattoo studios and laser clinics with an InkAge plan. If a studio invited you, open the link they sent.', 'Ez az oldal az InkAge-előfizetéssel rendelkező tetoválószalonoknak és lézerklinikáknak szól. Ha egy szalon meghívott, nyisd meg a tőle kapott linket.')}</p>
      {!native && (
        <Link className="btn wide ghost" href="/szalonoknak">
          {t('Plans for studios', 'Csomagok szalonoknak')}
        </Link>
      )}
    </div>
  );
}
