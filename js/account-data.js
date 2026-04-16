import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

function money(n) {
  var v = Number(n);
  if (Number.isNaN(v)) v = 0;
  return "$" + v.toFixed(2);
}

function fmtDate(raw) {
  if (!raw) return "";
  var d = new Date(raw + "T00:00:00");
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime12(iso) {
  if (!iso || !/^\d{2}:\d{2}$/.test(String(iso))) return iso ? String(iso) : "";
  var p = String(iso).split(":");
  var h = parseInt(p[0], 10);
  var m = p[1];
  var ampm = h >= 12 ? "PM" : "AM";
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ":" + m + " " + ampm;
}

function mergeBookingsById(a, b) {
  var map = {};
  (a || []).forEach(function (r) {
    if (r && r.id) map[r.id] = r;
  });
  (b || []).forEach(function (r) {
    if (r && r.id) map[r.id] = r;
  });
  return Object.keys(map).map(function (k) {
    return map[k];
  });
}

function todayISO() {
  var t = new Date();
  return (
    t.getFullYear() +
    "-" +
    String(t.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(t.getDate()).padStart(2, "0")
  );
}

/**
 * Prefer earliest future (or today) non-cancelled booking; if none (e.g. past date picked),
 * show the most recently submitted active request so the card is never empty when rows exist.
 */
function pickNextUpcomingBooking(bookings) {
  var iso = todayISO();
  var active = (bookings || []).filter(function (b) {
    return b && b.booking_date && b.status !== "cancelled";
  });
  var future = active.filter(function (b) {
    return String(b.booking_date) >= iso;
  });
  future.sort(function (a, b) {
    if (a.booking_date !== b.booking_date) {
      return a.booking_date < b.booking_date ? -1 : 1;
    }
    return String(a.booking_time || "").localeCompare(String(b.booking_time || ""));
  });
  if (future[0]) return future[0];
  active.sort(function (a, b) {
    var ca = a.created_at ? new Date(a.created_at).getTime() : 0;
    var cb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return cb - ca;
  });
  return active[0] || null;
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showToast(msg, variant) {
  if (typeof window.bbdShowToast === "function") {
    window.bbdShowToast(msg, { variant: variant || "info", duration: 2600 });
  }
}

var currentVehicles = [];
var currentUserId = "";
var vehiclesBtn = document.getElementById("acct-view-vehicles-btn");
var addVehicleBtn = document.getElementById("acct-add-vehicle-btn");
var vehiclesDialog = document.getElementById("acct-vehicles-dialog");
var vehiclesClose = document.getElementById("acct-vehicles-close");
var vehiclesList = document.getElementById("acct-vehicles-list");
var vehicleAddForm = document.getElementById("acct-vehicle-add-form");
var vehicleYearSelect = document.getElementById("acct-vehicle-year");
var vehicleMakeSelect = document.getElementById("acct-vehicle-make");
var vehicleModelSelect = document.getElementById("acct-vehicle-model");
var hasShownLoadedToast = false;

function populateVehicleModelOptions(make) {
  if (!vehicleModelSelect) return;
  vehicleModelSelect.innerHTML = "";
  var placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select model";
  vehicleModelSelect.appendChild(placeholder);
  if (!make || !window.BookingVehicleData || !window.BookingVehicleData.modelsByMake) {
    vehicleModelSelect.disabled = true;
    return;
  }
  var list = window.BookingVehicleData.modelsByMake[make];
  if (!Array.isArray(list) || !list.length) {
    vehicleModelSelect.disabled = true;
    return;
  }
  list.forEach(function (model) {
    var opt = document.createElement("option");
    opt.value = String(model);
    opt.textContent = String(model);
    vehicleModelSelect.appendChild(opt);
  });
  vehicleModelSelect.disabled = false;
}

function initVehicleAddDropdowns() {
  if (!vehicleYearSelect || !vehicleMakeSelect || !vehicleModelSelect) return;
  if (!window.BookingVehicleData || !Array.isArray(window.BookingVehicleData.makes)) return;

  if (vehicleYearSelect.options.length <= 1) {
    var yMax = new Date().getFullYear() + 1;
    for (var year = yMax; year >= 1990; year -= 1) {
      var yOpt = document.createElement("option");
      yOpt.value = String(year);
      yOpt.textContent = String(year);
      vehicleYearSelect.appendChild(yOpt);
    }
  }

  if (vehicleMakeSelect.options.length <= 1) {
    window.BookingVehicleData.makes.forEach(function (make) {
      var mOpt = document.createElement("option");
      mOpt.value = String(make);
      mOpt.textContent = String(make);
      vehicleMakeSelect.appendChild(mOpt);
    });
  }

  populateVehicleModelOptions(vehicleMakeSelect.value || "");
  vehicleMakeSelect.addEventListener("change", function () {
    populateVehicleModelOptions(vehicleMakeSelect.value || "");
  });
}

function openVehiclesDialogForAdd() {
  if (!vehiclesDialog) return;
  renderVehiclesDialog();
  vehiclesDialog.showModal();
  if (vehicleMakeSelect) vehicleMakeSelect.focus();
}

function renderVehiclesDialog() {
  if (!vehiclesList) return;
  vehiclesList.innerHTML = "";
  if (!currentVehicles.length) {
    vehiclesList.innerHTML = "<li>No vehicles on file yet.</li>";
    return;
  }
  currentVehicles.forEach(function (v) {
    var li = document.createElement("li");
    var row = document.createElement("div");
    row.className = "account-vehicles-modal-row";
    var label = document.createElement("span");
    label.textContent = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unnamed vehicle";
    row.appendChild(label);
    if (v.id != null) {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "account-vehicles-modal-remove";
      rm.textContent = "Remove";
      rm.setAttribute("data-vehicle-remove-id", String(v.id));
      row.appendChild(rm);
    }
    li.appendChild(row);
    vehiclesList.appendChild(li);
  });
}

function initVehiclesModal() {
  if (!vehiclesBtn || !vehiclesDialog) return;
  vehiclesBtn.addEventListener("click", function () {
    renderVehiclesDialog();
    vehiclesDialog.showModal();
  });
  if (addVehicleBtn) {
    addVehicleBtn.addEventListener("click", function () {
      openVehiclesDialogForAdd();
    });
  }
  if (vehiclesClose) {
    vehiclesClose.addEventListener("click", function () {
      vehiclesDialog.close();
    });
  }
  if (vehiclesList) {
    vehiclesList.addEventListener("click", async function (e) {
      var btn = e.target && e.target.closest("[data-vehicle-remove-id]");
      if (!btn || !currentUserId) return;
      var id = Number(btn.getAttribute("data-vehicle-remove-id"));
      if (!id) return;
      var del = await supabase
        .from("account_vehicles")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUserId);
      if (del.error) {
        console.error("[account-data] remove vehicle error", del.error);
        showToast("Could not remove vehicle.", "error");
        return;
      }
      showToast("Vehicle removed.", "success");
      load().catch(function () {});
    });
  }
  if (vehicleAddForm) {
    vehicleAddForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!currentUserId) return;
      var yearRaw = vehicleYearSelect ? String(vehicleYearSelect.value || "").trim() : "";
      var make = vehicleMakeSelect ? String(vehicleMakeSelect.value || "").trim() : "";
      var model = vehicleModelSelect ? String(vehicleModelSelect.value || "").trim() : "";
      if (!make || !model) {
        showToast("Please select vehicle make and model.", "error");
        return;
      }
      var year = yearRaw ? parseInt(yearRaw, 10) : null;
      if (yearRaw && Number.isNaN(year)) year = null;
      var ins = await supabase.from("account_vehicles").insert({
        user_id: currentUserId,
        year: year,
        make: make,
        model: model,
        is_primary: currentVehicles.length === 0,
      });
      if (ins.error) {
        console.error("[account-data] add vehicle error", ins.error);
        showToast("Could not add vehicle.", "error");
        return;
      }
      vehicleAddForm.reset();
      populateVehicleModelOptions("");
      showToast("Vehicle added.", "success");
      load().catch(function () {});
    });
  }
  vehiclesDialog.addEventListener("click", function (e) {
    if (e.target === vehiclesDialog) vehiclesDialog.close();
  });
}

async function load() {
  if (!isSupabaseConfigured()) {
    return;
  }

  var sessionRes = await supabase.auth.getSession();
  var session = sessionRes.data && sessionRes.data.session;
  var user = session && session.user;
  if (!user) {
    return;
  }

  var userId = user.id;
  currentUserId = userId;

  var userEmail = user.email ? String(user.email).trim() : "";
  var userEmailLower = userEmail ? userEmail.toLowerCase() : "";

  var profileQ = supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("id", userId)
    .maybeSingle();

  var dashQ = supabase
    .from("account_dashboard")
    .select("wash_credit_balance,reward_points,last_service_title,last_service_meta,next_appointment_label,next_appointment_meta")
    .eq("user_id", userId)
    .maybeSingle();

  var vehiclesQ = supabase
    .from("account_vehicles")
    .select("id,year,make,model,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  var activityQ = supabase
    .from("account_activity")
    .select("title,detail,amount_label,happened_on,sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("happened_on", { ascending: false })
    .limit(12);

  var bookingsByUserQ = supabase
    .from("bookings")
    .select(
      "id,reference_code,booking_date,booking_time,service_package,status,cust_email,created_at"
    )
    .eq("user_id", userId)
    .limit(120);

  var bookingsByEmailQ =
    userEmailLower
      ? supabase
          .from("bookings")
          .select(
            "id,reference_code,booking_date,booking_time,service_package,status,cust_email,created_at"
          )
          .ilike("cust_email", userEmailLower)
          .limit(120)
      : Promise.resolve({ data: [], error: null });

  var results = await Promise.all([
    profileQ,
    dashQ,
    vehiclesQ,
    activityQ,
    bookingsByUserQ,
    bookingsByEmailQ,
  ]);
  var profile = results[0];
  var dash = results[1];
  var vehicles = results[2];
  var activity = results[3];
  var bookingsUser = results[4];
  var bookingsEmail = results[5];

  if (profile.error || dash.error || vehicles.error || activity.error) {
    console.error("[account-data] query error", profile.error || dash.error || vehicles.error || activity.error);
    showToast("Could not load user info.", "error");
    return;
  }

  if (bookingsUser.error || bookingsEmail.error) {
    console.error(
      "[account-data] bookings query",
      bookingsUser.error || bookingsEmail.error
    );
    showToast(
      "Could not load your bookings: " +
        ((bookingsUser.error || bookingsEmail.error).message ||
          "check Supabase RLS and bookings table.") +
        " Run supabase/bookings-reference-rls.sql if you have not.",
      "error"
    );
  }

  var p = profile.data || {};
  var first = String(p.first_name || "").trim();
  var greeting = first ? "Welcome, " + first + "." : "Welcome back.";
  setText("acct-greeting", greeting);

  var d = dash.data || {};
  setText("acct-credit-balance", money(d.wash_credit_balance || 0));
  setText("acct-credit-meta", d.wash_credit_balance > 0 ? "Available as account credit for upcoming bookings." : "No account credit yet.");
  setText("acct-pass-tier", "Coming Soon");
  setText("acct-pass-meta", "Wash Pass X enrollment is not available yet.");
  setText("acct-reward-points", String(Number(d.reward_points || 0)));
  setText("acct-points-meta", Number(d.reward_points || 0) > 0 ? "Points available for future rewards." : "No reward points yet.");
  setText("acct-last-service-title", d.last_service_title && String(d.last_service_title).trim() ? String(d.last_service_title) : "No completed service yet");
  setText("acct-last-service-meta", d.last_service_meta && String(d.last_service_meta).trim() ? String(d.last_service_meta) : "When your first appointment is completed, it will appear here.");

  var mergedBookings = mergeBookingsById(
    bookingsUser.data || [],
    bookingsEmail.data || []
  );
  var nextBk = pickNextUpcomingBooking(mergedBookings);
  if (nextBk) {
    var pkg =
      nextBk.service_package === "essential"
        ? "Essential"
        : nextBk.service_package === "complete"
          ? "Complete"
          : nextBk.service_package === "signature"
            ? "Signature"
            : nextBk.service_package || "Service";
    var whenLine = fmtDate(nextBk.booking_date);
    if (nextBk.booking_time) whenLine += " · " + fmtTime12(nextBk.booking_time);
    var iso = todayISO();
    var isPastDate = String(nextBk.booking_date) < iso;
    setText("acct-next-appointment-label", whenLine);
    setText(
      "acct-next-appointment-meta",
      (isPastDate
        ? "Date in the past — confirmation still pending. "
        : "") +
        "Ref " +
        (nextBk.reference_code || "—") +
        " · " +
        pkg +
        " — we’ll confirm this request by phone or email."
    );
  } else {
    setText(
      "acct-next-appointment-label",
      d.next_appointment_label && String(d.next_appointment_label).trim()
        ? String(d.next_appointment_label)
        : "—"
    );
    setText(
      "acct-next-appointment-meta",
      d.next_appointment_meta && String(d.next_appointment_meta).trim()
        ? String(d.next_appointment_meta)
        : "No upcoming appointment on file. Book from the site and it will show here when the date is still ahead."
    );
  }

  var vehicleRows = Array.isArray(vehicles.data) ? vehicles.data : [];
  currentVehicles = vehicleRows.slice();
  setText("acct-vehicle-count", String(vehicleRows.length));
  if (vehicleRows.length) {
    var labels = vehicleRows.map(function (v) {
      return [v.year, v.make, v.model].filter(Boolean).join(" ");
    });
    setText("acct-vehicle-list", labels.join(" · "));
  } else {
    setText("acct-vehicle-list", "No vehicles added yet.");
  }
  if (vehiclesBtn) vehiclesBtn.hidden = !vehicleRows.length;
  if (addVehicleBtn) addVehicleBtn.hidden = !!vehicleRows.length;

  var list = document.getElementById("acct-activity-list");
  var actRows = Array.isArray(activity.data) ? activity.data : [];
  if (list) {
    list.innerHTML = "";
    if (!actRows.length) {
      list.innerHTML = "<li><span><strong>No activity yet</strong> — Once your account starts booking, items show here.</span><span>—</span></li>";
    } else {
      actRows.forEach(function (a) {
        var li = document.createElement("li");
        var left = document.createElement("span");
        var title = document.createElement("strong");
        title.textContent = a.title || "Activity";
        left.appendChild(title);
        if (a.detail) left.appendChild(document.createTextNode(" — " + a.detail));
        var right = document.createElement("span");
        right.textContent = a.amount_label || (a.happened_on ? fmtDate(a.happened_on) : "");
        li.appendChild(left);
        li.appendChild(right);
        list.appendChild(li);
      });
    }
  }

  if (!hasShownLoadedToast) {
    showToast("User info loaded.");
    hasShownLoadedToast = true;
  }
}

load().catch(function (e) {
  console.error("[account-data] fatal", e);
  showToast("Could not load user info.", "error");
});

initVehiclesModal();
initVehicleAddDropdowns();

window.addEventListener("bbd-account-data-refresh", function () {
  load().catch(function (e) {
    console.error("[account-data] refresh fatal", e);
    showToast("Could not refresh user info.", "error");
  });
});
