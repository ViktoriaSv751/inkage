import { AppProvider } from './AppProvider';
import { AuthSheet, BottomNav, DeskTheme, TopBar } from './ui';
import { AppConsent } from './AppConsent';
import './app.css';

export const metadata = { title: 'InkAge' };
// the app screens don't zoom (pinch or double tap): pictures stay in their boxes
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#000000', colorScheme: 'dark' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="appshell">
        <TopBar />
        <main className="appmain">{children}</main>
        <BottomNav />
        <DeskTheme />
        <AppConsent />
      </div>
      <AuthSheet />
    </AppProvider>
  );
}
