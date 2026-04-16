/**
 * Supabase project keys (Dashboard → Settings → API).
 * Replace placeholders before using auth in production.
 */
export const SUPABASE_URL = "https://jwckqgkhnylioanmmtgt.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3Y2txZ2tobnlsaW9hbm1tdGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTEzMzksImV4cCI6MjA5MTkyNzMzOX0.XeVaYH60xRwV8l0RMSDd4rRVXTbal_gnuBgXb27vv7o";

export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === "string" &&
    !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
    typeof SUPABASE_ANON_KEY === "string" &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON")
  );
}
