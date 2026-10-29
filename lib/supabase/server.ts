/* The admin routes' Supabase client, acting as the signed-in owner: her access token from the Authorization header
   (the dashboard's own requests) or the ink_adm cookie (the platforms' sign-in redirects). The database functions
   (is_admin, admin_*) decide what that token may do. */
import { cookies, headers } from 'next/headers';
import { userClient } from '../server';
import { isConfigured } from './config';

export async function supabaseServer() {
  if (!isConfigured()) return null;
  const h = headers();
  const bearer = h.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const tok = bearer || cookies().get('ink_adm')?.value;
  if (!tok || tok.split('.').length !== 3) return null;
  return userClient(tok);
}
