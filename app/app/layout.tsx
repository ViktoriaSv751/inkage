import { AppProvider } from './AppProvider';
import { AuthSheet, BottomNav, TopBar } from './ui';
import './app.css';

export const metadata = { title: 'InkAge' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="appshell">
        <TopBar />
        <main className="appmain">{children}</main>
        <BottomNav />
      </div>
      <AuthSheet />
    </AppProvider>
  );
}
