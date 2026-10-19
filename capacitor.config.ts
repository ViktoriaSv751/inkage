import type { CapacitorConfig } from '@capacitor/cli';

/* The store apps carry their own copy of the app screens (cap-native/, built by scripts/native-build.mjs:
   App Store rule 4.2), with native sign-in, camera, push, local reminders, share sheet and deep links.
   The API, photos and website pages stay on https://inkage.app. CAP_SERVER_URL=<url> switches back to
   loading a live site (for debugging only). */
const config: CapacitorConfig = {
  appId: 'app.inkage',
  appName: 'InkAge',
  webDir: 'cap-native',
  appendUserAgent: 'InkAgeApp',
  server: process.env.CAP_SERVER_URL
    ? { url: process.env.CAP_SERVER_URL, cleartext: false }
    : { androidScheme: 'https', hostname: 'localhost' },
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
