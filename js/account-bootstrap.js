import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

async function main() {
  var currentPage = (window.location.pathname.split("/").pop() || "account.html").toLowerCase();
  var nextPage = /^[a-z0-9_.-]+\.html$/i.test(currentPage) ? currentPage : "account.html";
  if (isSupabaseConfigured()) {
    var result = await supabase.auth.getSession();
    if (!result.data.session) {
      window.location.replace("login.html?next=" + encodeURIComponent(nextPage));
      return;
    }
  }

  await import("./auth-dropdown.js");
}

main();
