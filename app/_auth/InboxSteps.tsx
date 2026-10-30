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
