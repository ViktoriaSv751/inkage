/* The admin dashboard (copied from Calligra's) reads these names; InkAge keeps its values in lib/public-config. */
import { PUBLIC } from '../public-config';

export const SUPABASE_URL = PUBLIC.supabaseUrl;
export const SUPABASE_KEY = PUBLIC.supabaseAnonKey;
export const isConfigured = () => !process.env.NEXT_PUBLIC_STATIC_DEMO && Boolean(SUPABASE_URL && SUPABASE_KEY);
