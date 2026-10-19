'use client';
/* Sign in with Apple: App Store rule 5.1.1(v) asks apps to revoke the Apple token when an account is deleted.
   Supabase hands us Apple's refresh token once, right after an Apple sign-in; we keep it (only the owner can
   read it, row-level security) so account deletion can revoke it through /api/me/apple-revoke. */
import type { SupabaseClient } from '@supabase/supabase-js';

const KEY = 'ink_oauth_provider';

/** Remember which provider the sign-in that is about to start uses (the session itself doesn't say). */
export function markOAuthStart(provider: 'google' | 'apple') {
  try {
    localStorage.setItem(KEY, provider);
  } catch {}
}

function startedWithApple() {
  try {
    const v = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return v === 'apple';
  } catch {
    return false;
  }
}

export async function saveAppleToken(s: SupabaseClient, userId: string, refreshToken: string | null | undefined) {
  if (!refreshToken || !startedWithApple()) return;
  await s
    .from('apple_tokens')
    .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() })
    .then(
      () => {},
      () => {}
    );
}
