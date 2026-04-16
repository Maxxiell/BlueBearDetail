import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

(function () {
  var toolsWrap = document.getElementById("booking-profile-tools");
  var autofillBtn = document.getElementById("booking-autofill-details-btn");
  var vehicleWrap = document.getElementById("booking-saved-vehicle-wrap");
  var vehicleSelect = document.getElementById("booking-saved-vehicle-select");
  var useVehicleBtn = document.getElementById("booking-use-vehicle-btn");
  var statusEl = document.getElementById("booking-profile-tools-status");
  if (!toolsWrap || !autofillBtn || !vehicleWrap || !vehicleSelect || !useVehicleBtn) return;

  var loadedProfile = null;
  var loadedVehicles = [];

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.hidden = !msg;
  }

  function hasOption(selectEl, value) {
    if (!selectEl) return false;
    return !!selectEl.querySelector('option[value="' + String(value).replace(/"/g, '\\"') + '"]');
  }

  function setInputValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? "" : String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function populateVehicleSelect(vehicles) {
    vehicleSelect.innerHTML = "";
    vehicles.forEach(function (vehicle, idx) {
      var option = document.createElement("option");
      option.value = String(idx);
      var year = vehicle.year ? String(vehicle.year) + " " : "";
      var make = String(vehicle.make || "").trim();
      var model = String(vehicle.model || "").trim();
      var label = (year + make + " " + model).trim();
      if (!label) label = "Saved vehicle " + String(idx + 1);
      if (vehicle.is_primary) label += " (primary)";
      option.textContent = label;
      vehicleSelect.appendChild(option);
    });
  }

  function autofillDetails() {
    if (!loadedProfile) return;
    setInputValue("cust-first-name", loadedProfile.first_name || "");
    setInputValue("cust-last-name", loadedProfile.last_name || "");
    setInputValue("cust-email", loadedProfile.email || "");
    setInputValue("cust-phone", loadedProfile.phone || "");
    setInputValue("cust-address", loadedProfile.default_service_address || "");
    showStatus("Saved contact details applied.");
  }

  function applyVehicle(vehicle) {
    if (!vehicle) return;
    var vehYear = document.getElementById("veh-year");
    var vehMake = document.getElementById("veh-make");
    var vehModel = document.getElementById("veh-model");
    if (!vehYear || !vehMake || !vehModel) return;

    var year = vehicle.year != null ? String(vehicle.year) : "";
    var make = String(vehicle.make || "").trim();
    var model = String(vehicle.model || "").trim();

    if (year && hasOption(vehYear, year)) {
      vehYear.value = year;
      vehYear.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (make && hasOption(vehMake, make)) {
      vehMake.value = make;
      vehMake.dispatchEvent(new Event("change", { bubbles: true }));
      if (model && hasOption(vehModel, model)) {
        vehModel.value = model;
        vehModel.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (model && hasOption(vehModel, "Other")) {
        vehModel.value = "Other";
        vehModel.dispatchEvent(new Event("change", { bubbles: true }));
        setInputValue("veh-model-custom", model);
      }
      showStatus("Saved vehicle applied.");
      return;
    }

    if (hasOption(vehMake, "Other")) {
      vehMake.value = "Other";
      vehMake.dispatchEvent(new Event("change", { bubbles: true }));
      setInputValue("veh-make-custom", make);
      setInputValue("veh-model-custom", model);
      showStatus("Saved vehicle applied (custom make/model).");
    }
  }

  async function init() {
    toolsWrap.hidden = true;
    autofillBtn.hidden = true;
    vehicleWrap.hidden = true;
    showStatus("");

    if (!isSupabaseConfigured()) return;

    var authRes = await supabase.auth.getSession();
    var session = authRes && authRes.data ? authRes.data.session : null;
    if (!session || !session.user) return;

    var user = session.user;
    var userEmail = typeof user.email === "string" ? user.email.trim() : "";

    var profileQ = supabase
      .from("profiles")
      .select("first_name,last_name,phone,default_service_address")
      .eq("id", user.id)
      .maybeSingle();

    var vehiclesQ = supabase
      .from("account_vehicles")
      .select("id,year,make,model,is_primary,created_at")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    var results = await Promise.all([profileQ, vehiclesQ]);
    var profileRes = results[0];
    var vehiclesRes = results[1];

    if (profileRes.error) {
      console.error("[booking-autofill] profile query failed", profileRes.error);
    }
    if (vehiclesRes.error) {
      console.error("[booking-autofill] vehicles query failed", vehiclesRes.error);
    }

    var profileRow = profileRes && profileRes.data ? profileRes.data : null;
    loadedProfile = {
      first_name: profileRow ? profileRow.first_name || "" : "",
      last_name: profileRow ? profileRow.last_name || "" : "",
      phone: profileRow ? profileRow.phone || "" : "",
      default_service_address: profileRow ? profileRow.default_service_address || "" : "",
      email: userEmail || "",
    };

    loadedVehicles = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];

    var hasDetails =
      !!loadedProfile.email ||
      !!loadedProfile.first_name ||
      !!loadedProfile.last_name ||
      !!loadedProfile.phone ||
      !!loadedProfile.default_service_address;

    var hasVehicles = loadedVehicles.length > 0;
    if (!hasDetails && !hasVehicles) return;

    if (hasDetails) {
      autofillBtn.hidden = false;
      autofillBtn.addEventListener("click", autofillDetails);
    }

    if (hasVehicles) {
      populateVehicleSelect(loadedVehicles);
      vehicleWrap.hidden = false;
      useVehicleBtn.addEventListener("click", function () {
        var idx = parseInt(vehicleSelect.value, 10);
        if (Number.isNaN(idx) || !loadedVehicles[idx]) return;
        applyVehicle(loadedVehicles[idx]);
      });
    }

    toolsWrap.hidden = false;
  }

  init().catch(function (err) {
    console.error("[booking-autofill] init failed", err);
  });
})();
