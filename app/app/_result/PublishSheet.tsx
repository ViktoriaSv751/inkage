'use client';
import { useState } from 'react';
import { qOf } from '@/lib/tr';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { anonId, lsGet, lsSet, Preview, track } from '@/lib/store';
import { sb } from '@/lib/sb';

/** "Share in Explore": caption, consent and sending it for review. */
export function PublishSheet({
  preview,
  pubOpen,
  setPubOpen,
  setLinksTick,
  linkFor,
}: {
  preview: Preview;
  pubOpen: boolean;
  setPubOpen: (v: boolean) => void;
  setLinksTick: React.Dispatch<React.SetStateAction<number>>;
  linkFor: () => Promise<string>;
}) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const [pubOk, setPubOk] = useState(false);
  const [caption, setCaption] = useState('');
  const [pubBusy, setPubBusy] = useState(false);
  // share to Explore: only with consent, and only after a person has reviewed it
  const publish = async () => {
    if (!img.fresh || !img.y50) return;
    setPubBusy(true);
    try {
      const sid = await linkFor();
      const { data } = (await sb()?.rpc('submit_post', { p_share: sid, p_caption: caption, p_anon: anonId() })) || {};
      if (!data) throw new Error('limit');
      lsSet('ink_posts', [sid, ...lsGet<string[]>('ink_posts', []).filter((x) => x !== sid)].slice(0, 50));
      setLinksTick((n) => n + 1);
      track('community_submit');
      setPubOpen(false);
      toast(t('Sent! It appears in Explore after a quick review.', 'Elküldve! Rövid ellenőrzés után megjelenik a Felfedezésben.'));
    } catch {
      toast(t('Could not send it. Try again later.', 'Nem sikerült elküldeni. Próbáld újra később.'));
    }
    setPubBusy(false);
  };
  return (
    <Sheet open={pubOpen} onClose={() => setPubOpen(false)} label={t('Share in Explore', 'Megosztás a Felfedezésben')}>
      <h2>{t('Share in Explore', 'Megosztás a Felfedezésben')}</h2>
      <p className="sub">{t('Your fresh and 50-year images appear in the community feed, where anyone can vote. No name or account is shown.', 'A friss és az 50 éves képed megjelenik a közösségi falon, ahol bárki szavazhat rá. Nevet vagy fiókot nem mutatunk.')}</p>
      <input className="text" id="post-caption" maxLength={120} placeholder={t('Caption (optional), e.g. my first tattoo idea', 'Felirat (nem kötelező), pl. az első tetoválás-ötletem')} value={caption} onChange={(e) => setCaption(e.target.value)} />
      <label className="consent">
        <input type="checkbox" checked={pubOk} onChange={(e) => setPubOk(e.target.checked)} />
        <span>
          {t('The photo is of me, I’m over 18, no face or private details are visible, I have the right to the design, and I accept the ', 'A fotón én vagyok, elmúltam 18, nem látszik arc vagy személyes adat, jogom van a mintához, és elfogadom a ')}
          <a href={`/terms${qOf(ui.lang)}`} target="_blank" rel="noreferrer">{t('community rules', 'közösségi szabályokat')}</a>.
        </span>
      </label>
      <button className="btn wide" disabled={!pubOk || pubBusy} onClick={publish}>
        {pubBusy ? '…' : t('Send for review', 'Küldés ellenőrzésre')}
      </button>
    </Sheet>
  );
}
