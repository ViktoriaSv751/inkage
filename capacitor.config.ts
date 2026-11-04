import type { CapacitorConfig } from '@capacitor/cli';

/* The store apps load the live app from https://inkage.app/app (server.url below), so every web release reaches them
   at once; cap-www/ is only the "no internet" page. Native parts: sign-in sheet, camera, push, local reminders,
   share sheet and deep links. CAP_BUNDLE=1 would ship a bundled copy instead (cap-native/, built by
   scripts/native-build.mjs): experimental, not yet working on devices. CAP_SERVER_URL=<url> loads another site. */
const config: CapacitorConfig = {
  appId: 'app.inkage',
  appName: 'InkAge',
  // CAP_BUNDLE=1 ships the bundled screens (cap-native/, experimental: not yet working on devices);
  // the store builds load the live app, which is the tested, working setup
  webDir: process.env.CAP_BUNDLE === '1' ? 'cap-native' : 'cap-www',
  appendUserAgent: 'InkAgeApp',
  server:
    process.env.CAP_BUNDLE === '1'
      ? { androidScheme: 'https', hostname: 'localhost' }
      : {
          url: process.env.CAP_SERVER_URL || 'https://inkage.app/app',
          cleartext: false,
          errorPath: 'index.html',
          // every inkage.app page stays inside the app (sign-in, terms, privacy, FAQ…): without this Capacitor hands any
          // address outside /app to Safari, and the app opened Safari on its first start (App Review 2.1(a), 2026-11-04)
          allowNavigation: ['inkage.app', 'www.inkage.app'],
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
    SplashScreen: { launchShowDuration: 1500, launchAutoHide: true, backgroundColor: '#000000', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { style: 'DARK', overlaysWebView: false, backgroundColor: '#000000' },
    // Android 15+ draws edge to edge: the web app pads itself with env(safe-area-inset-*) (viewport-fit=cover)
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
