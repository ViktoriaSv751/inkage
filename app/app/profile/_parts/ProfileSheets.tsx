'use client';
import { useApp } from '../../AppProvider';
import { closeTap, Confirm, Sheet } from '../../ui';
import { tx } from '@/lib/i18n';
import type { useAccount } from './useAccount';

/** How to add the app to the home screen, where the browser has no install prompt. */
export function InstallSheet({ howto, setHowto, ios }: { howto: boolean; setHowto: (v: boolean) => void; ios: boolean }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={howto} onClose={() => setHowto(false)} label={ui.t('profile.install')}>
      <h2>{ui.t('profile.install')}</h2>
      {ios ? (
        <ol className="perks">
          <li>{t('Tap the Share button in Safari (the square with an arrow).', 'Koppints a Megosztás gombra a Safariban (négyzet nyíllal).')}</li>
          <li>{t('Choose “Add to Home Screen”.', 'Válaszd a „Főképernyőhöz adás” lehetőséget.')}</li>
          <li>{t('Tap “Add”.', 'Koppints a „Hozzáadás” gombra.')}</li>
        </ol>
      ) : (
        <ol className="perks">
          <li>{t('Open the browser menu (⋮).', 'Nyisd meg a böngésző menüjét (⋮).')}</li>
          <li>{t('Choose “Install app” or “Add to Home screen”.', 'Válaszd az „Alkalmazás telepítése” vagy „Hozzáadás a kezdőképernyőhöz” lehetőséget.')}</li>
        </ol>
      )}
      <button className="btn wide" onClick={() => setHowto(false)}>
        {ui.t('common.done')}
      </button>
    </Sheet>
  );
}

/** Edit profile: picture and name. */
export function EditProfileSheet({ acc, initial }: { acc: ReturnType<typeof useAccount>; initial: string }) {
  const { ui, profile } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const meta = profile;
  const { editOpen, setEditOpen, nameIn, setNameIn, accBusy, saveName, pickAvatar, removeAvatar } = acc;
  return (
    <Sheet open={editOpen} onClose={() => setEditOpen(false)} label={t('Edit profile', 'Profil szerkesztése')}>
      <h2>{t('Edit profile', 'Profil szerkesztése')}</h2>
      <div className="acc-avatar">
        <div className="pf-avatar sm">{meta.avatar ? <img src={meta.avatar} alt="" /> : <span>{initial}</span>}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="chipbtn" style={{ cursor: 'pointer' }}>
            {accBusy === 'avatar' ? t('Uploading…', 'Feltöltés…') : t('Upload a picture', 'Kép feltöltése')}
            <input type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])} />
          </label>
          {meta.avatar && (
            <button className="chipbtn" onClick={removeAvatar}>
              {t('Remove', 'Eltávolítás')}
            </button>
          )}
        </div>
      </div>
      <label className="acc-field">
        <span>{t('Name', 'Név')}</span>
        <div className="acc-row">
          <input className="text" value={nameIn} maxLength={60} onChange={(e) => setNameIn(e.target.value)} placeholder={t('Your name', 'A neved')} />
          <button className="btn" disabled={accBusy === 'name' || nameIn.trim() === meta.name} onClick={saveName}>
            {t('Save', 'Mentés')}
          </button>
        </div>
      </label>
      <p className="muted acc-note">
        {t('You sign in with Google or Apple, so your e-mail and password are managed there.', 'Google- vagy Apple-fiókkal lépsz be, így az e-mail-címed és a jelszavad ott kezelhető.')}
      </p>
      <button className="btn wide ghost" onClick={() => setEditOpen(false)} {...closeTap(() => setEditOpen(false))}>
        {t('Done', 'Kész')}
      </button>
    </Sheet>
  );
}

/** Asks before signing out of this device. */
export function SignOutConfirm({ askOut, setAskOut, doSignOut }: { askOut: boolean; setAskOut: (v: boolean) => void; doSignOut: () => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Confirm
      open={askOut}
      title={t('Sure you want to sign out?', 'Biztosan kijelentkezel?')}
      text={t('Your designs stay saved in your account.', 'A mintáid a fiókodban maradnak.')}
      yes={t('Sign out', 'Kijelentkezés')}
      no={t('Cancel', 'Mégse')}
      onYes={doSignOut}
      onClose={() => setAskOut(false)}
      icon={
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
        </svg>
      }
    />
  );
}

/** Delete account: type DELETE to confirm. */
export function EraseSheet({
  erase,
  setErase,
  confirm,
  setConfirm,
  busy,
  eraseAll,
}: {
  erase: boolean;
  setErase: (v: boolean) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  busy: boolean;
  eraseAll: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={erase} onClose={() => setErase(false)} label={ui.t('profile.erase')}>
      <h2>{ui.t('profile.erase')}</h2>
      <p className="sub">{ui.t('profile.eraseConfirm')}</p>
      <input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t('DELETE', 'TÖRLÉS')} autoCapitalize="characters" />
      <button className="btn wide red" disabled={![...['DELETE', 'TÖRLÉS', 'TORLES'], t('DELETE', 'TÖRLÉS').toUpperCase()].includes(confirm.trim().toUpperCase()) || busy} onClick={eraseAll}>
        {busy ? '…' : t('Delete everything', 'Mindent törlök')}
      </button>
    </Sheet>
  );
}
