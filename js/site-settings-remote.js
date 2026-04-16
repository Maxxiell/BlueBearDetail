/**
 * Load site-wide settings from Supabase so all visitors see admin pricing/copy (not only localStorage).
 * Requires supabase/site-settings.sql applied. Runs after js/site-settings.js defines bbdMergeRemoteSiteSettings.
 */
import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

(async function () {
  if (!isSupabaseConfigured()) return;
  var merge = window.bbdMergeRemoteSiteSettings;
  if (typeof merge !== "function") return;
  try {
    var res = await supabase.from("site_settings").select("settings").eq("id", "default").maybeSingle();
    if (res.error || !res.data || res.data.settings == null) return;
    var payload = res.data.settings;
    if (typeof payload !== "object" || payload === null) return;
    if (Object.keys(payload).length === 0) return;
    merge(payload);
  } catch (_e) {}
})();
