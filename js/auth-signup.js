import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

var form = document.getElementById("signup-form");
var errEl = document.getElementById("signup-error");
var okEl = document.getElementById("signup-success");

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

initPasswordToggles();

function showError(msg) {
  if (!errEl) return;
  errEl.textContent = msg || "";
  errEl.hidden = !msg;
  if (okEl) okEl.hidden = true;
}

function showSuccess(msg) {
  if (okEl) {
    okEl.textContent = msg;
    okEl.hidden = false;
  }
  if (errEl) errEl.hidden = true;
}

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    if (!isSupabaseConfigured()) {
      showError("Account sign-up is temporarily unavailable. Please try again later.");
      return;
    }

    var fd = new FormData(form);
    var email = String(fd.get("email") || "").trim();
    var password = String(fd.get("password") || "");
    var confirm = String(fd.get("password_confirm") || "");

    if (password.length < 8) {
      showError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      showError("Passwords do not match.");
      return;
    }

    var redirectTo = new URL("login.html", window.location.href).href;

    var result = await supabase.auth.signUp({
      email: email,
      password: password,
      options: { emailRedirectTo: redirectTo },
    });

    if (result.error) {
      showError(result.error.message || "Could not create account.");
      return;
    }

    if (result.data.session) {
      window.location.href = "account.html";
      return;
    }

    showSuccess(
      "Check your email to confirm your address, then return here to log in."
    );
    form.reset();
  });
}
