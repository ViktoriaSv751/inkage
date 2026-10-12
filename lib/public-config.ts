// Public, non-secret configuration (safe in the browser). Environment variables override these.
export const PUBLIC = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ibfpdbbcnyoqazodkmna.supabase.co',
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZnBkYmJjbnlvcWF6b2RrbW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MDc3NjAsImV4cCI6MjEwNzM4Mzc2MH0.DgduJDsqCudF4prmLHg7AFN-hMuIS7S5wwQgHVVni2o',
  priceWeekly: process.env.NEXT_PUBLIC_PRICE_WEEKLY_LABEL || '$5.99 / week',
  priceLifetime: process.env.NEXT_PUBLIC_PRICE_LIFETIME_LABEL || '$49.99 once',
};
