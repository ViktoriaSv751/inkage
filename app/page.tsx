'use client';

import { AuthCta } from './AuthCta';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareImage } from '@/lib/client';
import { LandingSections } from './LandingSections';
import { SiteFooter } from './SiteFooter';
import { SiteNav } from './SiteNav';
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
    <>
    <SiteNav lang={lang} onLang={setLang} signedIn={signedIn} />
    <main>

      <section className="hero">
        <div className="hero-copy">
          <h1>
            {t('Your tattoo,|50 years|from now.', 'A tetoválásod|50 év|múlva.')
              .split('|')
              .map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
          </h1>
          <p className="lede">
            {t(
              'Put any design on a photo of your own body. See it fresh, healed, and at 10, 30 and 50 years — on your skin — before it’s permanent.',
              'Tegyél bármilyen mintát a saját testedről készült fotóra. Nézd meg frissen, gyógyultan, 10, 30 és 50 év múlva – a saját bőrödön –, mielőtt végleges lesz.'
            )}
          </p>
          <AuthCta lang={lang} where="hero" />
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) startWithPhoto(f); e.target.value = ''; }} />
          <p className="fine" style={{ textAlign: 'left' }}>
            {made >= 100
              ? t(`${made.toLocaleString('en')} previews made so far. Free after sign-up with Google or Apple.`, `Eddig ${made.toLocaleString('hu')} előnézet készült. Google- vagy Apple-fiókkal regisztrálva ingyenes.`)
              : t('Free after a one-tap sign-up with Google or Apple.', 'Egy koppintásos Google- vagy Apple-regisztráció után ingyenes.')}
          </p>
        </div>
        <HeroAging />
      </section>

      <LandingSections lang={lang} made={made} onUpload={() => (track('landing_cta_bottom'), fileRef.current?.click())} />
    </main>
    <SiteFooter lang={lang} />
    </>
  );
}
