'use client';
import { useState } from 'react';
import { siteOrigin } from '@/lib/site';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { cloud, Preview, shares, track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { api, sb } from '@/lib/sb';
import { artistPdf } from '@/lib/brief';
import { placeName } from '../create/steps';
import { makeCard, smallJpeg } from './media';

/** Artist PDF, the "fresh vs. 50 years" picture and the vote link for one preview. */
export function useShareActions(preview: Preview, own: boolean, onShared?: (shareId: string | null) => void) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);

  const pdf = async () => {
    setPdfBusy(true);
    try {
      const blob = await artistPdf(preview, ui.lang, placeName(preview.placement, ui.lang));
      track('artist_pdf');
      await shareOrDownload(blob, 'inkage-tetovalas-terv.pdf');
    } catch (e) {
      console.warn(e);
      toast(t('Could not create the PDF. Try again.', 'Nem sikerült a PDF. Próbáld újra.'));
    }
    setPdfBusy(false);
  };

  const shareLink = async (id: string) => {
    const url = `${siteOrigin()}/v/${id}`;
    track('share_link', { id });
    const nav: any = navigator;
    const text = t('Should I get this tattoo? Here’s how it looks in 50 years 👀', 'Csináltassam meg ezt a tetoválást? Így néz ki 50 év múlva 👀');
    if (nav.share) await nav.share({ url, title: 'InkAge', text }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast(t('Link copied — send it to your friends', 'Link másolva – küldd el a barátaidnak'));
    }
  };
  /** The vote link for this preview: reuse it if there is one, otherwise make it. */
  const linkFor = async (): Promise<string> => {
    if (!img.y50 || !img.fresh) throw new Error(t('Wait for the 50-year image first.', 'Várd meg az 50 éves képet.'));
    if (preview.share_id) return preview.share_id;
    // a link made earlier on this device (guest kind only; it may have been closed meanwhile)
    const mine = preview.source === 'cloud' && me.user ? null : shares.forPreview(preview.id).find((x) => x.kind === 'guest');
    if (mine) {
      const { data } = (await sb()?.rpc('get_share', { p_share: mine.id })) || {};
      if (data) return mine.id;
      shares.drop(mine.id);
    }
    if (me.user && preview.source === 'cloud') {
      const id = await cloud.share(me.user.id, preview);
      onShared?.(id);
      shares.add({ id, at: new Date().toISOString(), label: placeName(preview.placement, ui.lang), previewId: preview.id, kind: 'preview' });
      return id;
    }
    // no account needed: the link keeps two small images
    const [fresh, y50] = await Promise.all([smallJpeg(img.fresh), smallJpeg(img.y50)]);
    const r = await api<{ id?: string; error?: string }>('/api/guest-share', { fresh, y50, placement: preview.placement, score: preview.score });
    if (!r.ok || !r.data.id) throw new Error(r.data?.error || t('Sharing failed. Try again.', 'A megosztás nem sikerült. Próbáld újra.'));
    shares.add({ id: r.data.id, at: new Date().toISOString(), label: placeName(preview.placement, ui.lang), previewId: preview.id, kind: 'guest' });
    return r.data.id;
  };

  const card = async () => {
    if (!img.fresh || !img.y50) return;
    setCardBusy(true);
    try {
      const blob = await makeCard(img.fresh, img.y50, {
        title: t('Fresh vs. 50 years', 'Friss vs. 50 év múlva'),
        left: own ? t('Today', 'Ma') : t('Fresh', 'Friss'),
        right: t('50 years', '50 év'),
        score: preview.score != null ? t(`Aging score ${preview.score}/100`, `Öregedési pontszám ${preview.score}/100`) : null,
      });
      track('card_made');
      await shareOrDownload(blob, 'inkage-friss-vs-50-ev.jpg');
    } catch {
      toast(t('Could not make the picture. Try again.', 'Nem sikerült a kép. Próbáld újra.'));
    }
    setCardBusy(false);
  };

  return { pdf, pdfBusy, shareLink, linkFor, card, cardBusy };
}
