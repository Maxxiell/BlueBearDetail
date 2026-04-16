import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

(function () {
  var DISMISS_KEY = "bbdAccountOnboardingDismissed";

  function toast(msg, variant) {
    if (typeof window.bbdShowToast === "function") {
      window.bbdShowToast(msg, { variant: variant || "info" });
    }
  }

  function createDialog() {
    var dlg = document.createElement("dialog");
    dlg.className = "account-onboarding-dialog";
    dlg.innerHTML =
      '<form method="dialog" class="account-onboarding-dialog__panel" id="acct-onboard-panel">' +
      '<button type="button" class="account-onboarding-dialog__close" id="acct-onboard-close" aria-label="Skip for now">&times;</button>' +
      '<h2 class="account-onboarding-dialog__title" id="acct-onboard-title"></h2>' +
      '<p class="account-onboarding-dialog__lede" id="acct-onboard-lede"></p>' +
      '<div class="account-onboarding-dialog__body" id="acct-onboard-body"></div>' +
      '<p class="account-onboarding-dialog__error" id="acct-onboard-error" hidden></p>' +
      '<div class="account-onboarding-dialog__actions">' +
      '<button type="button" class="btn btn-outline" id="acct-onboard-skip">Skip for now</button>' +
      '<button type="button" class="btn btn-primary" id="acct-onboard-save"></button>' +
      "</div>" +
      "</form>";
    document.body.appendChild(dlg);
    return dlg;
  }

  function setError(dlg, msg) {
    var el = dlg.querySelector("#acct-onboard-error");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function showStep(dlg, step) {
    dlg.querySelector("#acct-onboard-title").textContent = step.title;
    dlg.querySelector("#acct-onboard-lede").textContent = step.lede;
    dlg.querySelector("#acct-onboard-save").textContent = step.saveLabel;
    dlg.querySelector("#acct-onboard-body").innerHTML = step.html;
    setError(dlg, "");
    if (step.key === "vehicle") initOnboardingVehicleDropdowns(dlg);
  }

  async function getSessionUser() {
    if (!isSupabaseConfigured()) return null;
    var res = await supabase.auth.getSession();
    return res.data && res.data.session && res.data.session.user ? res.data.session.user : null;
  }

  function isDismissedForUser(userId) {
    try {
      return localStorage.getItem(DISMISS_KEY + ":" + userId) === "1";
    } catch (_e) {
      return false;
    }
  }

  function setDismissedForUser(userId) {
    try {
      localStorage.setItem(DISMISS_KEY + ":" + userId, "1");
    } catch (_e) {}
  }

  async function loadNeeds(userId) {
    var profQ = supabase
      .from("profiles")
      .select("first_name,last_name,phone,default_service_address")
      .eq("id", userId)
      .maybeSingle();
    var vehQ = supabase
      .from("account_vehicles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    var res = await Promise.all([profQ, vehQ]);
    var prof = res[0];
    var veh = res[1];
    if (prof.error || veh.error) return { needVehicle: false, needProfile: false, error: prof.error || veh.error };
    var p = prof.data || {};
    var needProfile =
      !String(p.first_name || "").trim() ||
      !String(p.last_name || "").trim() ||
      !String(p.phone || "").trim() ||
      !String(p.default_service_address || "").trim();
    var needVehicle = !Array.isArray(veh.data) || veh.data.length === 0;
    return { needVehicle: needVehicle, needProfile: needProfile, error: null };
  }

  function parseIntOrNull(v) {
    var n = parseInt(String(v || "").trim(), 10);
    return Number.isNaN(n) ? null : n;
  }

  function initOnboardingVehicleDropdowns(dlg) {
    if (!window.BookingVehicleData || !Array.isArray(window.BookingVehicleData.makes)) return;
    var yearEl = dlg.querySelector("#onboard-vehicle-year");
    var makeEl = dlg.querySelector("#onboard-vehicle-make");
    var modelEl = dlg.querySelector("#onboard-vehicle-model");
    if (!yearEl || !makeEl || !modelEl) return;

    function populateModels(make) {
      modelEl.innerHTML = '<option value="">Select model</option>';
      if (!make || !window.BookingVehicleData.modelsByMake) {
        modelEl.disabled = true;
        return;
      }
      var list = window.BookingVehicleData.modelsByMake[make];
      if (!Array.isArray(list) || !list.length) {
        modelEl.disabled = true;
        return;
      }
      list.forEach(function (model) {
        var opt = document.createElement("option");
        opt.value = String(model);
        opt.textContent = String(model);
        modelEl.appendChild(opt);
      });
      modelEl.disabled = false;
    }

    var yMax = new Date().getFullYear() + 1;
    for (var yr = yMax; yr >= 1990; yr -= 1) {
      var yOpt = document.createElement("option");
      yOpt.value = String(yr);
      yOpt.textContent = String(yr);
      yearEl.appendChild(yOpt);
    }

    window.BookingVehicleData.makes.forEach(function (make) {
      var mOpt = document.createElement("option");
      mOpt.value = String(make);
      mOpt.textContent = String(make);
      makeEl.appendChild(mOpt);
    });

    populateModels(makeEl.value || "");
    makeEl.addEventListener("change", function () {
      populateModels(makeEl.value || "");
    });
  }

  async function run() {
    if (!isSupabaseConfigured()) return;
    var user = await getSessionUser();
    if (!user) return;
    if (isDismissedForUser(user.id)) return;

    var needs = await loadNeeds(user.id);
    if (needs.error) {
      console.error("[account-onboarding] load error", needs.error);
      return;
    }
    if (!needs.needVehicle && !needs.needProfile) return;

    var steps = [];
    if (needs.needVehicle) {
      steps.push({
        key: "vehicle",
        title: "Add your vehicle",
        lede: "Help us keep your dashboard personalized.",
        saveLabel: "Save vehicle",
        html:
          '<div class="form-row"><label for="onboard-vehicle-year">Year (optional)</label><select id="onboard-vehicle-year"><option value="">Select year</option></select></div>' +
          '<div class="form-row"><label for="onboard-vehicle-make">Make</label><select id="onboard-vehicle-make"><option value="">Select make</option></select></div>' +
          '<div class="form-row"><label for="onboard-vehicle-model">Model</label><select id="onboard-vehicle-model" disabled><option value="">Select model</option></select></div>',
      });
    }
    if (needs.needProfile) {
      steps.push({
        key: "profile",
        title: "Add your profile details",
        lede: "We use this for service communication and address defaults.",
        saveLabel: "Save profile",
        html:
          '<div class="form-row"><label for="onboard-first">First name</label><input id="onboard-first" type="text"></div>' +
          '<div class="form-row"><label for="onboard-last">Last name</label><input id="onboard-last" type="text"></div>' +
          '<div class="form-row"><label for="onboard-phone">Phone</label><input id="onboard-phone" type="tel" placeholder="(555) 555-0100"></div>' +
          '<div class="form-row"><label for="onboard-address">Service address</label><input id="onboard-address" type="text" placeholder="Street, city, state"></div>',
      });
    }

    var dlg = createDialog();
    var closeBtn = dlg.querySelector("#acct-onboard-close");
    var skipBtn = dlg.querySelector("#acct-onboard-skip");
    var saveBtn = dlg.querySelector("#acct-onboard-save");
    var i = 0;

    function nextStep() {
      i += 1;
      if (i >= steps.length) {
        setDismissedForUser(user.id);
        dlg.close();
        dlg.remove();
        window.dispatchEvent(new Event("bbd-account-data-refresh"));
        return;
      }
      showStep(dlg, steps[i]);
    }

    closeBtn.addEventListener("click", function () {
      setDismissedForUser(user.id);
      dlg.close();
      dlg.remove();
    });

    skipBtn.addEventListener("click", function () {
      toast("Skipped for now. You can add this later in Settings.", "info");
      nextStep();
    });

    saveBtn.addEventListener("click", async function () {
      setError(dlg, "");
      var step = steps[i];
      if (step.key === "vehicle") {
        var make = String((document.getElementById("onboard-vehicle-make") || {}).value || "").trim();
        var model = String((document.getElementById("onboard-vehicle-model") || {}).value || "").trim();
        var year = parseIntOrNull((document.getElementById("onboard-vehicle-year") || {}).value);
        if (!make || !model) {
          setError(dlg, "Please select vehicle make and model, or skip this step.");
          return;
        }
        var ins = await supabase.from("account_vehicles").insert({
          user_id: user.id,
          year: year,
          make: make,
          model: model,
          is_primary: true,
        });
        if (ins.error) {
          console.error("[account-onboarding] vehicle save error", ins.error);
          setError(dlg, "Could not save vehicle right now.");
          return;
        }
        toast("Vehicle saved.", "success");
        nextStep();
        return;
      }

      var first = String((document.getElementById("onboard-first") || {}).value || "").trim();
      var last = String((document.getElementById("onboard-last") || {}).value || "").trim();
      var phone = String((document.getElementById("onboard-phone") || {}).value || "").trim();
      var address = String((document.getElementById("onboard-address") || {}).value || "").trim();
      if (!first || !last || !phone || !address) {
        setError(dlg, "Please complete all profile fields, or skip this step.");
        return;
      }
      var up = await supabase.from("profiles").upsert(
        {
          id: user.id,
          first_name: first,
          last_name: last,
          phone: phone,
          default_service_address: address,
        },
        { onConflict: "id" }
      );
      if (up.error) {
        console.error("[account-onboarding] profile save error", up.error);
        setError(dlg, "Could not save profile right now.");
        return;
      }
      toast("Profile saved.", "success");
      nextStep();
    });

    dlg.addEventListener("cancel", function (e) {
      e.preventDefault();
      setDismissedForUser(user.id);
      dlg.close();
      dlg.remove();
    });

    showStep(dlg, steps[0]);
    dlg.showModal();
  }

  run().catch(function (e) {
    console.error("[account-onboarding] fatal", e);
  });
})();
