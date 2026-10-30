'use client';
import Link from 'next/link';
import type { AuthFlow } from './useAuthFlow';

/** After sign-up or a reset request: a link is on its way. */
export function SentStep({ flow }: { flow: AuthFlow }) {
  const { T, q, email, sentKind, resend, busy, wait, err } = flow;
  return (
    <div className="au-done">
      <span className="au-mail" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
        </svg>
      </span>
      <h1>{T('Check your inbox', 'Nézd meg a leveleidet')}</h1>
      <p className="au-sub">
        {sentKind === 'reset'
          ? T('If there’s an account for ', 'Ha van fiók ehhez a címhez: ')
          : T('We sent a confirmation link to ', 'Megerősítő linket küldtünk ide: ')}
        <b>{email}</b>
        {sentKind === 'reset' ? T(', you’ll get a link to set a new password.', ', kapsz egy linket az új jelszó beállításához.') : T('. Open it to activate your account.', '. Nyisd meg, és aktiváld a fiókodat.')}
      </p>
      <Link className="au-btn as-link" href={`/belepes${q}`}>
        {T('Back to sign in', 'Vissza a belépéshez')}
      </Link>
      <p className="au-hint">{T('Didn’t get it? Check spam, or send it again.', 'Nem jött meg? Nézd meg a spam mappát, vagy küldd el újra.')}</p>
      {sentKind === 'confirm' && (
        <button type="button" className="au-resend" disabled={busy || wait > 0} onClick={resend}>
          {wait > 0 ? T(`Sent again – you can resend in ${wait} s`, `Újraküldve – ${wait} mp múlva küldheted újra`) : T('Send the e-mail again', 'Levél újraküldése')}
        </button>
      )}
      {err && <p className="au-err">{err}</p>}
    </div>
  );
}

/** The 6-digit code from the e-mail. */
export function CodeStep({ flow }: { flow: AuthFlow }) {
  const { T, email, setStep, code, setCode, busy, setErr, wait, boxes, send, verify, setDigit } = flow;
  return (
    <>
      <button type="button" className="au-back" onClick={() => (setStep('email'), setCode(['', '', '', '', '', '']), setErr(''))}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        {T('Back', 'Vissza')}
      </button>
      <span className="au-mail" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
        </svg>
      </span>
      <h1>{T('Check your inbox', 'Nézd meg a leveleidet')}</h1>
      <p className="au-sub">
        {T('We sent a 6-digit code to ', 'Küldtünk egy 6 jegyű kódot ide: ')}
        <b>{email}</b>
      </p>
      <div className="au-otp" onPaste={(e) => (e.preventDefault(), setDigit(0, e.clipboardData.getData('text')))}>
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            value={d}
            aria-label={T(`Digit ${i + 1}`, `${i + 1}. számjegy`)}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && boxes.current[i - 1]?.focus()}
          />
        ))}
      </div>
      <button className="au-btn" disabled={busy || code.join('').length < 6} onClick={() => verify()}>
        {busy ? <i className="au-spin" aria-hidden="true" /> : T('Continue', 'Tovább')}
      </button>
      <p className="au-resend">
        {wait > 0 ? (
          T(`You can request a new code in ${wait} s`, `Új kódot ${wait} mp múlva kérhetsz`)
        ) : (
          <button type="button" onClick={() => send()}>
            {T('Send a new code', 'Új kód küldése')}
          </button>
        )}
      </p>
      <p className="au-hint">{T('You can also tap the link in the e-mail.', 'A levélben lévő linkre is koppinthatsz.')}</p>
    </>
  );
}
