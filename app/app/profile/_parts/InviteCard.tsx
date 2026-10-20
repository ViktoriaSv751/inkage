'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';

/** The Invite tab: your link and how many friends joined with it. */
export function InviteCard({ link, invite, joined }: { link: string; invite: () => void; joined: number | null }) {
  const { ui, me, openAuth } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
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
  );
}
