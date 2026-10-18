'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { trErr, tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { uploads } from '@/lib/uploads';
import type { Photo } from './steps';

/** A link anywhere in a pasted text ("Look at this! https://pin.it/…"). */
const linkIn = (text: string) => /https:\/\/[^\s<>"']+/i.exec(text)?.[0] || '';

/**
 * Save a tattoo idea for later: a picture from the photo library or from a link (Pinterest, Instagram, any page or
 * image address). It goes to the gallery's Ideas, on the account, with the link it came from and an optional note.
 * `onTry` puts it straight onto the design slot instead.
 */
export function IdeaSheet({ open, onClose, onTry }: { open: boolean; onClose: () => void; onTry?: (blob: Blob) => void }) {
  const { ui, me, toast, openAuth } = useApp();
  const router = useRouter();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputKey, setInputKey] = useState(0);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'' | 'link' | 'file' | 'save'>('');
  const [pic, setPic] = useState<(Photo & { sourceUrl: string | null }) | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const reset = () => {
    setPic(null);
    setLink('');
    setNote('');
    setSaved(false);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const fromFile = async (f: File | Blob, sourceUrl: string | null = null) => {
    setBusy('file');
    try {
      const p = await prepareImage(f as File, 1280);
      setPic({ ...p, sourceUrl });
      setSaved(false);
      haptic();
    } catch {
      toast(t('That picture could not be opened. Try a JPG, PNG or HEIC.', 'Ezt a képet nem sikerült megnyitni. JPG, PNG vagy HEIC legyen.'));
    }
    setBusy('');
  };
  const fromLink = async (raw: string) => {
    const url = linkIn(raw);
    if (!url) return toast(t('Paste a link that starts with https://', 'Olyan linket illessz be, ami https://-sel kezdődik'));
    setBusy('link');
    track('idea_link');
    const r = await api<{ image?: string; error?: string }>('/api/fetch-image', { url });
    if (!r.ok || !r.data.image) {
      setBusy('');
      return toast(trErr(ui.lang, r.data?.error));
    }
    const blob = await (await fetch(r.data.image)).blob();
    await fromFile(blob, url);
  };
  // one button for whatever was copied: a picture, or a link to one
  const paste = async () => {
    try {
      const items = await (navigator.clipboard as any).read();
      for (const it of items) {
        const type = it.types.find((x: string) => x.startsWith('image/'));
        if (type) return fromFile(await it.getType(type));
      }
    } catch {}
    const text = (await navigator.clipboard.readText().catch(() => '')).trim();
    if (linkIn(text)) {
      setLink(linkIn(text));
      return fromLink(text);
    }
    toast(t('Nothing to paste. Copy a picture or a link first.', 'Nincs mit beilleszteni. Előbb másolj egy képet vagy linket.'));
  };

  const save = async () => {
    if (!pic) return;
    if (!me.user) return openAuth(t('Sign in to keep your ideas on every device.', 'Jelentkezz be, hogy az ötleteid minden eszközön meglegyenek.'));
    setBusy('save');
    const u = await uploads.add(me.user.id, 'idea', pic.dataUrl, pic.w, pic.h, { sourceUrl: pic.sourceUrl, note });
    setBusy('');
    if (!u) return toast(t('Could not save it. Check your connection and try again.', 'Nem sikerült menteni. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    track('idea_saved', { from: pic.sourceUrl ? 'link' : 'file' });
    haptic('success');
    setSaved(true);
  };
  const tryIt = async () => {
    if (!pic || !onTry) return;
    const blob = await (await fetch(pic.dataUrl)).blob();
    close();
    onTry(blob);
  };

  return (
    <Sheet open={open} onClose={close} label={t('Save a tattoo idea', 'Tetoválás-ötlet mentése')}>
      <h2>{t('Save a tattoo idea', 'Tetoválás-ötlet mentése')}</h2>
      <p className="sub">{t('Found something you like? Save it from your photos or a link (Pinterest, Instagram, any page). It waits in your gallery under Ideas.', 'Láttál valamit, ami tetszik? Mentsd el a fotótárból vagy linkről (Pinterest, Instagram, bármilyen oldal). A galériában, az Ötletek között vár.')}</p>

      {!pic ? (
        <div className="idea-pick">
          <input key={inputKey} ref={fileRef} id="idea-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; setInputKey((k) => k + 1); if (f) fromFile(f); }} />
          <label htmlFor="idea-input" role="button" tabIndex={0} className={`btn wide ${busy === 'file' ? 'is-busy' : ''}`} style={{ cursor: 'pointer' }}>
            {busy === 'file' ? t('Opening…', 'Megnyitás…') : t('From your photos', 'Fotótárból')}
          </label>
          <div className="idea-link">
            <input
              className="text"
              type="url"
              inputMode="url"
              placeholder={t('Paste a link: Pinterest, Instagram…', 'Link beillesztése: Pinterest, Instagram…')}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onPaste={(e) => {
                // a pasted picture works here too
                const f = Array.from(e.clipboardData.files || []).find((x) => x.type.startsWith('image/'));
                if (f) {
                  e.preventDefault();
                  fromFile(f);
                  return;
                }
                const text = e.clipboardData.getData('text');
                if (linkIn(text)) {
                  e.preventDefault();
                  setLink(linkIn(text));
                  fromLink(text);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && fromLink(link)}
              aria-label={t('Link to the picture', 'Link a képhez')}
            />
            <button className="btn" disabled={busy === 'link' || !linkIn(link)} onClick={() => fromLink(link)}>
              {busy === 'link' ? '…' : t('Get it', 'Betöltés')}
            </button>
          </div>
          <button className="chipbtn" onClick={paste} disabled={!!busy}>
            {t('Paste what I copied (picture or link)', 'Beillesztés (kép vagy link)')}
          </button>
        </div>
      ) : (
        <div className="idea-preview">
          <img src={pic.dataUrl} alt="" />
          {pic.sourceUrl && <small className="muted idea-src">{new URL(pic.sourceUrl).hostname.replace(/^www\./, '')}</small>}
          {!saved ? (
            <>
              <input className="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={t('A note (optional): where, how big, why…', 'Megjegyzés (nem kötelező): hová, mekkora, miért…')} aria-label={t('Note', 'Megjegyzés')} />
              <button className="btn wide" disabled={busy === 'save'} onClick={save}>
                {busy === 'save' ? t('Saving…', 'Mentés…') : t('Save to Ideas', 'Mentés az Ötletek közé')}
              </button>
              <button className="btn wide ghost" disabled={!!busy} onClick={() => setPic(null)}>
                {t('Pick another', 'Másikat választok')}
              </button>
            </>
          ) : (
            <>
              <p className="idea-ok" role="status">✓ {t('Saved to your Ideas', 'Elmentve az Ötletek közé')}</p>
              {onTry && (
                <button className="btn wide" onClick={tryIt}>
                  {t('Try it on now', 'Kipróbálom most')}
                </button>
              )}
              <button className="btn wide ghost" onClick={reset}>
                {t('Save another idea', 'Még egy ötlet')}
              </button>
              <button className="btn wide ghost" onClick={() => (close(), router.push('/app/gallery?view=ideas'))}>
                {t('See my Ideas', 'Ötleteim megnézése')}
              </button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
