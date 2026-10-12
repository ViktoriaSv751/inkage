import { AppProvider } from './AppProvider';
import { AuthSheet, BottomNav } from './ui';
import './app.css';

export const metadata = { title: 'InkAge' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="appshell">
        <main className="appmain">{children}</main>
        <BottomNav />
      </div>
      <AuthSheet />
    </AppProvider>
  );
}
