import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

var ADMIN_USER = "garcia219";
var ADMIN_PASS = "Efdatb21978h.m";
var ADMIN_AUTH_KEY = "bbdAdminAuth";
var ADMIN_AUTH_COOKIE = "bbdps_bbdAdminAuth__0";
var ADMIN_AUTH_COOKIE_COUNT = "bbdps_bbdAdminAuth__n";

var form = document.getElementById("login-form");
var errEl = document.getElementById("login-error");
var forgotToggle = document.getElementById("auth-forgot-toggle");
var forgotForm = document.getElementById("auth-forgot-form");
var forgotEmail = document.getElementById("auth-forgot-email");
var forgotOk = document.getElementById("auth-forgot-success");

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
}

function showForgotOk(msg) {
  if (!forgotOk) return;
  forgotOk.textContent = msg || "";
  forgotOk.hidden = !msg;
}

function safeNext(n) {
  if (!n || typeof n !== "string") return "account.html";
  if (/^[a-z0-9_.-]+\.html$/i.test(n)) return n;
  return "account.html";
}

function loginRedirectTarget() {
  var params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"));
}

function persistAdminAuth() {
  try {
    localStorage.setItem(ADMIN_AUTH_KEY, "1");
  } catch (_e) {}
  document.cookie = ADMIN_AUTH_COOKIE_COUNT + "=1; path=/; max-age=31536000; samesite=lax";
  document.cookie = ADMIN_AUTH_COOKIE + "=1; path=/; max-age=31536000; samesite=lax";
}

if (forgotToggle && forgotForm) {
  forgotToggle.addEventListener("click", function () {
    forgotForm.hidden = !forgotForm.hidden;
    if (!forgotForm.hidden && forgotEmail) forgotEmail.focus();
  });
}

if (forgotForm) {
  forgotForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");
    showForgotOk("");
    if (!isSupabaseConfigured()) {
      showError("Account sign-in is temporarily unavailable. Please try again later.");
      return;
    }
    var email = String((forgotEmail && forgotEmail.value) || "").trim();
    if (!email || email.indexOf("@") === -1) {
      showError("Enter a valid email address for password reset.");
      return;
    }
    var redirectTo = new URL("reset-password.html", window.location.href).href;
    var result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (result.error) {
      showError(result.error.message || "Could not send reset link.");
      return;
    }
    showForgotOk("Reset link sent. Check your email.");
    forgotForm.reset();
  });
}

if (form) {
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    var fd = new FormData(form);
    var email = String(fd.get("email") || "").trim();
    var password = String(fd.get("password") || "");

    if (email === ADMIN_USER && password === ADMIN_PASS) {
      persistAdminAuth();
      window.location.href = "admin.html";
      return;
    }

    if (!isSupabaseConfigured()) {
      showError("Account sign-in is temporarily unavailable. Please try again later.");
      return;
    }

    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
      showError(result.error.message || "Could not sign in.");
      return;
    }

    window.location.href = loginRedirectTarget();
  });
}
