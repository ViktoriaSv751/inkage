import { langOf } from '@/lib/tr';
import { TudastarView } from '../../tudastar/TudastarView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tudástár – InkAge' };

/** The knowledge base inside the app: same articles, the app's own frame, the person stays signed in. */
export default function AppTudastar({ searchParams }: { searchParams: { lang?: string } }) {
  return <TudastarView lang={langOf(searchParams)} inApp />;
}
