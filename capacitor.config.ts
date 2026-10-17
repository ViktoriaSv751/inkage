import type { CapacitorConfig } from '@capacitor/cli';

/* The store apps are a thin native shell around the live web app (https://inkage.vercel.app/app),
   with native sign-in, push, share sheet, splash screen and deep links. Change `server.url`
   if the production domain changes. `cap-www` is only the offline fallback page. */
const config: CapacitorConfig = {
  appId: 'app.inkage',
  appName: 'InkAge',
  webDir: 'cap-www',
  appendUserAgent: 'InkAgeApp',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://inkage.vercel.app/app',
    cleartext: false,
    errorPath: 'index.html',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#f3d6c8',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#f3d6c8',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: '#f3d6c8', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { style: 'DEFAULT', overlaysWebView: false, backgroundColor: '#f3d6c8' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
