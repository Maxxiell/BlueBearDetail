import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

  var viewEl = document.getElementById("account-profile-view");
  var formEl = document.getElementById("account-profile-form");
  var editBtn = document.getElementById("account-profile-edit-btn");
  var cancelBtn = document.getElementById("account-profile-cancel-btn");
  var passForm = document.getElementById("account-password-form");

  var emailInput = document.getElementById("acct-email");
  var confirmRow = document.getElementById("acct-email-confirm-row");
  var confirmInput = document.getElementById("acct-email-confirm");
  var confirmBtn = document.getElementById("acct-email-confirm-btn");

  var firstEl = document.getElementById("acct-first");
  var lastEl = document.getElementById("acct-last");
  var phoneEl = document.getElementById("acct-phone");
  var addressEl = document.getElementById("acct-address");

  /** @type {string} */
  var emailAtEditStart = "";
  /** @type {boolean} */
  var emailChangeAcknowledged = false;
  var STORAGE_KEY = "bbdAccountProfile";
  var currentSession = null;

  function toast(msg, variant) {
    if (typeof window.bbdShowToast === "function") {
      window.bbdShowToast(msg, { variant: variant || "info" });
    }
  }

  function readLocalStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") return o;
      }
    } catch (_e) {}
    return {};
  }

  function loadLocalProfile() {
    var stored = readLocalStorage();
    return {
      firstName: typeof stored.firstName === "string" ? stored.firstName : "",
      lastName: typeof stored.lastName === "string" ? stored.lastName : "",
      email: typeof stored.email === "string" ? stored.email : "",
      phone: typeof stored.phone === "string" ? stored.phone : "",
      address: typeof stored.address === "string" ? stored.address : "",
    };
  }

  function saveLocalProfile(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (_e) {
      toast("Could not save profile (storage may be full).", "error");
      return false;
    }
  }

  async function getSession() {
    if (!isSupabaseConfigured()) return null;
    if (currentSession && currentSession.user) return currentSession;
    var res = await supabase.auth.getSession();
    currentSession = res.data && res.data.session ? res.data.session : null;
    return currentSession;
  }

  async function loadProfile() {
    if (!isSupabaseConfigured()) return loadLocalProfile();
    var session = await getSession();
    var user = session && session.user;
    if (!user) return loadLocalProfile();

    var profileRes = await supabase
      .from("profiles")
      .select("first_name,last_name,phone,default_service_address")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRes.error) {
      console.error("[account-forms] load profile error", profileRes.error);
      return loadLocalProfile();
    }

    var row = profileRes.data || {};
    return {
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: user.email || "",
      phone: row.phone || "",
      address: row.default_service_address || "",
    };
  }

  async function saveProfile(data) {
    if (!isSupabaseConfigured()) return saveLocalProfile(data);
    var session = await getSession();
    var user = session && session.user;
    if (!user) return false;

    var upsertRes = await supabase.from("profiles").upsert(
      {
        id: user.id,
        first_name: data.firstName || "",
        last_name: data.lastName || "",
        phone: data.phone || "",
        default_service_address: data.address || "",
      },
      { onConflict: "id" }
    );

    if (upsertRes.error) {
      console.error("[account-forms] save profile error", upsertRes.error);
      toast("Could not save profile right now.", "error");
      return false;
    }

    var nextEmail = (data.email || "").trim();
    var curEmail = (user.email || "").trim();
    if (nextEmail && nextEmail.toLowerCase() !== curEmail.toLowerCase()) {
      var emailRes = await supabase.auth.updateUser({ email: nextEmail });
      if (emailRes.error) {
        console.error("[account-forms] update email error", emailRes.error);
        toast(emailRes.error.message || "Could not update email.", "error");
        return false;
      }
      toast("Profile saved. Check your inbox to confirm your new email.", "success");
    }

    return true;
  }

  function displayCell(dd, value) {
    var t = String(value || "").trim();
    if (!t) {
      dd.textContent = "Not set";
      dd.classList.add("account-profile-dl__dd--empty");
    } else {
      dd.textContent = t;
      dd.classList.remove("account-profile-dl__dd--empty");
    }
  }

  async function renderView() {
    if (!viewEl) return;
    var p = await loadProfile();
    viewEl.querySelectorAll("[data-profile-field]").forEach(function (dd) {
      var key = dd.getAttribute("data-profile-field");
      if (key && Object.prototype.hasOwnProperty.call(p, key)) {
        displayCell(dd, p[key]);
      }
    });
  }

  async function fillFormFromStorage() {
    var p = await loadProfile();
    if (firstEl) firstEl.value = p.firstName;
    if (lastEl) lastEl.value = p.lastName;
    if (emailInput) emailInput.value = p.email;
    if (phoneEl) phoneEl.value = p.phone;
    if (addressEl) addressEl.value = p.address;
    if (confirmInput) confirmInput.value = "";
  }

  function updateEmailConfirmUI() {
    if (!emailInput || !confirmRow) return;
    var cur = emailInput.value.trim().toLowerCase();
    var start = emailAtEditStart.trim().toLowerCase();
    if (cur === start) {
      confirmRow.hidden = true;
      if (confirmInput) confirmInput.value = "";
      emailChangeAcknowledged = true;
    } else {
      confirmRow.hidden = false;
      emailChangeAcknowledged = false;
    }
  }

  function setEditMode(on) {
    if (!formEl || !viewEl || !editBtn) return;
    if (on) {
      fillFormFromStorage().then(function () {
        emailAtEditStart = emailInput ? emailInput.value.trim() : "";
        emailChangeAcknowledged = true;
        updateEmailConfirmUI();
        formEl.hidden = false;
        viewEl.hidden = true;
        editBtn.hidden = true;
        editBtn.setAttribute("aria-expanded", "true");
        setTimeout(function () {
          if (firstEl) firstEl.focus();
        }, 0);
      });
    } else {
      formEl.hidden = true;
      viewEl.hidden = false;
      editBtn.hidden = false;
      editBtn.setAttribute("aria-expanded", "false");
      if (confirmInput) confirmInput.value = "";
      if (confirmRow) confirmRow.hidden = true;
    }
  }

  function initProfileCard() {
    if (!viewEl || !formEl || !editBtn) return;

    renderView();

    editBtn.addEventListener("click", function () {
      setEditMode(true);
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        setEditMode(false);
        renderView();
      });
    }

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        emailChangeAcknowledged = false;
        updateEmailConfirmUI();
      });
    }

    if (confirmInput) {
      confirmInput.addEventListener("input", function () {
        emailChangeAcknowledged = false;
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        if (!emailInput || !confirmInput) return;
        var a = emailInput.value.trim();
        var b = confirmInput.value.trim();
        if (!a || !b) {
          toast("Enter your new email in both fields.", "error");
          return;
        }
        if (a.toLowerCase() !== b.toLowerCase()) {
          toast("Emails don’t match. Re-enter the same address twice.", "error");
          return;
        }
        emailChangeAcknowledged = true;
        toast("New email confirmed. You can save your profile.", "success");
      });
    }

    formEl.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!firstEl || !lastEl || !emailInput || !phoneEl || !addressEl) return;

      var next = {
        firstName: firstEl.value.trim(),
        lastName: lastEl.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneEl.value.trim(),
        address: addressEl.value.trim(),
      };

      var curEmail = next.email.toLowerCase();
      var startEmail = emailAtEditStart.trim().toLowerCase();
      if (curEmail !== startEmail) {
        var conf = confirmInput ? confirmInput.value.trim().toLowerCase() : "";
        if (conf !== curEmail) {
          toast("Re-enter your new email in both fields and tap Confirm email.", "error");
          return;
        }
        if (!emailChangeAcknowledged) {
          toast("You changed your email — tap Confirm email after both fields match.", "error");
          return;
        }
      }

      var ok = await saveProfile(next);
      if (!ok) return;
      setEditMode(false);
      renderView();
      if (!isSupabaseConfigured() || next.email.trim().toLowerCase() === startEmail) {
        toast("Profile saved.", "success");
      }
    });
  }

  function initPasswordForm() {
    if (!passForm) return;
    passForm.addEventListener("submit", function (e) {
      e.preventDefault();
      toast("Preview only — use your auth provider for real password changes.", "info");
    });
  }

  initProfileCard();
  initPasswordForm();
