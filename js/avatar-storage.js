/**
 * Per-user avatar localStorage keys (never share one key across accounts).
 */
import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

export const LEGACY_AVATAR_KEY = "bbdAccountAvatar";

export async function getAvatarStorageKey() {
  if (!isSupabaseConfigured()) {
    return "bbdAccountAvatar:local-admin";
  }
  const { data } = await supabase.auth.getSession();
  const uid = data && data.session && data.session.user ? data.session.user.id : null;
  if (uid) return "bbdAccountAvatar:" + uid;
  return "bbdAccountAvatar:guest";
}

export function isAvatarStorageKey(key) {
  return typeof key === "string" && key.indexOf("bbdAccountAvatar") === 0;
}
