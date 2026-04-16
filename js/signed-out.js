/**
 * signed-out.html: clear Supabase session first, then load account menu (so UI isn’t “still signed in”), then redirect.
 * Restarting your static file server does not log anyone out — the session is stored in the browser (localStorage).
 */
import { supabase, clearPersistedAuthSession } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

async function main() {
  if (isSupabaseConfigured()) {
    try {
      var signOutRes = await supabase.auth.signOut({ scope: "global" });
      if (signOutRes.error) {
        console.error("[auth] signOut", signOutRes.error);
        clearPersistedAuthSession();
      }
    } catch (e) {
      console.error("[auth] signOut", e);
      clearPersistedAuthSession();
    }
  }
  await import("./auth-dropdown.js");
  setTimeout(function () {
    window.location.replace("index.html");
  }, 2000);
}

main();
