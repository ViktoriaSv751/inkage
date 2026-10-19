/* The store apps carry their own copy of the app screens (a static build, App Store rule 4.2), so inside them
   the page lives at capacitor://localhost or https://localhost while the server, the API and every public link
   stay on the website. NEXT_PUBLIC_NATIVE_BUNDLE is set only for that build. */
export const NATIVE_BUNDLE = !!process.env.NEXT_PUBLIC_NATIVE_BUNDLE;
export const SITE_URL = 'https://inkage.app';

/** Where links that other people open (shares, invites, e-mail sign-in) must point. */
export function siteOrigin(): string {
  if (NATIVE_BUNDLE || typeof location === 'undefined') return SITE_URL;
  return location.origin;
}

/** Pages that are part of the bundled app; everything else opens from the website. */
export const BUNDLED_PATH = /^\/(app(\/(gallery|explore|profile|create))?|belepes|regisztracio|elfelejtett-jelszo|uj-jelszo)?\/?$/;

/** Prefix for the website's API when the page itself is not on the website. */
export const API_HOST = NATIVE_BUNDLE ? SITE_URL : '';
