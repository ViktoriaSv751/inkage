import type { CapacitorConfig } from '@capacitor/cli';

/* The store apps are a thin native shell around the live web app (https://inkage.app/app),
   with native sign-in, push, share sheet, splash screen and deep links. Change `server.url`
   if the production domain changes. `cap-www` is only the offline fallback page. */
const config: CapacitorConfig = {
  appId: 'app.inkage',
  appName: 'InkAge',
  webDir: 'cap-www',
  appendUserAgent: 'InkAgeApp',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://inkage.app/app',
    cleartext: false,
    errorPath: 'index.html',
  },
  // dark first: the native frame around the web app is black (takes effect with the next store build)
  ios: {
    contentInset: 'never',
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
    // a build without Firebase (no google-services.json) must not ship the push plugin: calling it would crash
    ...(process.env.CAP_NO_PUSH === '1'
      ? { includePlugins: ['@capacitor/app', '@capacitor/browser', '@capacitor/camera', '@capacitor/filesystem', '@capacitor/haptics', '@capacitor/local-notifications', '@capacitor/share', '@capacitor/splash-screen', '@capacitor/status-bar'] }
      : {}),
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: '#ffffff', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: false, backgroundColor: '#000000' },
    // Android 15+ draws edge to edge: the web app pads itself with env(safe-area-inset-*) (viewport-fit=cover)
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
