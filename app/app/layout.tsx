import { AppProvider } from './AppProvider';
import { AuthSheet, BottomNav, DeskTheme, TopBar } from './ui';
import { AppConsent } from './AppConsent';
import './app.css';

export const metadata = { title: 'InkAge' };

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
