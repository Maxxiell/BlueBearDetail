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
    window.dispatchEvent(new CustomEvent("bbd:site-settings-updated"));
  } catch (_e) {}

  try {
    var channel = supabase
      .channel("site-settings-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
          filter: "id=eq.default",
        },
        function (evt) {
          var row = evt && evt.new ? evt.new : null;
          var settings = row && row.settings ? row.settings : null;
          if (!settings || typeof settings !== "object") return;
          merge(settings);
          window.dispatchEvent(new CustomEvent("bbd:site-settings-updated"));
        }
      )
      .subscribe();
  } catch (_e) {}
})();
