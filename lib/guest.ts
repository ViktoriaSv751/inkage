import crypto from 'crypto';
import { appSecret, userClient } from './server';

const COOKIE = 'ink_guest';

/** A random per-device id kept in a cookie, plus a salted hash of the IP (never the raw IP). */
export function guestFrom(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = new RegExp(`${COOKIE}=([a-f0-9-]{36})`).exec(cookie);
  const id = m?.[1] || crypto.randomUUID();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const ipHash = crypto.createHash('sha256').update(`ip:${appSecret('db')}:${ip}`).digest('hex').slice(0, 32);
  const setCookie = m ? null : `${COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
  return { id, ipHash, setCookie };
}

export async function guestStart(guest: string, ipHash: string, placement: string) {
  const { data, error } = await userClient().rpc('guest_start', { p_secret: appSecret('db'), p_guest: guest, p_ip: ipHash, p_placement: placement });
  if (error) throw error;
  return data as { ok: boolean; gid?: number; reason?: 'used' | 'busy' };
}
export async function guestBumpAge(gid: number, guest: string) {
  const { data } = await userClient().rpc('guest_bump_age', { p_secret: appSecret('db'), p_gid: gid, p_guest: guest });
  return !!data;
}
export async function guestRefund(gid: number, guest: string) {
  await userClient().rpc('guest_refund', { p_secret: appSecret('db'), p_gid: gid, p_guest: guest });
}
export async function guestHelperStart(guest: string, ipHash: string, label: string) {
  const { data, error } = await userClient().rpc('guest_helper_start', { p_secret: appSecret('db'), p_guest: guest, p_ip: ipHash, p_label: label });
  if (error) throw error;
  return data as { ok: boolean; gid?: number; reason?: 'used' | 'busy' };
}
