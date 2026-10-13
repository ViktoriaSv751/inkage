import { userClient } from './server';

/** Record a server-side failure so it shows on the admin page (no personal data, just what failed). */
export async function logServerError(route: string, e: unknown) {
  const msg = String((e as any)?.message || e).slice(0, 300);
  await userClient()
    .rpc('log_event', { p_name: 'server_error', p_anon: 'server', p_props: { route, msg } })
    .then(
      () => {},
      () => {}
    );
}
