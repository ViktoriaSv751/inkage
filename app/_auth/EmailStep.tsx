'use client';
import Link from 'next/link';
import type { AuthFlow } from './useAuthFlow';

/** The first step: Apple / Google, e-mail + password, or the reset form. */
export function EmailStep({ mode, flow }: { mode: 'login' | 'signup' | 'forgot'; flow: AuthFlow }) {
  const { T, q, email, setEmail, agree, setAgree, name, setName, pw, setPw, show, setShow, busy, err, setErr, okEmail, pwScore, loginPw, signupPw, forgot, oauth } = flow;
  const terms = (
    <>
      <Link href={`/terms${q}`}>{T('Terms', 'ÁSZF-et')}</Link>
      {T(' and the ', ' és az ')}
      <Link href={`/privacy${q}`}>{T('Privacy policy', 'Adatvédelmi tájékoztatót')}</Link>
    </>
  );
  return (
    <>
      {mode !== 'forgot' && (
        <div className="au-tabs" role="tablist">
          <Link href={`/belepes${q}`} role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''}>
            {T('Sign in', 'Belépés')}
          </Link>
          <Link href={`/regisztracio${q}`} role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''}>
            {T('Create account', 'Regisztráció')}
          </Link>
        </div>
      )}
      {mode === 'forgot' && (
        <Link className="au-back" href={`/belepes${q}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {T('Back to sign in', 'Vissza a belépéshez')}
        </Link>
      )}
      {mode !== 'forgot' && (
        <p className="au-kick">
          <i aria-hidden="true" />
          {mode === 'login' ? T('Pick up where you left off', 'Folytasd, ahol abbahagytad') : T('Takes under a minute', 'Kevesebb mint 1 perc')}
        </p>
      )}
      <h1>{mode === 'login' ? T('Welcome back', 'Üdv újra itt') : mode === 'signup' ? T('Create your account', 'Hozd létre a fiókodat') : T('Forgot your password?', 'Elfelejtetted a jelszavad?')}</h1>
      <p className="au-sub">
        {mode === 'login'
          ? T('Sign in with Apple, Google or your e-mail to try InkAge on your own photo.', 'Lépj be Apple-, Google-fiókkal vagy e-maillel, és próbáld ki az InkAge-et a saját fotódon.')
          : mode === 'signup'
            ? T('One tap with Apple or Google, or sign up with your e-mail – then try it on your own photo.', 'Egy koppintás Apple- vagy Google-fiókkal, vagy regisztrálj e-maillel – utána kipróbálhatod a saját fotódon.')
            : T('Enter your e-mail and we’ll send you a link to set a new one.', 'Add meg az e-mail-címed, és küldünk egy linket az új jelszó beállításához.')}
      </p>

      {mode !== 'forgot' && (
        <div className="au-social">
          <button type="button" className="au-soc dark" onClick={() => oauth('apple')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16.4 12.6c0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.8-4.2zM14 5.2c.7-.8 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z" />
            </svg>
            {T('Continue with Apple', 'Folytatás Apple-lel')}
          </button>
          <button type="button" className="au-soc" onClick={() => oauth('google')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.1a11 11 0 0 0 0 9.8z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.2L5.8 10c.9-2.6 3.3-4.6 6.2-4.6z" />
            </svg>
            {T('Continue with Google', 'Folytatás Google-lel')}
          </button>
          {/* tapping Apple / Google is the agreement (no box to tick first: on a phone the box and its error were off screen) */}
          <p className="au-legal" style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.45, textAlign: 'center', color: 'var(--ink-3)' }}>
            {T('By continuing you confirm you’re 18 or older and accept the ', 'A folytatással megerősíted, hogy elmúltál 18 éves, és elfogadod az ')}
            {terms}.
          </p>
          {err && (
            <p className="au-err" role="alert" style={{ marginTop: 6 }}>
              {err}
            </p>
          )}
          <Link href={`/app/explore${q}`} className="au-browse" style={{ display: 'block', textAlign: 'center', padding: '10px 0 2px', fontSize: 15, fontWeight: 600, textDecoration: 'underline', color: 'inherit' }}>
            {T('Look around first, without an account', 'Előbb körülnézek, fiók nélkül')}
          </Link>
        </div>
      )}

      {mode !== 'forgot' && (
        <>
          <div className="au-or" role="separator">
            <span>{mode === 'login' ? T('or sign in with e-mail', 'vagy belépés e-maillel') : T('or sign up with e-mail', 'vagy regisztráció e-maillel')}</span>
          </div>
          <form onSubmit={mode === 'login' ? loginPw : signupPw} className="au-form au-pw" id="email-auth">
            {mode === 'signup' && (
              <label className="au-field">
                <span>{T('Name (optional)', 'Név (nem kötelező)')}</span>
                <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            )}
            <label className="au-field">
              <span>{T('E-mail address', 'E-mail-cím')}</span>
              <input type="email" autoComplete={mode === 'login' ? 'username' : 'email'} inputMode="email" placeholder={T('you@email.com', 'te@email.hu')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="au-field">
              <span className="au-field-row">
                {T('Password', 'Jelszó')}
                {mode === 'login' && (
                  <Link href={`/elfelejtett-jelszo${q}`} className="au-forgot">
                    {T('Forgot it?', 'Elfelejtetted?')}
                  </Link>
                )}
              </span>
              <input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? T('At least 8 characters', 'Legalább 8 karakter') : ''} value={pw} onChange={(e) => setPw(e.target.value)} required />
            </label>
            {mode === 'signup' && pw.length > 0 && (
              <div className="au-strength" data-s={pwScore} aria-hidden="true">
                <i /><i /><i />
                <span>{[T('Too short', 'Túl rövid'), T('Weak', 'Gyenge'), T('Good', 'Jó'), T('Strong', 'Erős')][pwScore]}</span>
              </div>
            )}
            <label className="au-showpw">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {T('Show password', 'Jelszó megjelenítése')}
            </label>
            {mode === 'signup' && (
              <label className="au-check">
                <input type="checkbox" checked={agree} onChange={(e) => (setAgree(e.target.checked), setErr(''))} />
                <span className="au-box" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M6 12.5l4 4L18 8" />
                  </svg>
                </span>
                <span>
                  {T('I’m over 18 and accept the ', 'Elmúltam 18 éves, és elfogadom az ')}
                  {terms}.
                </span>
              </label>
            )}
            <button className="au-btn" disabled={busy || !okEmail || pw.length < (mode === 'login' ? 6 : 8) || (mode === 'signup' && !agree)}>
              {busy ? <i className="au-spin" aria-hidden="true" /> : mode === 'login' ? T('Sign in with e-mail', 'Belépés e-maillel') : T('Create account with e-mail', 'Regisztráció e-maillel')}
            </button>
            {mode === 'signup' && !agree && <p className="au-hint">{T('Tick the box above to continue.', 'A folytatáshoz pipáld be a fenti mezőt.')}</p>}
          </form>
        </>
      )}

      {mode === 'forgot' ? (
        <form onSubmit={forgot} className="au-form">
          <label className="au-field">
            <span>{T('E-mail address', 'E-mail-cím')}</span>
            <input type="email" autoComplete="email" inputMode="email" placeholder={T('you@email.com', 'te@email.hu')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="au-btn" disabled={busy || !okEmail}>
            {busy ? <i className="au-spin" aria-hidden="true" /> : T('Send reset link', 'Visszaállító link küldése')}
          </button>
        </form>
      ) : (
        <div className="au-form">
          <ul className="au-trust">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" /></svg>
              {T('Private account', 'Privát fiók')}
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM6.5 6.5l11 11" /></svg>
              {T('No posting for you', 'Nem posztolunk')}
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
