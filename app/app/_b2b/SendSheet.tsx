'use client';
import './b2b-app.css';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { localeOf } from '@/lib/tr';
import { haptic, track, type Preview } from '@/lib/store';
import { createGuestLink, guestUrl, listGuestLinks, revokeGuestLink, type GuestLink, type Studio } from '@/lib/studio';
import { qrSvgPath } from '@/lib/qr';
import { placeName } from '../create/steps';

/** "Send it to the guest": a clean page with this guest's previews (/e/<id>), shared by link, SMS, WhatsApp,
    e-mail or a QR code at the counter. The studio can close any link. */
export function SendSheet({ open, onClose, preview, items, studio }: { open: boolean; onClose: () => void; preview: Preview; items: Preview[]; studio: Studio }) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  // the same guest's other previews are offered too (ticked by default)
  const same = useMemo(() => {
    const n = (preview.guestName || '').trim().toLowerCase();
    const list = n ? items.filter((p) => p.source === 'cloud' && (p.guestName || '').trim().toLowerCase() === n) : [];
    return list.some((p) => p.id === preview.id) ? list : [preview, ...list];
  }, [items, preview]);
  const [pick, setPick] = useState<string[]>([preview.id]);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<GuestLink | null>(null);
  const [old, setOld] = useState<GuestLink[]>([]);
  const [qr, setQr] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPick(same.map((p) => p.id));
    setLink(null);
    setQr(false);
    listGuestLinks(preview.id).then(setOld).catch(() => setOld([]));
  }, [open, preview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const make = async () => {
    setBusy(true);
    try {
      const list = same.filter((p) => pick.includes(p.id));
      const l = await createGuestLink(studio.uid, list.length ? list : [preview], preview.guestName || null);
      setLink(l);
      setOld((o) => [l, ...o]);
      haptic('success');
      track('b2b_guest_link', { n: list.length });
    } catch {
      toast(t('The link could not be made. Check your connection and try again.', 'Nem sikerült elkészíteni a linket. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    }
    setBusy(false);
  };
  const revoke = async (l: GuestLink) => {
    try {
      await revokeGuestLink(l);
      setOld((o) => o.filter((x) => x.id !== l.id));
      if (link?.id === l.id) setLink(null);
      toast(t('Link closed', 'Link lezárva'));
    } catch {
      toast(t('Could not close it. Try again.', 'Nem sikerült lezárni. Próbáld újra.'));
    }
  };

  const url = link ? guestUrl(link.id) : '';
  const who = studio.name || 'InkAge';
  const msg = link ? t(`Your tattoo preview from ${who}: ${url}`, `A tetoválás-előnézeted – ${who}: ${url}`) : '';
  const enc = encodeURIComponent(msg);
  const code = useMemo(() => (qr && url ? qrSvgPath(url) : null), [qr, url]);
  const date = (s: string) => new Date(s).toLocaleDateString(localeOf(ui.lang), { month: 'short', day: 'numeric' });

  return (
    <Sheet open={open} onClose={onClose} label={t('Send to the guest', 'Elküldöm a vendégnek')}>
      <div className="sendsheet">
        <h2>{t('Send to the guest', 'Elküldöm a vendégnek')}</h2>
        <p className="sub">{t('A clean page with the previews, your studio name and logo. Only people with the link can open it.', 'Egy tiszta oldal az előnézetekkel, a szalonod nevével és logójával. Csak az nyitja meg, akinek a linket elküldöd.')}</p>

        {!link && (
          <>
            {same.length > 1 && (
              <div className="ss-pick">
                {same.map((p) => (
                  <label key={p.id}>
                    <input type="checkbox" checked={pick.includes(p.id)} onChange={(e) => setPick((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))} />
                    {p.images.fresh && <img src={p.images.fresh} alt="" />}
                    <span>
                      {placeName(p.placement, ui.lang)} · {date(p.created_at)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <button className="btn wide dark" style={{ marginTop: 12 }} disabled={busy || !pick.length} onClick={make}>
              {busy ? t('Preparing…', 'Készül…') : t('Make the link', 'Link készítése')}
            </button>
          </>
        )}

        {link && (
          <>
            <div className="ss-link">
              <span style={{ flex: 1 }}>{url}</span>
            </div>
            <div className="ss-actions">
              <button
                className="chipbtn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast(t('Link copied', 'Link másolva'));
                  } catch {}
                }}
              >
                🔗 {t('Copy link', 'Link másolása')}
              </button>
              <button className={`chipbtn ${qr ? 'on' : ''}`} onClick={() => setQr((v) => !v)}>
                ▦ {t('QR code', 'QR-kód')}
              </button>
              <a className="chipbtn" href={`sms:?&body=${enc}`}>
                💬 SMS
              </a>
              <a className="chipbtn" href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer">
                🟢 WhatsApp
              </a>
              <a className="chipbtn" href={`mailto:?subject=${encodeURIComponent(t('Your tattoo preview', 'A tetoválás-előnézeted'))}&body=${enc}`}>
                ✉️ {t('E-mail', 'E-mail')}
              </a>
              <a className="chipbtn" href={url} target="_blank" rel="noopener noreferrer">
                ↗ {t('Open', 'Megnyitás')}
              </a>
            </div>
            {code && (
              <div className="ss-qr" aria-label={t('QR code of the link', 'A link QR-kódja')}>
                <svg viewBox={`0 0 ${code.size} ${code.size}`} shapeRendering="crispEdges" role="img">
                  <rect width={code.size} height={code.size} fill="#fff" />
                  <path d={code.d} fill="#000" />
                </svg>
              </div>
            )}
            {qr && <p className="fine">{t('The guest scans it with their phone camera.', 'A vendég a telefonja kamerájával olvassa be.')}</p>}
          </>
        )}

        {old.length > 0 && (
          <div className="ss-old">
            <b>{t('Open links for this preview', 'Az előnézet nyitott linkjei')}</b>
            {old.map((l) => (
              <div key={l.id}>
                <span>
                  {date(l.created_at)} · {l.items.length} {t('preview(s)', 'előnézet')} · {l.views} {t('views', 'megnyitás')}
                </span>
                <button className="chipbtn danger" onClick={() => revoke(l)}>
                  {t('Close link', 'Lezárás')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
