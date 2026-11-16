import { SharedView } from '../../../v/[id]/SharedView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'InkAge', robots: { index: false } };

/** A community post or poll opened from Explore, inside the app. */
export default async function AppShared(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <SharedView id={params.id} inApp />;
}
