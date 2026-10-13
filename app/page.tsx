'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareImage } from '@/lib/client';
import { LandingSections } from './LandingSections';
import './landing.css';
import { HeroAging } from './visuals';
import { useLang, tx } from '@/lib/i18n';
import { lsSet, track } from '@/lib/store';
import { sb } from '@/lib/sb';

export default function Landing() {
  const { lang, setLang } = useLang();
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [signedIn, setSignedIn] = useState(false);
  const [made, setMade] = useState(0);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  // "Try it now": pick the photo right here; the app opens with it already in place
  const startWithPhoto = async (f: File) => {
    try {
      const p = await prepareImage(f, 1024);
      const prev = JSON.parse(sessionStorage.getItem('ink_draft') || '{}');
      sessionStorage.setItem('ink_draft', JSON.stringify({ ...prev, photo: p }));
      track('landing_photo');
    } catch {}
    router.push('/app');
  };

  useEffect(() => {
    // referral links: /?ref=<user id>
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
      lsSet('ink_ref', ref);
      track('ref_visit');
    }
    track('landing_view', { ref: !!ref });
    sb()?.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    sb()
      ?.rpc('trends')
      .then(({ data }) => setMade(Number((data as any)?.previews_total) || 0));
  }, []);

  return (
    <main>
      <header className="top">
        <Link className="logo" href="/" aria-label="InkAge home">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="30" />
            <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
          </svg>
          InkAge
        </Link>
        <nav className="row" style={{ alignItems: 'center' }}>
          <button className="link" onClick={() => setLang(lang === 'hu' ? 'en' : 'hu')} aria-label={t('Switch to Hungarian', 'Váltás angolra')}>
            {lang === 'hu' ? 'EN' : 'HU'}
          </button>
          <Link className="link" href="/app">
            {signedIn ? t('Open app', 'App megnyitása') : t('Sign in', 'Belépés')}
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>
            {lang === 'hu' ? (
              <>
                A tetoválásod
                <br />
                50 év
                <br />
                múlva.
              </>
            ) : (
              <>
                Your tattoo,
                <br />
                50 years
                <br />
                from now.
              </>
            )}
          </h1>
          <p className="lede">
            {t(
              'Put any design on a photo of your own body. See it fresh, healed, and at 10, 30 and 50 years — on your skin — before it’s permanent.',
              'Tegyél bármilyen mintát a saját testedről készült fotóra. Nézd meg frissen, gyógyultan, 10, 30 és 50 év múlva – a saját bőrödön –, mielőtt végleges lesz.'
            )}
          </p>
          <div className="row" style={{ alignItems: 'center' }}>
            <button className="btn" onClick={() => (track('landing_cta'), fileRef.current?.click())}>
              {t('Upload my photo — free', 'Feltöltöm a fotómat – ingyen')}
            </button>
            <Link className="btn ghost" href="/app" onClick={() => track('landing_cta_app')}>
              {t('Open the app', 'App megnyitása')}
            </Link>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) startWithPhoto(f); e.target.value = ''; }} />
          <p className="fine" style={{ textAlign: 'left' }}>
            {made >= 100
              ? t(`${made.toLocaleString('en')} previews made so far. No sign-up, about a minute.`, `Eddig ${made.toLocaleString('hu')} előnézet készült. Regisztráció nélkül, kb. egy perc.`)
              : t('No sign-up for your first preview. Takes about a minute.', 'Az első előnézethez nem kell regisztrálni. Kb. egy perc.')}
          </p>
        </div>
        <HeroAging />
      </section>

      <LandingSections lang={lang} made={made} onUpload={() => (track('landing_cta_bottom'), fileRef.current?.click())} />
    </main>
  );
}
