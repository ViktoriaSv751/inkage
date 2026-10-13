'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareImage } from '@/lib/client';
import { SEO_AREAS, SEO_STYLES } from '@/lib/seo';
import { HeroAging } from './visuals';
import { useLang, tx } from '@/lib/i18n';
import { lsSet, track } from '@/lib/store';
import { sb } from '@/lib/sb';
import { ARTICLES } from '@/lib/articles';

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

      <section className="facts">
        <h2>{t('How it works', 'Hogyan működik?')}</h2>
        <ol className="timeline">
          <li>
            <b>{t('1. Your photo', '1. A fotód')}</b>
            <span>{t('Snap the spot where the tattoo will go. We check the light and focus for you.', 'Fotózd le a helyet, ahová a tetoválás kerül. Mi ellenőrizzük a fényt és az élességet.')}</span>
          </li>
          <li>
            <b>{t('2. Any design', '2. Bármilyen minta')}</b>
            <span>{t('A Pinterest pin, a screenshot, your artist’s sketch — we remove the background automatically.', 'Pinterest-kép, képernyőfotó, a tetoválód vázlata – a hátteret automatikusan eltávolítjuk.')}</span>
          </li>
          <li>
            <b>{t('3. Place it', '3. Helyezd el')}</b>
            <span>{t('Drag, pinch and rotate it into place and see the real size in centimetres.', 'Húzd, méretezd, forgasd a helyére, és lásd a valós méretet centiméterben.')}</span>
          </li>
          <li>
            <b>{t('4. Watch it age', '4. Nézd, hogyan öregszik')}</b>
            <span>{t('Realistic previews on your own skin at 1, 10, 30 and 50 years, plus an Ink Longevity Score with tips.', 'Valósághű képek a saját bőrödön 1, 10, 30 és 50 év múlva, plusz tartóssági pontszám tippekkel.')}</span>
          </li>
          <li>
            <b>{t('5. Ask your friends', '5. Kérdezd meg a barátaidat')}</b>
            <span>{t('Make a TikTok-ready video or send a link your friends can vote on.', 'Készíts TikTokra kész videót, vagy küldj egy linket, amin a barátaid szavazhatnak.')}</span>
          </li>
        </ol>
        <p style={{ marginTop: 24 }}>
          <Link className="btn" href="/app">
            {t('Start now', 'Kezdjük')}
          </Link>
        </p>
      </section>

      <section className="facts">
        <h2>{t('Know before you ink', 'Tudd, mielőtt varratsz')}</h2>
        {ARTICLES.slice(0, 4).map((a) => (
          <p key={a.slug}>
            <Link href={`/learn/${a.slug}${lang === 'hu' ? '?lang=hu' : ''}`} style={{ fontWeight: 700 }}>
              {a.title[lang]}
            </Link>
            <br />
            <span style={{ color: 'var(--ink-2)' }}>{a.desc[lang]}</span>
          </p>
        ))}
      </section>

      <section className="facts">
        <h2>{t('How styles age, by body area', 'Hogyan öregszenek a stílusok testrészenként?')}</h2>
        <p style={{ lineHeight: 2 }}>
          {SEO_STYLES.slice(0, 3).flatMap((st) =>
            SEO_AREAS.slice(0, 4).map((ar) => (
              <Link key={st.k + ar.k} href={`/tattoo/${st.k}-${ar.k}${lang === 'hu' ? '?lang=hu' : ''}`} style={{ marginRight: 16, display: 'inline-block' }}>
                {lang === 'hu' ? `${st.hu} – ${ar.hu}` : `${st.en} on the ${ar.en}`}
              </Link>
            ))
          )}
        </p>
      </section>

      <footer>
        <Link href="/learn">{t('Guides', 'Útmutatók')}</Link>
        <Link href="/terms">{t('Terms', 'Feltételek')}</Link>
        <Link href="/privacy">{t('Privacy', 'Adatvédelem')}</Link>
      </footer>
    </main>
  );
}
