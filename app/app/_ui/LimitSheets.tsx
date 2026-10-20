'use client';
import { siteOrigin } from '@/lib/site';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { Sheet } from './Sheet';

/** Shown when this month's previews are used up. */
export function OutOfPreviews({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, ui, openAuth, toast } = useApp();
  const link = me.user ? `${siteOrigin()}/?ref=${me.user.id}` : '';
  return (
    <Sheet open={open} onClose={onClose} label="Out of previews">
      <h2>{ui.t('paywall.used')}</h2>
      <p className="sub">{ui.t('paywall.sub')}</p>
      {me.user ? (
        <>
          <div className="copybox">
            <input id="ref-link" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <button
            className="btn wide"
            onClick={async () => {
              try {
                if ((navigator as any).share) await (navigator as any).share({ url: link, title: 'InkAge' });
                else {
                  await navigator.clipboard.writeText(link);
                  toast(ui.t('profile.copied'));
                }
              } catch {}
            }}
          >
            {ui.t('profile.invite')}
          </button>
        </>
      ) : (
        <button className="btn wide" onClick={() => { onClose(); openAuth(tx(ui.lang, 'Sign in to get your invite link — every friend who joins gives you both a free preview.', 'Jelentkezz be a meghívó linkedért – minden csatlakozó barát után mindketten kaptok egy ingyenes előnézetet.')); }}>
          {tx(ui.lang, 'Sign in to get your invite link', 'Bejelentkezés a meghívó linkért')}
        </button>
      )}
    </Sheet>
  );
}

/** The daily safety cap was reached: let people leave an e-mail to hear when previews are back. */
export function Waitlist({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ui, me, toast } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open && me.user?.email) setEmail(me.user.email);
  }, [open, me.user?.email]);
  const join = async () => {
    const { data } = (await sb()?.rpc('join_waitlist', { p_email: email.trim(), p_lang: ui.lang })) || {};
    if (data) {
      setDone(true);
      toast(L('You’re on the list', 'Felírtunk'));
    } else toast(L('Check the e-mail address', 'Ellenőrizd az e-mail-címet'));
  };
  return (
    <Sheet open={open} onClose={onClose} label="Waitlist">
      <h2>{L('Today’s free previews are all used', 'Mára elfogytak az ingyenes előnézetek')}</h2>
      <p className="sub">
        {done
          ? L('Thanks! We’ll e-mail you as soon as you can make previews again.', 'Köszönjük! Írunk, amint újra készíthetsz előnézetet.')
          : L('So many people tried InkAge today that we paused new previews to keep it free. Leave your e-mail and we’ll tell you when it’s back — usually within a day.', 'Ma annyian kipróbálták az InkAge-et, hogy szüneteltetjük az új előnézeteket, hogy ingyenes maradhasson. Add meg az e-mail-címed, és szólunk, amint újra megy – általában egy napon belül.')}
      </p>
      {!done && (
        <>
          <input id="waitlist-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && join()} />
          <button className="btn wide" disabled={!/\S+@\S+\.\S+/.test(email)} onClick={join}>
            {L('Tell me when it’s back', 'Szóljatok, ha újra megy')}
          </button>
        </>
      )}
    </Sheet>
  );
}
