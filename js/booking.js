/**
 * Multi-step booking wizard. Calendar + time dropdown; vehicle year/make/model dropdowns.
 * Extend fetchBookedSlots() for a real calendar API when you add a backend.
 */
(function () {
  var form = document.getElementById("booking-form");
  var progressList = document.getElementById("booking-progress-list");
  var errEl = document.getElementById("booking-error");
  var btnNext = document.getElementById("booking-next");
  var btnBack = document.getElementById("booking-back");
  var btnSubmitBook = document.getElementById("booking-submit-book");
  var btnSubmitPay = document.getElementById("booking-submit-pay");
  var dateInput = document.getElementById("booking-date");
  var timeSelect = document.getElementById("booking-time-select");
  var calGrid = document.getElementById("booking-cal-grid");
  var calMonthLabel = document.getElementById("booking-cal-month-label");
  var calPrev = document.getElementById("booking-cal-prev");
  var calNext = document.getElementById("booking-cal-next");
  var donePanel = document.getElementById("booking-done");
  var doneTextEl = document.getElementById("booking-done-text");
  var summaryText = document.getElementById("booking-summary-text");
  var copyBtn = document.getElementById("booking-copy-summary");
  var selectedServiceEls = document.querySelectorAll("[data-booking-selected-service]");
  var selectedVehicleEls = document.querySelectorAll("[data-booking-selected-vehicle]");

  var vehYear = document.getElementById("veh-year");
  var vehMake = document.getElementById("veh-make");
  var vehModel = document.getElementById("veh-model");
  var vehMakeCustomWrap = document.getElementById("veh-make-custom-wrap");
  var vehMakeCustom = document.getElementById("veh-make-custom");
  var vehModelWrap = document.getElementById("veh-model-wrap");
  var vehModelCustomWrap = document.getElementById("veh-model-custom-wrap");
  var vehModelCustom = document.getElementById("veh-model-custom");
  var payNotice = document.getElementById("booking-pay-notice");

  if (!form || !btnNext) return;

  /**
   * URL for booking-submit-supabase.js next to booking.js.
   * Do not use import("./js/...") — that resolves against the *page* path, so if book-flow.html
   * is opened under /js/ you get /js/js/... and the import fails (e.g. Live Server).
   */
  function bookingSubmitModuleUrl() {
    var scripts = document.getElementsByTagName("script");
    var i;
    for (i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src;
      if (!src || src.indexOf("booking.js") === -1) continue;
      return src.replace(/booking\.js(\?[^#]*)?(#.*)?$/, "booking-submit-supabase.js$1$2");
    }
    return new URL("js/booking-submit-supabase.js", window.location.href).href;
  }

  var STORAGE_KEY = "bbdBookingWizard";
  var ADMIN_BLOCKS_KEY = "bbdAdminBlockedSchedule";
  var SITE_SETTINGS_KEY = "bbdSiteSettings";
  var TOTAL_STEPS = 6;
  var MAILTO = "hello@bluebearautocare.com";
  var SERVICE_BLOCK_MINS = { essential: 180, complete: 240 };
  var activeSupabaseModulePromise = null;
  var store =
    window.bbdPersistentStore &&
    typeof window.bbdPersistentStore.getItem === "function"
      ? window.bbdPersistentStore
      : {
          getItem: function (key) {
            try {
              return localStorage.getItem(key);
            } catch (_e) {
              return null;
            }
          },
        };

  var serviceLabels = {
    essential: "Essential",
    complete: "Complete",
    signature: "Signature",
  };

  var vehicleLabels = {
    "sedan-coupe": "Sedan / Coupe",
    suv: "SUV",
    truck: "Truck",
  };

  var addonLabels = {
    "spray-wax": "Spray Wax Protection",
    "pet-hair": "Pet Hair Removal",
    "leather-condition": "Leather Condition & Protection",
    "light-stain-spot-treatment": "Stain Spot Treatment",
    "headliner-cleaning": "Headliner Cleaning",
    "carpet-shampoo": "Carpet Shampoo",
  };

  /** Typical add-on line pricing (Denver-area mobile detail range); not a final invoice. */
  var addonPrices = {
    "spray-wax": 35,
    "pet-hair": 59,
    "leather-condition": 45,
    "light-stain-spot-treatment": 50,
    "headliner-cleaning": 40,
    "carpet-shampoo": 75,
  };

  var addonPriceFromKeys = {
    "pet-hair": true,
    "carpet-shampoo": true,
  };

  function formatAddonPriceDollars(key) {
    var n = addonPrices[key];
    if (n == null || Number.isNaN(n)) return "";
    if (addonPriceFromKeys[key]) return "$" + n.toFixed(0) + "+ (from)";
    return "$" + n.toFixed(0);
  }

  var currentStep = 1;
  /** First day of the month currently shown in the calendar (Date, local). */
  var calendarViewMonth = new Date();

  function allHalfHourSlots() {
    var out = [];
    for (var t = 6 * 60; t <= 17 * 60; t += 30) {
      var h = Math.floor(t / 60);
      var m = t % 60;
      out.push(
        String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0")
      );
    }
    return out;
  }

  function formatTime12h(iso) {
    var p = iso.split(":");
    var h = parseInt(p[0], 10);
    var m = p[1];
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + ampm;
  }

  function getSupabaseModule() {
    if (activeSupabaseModulePromise) return activeSupabaseModulePromise;
    activeSupabaseModulePromise = Promise.all([
      import(new URL("auth-client.js", bookingSubmitModuleUrl()).href),
      import(new URL("supabase-config.js", bookingSubmitModuleUrl()).href),
    ])
      .then(function (mods) {
        return {
          supabase: mods[0].supabase,
          isConfigured:
            typeof mods[1].isSupabaseConfigured === "function"
              ? mods[1].isSupabaseConfigured()
              : false,
        };
      })
      .catch(function () {
        return { supabase: null, isConfigured: false };
      });
    return activeSupabaseModulePromise;
  }

  async function fetchBookedSlots(dateStr) {
    var blocks = readAdminBlocks();
    var ranges = (blocks.timeRangesByDate && blocks.timeRangesByDate[dateStr]) || [];
    var all = allHalfHourSlots();
    var blocked = all.filter(function (slot) {
      return ranges.some(function (range) {
        var slotMins = slotToMinutes(slot);
        return slotMins >= range.startMins && slotMins < range.endMins;
      });
    });
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return blocked;

    try {
      var supa = await getSupabaseModule();
      if (!supa || !supa.isConfigured || !supa.supabase) return blocked;
      var res = await supa.supabase
        .from("bookings")
        .select("booking_time,service_package,status")
        .eq("booking_date", dateStr);
      if (res.error || !Array.isArray(res.data)) return blocked;

      var fromBookings = [];
      res.data.forEach(function (row) {
        if (!row || String(row.status || "").toLowerCase() === "cancelled") return;
        var startMins = parseTimeToMins(String(row.booking_time || ""));
        if (startMins == null) return;
        var mins = SERVICE_BLOCK_MINS[String(row.service_package || "").toLowerCase()] || 180;
        var endMins = startMins + mins;
        all.forEach(function (slot) {
          var sm = slotToMinutes(slot);
          if (sm >= startMins && sm < endMins) fromBookings.push(slot);
        });
      });

      var seen = {};
      blocked.concat(fromBookings).forEach(function (slot) {
        seen[slot] = true;
      });
      return Object.keys(seen).sort();
    } catch (_e) {
      return blocked;
    }
  }

  function safeUniqueIsoDates(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    var seen = {};
    list.forEach(function (value) {
      if (typeof value !== "string") return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
      if (seen[value]) return;
      seen[value] = true;
      out.push(value);
    });
    return out;
  }

  function parseTimeToMins(raw) {
    if (typeof raw !== "string" || !/^\d{2}:\d{2}$/.test(raw)) return null;
    var p = raw.split(":");
    var h = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  function readAdminBlocksFromShape(shape) {
    var blockedDates = safeUniqueIsoDates(shape.blockedDates);
    var timeRangesByDate = {};

    if (shape.timeRangesByDate && typeof shape.timeRangesByDate === "object") {
      Object.keys(shape.timeRangesByDate).forEach(function (dateKey) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        var ranges = shape.timeRangesByDate[dateKey];
        if (!Array.isArray(ranges) || !ranges.length) return;
        var norm = ranges
          .map(function (r) {
            var startMins = parseTimeToMins(r.start);
            var endMins = parseTimeToMins(r.end);
            if (startMins == null || endMins == null || endMins <= startMins) return null;
            return { start: r.start, end: r.end, startMins: startMins, endMins: endMins };
          })
          .filter(Boolean);
        var deduped = [];
        var seen = {};
        norm.forEach(function (item) {
          var k = item.start + "|" + item.end;
          if (seen[k]) return;
          seen[k] = true;
          deduped.push(item);
        });
        if (deduped.length) {
          timeRangesByDate[dateKey] = deduped;
        }
      });
    }

    return { blockedDates: blockedDates, timeRangesByDate: timeRangesByDate };
  }

  function readAdminBlocks() {
    var empty = { blockedDates: [], timeRangesByDate: {} };
    try {
      var settingsRaw = store.getItem(SITE_SETTINGS_KEY);
      if (settingsRaw) {
        var parsedSettings = JSON.parse(settingsRaw);
        var remoteBlocks = parsedSettings && parsedSettings.bookingBlocks;
        if (remoteBlocks && typeof remoteBlocks === "object") {
          return readAdminBlocksFromShape({
            blockedDates: remoteBlocks.blockedDates,
            timeRangesByDate: remoteBlocks.timeRangesByDate,
          });
        }
      }
      var raw = store.getItem(ADMIN_BLOCKS_KEY);
      if (!raw) return empty;
      var parsed = JSON.parse(raw);
      return readAdminBlocksFromShape(parsed);
    } catch (_e) {
      return empty;
    }
  }

  function todayLocalStr() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function maxDateStr() {
    var d = new Date();
    d.setDate(d.getDate() + 120);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function parseISODate(s) {
    var p = s.split("-");
    return new Date(
      parseInt(p[0], 10),
      parseInt(p[1], 10) - 1,
      parseInt(p[2], 10)
    );
  }

  function toISODate(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function nowMinutes() {
    var n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  function slotToMinutes(slot) {
    var p = slot.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function renderTimeSelect(dateStr, booked) {
    if (!timeSelect) return;
    var keep = timeSelect.value;
    timeSelect.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "— Select time —";
    timeSelect.appendChild(ph);

    if (!dateStr) return;

    var blocks = readAdminBlocks();
    var slots = allHalfHourSlots();
    var bookedSet = {};
    (booked || []).forEach(function (b) {
      bookedSet[b] = true;
    });

    slots.forEach(function (slot) {
      if (bookedSet[slot]) return;
      if (blocks.blockedDates.indexOf(dateStr) !== -1) return;
      var opt = document.createElement("option");
      opt.value = slot;
      opt.textContent = formatTime12h(slot);
      timeSelect.appendChild(opt);
    });

    if (keep && timeSelect.querySelector('option[value="' + keep + '"]')) {
      timeSelect.value = keep;
    } else {
      timeSelect.value = "";
    }
  }

  function refreshTimeForDate() {
    var d = dateInput ? dateInput.value : "";
    fetchBookedSlots(d).then(function (booked) {
      renderTimeSelect(d, booked);
    });
  }

  function firstOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function renderCalendar() {
    if (!calGrid || !calMonthLabel) return;

    var y = calendarViewMonth.getFullYear();
    var m = calendarViewMonth.getMonth();
    calMonthLabel.textContent = calendarViewMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    var minD = parseISODate(todayLocalStr());
    var maxD = parseISODate(maxDateStr());
    var minMonth = new Date(minD.getFullYear(), minD.getMonth(), 1);
    var nextMonthFirst = new Date(y, m + 1, 1);
    var canPrev = calendarViewMonth.getTime() > minMonth.getTime();
    var canNext = nextMonthFirst <= maxD;

    if (calPrev) calPrev.disabled = !canPrev;
    if (calNext) calNext.disabled = !canNext;

    var first = new Date(y, m, 1);
    var startPad = first.getDay();
    var dim = daysInMonth(y, m);

    calGrid.innerHTML = "";

    for (var i = 0; i < startPad; i++) {
      var pad = document.createElement("div");
      pad.className = "booking-cal-cell booking-cal-cell--pad";
      pad.setAttribute("aria-hidden", "true");
      calGrid.appendChild(pad);
    }

    var selected = dateInput ? dateInput.value : "";

    var blocks = readAdminBlocks();

    for (var day = 1; day <= dim; day++) {
      var cellDate = new Date(y, m, day);
      var iso = toISODate(cellDate);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "booking-cal-day";
      btn.textContent = String(day);
      btn.setAttribute("data-date", iso);

      var isBlockedDay = blocks.blockedDates.indexOf(iso) !== -1;
      if (cellDate < minD || cellDate > maxD || isBlockedDay) {
        btn.disabled = true;
        btn.classList.add("booking-cal-day--muted");
        if (isBlockedDay) {
          btn.title = "Blocked by admin";
        }
      } else {
        if (iso === selected) {
          btn.classList.add("is-selected");
        }
        btn.addEventListener("click", function () {
          selectDate(this.getAttribute("data-date"));
        });
      }
      calGrid.appendChild(btn);
    }
  }

  function selectDate(isoStr) {
    if (!dateInput) return;
    dateInput.value = isoStr;
    timeSelect.value = "";
    refreshTimeForDate();
    renderCalendar();
    saveState();
  }

  function initCalendarNav() {
    if (calPrev) {
      calPrev.addEventListener("click", function () {
        calendarViewMonth = new Date(
          calendarViewMonth.getFullYear(),
          calendarViewMonth.getMonth() - 1,
          1
        );
        renderCalendar();
      });
    }
    if (calNext) {
      calNext.addEventListener("click", function () {
        calendarViewMonth = new Date(
          calendarViewMonth.getFullYear(),
          calendarViewMonth.getMonth() + 1,
          1
        );
        renderCalendar();
      });
    }
  }

  function syncCalendarViewToDate(isoStr) {
    if (!isoStr) return;
    var d = parseISODate(isoStr);
    calendarViewMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function getSteps() {
    return form.querySelectorAll(".booking-step");
  }

  function showError(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    } else {
      errEl.textContent = "";
      errEl.hidden = true;
    }
  }

  function updateProgress() {
    if (!progressList) return;
    var items = progressList.querySelectorAll(".booking-progress__step");
    items.forEach(function (li, i) {
      var n = i + 1;
      li.classList.toggle("is-active", n === currentStep);
      li.classList.toggle("is-done", n < currentStep);
    });
  }

  function updateSelectionLabels() {
    var checked = form.querySelector('input[name="service"]:checked');
    var serviceLabel =
      !checked || !checked.value
        ? "None selected yet"
        : serviceLabels[checked.value] || checked.value;
    selectedServiceEls.forEach(function (el) {
      el.textContent = serviceLabel;
    });

    var v = form.querySelector('input[name="vehicle"]:checked');
    var vehicleLabel =
      !v || !v.value ? "None selected yet" : vehicleLabels[v.value] || v.value;
    selectedVehicleEls.forEach(function (el) {
      el.textContent = vehicleLabel;
    });
  }

  function showStep(n) {
    currentStep = n;
    form.setAttribute("data-current-step", String(n));
    var steps = getSteps();
    steps.forEach(function (el) {
      var s = parseInt(el.getAttribute("data-step"), 10);
      var on = s === n;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });

    btnBack.hidden = n <= 1;
    if (n <= 1) {
      btnBack.setAttribute("aria-hidden", "true");
      btnBack.disabled = true;
      btnBack.style.display = "none";
    } else {
      btnBack.setAttribute("aria-hidden", "false");
      btnBack.disabled = false;
      btnBack.style.display = "";
    }
    btnNext.hidden = n >= TOTAL_STEPS;
    if (btnNext) {
      btnNext.setAttribute("aria-hidden", n >= TOTAL_STEPS ? "true" : "false");
    }

    if (btnSubmitBook || btnSubmitPay) {
      if (n === TOTAL_STEPS) {
        syncCheckoutUi();
      } else {
        if (btnSubmitBook) btnSubmitBook.hidden = true;
        if (btnSubmitPay) btnSubmitPay.hidden = true;
      }
    }

    updateProgress();
    updateSelectionLabels();
    showError("");

    if (n === 4) {
      renderCalendar();
      refreshTimeForDate();
    }

    var active = form.querySelector(".booking-step.is-active");
    if (active) {
      var focusable = active.querySelector(
        "button:not([disabled]), [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      if (focusable) focusable.focus({ preventScroll: true });
    }
  }

  function populateModels(make) {
    if (!vehModel || !window.BookingVehicleData) return;
    vehModel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Select model";
    vehModel.appendChild(opt0);

    if (!make) {
      vehModel.disabled = true;
      return;
    }
    vehModel.disabled = false;

    var list = BookingVehicleData.modelsByMake[make];
    if (!list || list.length === 0) {
      var o = document.createElement("option");
      o.value = "Other";
      o.textContent = "Other";
      vehModel.appendChild(o);
      return;
    }
    list.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      vehModel.appendChild(opt);
    });
  }

  function updateVehicleUI() {
    if (!vehMake) return;
    var make = vehMake.value;

    if (!make) {
      if (vehMakeCustomWrap) vehMakeCustomWrap.hidden = true;
      if (vehMakeCustom) {
        vehMakeCustom.required = false;
        vehMakeCustom.value = "";
      }
      if (vehModelWrap) vehModelWrap.hidden = false;
      if (vehModel) {
        vehModel.required = false;
      }
      populateModels("");
      if (vehModelCustomWrap) vehModelCustomWrap.hidden = true;
      if (vehModelCustom) {
        vehModelCustom.required = false;
        vehModelCustom.value = "";
      }
      return;
    }

    if (make === "Other") {
      if (vehMakeCustomWrap) vehMakeCustomWrap.hidden = false;
      if (vehMakeCustom) vehMakeCustom.required = true;
      if (vehModelWrap) vehModelWrap.hidden = true;
      if (vehModel) {
        vehModel.required = false;
        vehModel.disabled = true;
        vehModel.innerHTML = "";
      }
      if (vehModelCustomWrap) vehModelCustomWrap.hidden = false;
      if (vehModelCustom) vehModelCustom.required = true;
    } else {
      if (vehMakeCustomWrap) vehMakeCustomWrap.hidden = true;
      if (vehMakeCustom) {
        vehMakeCustom.required = false;
        vehMakeCustom.value = "";
      }
      if (vehModelWrap) vehModelWrap.hidden = false;
      if (vehModel) {
        vehModel.disabled = false;
        vehModel.required = true;
      }
      if (vehModelCustomWrap) vehModelCustomWrap.hidden = true;
      if (vehModelCustom) {
        vehModelCustom.required = false;
        vehModelCustom.value = "";
      }
      if (make) populateModels(make);
    }
  }

  function initVehicleSelects() {
    if (!vehYear || !vehMake || !window.BookingVehicleData) return;

    var yPh = document.createElement("option");
    yPh.value = "";
    yPh.textContent = "Select year";
    vehYear.appendChild(yPh);

    var yMax = new Date().getFullYear() + 1;
    for (var yr = yMax; yr >= 1990; yr--) {
      var o = document.createElement("option");
      o.value = String(yr);
      o.textContent = String(yr);
      vehYear.appendChild(o);
    }

    var mPh = document.createElement("option");
    mPh.value = "";
    mPh.textContent = "Select make";
    vehMake.appendChild(mPh);

    BookingVehicleData.makes.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      vehMake.appendChild(opt);
    });

    populateModels("");

    vehMake.addEventListener("change", function () {
      updateVehicleUI();
    });

    vehModel.addEventListener("change", function () {
      if (this.value === "Other") {
        if (vehModelCustomWrap) vehModelCustomWrap.hidden = false;
        if (vehModelCustom) vehModelCustom.required = true;
      } else {
        if (vehModelCustomWrap) vehModelCustomWrap.hidden = true;
        if (vehModelCustom) {
          vehModelCustom.required = false;
          vehModelCustom.value = "";
        }
      }
    });
  }

  function validateStep(step) {
    if (step === 1) {
      var s = form.querySelector('input[name="service"]:checked');
      if (!s) return "Please select a service package.";
      return "";
    }
    if (step === 2) {
      var v = form.querySelector('input[name="vehicle"]:checked');
      if (!v) return "Please select a vehicle type.";
      return "";
    }
    if (step === 3) return "";
    if (step === 4) {
      if (!dateInput || !dateInput.value) return "Please choose a date on the calendar.";
      if (!timeSelect || !timeSelect.value) return "Please select a start time.";
      return "";
    }
    if (step === 5) {
      var req = [
        "cust-first-name",
        "cust-last-name",
        "cust-email",
        "cust-phone",
        "cust-address",
        "cust-city",
        "cust-state",
        "cust-zip",
      ];
      for (var i = 0; i < req.length; i++) {
        var el = document.getElementById(req[i]);
        if (el && !el.value.trim()) {
          el.focus();
          return "Please fill in all required fields.";
        }
      }
      if (!vehYear || !vehYear.value) {
        if (vehYear) vehYear.focus();
        return "Please select a vehicle year.";
      }
      if (!vehMake || !vehMake.value) {
        if (vehMake) vehMake.focus();
        return "Please select a make.";
      }
      if (vehMake.value === "Other") {
        if (!vehMakeCustom || !vehMakeCustom.value.trim()) {
          if (vehMakeCustom) vehMakeCustom.focus();
          return "Please enter your vehicle make.";
        }
        if (!vehModelCustom || !vehModelCustom.value.trim()) {
          if (vehModelCustom) vehModelCustom.focus();
          return "Please enter your vehicle model.";
        }
      } else {
        if (!vehModel || !vehModel.value) {
          if (vehModel) vehModel.focus();
          return "Please select a model.";
        }
        if (vehModel.value === "Other") {
          if (!vehModelCustom || !vehModelCustom.value.trim()) {
            if (vehModelCustom) vehModelCustom.focus();
            return "Please specify your model.";
          }
        }
      }
      var email = document.getElementById("cust-email");
      if (email && email.validity && !email.validity.valid) {
        email.focus();
        return "Please enter a valid email address.";
      }
      var zip = document.getElementById("cust-zip");
      if (zip && !/^\d{5}(?:-\d{4})?$/.test(String(zip.value || "").trim())) {
        zip.focus();
        return "Please enter a valid ZIP code.";
      }
      return "";
    }
    if (step === 6) {
      var cm = form.querySelector('input[name="checkoutMethod"]:checked');
      if (!cm) return "Please choose how you’d like to complete your request.";
      if (cm.value === "pay") {
        return "Pay online is coming soon. Please choose Book appointment to submit your request.";
      }
      var ack = document.getElementById("pay-inspection-ack");
      if (!ack || !ack.checked) {
        if (ack) ack.focus();
        return "Please confirm you understand pricing may change after vehicle inspection.";
      }
      return "";
    }
    return "";
  }

  function syncCheckoutUi() {
    if (payNotice) payNotice.hidden = false;
    if (!btnSubmitBook && !btnSubmitPay) return;
    if (currentStep !== TOTAL_STEPS) {
      if (btnSubmitBook) btnSubmitBook.hidden = true;
      if (btnSubmitPay) btnSubmitPay.hidden = true;
      return;
    }
    var method = form.querySelector('input[name="checkoutMethod"]:checked');
    if (!method) {
      if (btnSubmitBook) btnSubmitBook.hidden = true;
      if (btnSubmitPay) btnSubmitPay.hidden = true;
      return;
    }
    if (method.value === "pay") {
      if (btnSubmitBook) btnSubmitBook.hidden = true;
      if (btnSubmitPay) btnSubmitPay.hidden = false;
    } else {
      if (btnSubmitBook) btnSubmitBook.hidden = false;
      if (btnSubmitPay) btnSubmitPay.hidden = true;
    }
  }

  function saveState() {
    try {
      var data = {
        step: currentStep,
        service: (form.querySelector('input[name="service"]:checked') || {}).value,
        vehicle: (form.querySelector('input[name="vehicle"]:checked') || {}).value,
        addons: Array.prototype.map.call(
          form.querySelectorAll('input[name="addon"]:checked'),
          function (c) {
            return c.value;
          }
        ),
        bookingDate: dateInput ? dateInput.value : "",
        bookingTime: timeSelect ? timeSelect.value : "",
        custFirstName: document.getElementById("cust-first-name")
          ? document.getElementById("cust-first-name").value
          : "",
        custLastName: document.getElementById("cust-last-name")
          ? document.getElementById("cust-last-name").value
          : "",
        custEmail: document.getElementById("cust-email")
          ? document.getElementById("cust-email").value
          : "",
        custPhone: document.getElementById("cust-phone")
          ? document.getElementById("cust-phone").value
          : "",
        custAddress: document.getElementById("cust-address")
          ? document.getElementById("cust-address").value
          : "",
        custCity: document.getElementById("cust-city")
          ? document.getElementById("cust-city").value
          : "",
        custState: document.getElementById("cust-state")
          ? document.getElementById("cust-state").value
          : "CO",
        custZip: document.getElementById("cust-zip")
          ? document.getElementById("cust-zip").value
          : "",
        vehYear: vehYear ? vehYear.value : "",
        vehMake: vehMake ? vehMake.value : "",
        vehModel: vehModel ? vehModel.value : "",
        vehMakeCustom: vehMakeCustom ? vehMakeCustom.value : "",
        vehModelCustom: vehModelCustom ? vehModelCustom.value : "",
        vehColor: document.getElementById("veh-color")
          ? document.getElementById("veh-color").value
          : "",
        custNotes: document.getElementById("cust-notes")
          ? document.getElementById("cust-notes").value
          : "",
        checkoutMethod: (form.querySelector('input[name="checkoutMethod"]:checked') || {})
          .value,
        payInspectionAck: document.getElementById("pay-inspection-ack")
          ? document.getElementById("pay-inspection-ack").checked
          : false,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function restoreState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.service && data.service !== "signature") {
        var r = form.querySelector('input[name="service"][value="' + data.service + '"]');
        if (r) r.checked = true;
      }
      updateSelectionLabels();
      if (data.vehicle) {
        var rv = form.querySelector('input[name="vehicle"][value="' + data.vehicle + '"]');
        if (rv) rv.checked = true;
      }
      if (data.addons && data.addons.length) {
        data.addons.forEach(function (a) {
          var c = form.querySelector('input[name="addon"][value="' + a + '"]');
          if (c) c.checked = true;
        });
      }
      if (data.bookingDate && dateInput) {
        dateInput.value = data.bookingDate;
        syncCalendarViewToDate(data.bookingDate);
      }
      if (data.bookingTime && timeSelect) timeSelect.value = data.bookingTime;

      var fields = [
        "custFirstName",
        "custLastName",
        "custEmail",
        "custPhone",
        "custAddress",
        "custCity",
        "custState",
        "custZip",
        "vehColor",
        "custNotes",
      ];
      var ids = [
        "cust-first-name",
        "cust-last-name",
        "cust-email",
        "cust-phone",
        "cust-address",
        "cust-city",
        "cust-state",
        "cust-zip",
        "veh-color",
        "cust-notes",
      ];
      fields.forEach(function (k, i) {
        if (data[k] != null && document.getElementById(ids[i])) {
          document.getElementById(ids[i]).value = data[k];
        }
      });
      if (
        !data.custFirstName &&
        !data.custLastName &&
        data.custName &&
        document.getElementById("cust-first-name")
      ) {
        var parts = String(data.custName).trim().split(/\s+/);
        document.getElementById("cust-first-name").value = parts.shift() || "";
        if (document.getElementById("cust-last-name")) {
          document.getElementById("cust-last-name").value = parts.join(" ");
        }
      }

      if (data.vehYear && vehYear) vehYear.value = data.vehYear;
      if (data.vehMake && vehMake) vehMake.value = data.vehMake;
      updateVehicleUI();
      if (vehMake && vehMake.value !== "Other" && vehModel && data.vehModel) {
        vehModel.value = data.vehModel;
      }
      if (vehModel && vehModel.value === "Other" && vehModelCustom && data.vehModelCustom) {
        vehModelCustom.value = data.vehModelCustom;
        if (vehModelCustomWrap) vehModelCustomWrap.hidden = false;
        if (vehModelCustom) vehModelCustom.required = true;
      }
      if (vehMake && vehMake.value === "Other") {
        if (vehMakeCustom && data.vehMakeCustom != null)
          vehMakeCustom.value = data.vehMakeCustom;
        if (vehModelCustom && data.vehModelCustom != null)
          vehModelCustom.value = data.vehModelCustom;
      }

      if (data.checkoutMethod === "pay") {
        var payMethod = form.querySelector('input[name="checkoutMethod"][value="pay"]');
        if (payMethod && !payMethod.disabled) payMethod.checked = true;
      } else {
        var bookMethod = form.querySelector('input[name="checkoutMethod"][value="book"]');
        if (bookMethod) bookMethod.checked = true;
      }
      if (data.payInspectionAck && document.getElementById("pay-inspection-ack")) {
        document.getElementById("pay-inspection-ack").checked = true;
      }

      if (data.step && data.step >= 1 && data.step <= TOTAL_STEPS) {
        showStep(data.step);
      }
      if (data.bookingDate) {
        refreshTimeForDate();
        renderCalendar();
      }
    } catch (e) {}
  }

  function vehicleSummaryLine(fd) {
    var y = fd.get("vehYear") || "";
    var make = fd.get("vehMake") || "";
    var model = fd.get("vehModel") || "";
    var makeC = fd.get("vehMakeCustom") || "";
    var modelC = fd.get("vehModelCustom") || "";

    if (make === "Other") {
      return [y, makeC, modelC].filter(function (x) {
        return x && String(x).trim();
      }).join(" ");
    }
    var modelPart = model === "Other" ? modelC : model;
    return [y, make, modelPart].filter(function (x) {
      return x && String(x).trim();
    }).join(" ");
  }

  function formatAddressFromFormData(fd) {
    var street = String(fd.get("custAddress") || "").trim();
    var city = String(fd.get("custCity") || "").trim();
    var state = String(fd.get("custState") || "").trim();
    var zip = String(fd.get("custZip") || "").trim();
    var cityStateZip = [city, state, zip].filter(Boolean).join(", ");
    return [street, cityStateZip].filter(Boolean).join(", ");
  }

  function buildSummaryText() {
    var fd = new FormData(form);
    var service = fd.get("service");
    var vehicle = fd.get("vehicle");
    var addons = fd.getAll("addon");
    var date = fd.get("bookingDate");
    var time = fd.get("bookingTime");

    var lines = [];
    lines.push("Blue Bear Detail — booking request");
    lines.push("");
    lines.push("Service: " + (serviceLabels[service] || service));
    lines.push("Vehicle type: " + (vehicleLabels[vehicle] || vehicle));
    lines.push(
      "Add-ons: " +
        (addons.length
          ? addons
              .map(function (a) {
                var label = addonLabels[a] || a;
                var p = formatAddonPriceDollars(a);
                return p ? label + " (" + p + ")" : label;
              })
              .join(", ")
          : "None")
    );
    lines.push(
      "Preferred date: " + (date || "") + " at " + (time ? formatTime12h(time) : "")
    );
    lines.push("");
    lines.push("Contact");
    var firstName = fd.get("custFirstName") || "";
    var lastName = fd.get("custLastName") || "";
    lines.push("Name: " + [firstName, lastName].filter(Boolean).join(" "));
    lines.push("Email: " + (fd.get("custEmail") || ""));
    lines.push("Phone: " + (fd.get("custPhone") || ""));
    lines.push("Address: " + formatAddressFromFormData(fd));
    lines.push("");
    lines.push("Vehicle");
    lines.push(vehicleSummaryLine(fd));
    var color = fd.get("vehColor");
    if (color) lines.push("Color / trim: " + color);
    var notes = fd.get("custNotes");
    if (notes && String(notes).trim()) {
      lines.push("");
      lines.push("Special instructions:");
      lines.push(String(notes).trim());
    }
    lines.push("");
    lines.push("Completion");
    var cm = fd.get("checkoutMethod");
    lines.push(
      "Method: " +
        (cm === "pay"
          ? "Pay online (payment link to follow)"
          : cm === "book"
            ? "Book appointment (confirm by phone/email)"
            : (cm || ""))
    );
    lines.push(
      "Inspection acknowledgment: " +
        (fd.get("payInspectionAck") === "yes" ? "Agreed" : "—")
    );
    lines.push("");
    lines.push("— Sent from bluebeardetail.com booking form");
    return lines.join("\n");
  }

  function openMailto(summary) {
    var subject = encodeURIComponent("Detailing booking request");
    var body = encodeURIComponent(summary);
    window.location.href = "mailto:" + MAILTO + "?subject=" + subject + "&body=" + body;
  }

  function setSubmitting(isLoading) {
    if (btnSubmitBook) {
      btnSubmitBook.disabled = !!isLoading;
    }
    if (btnSubmitPay) {
      btnSubmitPay.disabled = !!isLoading;
    }
  }

  function showDonePanel(summary, doneMessage) {
    summaryText.textContent = summary;
    if (doneTextEl) {
      doneTextEl.textContent =
        doneMessage ||
        "Your booking request was saved. We’ll follow up by phone or email to confirm.";
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (x) {}

    form.hidden = true;
    var bp = document.querySelector(".booking-progress");
    if (bp) bp.hidden = true;
    if (errEl) errEl.hidden = true;
    donePanel.hidden = false;
    refreshLucideIcons();
    donePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function refreshLucideIcons() {
    if (typeof lucide !== "undefined" && lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
  }

  btnNext.addEventListener("click", function () {
    var err = validateStep(currentStep);
    if (err) {
      showError(err);
      return;
    }
    saveState();
    if (currentStep < TOTAL_STEPS) {
      showStep(currentStep + 1);
      saveState();
    }
  });

  btnBack.addEventListener("click", function () {
    if (currentStep > 1) {
      showStep(currentStep - 1);
      saveState();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (currentStep !== TOTAL_STEPS) {
      showError("Please use Continue to reach the final step.");
      return;
    }
    var err = validateStep(6);
    if (err) {
      showError(err);
      return;
    }
    var fd = new FormData(form);
    var checkoutMethod = fd.get("checkoutMethod");
    var summary = buildSummaryText();

    if (checkoutMethod === "pay") {
      showError(
        "Pay online is coming soon. Please choose Book appointment to submit your request."
      );
      return;
    }
    if (checkoutMethod !== "book") {
      showError("Please choose Book appointment to submit.");
      return;
    }

    setSubmitting(true);
    showError("");

    // file:// pages cannot load ES modules (dynamic import) — booking submit never runs.
    if (location.protocol === "file:") {
      setSubmitting(false);
      showError(
        "Booking save needs this page served over http (not opened as a file). In Terminal: cd to your project folder, run python3 -m http.server 8765 — then open http://127.0.0.1:8765/book-flow.html (or run bash serve-local.sh if your project has it)."
      );
      return;
    }

    import(bookingSubmitModuleUrl())
      .then(function (mod) {
        return mod.submitBookAppointment(form, summary);
      })
      .then(function (result) {
        setSubmitting(false);
        if (!result) {
          showError("Could not save your booking. Please try again.");
          return;
        }
        if (result.error) {
          showError(result.error);
          return;
        }
        if (result.skipped) {
          openMailto(summary);
          showDonePanel(
            summary,
            "Supabase isn’t configured in js/supabase-config.js yet — we opened your email app instead. If nothing opened, copy the summary below or call us."
          );
          return;
        }
        var shortRef = result.referenceCode
          ? String(result.referenceCode)
          : result.id
            ? String(result.id)
                .replace(/-/g, "")
                .slice(0, 8)
                .toUpperCase()
            : "";
        var emailLine =
          result.emailSent === true
            ? " We sent a confirmation email to the address you provided."
            : "";
        showDonePanel(
          summary,
          shortRef
            ? "Your request is saved (reference " +
                shortRef +
                "…)." +
                emailLine +
                " We’ll follow up by phone or email to confirm. A copy of your details is below."
            : "Your request is saved." +
                emailLine +
                " We’ll follow up by phone or email to confirm. A copy of your details is below."
        );
      })
      .catch(function (err) {
        setSubmitting(false);
        console.error("[booking]", err);
        var hint =
          err && err.message
            ? err.message
            : "Could not save your booking. Please try again or call us.";
        if (
          typeof hint === "string" &&
          hint.indexOf("Failed to fetch") !== -1
        ) {
          hint +=
            " Check your network, or open this site over http:// (not file://).";
        }
        showError(hint);
      });
  });

  if (copyBtn && summaryText) {
    copyBtn.addEventListener("click", function () {
      var t = summaryText.textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () {
          copyBtn.textContent = "Copied";
          setTimeout(function () {
            copyBtn.textContent = "Copy details";
          }, 2000);
        });
      }
    });
  }

  calendarViewMonth = firstOfMonth(new Date());
  initCalendarNav();
  initVehicleSelects();
  renderCalendar();
  refreshTimeForDate();

  form.querySelectorAll('input[name="checkoutMethod"]').forEach(function (r) {
    r.addEventListener("change", syncCheckoutUi);
  });

  form.querySelectorAll('input[name="service"]').forEach(function (r) {
    r.addEventListener("change", updateSelectionLabels);
  });

  form.querySelectorAll('input[name="vehicle"]').forEach(function (r) {
    r.addEventListener("change", updateSelectionLabels);
  });

  window.addEventListener("storage", function (event) {
    if (event.key === ADMIN_BLOCKS_KEY || event.key === SITE_SETTINGS_KEY) {
      renderCalendar();
      refreshTimeForDate();
    }
  });

  window.addEventListener("bbd:site-settings-updated", function () {
    renderCalendar();
    refreshTimeForDate();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      renderCalendar();
      refreshTimeForDate();
    }
  });

  function initRealtimeAvailabilitySync() {
    getSupabaseModule().then(function (supa) {
      if (!supa || !supa.isConfigured || !supa.supabase) return;
      try {
        supa.supabase
          .channel("booking-live-availability")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "bookings" },
            function () {
              renderCalendar();
              refreshTimeForDate();
            }
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "site_settings", filter: "id=eq.default" },
            function () {
              renderCalendar();
              refreshTimeForDate();
            }
          )
          .subscribe();
      } catch (_e) {}
    });
  }

  function applyServiceFromUrl(hadSavedState) {
    try {
      var p = new URLSearchParams(window.location.search);
      var s = p.get("service");
      if (
        s &&
        (s === "essential" || s === "complete")
      ) {
        var r = form.querySelector('input[name="service"][value="' + s + '"]');
        if (r) {
          r.checked = true;
          updateSelectionLabels();
          if (!hadSavedState && currentStep === 1) {
            showStep(2);
          }
        }
        saveState();
      }
    } catch (e) {}
  }

  var hadSavedState = false;
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) {
      hadSavedState = true;
      restoreState();
    } else {
      showStep(1);
    }
  } catch (e) {
    showStep(1);
  }
  applyServiceFromUrl(hadSavedState);
  updateSelectionLabels();
  initRealtimeAvailabilitySync();

  /** Stain Spot Treatment only — opened via info button on book-flow */
  var addonInfoHtml = {
    "light-stain-spot-treatment":
      "<p>Already included in the Complete package. This add-on is intended for light to normal stains; heavier stains may require deep extraction — a service we do not yet offer.</p>",
  };

  function initAddonInfoDialog() {
    var dlg = document.getElementById("booking-addon-info-dialog");
    var titleEl = document.getElementById("booking-addon-info-title");
    var bodyEl = document.getElementById("booking-addon-info-body");
    var closeBtn = document.getElementById("booking-addon-info-close");
    if (!dlg || !titleEl || !bodyEl) return;

    document.querySelectorAll(".booking-addon-card__info-btn[data-addon-info]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute("data-addon-info");
        var html = addonInfoHtml[key];
        if (!html) return;
        titleEl.textContent = addonLabels[key] || key;
        bodyEl.innerHTML = html;
        dlg.showModal();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        dlg.close();
      });
    }
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
  }

  function initServiceInfoDialog() {
    var dlg = document.getElementById("booking-service-info-dialog");
    var titleEl = document.getElementById("booking-service-info-title");
    var bodyEl = document.getElementById("booking-service-info-body");
    var closeBtn = document.getElementById("booking-service-info-close");
    if (!dlg || !titleEl || !bodyEl) return;

    var info = {
      essential:
        "<p><strong>Best fit</strong> for daily drivers that need a quick exterior and interior refresh between deeper details.</p>" +
        "<p><strong>Vehicle condition</strong> Works best with light dust, routine dirt, and manageable interiors.</p>" +
        "<p><strong>Pricing</strong> Listed pricing assumes a standard condition vehicle. After inspection, we may adjust for size, soil level, or special requests.</p>",
      complete:
        "<p><strong>Best fit</strong> for when your vehicle needs some TLC&lt;3. Our most popular all-in-one option full interior and exterior clean.</p>" +
        "<p><strong>Vehicle condition</strong> Great for typical family wear, commuting grime, and seasonal buildup. Pet hair, heavy odors or set-in stains may require add-on time.</p>" +
        "<p><strong>Pricing</strong> Listed pricing assumes a standard condition vehicle. After inspection, we may adjust for size, soil level, or special requests.</p>",
      signature:
        "<p><strong>Best fit</strong> for enthusiasts and owners who want gloss and clarity dialed up.</p>" +
        "<p><strong>Vehicle condition</strong> Paint is assessed in person: heavy swirls, sanding marks, or XXL vehicles change time and materials. We plan protection (including ceramic add-ons) around what we see at inspection.</p>" +
        "<p><strong>Pricing</strong> Listed pricing assumes a standard condition vehicle. After inspection, we may adjust for size, soil level, or special requests.</p>" +
        "<p><strong>Launch</strong> Signature booking opens in <strong>July 2026</strong>.</p>",
    };

    document.querySelectorAll("[data-booking-service-info]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.getAttribute("data-booking-service-info");
        titleEl.textContent =
          key === "essential"
            ? "Essential details"
            : key === "complete"
              ? "Complete details"
              : "Signature details";
        bodyEl.innerHTML = info[key] || "<p>Details unavailable.</p>";
        dlg.showModal();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        dlg.close();
      });
    }
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
    });
  }

  initAddonInfoDialog();
  initServiceInfoDialog();
  refreshLucideIcons();
})();
