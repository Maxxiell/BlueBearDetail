import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./supabase-config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

if (!isSupabaseConfigured()) {
  console.warn(
    "[Blue Bear] Set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase-config.js (Supabase Dashboard → Settings → API)."
  );
}
