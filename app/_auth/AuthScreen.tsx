'use client';
import { type Lang } from '@/lib/tr';
import { ThemeToggle } from '../ThemeToggle';
import { LangPicker } from '../LangPicker';
import { setLang } from '@/lib/i18n';

import Link from 'next/link';
import { AuthArt } from './AuthArt';
import './auth.css';
import { LogoMark } from '../LogoMark';
import { EmailStep } from './EmailStep';
import { CodeStep, SentStep } from './InboxSteps';
import { useAuthFlow } from './useAuthFlow';


/** Full-page sign-in / sign-up with e-mail code (and Google / Apple when switched on). */
export function AuthScreen({ mode, lang }: { mode: 'login' | 'signup' | 'forgot'; lang: Lang; img?: string }) {
  const flow = useAuthFlow(mode, lang);
  const { T, q, native, step, err } = flow;

  return (
    <div className="au">
      <header className="au-bar">
        <Link href={native ? `/belepes${q}` : `/${q}`} className="au-logo" aria-label="InkAge">
          <LogoMark />
          InkAge
        </Link>
        <span className="au-top-r">
          <span className="tg-lang">
            <LangPicker lang={lang} variant="icon" onPick={(l) => setLang(l)} />
          </span>
          <ThemeToggle lang={lang} />
          {!native && (
            <Link href={`/${q}`} className="au-close" aria-label={T('Close', 'Bezárás')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Link>
          )}
        </span>
      </header>

      <aside className="au-art">
        <AuthArt lang={lang} />
        <div className="au-art-copy">
          <h2>{T('See it before it’s permanent.', 'Nézd meg, mielőtt végleges lesz.')}</h2>
          <ul>
            <li>{T('Your designs on every device', 'A terveid minden eszközödön')}</li>
            <li>{T('Bonus previews for inviting friends', 'Bónusz előnézetek a meghívásokért')}</li>
            <li>{T('Try it on your own photo', 'Próbáld ki a saját fotódon')}</li>
          </ul>
        </div>
      </aside>

      <main className="au-main">
        <div className="au-card">
          {step === 'sent' ? (
            <SentStep flow={flow} />
          ) : step === 'email' ? (
            <EmailStep mode={mode} flow={flow} />
          ) : (
            <CodeStep flow={flow} />
          )}
          {/* on the first step the error sits under the Apple / Google buttons (EmailStep), where the tap was */}
          {err && step !== 'email' && (
            <p className="au-err" role="alert">
              {err}
            </p>
          )}
        </div>

        <p className="au-switch">
          {mode !== 'signup' ? (
            <>
              {T('New to InkAge? ', 'Még nincs fiókod? ')}
              <Link href={`/regisztracio${q}`}>{T('Create an account', 'Regisztrálj')}</Link>
            </>
          ) : (
            <>
              {T('Already have an account? ', 'Van már fiókod? ')}
              <Link href={`/belepes${q}`}>{T('Sign in', 'Lépj be')}</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
