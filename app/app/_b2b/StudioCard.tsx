'use client';
import './b2b-app.css';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { localeOf } from '@/lib/tr';
import { guestUrl, listGuestLinks, removeLogo, revokeGuestLink, saveStudio, uploadLogo, type GuestLink, type Studio } from '@/lib/studio';

/** Profile → studio settings (studio accounts only): the name and logo guests see, auto-delete of guest photos,
    the studio name on downloaded images, and the open guest links. */
export function StudioCard({ studio }: { studio: Studio }) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [name, setName] = useState(studio.name);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<GuestLink[] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setName(studio.name), [studio.name]);
  useEffect(() => {
    listGuestLinks().then(setLinks).catch(() => setLinks([]));
  }, []);
  const fail = () => toast(t('Could not save. Try again.', 'Nem sikerült menteni. Próbáld újra.'));
  const save = async (patch: Parameters<typeof saveStudio>[1], ok?: string) => {
    try {
      await saveStudio(studio.uid, patch);
      if (ok) toast(ok);
    } catch {
      fail();
    }
  };
  const date = (s: string) => new Date(s).toLocaleDateString(localeOf(ui.lang), { month: 'short', day: 'numeric' });

  return (
    <div className="card studiocard">
      <h3>{t('Studio', 'Szalon')}</h3>
      <label className="sc-field">
        {t('Name shown to guests', 'A vendégeknek mutatott név')}
        <input
          className="text"
          value={name}
          maxLength={80}
          placeholder={studio.company || t('Studio name', 'Szalon neve')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== studio.name && save({ name: name.trim() || null }, t('Saved', 'Mentve'))}
        />
      </label>

      <div className="sc-logo">
        {studio.logoUrl && <img src={studio.logoUrl} alt={t('Studio logo', 'Szalon logója')} />}
        <button className="chipbtn" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? t('Uploading…', 'Feltöltés…') : studio.logoUrl ? t('Change logo', 'Logó cseréje') : t('Upload logo', 'Logó feltöltése')}
        </button>
        {studio.logoUrl && (
          <button className="chipbtn" onClick={() => removeLogo(studio.uid, studio.logoPath).catch(fail)}>
            {t('Remove', 'Eltávolítás')}
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="file-hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (f.size > 5e6) return toast(t('Use an image under 5 MB.', '5 MB-nál kisebb képet használj.'));
            setBusy(true);
            try {
              await uploadLogo(studio.uid, f, studio.logoPath);
              toast(t('Logo saved', 'Logó mentve'));
            } catch {
              fail();
            }
            setBusy(false);
          }}
        />
      </div>
      <p className="fine" style={{ textAlign: 'left' }}>{t('Shown on the page you send to guests.', 'A vendégeknek küldött oldalon jelenik meg.')}</p>

      <div>
        <b>{t('Delete guest photos automatically', 'Vendégfotók automatikus törlése')}</b>
        <div className="seg" role="radiogroup" aria-label={t('Delete guest photos automatically', 'Vendégfotók automatikus törlése')}>
          {([null, 30, 90] as const).map((d) => (
            <button key={String(d)} role="radio" aria-checked={studio.photoDays === d} className={studio.photoDays === d ? 'on' : ''} onClick={() => save({ photo_days: d }, t('Saved', 'Mentve'))}>
              {d === null ? t('never', 'soha') : t(`${d} days`, `${d} nap`)}
            </button>
          ))}
        </div>
        {studio.photoDays && (
          <label className="sc-check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={studio.deletePreviews} onChange={(e) => save({ delete_previews: e.target.checked })} />
            {t('Also delete the guests’ previews (and close their links)', 'A vendégek előnézeteit is (és a linkjeiket lezárja)')}
          </label>
        )}
        <p className="fine" style={{ textAlign: 'left' }}>
          {studio.photoDays
            ? t(
                `Every night the guest photos uploaded more than ${studio.photoDays} days ago are deleted from this account. Files are removed for good the next time this app opens.`,
                `Minden éjjel töröljük a fiókból a ${studio.photoDays} napnál régebben feltöltött vendégfotókat. A fájlok véglegesen az app következő megnyitásakor törlődnek.`
              )
            : t('Guest photos stay until you delete them.', 'A vendégfotók addig maradnak, amíg nem törlöd őket.')}
        </p>
      </div>

      <label className="sc-check">
        <input type="checkbox" checked={studio.markDownloads} onChange={(e) => save({ mark_downloads: e.target.checked })} />
        {t('Put the studio name in the corner of downloaded images', 'A szalon neve a letöltött képek sarkába')}
      </label>

      {links && links.length > 0 && (
        <div>
          <b>{t('Open guest links', 'Nyitott vendéglinkek')}</b>
          <div className="stack" style={{ marginTop: 8 }}>
            {links.map((l) => (
              <div key={l.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <a href={guestUrl(l.id)} target="_blank" rel="noopener noreferrer" className="small">
                  {l.guest_name || t('No name', 'Név nélkül')} · {date(l.created_at)} · {l.views} {t('views', 'megnyitás')}
                </a>
                <button
                  className="chipbtn danger"
                  onClick={async () => {
                    try {
                      await revokeGuestLink(l);
                      setLinks((x) => (x || []).filter((y) => y.id !== l.id));
                      toast(t('Link closed', 'Link lezárva'));
                    } catch {
                      fail();
                    }
                  }}
                >
                  {t('Close', 'Lezárás')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
