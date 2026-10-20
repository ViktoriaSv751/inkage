import { api, sb } from '@/lib/sb';
import { local, lsSet, shares, revokeGuestShare } from '@/lib/store';

/** Deletes the account, its files and everything this device keeps; throws if the server refuses. */
export async function eraseAccount(s: NonNullable<ReturnType<typeof sb>>, uid: string) {
  // vote links made on this device without an account
  for (const x of shares.all()) if (x.kind !== 'preview') await revokeGuestShare(x.id).catch(() => false);
  // Sign in with Apple: revoke Apple's token first (App Store 5.1.1(v)); never blocks the deletion
  await api('/api/me/apple-revoke', {}).catch(() => null);
  const { error } = await s.rpc('erase_my_account');
  if (error) throw error;
  for (const bucket of ['previews', 'shares']) {
    const { data: dirs } = await s.storage.from(bucket).list(uid, { limit: 1000 });
    for (const d of dirs || []) {
      const { data: files } = await s.storage.from(bucket).list(`${uid}/${d.name}`, { limit: 1000 });
      const paths = (files || []).map((f) => `${uid}/${d.name}/${f.name}`);
      if (paths.length) await s.storage.from(bucket).remove(paths);
    }
  }

  lsSet('ink_shares', []);
  lsSet('ink_posts', []);
  const mine = await local.all().catch(() => []);
  for (const p of mine) await local.remove(p.id);
  ['ink_onboarding', 'ink_ref', 'ink_folders', 'ink_recent_photos'].forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
}
