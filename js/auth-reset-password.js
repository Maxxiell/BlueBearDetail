import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

var form = document.getElementById("reset-form");
var errEl = document.getElementById("reset-error");
var okEl = document.getElementById("reset-success");

function showError(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
  if (okEl) okEl.hidden = true;
}

function showSuccess(msg) {
  if (!okEl) return;
  okEl.textContent = msg || "";
  okEl.hidden = !msg;
  if (errEl) errEl.hidden = true;
}

function initPasswordToggles() {
  document.querySelectorAll("[data-pass-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-pass-toggle");
      var input = id ? document.getElementById(id) : null;
      var icon = btn.querySelector("i");
      if (!input) return;
      var nextType = input.type === "password" ? "text" : "password";
      input.type = nextType;
      var showing = nextType === "text";
      btn.setAttribute("aria-label", showing ? "Hide password" : "Show password");
      if (icon) {
        icon.classList.toggle("fa-eye", !showing);
        icon.classList.toggle("fa-eye-slash", showing);
      }
    });
  });
}

async function ensureRecoverySession() {
  if (!isSupabaseConfigured()) return false;
  var res = await supabase.auth.getSession();
  return !!(res.data && res.data.session);
}

initPasswordToggles();

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");
    if (!isSupabaseConfigured()) {
      showError("Password reset is temporarily unavailable. Please try again later.");
      return;
    }
    if (!(await ensureRecoverySession())) {
      showError("Reset session expired. Request a new reset link from the login page.");
      return;
    }
    var fd = new FormData(form);
    var pass = String(fd.get("password") || "");
    var confirm = String(fd.get("password_confirm") || "");
    if (pass.length < 8) {
      showError("Use at least 8 characters.");
      return;
    }
    if (pass !== confirm) {
      showError("Passwords do not match.");
      return;
    }
    var update = await supabase.auth.updateUser({ password: pass });
    if (update.error) {
      showError(update.error.message || "Could not update password.");
      return;
    }
    showSuccess("Password updated. Redirecting to login...");
    setTimeout(function () {
      window.location.href = "login.html";
    }, 1400);
  });
}
