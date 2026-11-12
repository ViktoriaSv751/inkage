import './guest.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { fromBrowser, isLang, localeOf, tx, type Lang } from '@/lib/tr';
import { placeName } from '@/lib/placements';
import { PUBLIC } from '@/lib/public-config';

/** ?lang= wins, then the language middleware.ts resolved, then the browser's (same as the vote pages). */
function reqLang(sp?: { lang?: string | string[] } | null): Lang {
  const v = Array.isArray(sp?.lang) ? sp?.lang[0] : sp?.lang;
  if (isLang(v)) return v;
  const h = headers().get('x-ink-lang');
  if (isLang(h)) return h;
  return fromBrowser(headers().get('accept-language') || '');
}

export const dynamic = 'force-dynamic';

/* The page a studio sends to its guest (/e/<id>, made in the app: lib/studio.ts createGuestLink). It shows only what
   the studio sent: the previews (today, 1/10/30/50 years, laser if made), the studio's name and logo, and a short
   neutral footer. No sign-up, no prices, not indexed. Closed links show a short notice. */

type Item = { id: string; placement: string; created_at: string; mode?: string; images: Record<string, string> };
type Data = { guest: string | null; studio: string | null; logo: string | null; items: Item[]; created_at: string };

export const metadata: Metadata = {
  title: 'Tetoválás-előnézet · Tattoo preview',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

async function getLink(id: string): Promise<Data | null> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return null;
  try {
    const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/guest_link_get`, {
      method: 'POST',
      headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${PUBLIC.supabaseAnonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_id: id }),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as Data | null;
  } catch {
    return null;
  }
}

const STAGES: [string, string, string][] = [
  ['fresh', 'Today', 'Ma'],
  ['healed', '1 year', '1 év'],
  ['y10', '10 years', '10 év'],
  ['y30', '30 years', '30 év'],
  ['y50', '50 years', '50 év'],
  ['laser3', 'After 3 laser sessions', '3 lézeres kezelés után'],
  ['laser6', 'After 6 laser sessions', '6 lézeres kezelés után'],
  ['laser10', 'After 10 laser sessions', '10 lézeres kezelés után'],
];
const safeUrl = (u?: string | null) => (u && /^https:\/\//.test(u) ? u : null);

export default async function GuestPage({ params, searchParams }: { params: { id: string }; searchParams?: { lang?: string } }) {
  const lang = reqLang(searchParams);
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const d = await getLink(params.id);
  if (!d) {
    return (
      <main className="gpage">
        <div className="gp-closed">
          <h1>{t('This link no longer works', 'Ez a link már nem él')}</h1>
          <p>{t('The studio closed it, or the address is wrong. Ask them for a new link.', 'A szalon lezárta, vagy elírás van a címben. Kérj tőlük új linket.')}</p>
        </div>
      </main>
    );
  }
  const logo = safeUrl(d.logo);
  const date = (s: string) => new Date(s).toLocaleDateString(localeOf(lang), { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <main className="gpage">
      <header className="gp-head">
        {logo && <img className="gp-logo" src={logo} alt={d.studio || ''} />}
        {d.studio && <p className="gp-studio">{d.studio}</p>}
        <h1>{d.guest ? t(`Tattoo preview for ${d.guest}`, `Tetoválás-előnézet – ${d.guest}`) : t('Your tattoo preview', 'A tetoválás-előnézeted')}</h1>
        <p className="gp-sub">{t('How the tattoo looks today and as the years pass. An AI simulation, not a guarantee.', 'Így néz ki a tetoválás ma, és ahogy telnek az évek. MI-szimuláció, nem garancia.')}</p>
      </header>
      {(d.items || []).map((it) => {
        const shots = STAGES.filter(([k]) => safeUrl(it.images?.[k]));
        return (
          <section key={it.id} className="gp-item">
            <h2>
              {placeName(it.placement, lang)} <small>· {date(it.created_at)}</small>
            </h2>
            <div className="gp-grid">
              {shots.map(([k, en, hu]) => (
                <figure key={k}>
                  <a href={safeUrl(it.images[k])!} target="_blank" rel="noopener noreferrer">
                    <img src={safeUrl(it.images[k])!} alt={t(en, hu)} loading="lazy" />
                  </a>
                  <figcaption>{t(en, hu)}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
      <footer className="gp-foot">{t('Previews made with InkAge · inkage.app', 'Az előnézetek InkAge-dzsel készültek · inkage.app')}</footer>
    </main>
  );
}
