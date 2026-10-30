'use client';

import { TryLink } from '../AuthCta';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { track } from '@/lib/store';
import { LogoMark } from '../LogoMark';
import type { T } from './types';
import type { Lang } from '@/lib/tr';

/* ------------------------------------------------------------------ privacy */
export function PrivacyBlock({ t }: { t: T }) {
  const rows = [
    { i: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4', h: t('Private cloud storage', 'Privát felhőtárhely'), s: t('Only you can open it', 'Csak te nyithatod meg'), on: true },
    { i: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1', h: t('Public vote link', 'Nyilvános szavazós link'), s: t('Off until you share', 'Kikapcsolva, amíg nem osztod meg'), on: false },
    { i: 'M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM4 4l16 16', h: t('Ad trackers', 'Hirdetési követők'), s: t('None, ever', 'Egy sincs'), on: false },
  ];
  const pts = [
    { h: t('You choose what’s shared', 'Te döntöd el, mit osztasz meg'), p: t('A vote link holds only the fresh and the 50-year image. Delete the preview and the link disappears.', 'A szavazós link csak a friss és az 50 éves képet tartalmazza. Ha törlöd az előnézetet, a link is eltűnik.') },
    { h: t('Delete everything, anytime', 'Bármikor törölhetsz mindent'), p: t('One button in your profile removes your account and every saved preview.', 'A profilodban egyetlen gombbal törölheted a fiókodat és minden mentett előnézetet.') },
  ];
  return (
    <section className="ls-sec lm-pv">
      <div className="lm-pv-card">
        <div className="lm-pv-txt">
          <span className="lm-pv-badge">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            {t('Privacy by default', 'Alapból privát')}
          </span>
          <h2>{t('Your photos are yours.', 'A fotóid a tieid.')}</h2>
          <p>{t('No advertising trackers, no third-party analytics, and nothing public unless you share it.', 'Nincsenek hirdetési követők, nincs külső analitika, és semmi sem nyilvános, amíg meg nem osztod.')}</p>
          <ul>
            {pts.map((x) => (
              <li key={x.h}>
                <b>{x.h}</b>
                <span>{x.p}</span>
              </li>
            ))}
          </ul>
          <Link className="lm-pv-link" href="/adatbiztonsag">
            {t('How we protect your data', 'Így védjük az adataidat')}
          </Link>
        </div>
        <div className="lm-pv-ui" aria-label={t('Example privacy settings', 'Példa adatvédelmi beállítások')}>
          <div className="lm-pv-phone">
            <div className="lm-pv-bar">
              <span>9:41</span>
              <i />
            </div>
            <p className="lm-pv-title">{t('Your data', 'Adataid')}</p>
            <div className="lm-pv-group">
              {rows.map((r) => (
                <div key={r.h} className="lm-pv-row">
                  <span className="lm-pv-ico">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={r.i} />
                    </svg>
                  </span>
                  <span className="lm-pv-l">
                    <b>{r.h}</b>
                    <small>{r.s}</small>
                  </span>
                  <span className={`lm-pv-sw ${r.on ? 'on' : ''}`} aria-label={r.on ? t('On', 'Be') : t('Off', 'Ki')} />
                </div>
              ))}
            </div>
            <div className="lm-pv-del">{t('Delete my account and data', 'Fiókom és adataim törlése')}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ beta + add to home screen */
export function BetaInstall({ t, lang }: { t: T; lang?: Lang }) {
  const [evt, setEvt] = useState<any>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia?.('(display-mode: standalone)').matches);
    const h = (e: any) => (e.preventDefault(), setEvt(e));
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const steps = ios
    ? [t('Open inkage.app in Safari', 'Nyisd meg az oldalt Safariban'), t('Tap the Share button', 'Koppints a Megosztás gombra'), t('Choose “Add to Home Screen”', 'Válaszd: „Főképernyőhöz adás”')]
    : [t('Open the browser menu (⋮)', 'Nyisd meg a böngésző menüjét (⋮)'), t('Choose “Install app”', 'Válaszd: „Alkalmazás telepítése”'), t('Open InkAge from your home screen', 'Nyisd meg az InkAge-et a kezdőképernyőről')];
  return (
    <section className="ls-sec lm-beta" id="beta">
      <div className="lm-beta-card">
        <h2>{t('Every feature, with your account.', 'Minden funkció, a fiókoddal.')}</h2>
        <p>{t('30 previews a month with your account, plus invite bonuses. The allowance restarts on the 1st of each month.', 'Fiókkal havonta 30 előnézet, plusz meghívási bónuszok. A keret minden hónap 1-jén újraindul.')}</p>
        <ul>
          <li>{t('Ageing previews at 1, 10, 30 and 50 years', 'Öregedési előnézet 1, 10, 30 és 50 évre')}</li>
          <li>{t('Longevity score and “Make it last” redraw', 'Tartóssági pontszám és „Tedd tartóssá” átrajzolás')}</li>
          <li>{t('Laser removal preview', 'Lézeres eltávolítás előnézete')}</li>
          <li>{t('Videos, vote links and the PDF for your artist', 'Videók, szavazós linkek és PDF a tetoválódnak')}</li>
        </ul>
        <TryLink lang={lang} className="btn">{t('Create account', 'Regisztráció')}</TryLink>
      </div>
      <div className="lm-install" id="telepites">
        <div className="lm-hs" aria-hidden="true">
          <div className="lm-hs-screen">
            <div className="lm-hs-grid">
              {Array.from({ length: 7 }).map((_, k) => (
                <i key={k} />
              ))}
              <span className="lm-hs-app">
                <span>
                  <LogoMark />
                </span>
                <small>InkAge</small>
              </span>
            </div>
          </div>
        </div>
        <div className="lm-install-txt">
          <h3>{t('Keep it on your home screen', 'Tedd ki a kezdőképernyőre')}</h3>
          <p>{installed ? t('InkAge is already installed on this device.', 'Az InkAge már telepítve van ezen az eszközön.') : t('Opens full screen like an app — no app store needed.', 'Teljes képernyőn nyílik, mint egy app – alkalmazásbolt nélkül.')}</p>
          {!installed &&
            (evt ? (
              <button
                className="btn"
                onClick={async () => {
                  evt.prompt();
                  const r = await evt.userChoice.catch(() => null);
                  track('pwa_install', { outcome: r?.outcome });
                  setEvt(null);
                }}
              >
                {t('Install InkAge', 'InkAge telepítése')}
              </button>
            ) : (
              <ol className="lm-steps3">
                {steps.map((x, k) => (
                  <li key={k}>
                    <span>{k + 1}</span>
                    {x}
                  </li>
                ))}
              </ol>
            ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */
export function LandingFaq({ t, kbSfx }: { t: T; kbSfx: string }) {
  const qs = [
    [t('How many previews can I make?', 'Hány előnézetet készíthetek?'), t('30 previews a month with your account, plus bonus previews when friends join through your invite link. The allowance restarts on the 1st of each month.', 'Fiókkal havonta 30 előnézetet, plusz bónuszt, ha a barátaid a meghívó linkeddel csatlakoznak. A keret minden hónap 1-jén újraindul.')],
    [t('How accurate is the ageing?', 'Mennyire pontos az öregítés?'), t('It is an AI estimate based on how ink, skin and sun usually behave — not a measurement of your skin. Use it to compare designs, sizes and placements, and talk details through with your artist.', 'MI-alapú becslés arról, ahogy a tinta, a bőr és a nap általában viselkedik – nem a saját bőröd mérése. Minták, méretek és helyek összehasonlítására használd, a részleteket pedig beszéld át a tetoválóddal.')],
    [t('Do I need to sign up?', 'Kell regisztrálnom?'), t('Yes. A quick sign-up with Google or Apple (or e-mail) is needed, so your images stay private in your account.', 'Igen. Egy gyors regisztráció kell Google- vagy Apple-fiókkal (vagy e-maillel), így a képeid privátak maradnak a fiókodban.')],
    [t('What photo works best?', 'Milyen fotó működik a legjobban?'), t('Daylight, the spot in focus, filling most of the frame, without heavy filters. The app checks the light and focus for you.', 'Nappali fény, éles terület, ami kitölti a kép nagy részét, erős szűrők nélkül. Az app ellenőrzi helyetted a fényt és az élességet.')],
    [t('Can I use a design I found online?', 'Használhatok netről talált mintát?'), t('Yes — a screenshot, a sketch or even a photo of someone else’s tattoo. Remember that a design belongs to its artist: use it for inspiration and let your artist draw your own version.', 'Igen – képernyőfotót, vázlatot, vagy akár más tetoválásáról készült fotót is. Ne feledd, a minta az alkotójáé: inspirációnak használd, és a tetoválód rajzolja meg a saját változatodat.')],
    [t('Does it work on darker skin?', 'Sötétebb bőrön is működik?'), t('Yes. Every stage keeps your own skin tone. Our guide on tattoos on darker skin explains which colours and styles show best.', 'Igen. Minden stádium megtartja a saját bőrtónusodat. A sötétebb bőrről szóló útmutatónk elmagyarázza, mely színek és stílusok mutatnak a legjobban.')],
  ];
  return (
    <section className="ls-sec lm-faq">
      <div className="ls-head row-between">
        <h2>{t('Questions, answered.', 'Kérdések és válaszok.')}</h2>
        <Link className="ls-link" href={`/gyik${kbSfx}`}>
          {t('All questions', 'Összes kérdés')}
        </Link>
      </div>
      <div className="lm-faq-list">
        {qs.map(([q, a], i) => (
          <details key={i} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track('landing_faq', { i })}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
