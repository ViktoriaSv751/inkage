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
  // several pictures can be picked at once; they are saved together (with the same note)
  const [pics, setPics] = useState<(Photo & { sourceUrl: string | null })[]>([]);
  const [progress, setProgress] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(0);
  const pic = pics.length === 1 ? pics[0] : null;

  const reset = () => {
    setPics([]);
    setProgress('');
    setLink('');
    setNote('');
    setSaved(0);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const MAX = 20;
  /** One or many pictures from the photo library (or one from a link); they join what is already picked. */
  const fromFiles = async (files: (File | Blob)[], sourceUrl: string | null = null) => {
    const list = files.slice(0, Math.max(0, MAX - pics.length));
    if (files.length > list.length) toast(t(`Up to ${MAX} pictures at once.`, `Egyszerre legfeljebb ${MAX} kép.`));
    if (!list.length) return;
    setBusy('file');
    setSaved(0);
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      if (list.length > 1) setProgress(`${i + 1}/${list.length}`);
      try {
        const p = await prepareImage(list[i] as File, 1280);
        setPics((cur) => [...cur, { ...p, sourceUrl }]);
      } catch {
        bad++;
      }
    }
    setProgress('');
    setBusy('');
    if (bad) toast(bad === list.length ? t('That picture could not be opened. Try a JPG, PNG or HEIC.', 'Ezt a képet nem sikerült megnyitni. JPG, PNG vagy HEIC legyen.') : t(`${bad} picture(s) could not be opened.`, `${bad} képet nem sikerült megnyitni.`));
    else haptic();
  };
  const fromFile = (f: File | Blob, sourceUrl: string | null = null) => fromFiles([f], sourceUrl);
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
    if (!pics.length) return;
    if (!me.user) return openAuth(t('Sign in to keep your ideas on every device.', 'Jelentkezz be, hogy az ötleteid minden eszközön meglegyenek.'));
    setBusy('save');
    let ok = 0;
    const left: typeof pics = [];
    for (let i = 0; i < pics.length; i++) {
      if (pics.length > 1) setProgress(`${i + 1}/${pics.length}`);
      const p = pics[i];
      const u = await uploads.add(me.user.id, 'idea', p.dataUrl, p.w, p.h, { sourceUrl: p.sourceUrl, note });
      if (u) ok++;
      else left.push(p);
    }
    setProgress('');
    setBusy('');
    track('idea_saved', { n: ok, from: pics.some((p) => p.sourceUrl) ? 'link' : 'file' });
    if (!ok) return toast(t('Could not save it. Check your connection and try again.', 'Nem sikerült menteni. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    if (left.length) {
      // the ones that did not make it stay picked, so a second tap saves just those
      setPics(left);
      return toast(t(`${ok} saved, ${left.length} not. Tap Save again.`, `${ok} elmentve, ${left.length} nem. Koppints újra a Mentésre.`));
    }
    haptic('success');
    setSaved(ok);
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

      {!pics.length ? (
        <div className="idea-pick">
          <input key={inputKey} ref={fileRef} id="idea-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" multiple tabIndex={-1} aria-hidden="true" onChange={(e) => { const fs = Array.from(e.target.files || []); setInputKey((k) => k + 1); if (fs.length) fromFiles(fs); }} />
          <label htmlFor="idea-input" role="button" tabIndex={0} className={`btn wide ${busy === 'file' ? 'is-busy' : ''}`} style={{ cursor: 'pointer' }}>
            {busy === 'file' ? `${t('Opening…', 'Megnyitás…')} ${progress}` : t('From your photos (one or more)', 'Fotótárból (egy vagy több)')}
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
          {pic ? (
            <>
              <img src={pic.dataUrl} alt="" />
              {pic.sourceUrl && <small className="muted idea-src">{new URL(pic.sourceUrl).hostname.replace(/^www\./, '')}</small>}
            </>
          ) : (
            <div className="idea-multi">
              {pics.map((p, i) => (
                <div key={i} className="idea-mtile">
                  <img src={p.dataUrl} alt="" />
                  {!saved && (
                    <button type="button" aria-label={t('Remove', 'Eltávolítás')} disabled={!!busy} onClick={() => setPics((cur) => cur.filter((_, k) => k !== i))}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!saved ? (
            <>
              {pics.length < MAX && (
                <label htmlFor="idea-input" role="button" tabIndex={0} className={`chipbtn idea-more ${busy === 'file' ? 'is-busy' : ''}`}>
                  {busy === 'file' ? `${t('Opening…', 'Megnyitás…')} ${progress}` : t('+ Add more from your photos', '+ Még képek a fotótárból')}
                </label>
              )}
              <input key={inputKey} id="idea-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" multiple tabIndex={-1} aria-hidden="true" onChange={(e) => { const fs = Array.from(e.target.files || []); setInputKey((k) => k + 1); if (fs.length) fromFiles(fs); }} />
              <input className="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={pics.length > 1 ? t('A note for all of them (optional)', 'Megjegyzés mindegyikhez (nem kötelező)') : t('A note (optional): where, how big, why…', 'Megjegyzés (nem kötelező): hová, mekkora, miért…')} aria-label={t('Note', 'Megjegyzés')} />
              <button className="btn wide" disabled={!!busy} onClick={save}>
                {busy === 'save'
                  ? `${t('Saving…', 'Mentés…')} ${progress}`
                  : pics.length > 1
                    ? t(`Save ${pics.length} ideas`, `${pics.length} ötlet mentése`)
                    : t('Save to Ideas', 'Mentés az Ötletek közé')}
              </button>
              <button className="btn wide ghost" disabled={!!busy} onClick={() => setPics([])}>
                {pics.length > 1 ? t('Start over', 'Újrakezdem') : t('Pick another', 'Másikat választok')}
              </button>
            </>
          ) : (
            <>
              <p className="idea-ok" role="status">✓ {saved > 1 ? t(`${saved} ideas saved`, `${saved} ötlet elmentve`) : t('Saved to your Ideas', 'Elmentve az Ötletek közé')}</p>
              {onTry && pic && (
                <button className="btn wide" onClick={tryIt}>
                  {t('Try it on now', 'Kipróbálom most')}
                </button>
              )}
              <button className="btn wide ghost" onClick={reset}>
                {t('Save more ideas', 'Még ötletek mentése')}
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
