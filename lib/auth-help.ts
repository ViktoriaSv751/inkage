// Small helpers shared by every Google / Apple sign-in button (web and the native apps).
import { tx, type Lang } from './tr';

/** Google: always show the account chooser, so a different Gmail can be picked every time.
 *  Apple has no such switch – it always uses the Apple ID signed in on the device / in the browser. */
export const oauthParams = (provider: 'google' | 'apple'): Record<string, string> | undefined =>
  provider === 'google' ? { prompt: 'select_account' } : undefined;

/** The error code of a failed sign-in redirect (#error=…&error_code=… or ?error=…), if any. */
export function authErrorCode(p: URLSearchParams): string | null {
  const code = p.get('error_code') || p.get('error');
  if (!code) return null;
  const desc = p.get('error_description') || '';
  if (/banned/i.test(code + desc)) return 'user_banned';
  return code.replace(/[^\w-]/g, '').slice(0, 40) || 'unknown';
}

/** What to tell the person on the sign-in page. */
export function authErrorText(code: string, lang: Lang): string {
  if (code === 'user_banned')
    return tx(
      lang,
      'This account was deleted, so it can’t be used to sign in. Choose another Google account or Apple ID, or sign up with your e-mail.',
      'Ez a fiók törölve lett, ezért nem lehet vele belépni. Válassz másik Google-fiókot vagy Apple ID-t, vagy regisztrálj e-mail-címmel.'
    );
  if (code === 'access_denied')
    return tx(lang, 'Sign-in was cancelled. Try again.', 'A belépés megszakadt. Próbáld újra.');
  return tx(lang, 'Sign-in didn’t work. Try again, or use your e-mail.', 'A belépés nem sikerült. Próbáld újra, vagy lépj be e-mail-címmel.');
}
