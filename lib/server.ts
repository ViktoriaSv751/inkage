import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import crypto from 'crypto';

export type Plan = 'free' | 'weekly' | 'lifetime';

const URL_ = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function serverConfig() {
  return {
    ai: !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
    auth: !!(URL_() && ANON() && process.env.APP_SECRET),
    payments: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_WEEKLY && process.env.STRIPE_PRICE_LIFETIME),
  };
}

/** A Supabase client acting as the signed-in user (RLS + SECURITY DEFINER functions do the rest). */
export function userClient(token?: string): SupabaseClient {
  return createClient(URL_()!, ANON()!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export type Authed = { user: User; db: SupabaseClient };

export async function getAuthed(req: Request): Promise<Authed | null> {
  if (!URL_() || !ANON()) return null;
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  const token = h.slice(7);
  const db = userClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, db };
}

export type Quota = {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  canAge: boolean;
  stripe_customer_id: string | null;
};

export async function quota(db: SupabaseClient): Promise<Quota> {
  const { data, error } = await db.rpc('my_quota');
  if (error) throw error;
  return data as Quota;
}

// ---- signed tokens so /api/age only ages images we generated for a paying user
function secret() {
  return process.env.APP_SECRET || 'dev-secret';
}
export function sha(data: string) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
export function signToken(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyToken<T>(token: string): T | null {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

/** Calls the guarded webhook function in the database. */
export async function stripeApply(args: { user?: string | null; customer?: string | null; plan?: string | null; until?: string | null }) {
  const { error } = await userClient().rpc('stripe_apply', {
    p_secret: process.env.APP_SECRET,
    p_user: args.user ?? null,
    p_customer: args.customer ?? null,
    p_plan: args.plan ?? null,
    p_until: args.until ?? null,
  });
  if (error) throw error;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export function dataUrlToBuffer(dataUrl: string): { buf: Buffer; mime: string } {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('Invalid image');
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}
