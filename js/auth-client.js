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

/**
 * Clears Supabase session keys from localStorage (e.g. if signOut() failed offline).
 * Keys match the pattern used by supabase-js: sb-<project-ref>-auth-token…
 */
export function clearPersistedAuthSession() {
  try {
    Object.keys(localStorage).forEach(function (key) {
      if (/^sb-[\w-]+-auth-token/.test(key)) {
        localStorage.removeItem(key);
      }
    });
  } catch (_e) {}
}

if (!isSupabaseConfigured()) {
  console.warn(
    "[Blue Bear] Set SUPABASE_URL and SUPABASE_ANON_KEY in js/supabase-config.js (Supabase Dashboard → Settings → API)."
  );
}
