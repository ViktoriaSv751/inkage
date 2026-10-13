import { appSecret, userClient } from './server';

/**
 * Results of a running preview are kept on the server for a while,
 * so closing the app mid-way doesn't lose them (the app picks them up when reopened).
 */
export async function jobPut(id: unknown, owner: string, key: string, value: unknown) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return;
  await userClient()
    .rpc('job_put', { p_secret: appSecret('db'), p_id: id, p_owner: owner, p_key: key, p_value: value })
    .then(
      ({ error }) => error && console.warn('job_put failed', error.message),
      (e) => console.warn('job_put failed', e)
    );
}

export async function jobGet(id: string, owner: string) {
  const { data } = await userClient().rpc('job_get', { p_secret: appSecret('db'), p_id: id, p_owner: owner });
  return (data || null) as Record<string, any> | null;
}
