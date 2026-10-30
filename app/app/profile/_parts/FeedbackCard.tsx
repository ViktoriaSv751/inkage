'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { useFeedback } from './useFeedback';

/** Help & feedback: a short FAQ and the message form. */
export function FeedbackCard({ fb }: { fb: ReturnType<typeof useFeedback> }) {
  const { ui, me } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const { fbKind, setFbKind, fbMsg, setFbMsg, fbEmail, setFbEmail, fbBusy, sendFeedback } = fb;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t('Help & feedback', 'Súgó és visszajelzés')}</h2>
      <div className="faq">
        {(
          [
            ['How accurate is the preview?', 'Mennyire pontos az előnézet?', 'It is an AI simulation based on how ink and skin usually age (spreading, fading, sun, skin changes). Real results depend on your artist, your skin and aftercare — use it to compare options, not as a guarantee.', 'MI-szimuláció, ami azon alapul, hogyan öregszik általában a tinta és a bőr (szétterülés, fakulás, nap, bőrváltozás). A valós eredmény a tetoválótól, a bőrödtől és az utókezeléstől függ – lehetőségek összevetésére használd, ne garanciaként.'],
            ['What happens to my photos?', 'Mi történik a fotóimmal?', 'They are used to make your preview and are stored privately in your account. Shared links only contain the small images you chose to share. You can delete everything here in Profile.', 'Az előnézet elkészítéséhez használjuk őket, és privát módon a fiókodban tároljuk. A megosztott link csak azokat a kis képeket tartalmazza, amiket megosztottál. Itt a Profilban mindent törölhetsz.'],
            ['The tattoo landed on my clothes / looks wrong', 'Ruhára került / rossz lett a tetoválás', 'Tap “Not right? Make it again” under the result and tick what went wrong — the next try avoids exactly that. A close, sharp daylight photo of bare skin gives the best results.', 'Koppints az eredmény alatt a „Nem lett jó? Újracsináljuk” gombra, és jelöld be, mi a baj – az új próbálkozás pont ezt kerüli el. A közeli, éles, nappali fényes fotó csupasz bőrről adja a legjobb eredményt.'],
            ['How many previews can I make?', 'Hány előnézetet készíthetek?', 'You get 30 previews a month with your account. They start again on the 1st.', 'A fiókoddal havonta 30 előnézet jár. Minden hónap 1-jén újraindul.'],
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
  );
}
