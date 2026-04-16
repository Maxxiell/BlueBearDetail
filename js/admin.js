import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

(async () => {
  const ADMIN_AUTH_KEY = "bbdAdminAuth";
  const ADMIN_EMAIL_ALLOWED = "deleteddata@outlook.com";
  const BLOCKS_KEY = "bbdAdminBlockedSchedule";
  const SITE_SETTINGS_KEY = "bbdSiteSettings";
  const DEMO_CUSTOMERS_KEY = "bbdAdminDemoCustomers";
  const DEMO_PAYMENTS_KEY = "bbdAdminDemoPayments";
  const store =
    window.bbdPersistentStore &&
    typeof window.bbdPersistentStore.getItem === "function" &&
    typeof window.bbdPersistentStore.setItem === "function" &&
    typeof window.bbdPersistentStore.removeItem === "function"
      ? window.bbdPersistentStore
      : {
          getItem: (key) => {
            try {
              return localStorage.getItem(key);
            } catch (_e) {
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(key, String(value));
            } catch (_e) {}
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(key);
            } catch (_e) {}
          },
        };

  function adminToast(message, variant) {
    if (typeof window.bbdShowToast === "function") {
      window.bbdShowToast(message, { variant: variant || "info" });
    } else {
      alert(message);
    }
  }

  /** Per-page icon (Font Awesome 6 solid) for storefront copy cards. */
  const PAGE_CARD_ICONS = {
    index: "fa-house",
    services: "fa-wand-magic-sparkles",
    book: "fa-calendar-days",
    bookflow: "fa-clipboard-check",
    gallery: "fa-images",
    contact: "fa-envelope-open-text",
    about: "fa-book-open",
    subscriptions: "fa-ticket",
    account: "fa-id-card",
    login: "fa-key",
    signup: "fa-user-plus",
    terms: "fa-file-contract",
    privacy: "fa-shield-halved",
    admin: "fa-sliders",
  };

  const PAGE_EDIT_GROUPS = [
    {
      id: "index",
      title: "Home",
      fields: [
        { key: "index.heroH1", label: "Hero headline", multiline: false },
        { key: "index.heroDesc", label: "Hero description", multiline: true },
        { key: "index.heroEyebrow", label: "Hero eyebrow line", multiline: false },
        { key: "index.whatWeOfferTitle", label: "“What we offer” section title", multiline: false },
        { key: "index.mapH2", label: "Map section heading", multiline: false },
        { key: "index.mapSub", label: "Map section subtext", multiline: true },
        { key: "index.offerHeading", label: "Featured offer card heading", multiline: false },
        { key: "index.offerCopy", label: "Featured offer card copy", multiline: true },
      ],
    },
    {
      id: "services",
      title: "Services",
      fields: [
        { key: "services.heroH1", label: "Page title", multiline: false },
        { key: "services.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "book",
      title: "Book",
      fields: [
        { key: "book.heroH1", label: "Page title", multiline: false },
        { key: "book.heroP", label: "Page subtitle", multiline: true },
        { key: "book.scheduleH2", label: "“Schedule a visit” heading", multiline: false },
        { key: "book.subsPreviewH2", label: "“Memberships” preview heading", multiline: false },
        { key: "book.subsLede", label: "Memberships preview text", multiline: true },
      ],
    },
    {
      id: "bookflow",
      title: "Checkout",
      fields: [
        { key: "bookflow.heroH1", label: "Page title", multiline: false },
        { key: "bookflow.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "gallery",
      title: "Gallery",
      fields: [
        { key: "gallery.heroH1", label: "Page title", multiline: false },
        { key: "gallery.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      fields: [
        { key: "contact.heroH1", label: "Page title", multiline: false },
        { key: "contact.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "about",
      title: "About",
      fields: [
        { key: "about.heroH1", label: "Page title", multiline: false },
        { key: "about.heroP", label: "Page subtitle", multiline: true },
        { key: "about.introP", label: "First body paragraph", multiline: true },
      ],
    },
    {
      id: "subscriptions",
      title: "Plans",
      fields: [
        { key: "subscriptions.heroH1", label: "Page title", multiline: false },
        { key: "subscriptions.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "account",
      title: "Account",
      fields: [
        { key: "account.heroH1", label: "Page title", multiline: false },
        { key: "account.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "login",
      title: "Login",
      fields: [
        { key: "login.heroH1", label: "Page title", multiline: false },
        { key: "login.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "signup",
      title: "Join",
      fields: [
        { key: "signup.heroH1", label: "Page title", multiline: false },
        { key: "signup.heroP", label: "Page subtitle", multiline: true },
      ],
    },
    {
      id: "terms",
      title: "Terms",
      fields: [
        { key: "terms.heroH1", label: "Page title", multiline: false },
        { key: "terms.heroP", label: "Hero meta line (e.g. last updated)", multiline: false },
      ],
    },
    {
      id: "privacy",
      title: "Privacy",
      fields: [
        { key: "privacy.heroH1", label: "Page title", multiline: false },
        { key: "privacy.heroP", label: "Hero meta line (e.g. last updated)", multiline: false },
      ],
    },
    {
      id: "admin",
      title: "Admin",
      fields: [
        { key: "admin.heroH1", label: "Page title", multiline: false },
        { key: "admin.heroP", label: "Page subtitle", multiline: true },
      ],
    },
  ];

  /** Site default copy (matches HTML) when nothing is saved yet. */
  const DEFAULT_PAGE_TEXT = {
    "index.heroH1": "Care for every vehicle, inside and out",
    "index.heroDesc":
      "Cars, trucks, SUVs, and more — washes, interiors, paint protection, and fleet-friendly scheduling. We bring pro gear and sharp attention to your driveway or office.",
    "index.heroEyebrow": "Denver mobile detailing",
    "index.whatWeOfferTitle": "What We Offer",
    "index.mapH2": "Serving Denver and surrounding areas",
    "index.mapSub":
      "Approximate 50-mile service radius from Denver — contact us to confirm availability for your location.",
    "index.offerHeading": "Mobile Detailing Packages",
    "index.offerCopy":
      "From express washes to full interior and exterior packages, we bring showroom results to your driveway or office.",
    "services.heroH1": "Services",
    "services.heroP":
      "Three clear packages — pick what fits your vehicle and schedule. Fleet and custom work available on request.",
    "book.heroH1": "Book & Plans",
    "book.heroP":
      "Schedule a mobile detail in a few steps, or learn about our monthly membership options.",
    "book.scheduleH2": "Schedule a Visit",
    "book.subsPreviewH2": "Memberships & Subscriptions",
    "book.subsLede":
      "Separate from the booking flow — monthly credits toward a detail or a recurring service plan.",
    "bookflow.heroH1": "Book your appointment",
    "bookflow.heroP":
      "Choose your package, vehicle type, add-ons, and a preferred time — then how you’d like to complete your request.",
    "gallery.heroH1": "Gallery",
    "gallery.heroP": "Replace placeholders with your photos — same filenames or update the paths below.",
    "contact.heroH1": "Contact",
    "contact.heroP": "Book a visit or ask a question — we reply as soon as we can.",
    "about.heroH1": "About us",
    "about.heroP": "Local, mobile, and focused on lasting results.",
    "about.introP":
      "Blue Bear Detail LLC is a family-owned mobile detailing company that started in Denver. We built this business around reliable service, honest work, and treating every customer vehicle like our own.",
    "subscriptions.heroH1": "Subscriptions & memberships",
    "subscriptions.heroP":
      "Separate from one-time booking — enroll anytime; we confirm vehicle and pricing before you’re charged.",
    "account.heroH1": "Account",
    "account.heroP":
      "Signed-in view (Supabase Auth). Dashboard copy below is still sample data until you connect your database.",
    "login.heroH1": "Log in",
    "login.heroP": "Access your dashboard with the email and password you used to sign up.",
    "signup.heroH1": "Create account",
    "signup.heroP":
      "Sign up with email. If email confirmation is on in Supabase, check your inbox before logging in.",
    "terms.heroH1": "Terms of Service",
    "terms.heroP": "Last updated: April 6, 2026",
    "privacy.heroH1": "Privacy Policy",
    "privacy.heroP": "Last updated: April 6, 2026",
    "admin.heroH1": "Admin",
    "admin.heroP": "Rates, copy, and booking availability.",
  };

  const DEFAULT_PACKAGE_BULLETS = {
    essential: [
      "Exterior hand wash & dry",
      "Wheels & tires cleaned, tires dressed",
      "Interior vacuum & wipe-down",
      "Glass cleaned inside & out",
    ],
    complete: [
      "Everything in Essential",
      "Deep interior: seats & carpets shampooed or steamed",
      "Panels, vents, and cupholders detailed",
      "Exterior decontamination, sealant or wax protection",
    ],
    signature: [
      "Everything in Complete",
      "Paint enhancement polish to reduce swirls & boost gloss",
      "Ceramic coating add-on available",
      "Engine bay & trim dressings as needed",
    ],
  };

  const DEFAULT_CUSTOMERS = [
    {
      name: "Alex K.",
      email: "alex.k@example.com",
      phone: "(303) 555-0101",
      since: "2025-11-12",
      notes: "Complete package · Denver",
      creditBalance: 0,
      rewardPoints: 240,
    },
    {
      name: "Jordan M.",
      email: "jordan@example.com",
      phone: "(720) 555-0142",
      since: "2026-01-08",
      notes: "Fleet contact · quarterly",
      creditBalance: 50,
      rewardPoints: 1180,
    },
    {
      name: "Sam R.",
      email: "sam.r@example.com",
      phone: "(303) 555-0199",
      since: "2026-03-22",
      notes: "New customer · referral",
      creditBalance: 0,
      rewardPoints: 90,
    },
  ];

  const DEFAULT_PAYMENTS = [
    {
      id: "txn_8fa21c",
      date: "2026-04-02",
      customer: "Alex K.",
      amount: 212.49,
      status: "Paid",
      method: "Card",
    },
    {
      id: "txn_7bc903",
      date: "2026-03-18",
      customer: "Jordan M.",
      amount: 499.0,
      status: "Paid",
      method: "Invoice",
    },
    {
      id: "txn_6ad441",
      date: "2026-03-05",
      customer: "Sam R.",
      amount: 99.99,
      status: "Pending",
      method: "Card",
    },
  ];

  const priceEssential = document.getElementById("price-essential");
  const priceComplete = document.getElementById("price-complete");
  const priceSignature = document.getElementById("price-signature");
  const promoDiscount = document.getElementById("promo-discount");
  const promoCode = document.getElementById("promo-code");
  const promoText = document.getElementById("promo-text");
  const promoEnabledInput = document.getElementById("promo-enabled");
  const packageBulletsEssential = document.getElementById("package-bullets-essential");
  const packageBulletsComplete = document.getElementById("package-bullets-complete");
  const packageBulletsSignature = document.getElementById("package-bullets-signature");
  const savePricingBtn = document.getElementById("site-settings-save-pricing");
  const pageEditsRoot = document.getElementById("admin-page-edits-root");
  const demoCustomersBody = document.getElementById("admin-demo-customers-body");
  const demoPaymentsBody = document.getElementById("admin-demo-payments-body");
  const demoDataResetBtn = document.getElementById("admin-demo-data-reset");
  const balanceCustomerSelect = document.getElementById("admin-balance-customer");
  const balanceCreditInput = document.getElementById("admin-balance-credit");
  const balancePointsInput = document.getElementById("admin-balance-points");
  const balanceApplyBtn = document.getElementById("admin-balance-apply");
  const adminBookingsBody = document.getElementById("admin-bookings-body");

  const dayInput = document.getElementById("block-day-date");
  const dayAddBtn = document.getElementById("block-day-add");
  const dayList = document.getElementById("blocked-days-list");
  const dayEmpty = document.getElementById("blocked-days-empty");

  const timeDateInput = document.getElementById("block-time-date");
  const timeStartInput = document.getElementById("block-time-start");
  const timeEndInput = document.getElementById("block-time-end");
  const timeAddBtn = document.getElementById("block-time-add");
  const timeList = document.getElementById("blocked-times-list");
  const timeEmpty = document.getElementById("blocked-times-empty");

  if (!dayInput || !dayAddBtn || !dayList || !dayEmpty || !timeDateInput || !timeStartInput || !timeEndInput || !timeAddBtn || !timeList || !timeEmpty) {
    return;
  }

  async function hasAllowedSupabaseAdminSession() {
    if (!isSupabaseConfigured()) return false;
    try {
      const res = await supabase.auth.getSession();
      const session = res && res.data ? res.data.session : null;
      const email =
        session &&
        session.user &&
        typeof session.user.email === "string"
          ? session.user.email.trim().toLowerCase()
          : "";
      return email === ADMIN_EMAIL_ALLOWED;
    } catch (_e) {
      return false;
    }
  }

  if (isSupabaseConfigured()) {
    const allowed = await hasAllowedSupabaseAdminSession();
    if (!allowed) {
      store.removeItem(ADMIN_AUTH_KEY);
      window.location.replace("login.html?next=admin.html");
      return;
    }
    store.setItem(ADMIN_AUTH_KEY, "1");
  } else if (store.getItem(ADMIN_AUTH_KEY) !== "1") {
    window.location.replace("login.html?next=admin.html");
    return;
  }

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function parseTimeToMins(raw) {
    if (!/^\d{2}:\d{2}$/.test(raw)) return null;
    const [h, m] = raw.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  function readBlocks() {
    try {
      const raw = store.getItem(BLOCKS_KEY);
      if (!raw) return { blockedDates: [], timeRangesByDate: {} };
      const data = JSON.parse(raw);
      return sanitizeBlocks({
        blockedDates: Array.isArray(data.blockedDates) ? data.blockedDates : [],
        timeRangesByDate: data.timeRangesByDate && typeof data.timeRangesByDate === "object" ? data.timeRangesByDate : {},
      });
    } catch (_e) {
      return { blockedDates: [], timeRangesByDate: {} };
    }
  }

  function readSiteSettings() {
    try {
      const raw = store.getItem(SITE_SETTINGS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function writeSiteSettings(nextSettings) {
    const current = readSiteSettings();
    const merged = { ...current, ...nextSettings };
    store.setItem(SITE_SETTINGS_KEY, JSON.stringify(merged));
  }

  function sanitizeBlocks(data) {
    const cleanDates = [...new Set((data.blockedDates || []).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    const cleanRanges = {};
    const source = data.timeRangesByDate && typeof data.timeRangesByDate === "object" ? data.timeRangesByDate : {};

    Object.keys(source).forEach((dateKey) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const ranges = Array.isArray(source[dateKey]) ? source[dateKey] : [];
      const deduped = [];
      const seen = new Set();
      ranges.forEach((range) => {
        if (!range || typeof range.start !== "string" || typeof range.end !== "string") return;
        const startMins = parseTimeToMins(range.start);
        const endMins = parseTimeToMins(range.end);
        if (startMins == null || endMins == null || endMins <= startMins) return;
        const key = `${range.start}|${range.end}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push({ start: range.start, end: range.end });
      });
      deduped.sort((a, b) => a.start.localeCompare(b.start));
      if (deduped.length) cleanRanges[dateKey] = deduped;
    });

    return { blockedDates: cleanDates, timeRangesByDate: cleanRanges };
  }

  function writeBlocks(data) {
    store.setItem(BLOCKS_KEY, JSON.stringify(sanitizeBlocks(data)));
  }

  function removeBlockedDate(date) {
    const data = readBlocks();
    data.blockedDates = data.blockedDates.filter((d) => d !== date);
    writeBlocks(data);
    render();
  }

  function removeRange(date, start, end) {
    const data = readBlocks();
    const ranges = Array.isArray(data.timeRangesByDate[date]) ? data.timeRangesByDate[date] : [];
    const nextRanges = ranges.filter((range) => !(range.start === start && range.end === end));
    const changed = nextRanges.length !== ranges.length;
    if (!changed) return;
    if (nextRanges.length) {
      data.timeRangesByDate[date] = nextRanges;
    } else {
      delete data.timeRangesByDate[date];
    }
    writeBlocks(data);
    render();
  }

  function render() {
    const data = readBlocks();

    dayList.innerHTML = "";
    const dayDates = [...new Set(data.blockedDates)].sort();
    dayEmpty.hidden = dayDates.length > 0;
    dayDates.forEach((date) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${date}</span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-admin-ghost admin-list-remove";
      btn.textContent = "Remove";
      btn.addEventListener("click", () => removeBlockedDate(date));
      li.appendChild(btn);
      dayList.appendChild(li);
    });

    timeList.innerHTML = "";
    const entries = Object.entries(data.timeRangesByDate || {})
      .filter((entry) => Array.isArray(entry[1]) && entry[1].length)
      .sort(([a], [b]) => a.localeCompare(b));

    timeEmpty.hidden = entries.length > 0;
    entries.forEach(([date, ranges]) => {
      ranges.forEach((range) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${date} · ${range.start} - ${range.end}</span>`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-admin-ghost admin-list-remove";
        btn.textContent = "Remove";
        btn.addEventListener("click", () => removeRange(date, range.start, range.end));
        li.appendChild(btn);
        timeList.appendChild(li);
      });
    });
  }

  dayAddBtn.addEventListener("click", () => {
    const date = dayInput.value;
    if (!date) {
      adminToast("Select a date first.", "error");
      return;
    }
    const data = readBlocks();
    if (!data.blockedDates.includes(date)) {
      data.blockedDates.push(date);
      data.blockedDates.sort();
      writeBlocks(data);
    }
    render();
  });

  timeAddBtn.addEventListener("click", () => {
    const date = timeDateInput.value;
    const start = timeStartInput.value;
    const end = timeEndInput.value;
    if (!date || !start || !end) {
      adminToast("Set date, start time, and end time.", "error");
      return;
    }
    const startMins = parseTimeToMins(start);
    const endMins = parseTimeToMins(end);
    if (startMins == null || endMins == null || endMins <= startMins) {
      adminToast("End time must be later than start time.", "error");
      return;
    }
    const data = readBlocks();
    const ranges = Array.isArray(data.timeRangesByDate[date]) ? data.timeRangesByDate[date] : [];
    ranges.push({ start, end });
    ranges.sort((a, b) => a.start.localeCompare(b.start));
    data.timeRangesByDate[date] = ranges;
    writeBlocks(data);
    render();
  });

  const minDate = todayISO();
  dayInput.min = minDate;
  timeDateInput.min = minDate;
  dayInput.value = minDate;
  timeDateInput.value = minDate;

  const settings = readSiteSettings();
  if (settings.pricing) {
    if (typeof settings.pricing.essential === "number" && priceEssential) priceEssential.value = settings.pricing.essential.toFixed(2);
    if (typeof settings.pricing.complete === "number" && priceComplete) priceComplete.value = settings.pricing.complete.toFixed(2);
    if (typeof settings.pricing.signature === "number" && priceSignature) priceSignature.value = settings.pricing.signature.toFixed(2);
  }
  if (settings.promo) {
    if (typeof settings.promo.discountPct === "number" && promoDiscount) promoDiscount.value = String(settings.promo.discountPct);
    if (typeof settings.promo.code === "string" && promoCode) promoCode.value = settings.promo.code;
    if (typeof settings.promo.text === "string" && promoText) promoText.value = settings.promo.text;
  }
  if (promoEnabledInput) {
    promoEnabledInput.checked = settings.promo == null || settings.promo.enabled !== false;
  }
  function fillPackageBulletTextarea(el, key) {
    if (!el || !DEFAULT_PACKAGE_BULLETS[key]) return;
    const stored = settings.packageBullets && settings.packageBullets[key];
    const lines = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_PACKAGE_BULLETS[key];
    el.value = lines.map((x) => String(x)).join("\n");
  }
  fillPackageBulletTextarea(packageBulletsEssential, "essential");
  fillPackageBulletTextarea(packageBulletsComplete, "complete");
  fillPackageBulletTextarea(packageBulletsSignature, "signature");

  function resolvePageTextValue(key, settings) {
    const pe = settings.pageEdits && typeof settings.pageEdits === "object" ? settings.pageEdits : {};
    const legacy = settings.indexOffer || {};
    if (pe[key] != null && String(pe[key]).trim() !== "") return String(pe[key]).trim();
    if (key === "index.offerHeading" && legacy.heading && String(legacy.heading).trim() !== "") {
      return String(legacy.heading).trim();
    }
    if (key === "index.offerCopy" && legacy.copy && String(legacy.copy).trim() !== "") {
      return String(legacy.copy).trim();
    }
    return DEFAULT_PAGE_TEXT[key] || "";
  }

  function setGroupEditing(det, editing) {
    const viewPane = det.querySelector(".admin-page-pane--view");
    const editPane = det.querySelector(".admin-page-pane--edit");
    const btnEdit = det.querySelector(".admin-page-btn-edit");
    const btnSave = det.querySelector(".admin-page-btn-save");
    const btnCancel = det.querySelector(".admin-page-btn-cancel");
    if (!viewPane || !editPane) return;
    viewPane.hidden = editing;
    editPane.hidden = !editing;
    if (btnEdit) btnEdit.hidden = editing;
    if (btnSave) btnSave.hidden = !editing;
    if (btnCancel) btnCancel.hidden = !editing;
    if (editing) det.open = true;
  }

  function refreshGroupPreviews(groupId) {
    const det = pageEditsRoot && pageEditsRoot.querySelector(`details[data-page-group="${groupId}"]`);
    if (!det) return;
    const settings = readSiteSettings();
    const groupDef = PAGE_EDIT_GROUPS.find((g) => g.id === groupId);
    if (!groupDef) return;
    groupDef.fields.forEach((field) => {
      const preview = det.querySelector(`[data-page-preview-key="${field.key}"]`);
      if (preview) preview.textContent = resolvePageTextValue(field.key, settings);
    });
  }

  function syncGroupInputsFromStorage(groupId) {
    const det = pageEditsRoot && pageEditsRoot.querySelector(`details[data-page-group="${groupId}"]`);
    if (!det) return;
    const settings = readSiteSettings();
    const groupDef = PAGE_EDIT_GROUPS.find((g) => g.id === groupId);
    if (!groupDef) return;
    groupDef.fields.forEach((field) => {
      const input = det.querySelector(`[data-page-edit-key="${field.key}"]`);
      if (input) input.value = resolvePageTextValue(field.key, settings);
    });
  }

  function saveOneGroup(groupId) {
    const groupDef = PAGE_EDIT_GROUPS.find((g) => g.id === groupId);
    if (!groupDef || !pageEditsRoot) return;
    const det = pageEditsRoot.querySelector(`details[data-page-group="${groupId}"]`);
    if (!det) return;
    const idx = readSiteSettings();
    const mergedEdits = { ...(idx.pageEdits && typeof idx.pageEdits === "object" ? idx.pageEdits : {}) };
    groupDef.fields.forEach((field) => {
      const input = det.querySelector(`[data-page-edit-key="${field.key}"]`);
      if (input) mergedEdits[field.key] = String(input.value || "").trim();
    });
    writeSiteSettings({
      pageEdits: mergedEdits,
      indexOffer: {
        heading: mergedEdits["index.offerHeading"] || "",
        copy: mergedEdits["index.offerCopy"] || "",
      },
    });
    refreshGroupPreviews(groupId);
    setGroupEditing(det, false);
    adminToast("Page copy saved.", "success");
  }

  function buildPageEditForm() {
    if (!pageEditsRoot) return;
    pageEditsRoot.innerHTML = "";
    const settings = readSiteSettings();

    PAGE_EDIT_GROUPS.forEach((group) => {
      const det = document.createElement("details");
      det.className = "admin-page-edit-group";
      det.dataset.pageGroup = group.id;
      det.open = false;

      const sum = document.createElement("summary");
      sum.className = "admin-page-card__summary";

      const chev = document.createElement("span");
      chev.className = "admin-page-card__chevron";
      chev.setAttribute("aria-hidden", "true");
      chev.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

      const pageIco = document.createElement("span");
      pageIco.className = "admin-page-card__page-icon";
      pageIco.setAttribute("aria-hidden", "true");
      const icoClass = PAGE_CARD_ICONS[group.id] || "fa-file-lines";
      pageIco.innerHTML = `<i class="fa-solid ${icoClass}"></i>`;

      const nameEl = document.createElement("span");
      nameEl.className = "admin-page-card__name";
      nameEl.textContent = group.title;

      sum.appendChild(chev);
      sum.appendChild(pageIco);
      sum.appendChild(nameEl);
      det.appendChild(sum);

      const viewPane = document.createElement("div");
      viewPane.className = "admin-page-pane admin-page-pane--view";

      const editPane = document.createElement("div");
      editPane.className = "admin-page-pane admin-page-pane--edit";
      editPane.hidden = true;

      group.fields.forEach((field) => {
        const textVal = resolvePageTextValue(field.key, settings);
        const safeId = `bbd-pe-${field.key.replace(/[^a-z0-9_-]/gi, "_")}`;

        const viewRow = document.createElement("div");
        viewRow.className = "admin-page-field";
        const vLabel = document.createElement("div");
        vLabel.className = "admin-page-field__label";
        vLabel.textContent = field.label;
        const vValue = document.createElement("div");
        vValue.className = "admin-page-field__value";
        vValue.dataset.pagePreviewKey = field.key;
        vValue.textContent = textVal;
        viewRow.appendChild(vLabel);
        viewRow.appendChild(vValue);
        viewPane.appendChild(viewRow);

        const editWrap = document.createElement("div");
        editWrap.className = "admin-page-field admin-page-field--edit";
        const lab = document.createElement("label");
        lab.htmlFor = safeId;
        lab.textContent = field.label;
        const input = field.multiline ? document.createElement("textarea") : document.createElement("input");
        input.id = safeId;
        input.dataset.pageEditKey = field.key;
        if (!field.multiline) input.type = "text";
        input.value = textVal;
        editWrap.appendChild(lab);
        editWrap.appendChild(input);
        editPane.appendChild(editWrap);
      });

      const drawer = document.createElement("div");
      drawer.className = "admin-page-card__drawer";

      drawer.appendChild(viewPane);
      drawer.appendChild(editPane);

      const actions = document.createElement("div");
      actions.className = "admin-page-group-actions";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn btn-admin-ghost admin-page-btn-edit";
      btnEdit.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i> Edit';

      const btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.className = "btn btn-admin-ghost admin-page-btn-cancel";
      btnCancel.textContent = "Cancel";
      btnCancel.hidden = true;

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.className = "btn btn-admin-primary admin-page-btn-save";
      btnSave.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Save';
      btnSave.textContent = "Save";
      btnSave.hidden = true;

      btnEdit.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        syncGroupInputsFromStorage(group.id);
        setGroupEditing(det, true);
      });
      btnCancel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        syncGroupInputsFromStorage(group.id);
        setGroupEditing(det, false);
      });
      btnSave.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveOneGroup(group.id);
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnCancel);
      actions.appendChild(btnSave);
      drawer.appendChild(actions);
      det.appendChild(drawer);

      pageEditsRoot.appendChild(det);
    });
  }

  function normalizeCustomer(row) {
    if (!row || typeof row !== "object") return null;
    const credit =
      typeof row.creditBalance === "number" && !Number.isNaN(row.creditBalance)
        ? Math.max(0, Math.round(row.creditBalance * 100) / 100)
        : 0;
    const pts =
      typeof row.rewardPoints === "number" && !Number.isNaN(row.rewardPoints)
        ? Math.max(0, Math.floor(row.rewardPoints))
        : 0;
    return {
      name: String(row.name || "").trim() || "—",
      email: String(row.email || "").trim() || "—",
      phone: String(row.phone || "").trim() || "—",
      since: String(row.since || "").trim() || "—",
      notes: String(row.notes || "").trim(),
      creditBalance: credit,
      rewardPoints: pts,
    };
  }

  function loadDemoCustomers() {
    try {
      const raw = store.getItem(DEMO_CUSTOMERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map(normalizeCustomer).filter(Boolean);
        }
      }
    } catch (_e) {}
    return DEFAULT_CUSTOMERS.map((c) => normalizeCustomer(c)).filter(Boolean);
  }

  function saveCustomersArray(rows) {
    store.setItem(DEMO_CUSTOMERS_KEY, JSON.stringify(rows.map(normalizeCustomer).filter(Boolean)));
  }

  function loadDemoPayments() {
    try {
      const raw = store.getItem(DEMO_PAYMENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_e) {}
    return DEFAULT_PAYMENTS.slice();
  }

  function persistDemoData() {
    saveCustomersArray(loadDemoCustomers());
    store.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(loadDemoPayments()));
  }

  function ensureDemoSeed() {
    if (!store.getItem(DEMO_CUSTOMERS_KEY)) {
      store.setItem(DEMO_CUSTOMERS_KEY, JSON.stringify(DEFAULT_CUSTOMERS.map((c) => normalizeCustomer(c))));
    }
    if (!store.getItem(DEMO_PAYMENTS_KEY)) {
      store.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(DEFAULT_PAYMENTS));
    }
  }

  function populateBalanceCustomerSelect() {
    if (!balanceCustomerSelect) return;
    const customers = loadDemoCustomers();
    const prev = balanceCustomerSelect.value;
    balanceCustomerSelect.innerHTML =
      '<option value="">— Select customer —</option>' +
      customers
        .map((c) => {
          const v = escapeHtml(c.email);
          const label = `${c.name} (${c.email})`;
          return `<option value="${v}">${escapeHtml(label)}</option>`;
        })
        .join("");
    if (prev && customers.some((c) => c.email === prev)) {
      balanceCustomerSelect.value = prev;
    }
  }

  function refundPayment(paymentId) {
    const payments = loadDemoPayments();
    const idx = payments.findIndex((p) => p && p.id === paymentId);
    if (idx === -1) return;
    const row = payments[idx];
    const status = String(row.status || "");
    if (status === "Refunded") {
      adminToast("This payment is already refunded.", "error");
      return;
    }
    if (status !== "Paid") {
      adminToast("Only completed (Paid) charges can be refunded in this preview.", "error");
      return;
    }
    const amt = typeof row.amount === "number" ? row.amount.toFixed(2) : String(row.amount);
    if (!window.confirm(`Record a refund of $${amt} for ${row.customer}? (sample ledger only)`)) return;
    payments[idx] = {
      ...row,
      status: "Refunded",
      refundedAt: new Date().toISOString().slice(0, 10),
    };
    store.setItem(DEMO_PAYMENTS_KEY, JSON.stringify(payments));
    renderDemoTables();
    adminToast("Refund recorded.", "success");
  }

  function renderDemoTables() {
    if (demoCustomersBody) {
      demoCustomersBody.innerHTML = "";
      loadDemoCustomers().forEach((row) => {
        const tr = document.createElement("tr");
        const cr = typeof row.creditBalance === "number" ? row.creditBalance.toFixed(2) : "0.00";
        const pts = typeof row.rewardPoints === "number" ? String(row.rewardPoints) : "0";
        tr.innerHTML = `<td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(
          row.phone
        )}</td><td>${escapeHtml(row.since)}</td><td>$${escapeHtml(cr)}</td><td>${escapeHtml(pts)}</td><td>${escapeHtml(
          row.notes || ""
        )}</td>`;
        demoCustomersBody.appendChild(tr);
      });
    }
    if (demoPaymentsBody) {
      demoPaymentsBody.innerHTML = "";
      loadDemoPayments().forEach((row) => {
        const tr = document.createElement("tr");
        const amt = typeof row.amount === "number" ? row.amount.toFixed(2) : escapeHtml(String(row.amount));
        const st = String(row.status || "");
        let actions = "—";
        if (st === "Paid") {
          const pid = escapeHtml(row.id);
          actions = `<button type="button" class="btn btn-admin-ghost admin-refund-btn" data-admin-refund="${pid}">Refund</button>`;
        } else if (st === "Refunded") {
          const when = row.refundedAt ? ` · ${escapeHtml(row.refundedAt)}` : "";
          actions = `<span class="admin-refund-done">Refunded${when}</span>`;
        }
        tr.innerHTML = `<td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(
          row.customer
        )}</td><td>$${amt}</td><td>${escapeHtml(st)}</td><td>${escapeHtml(row.method)}</td><td class="admin-table-actions">${actions}</td>`;
        demoPaymentsBody.appendChild(tr);
      });
    }
    populateBalanceCustomerSelect();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function loadBookingsAdmin() {
    if (!adminBookingsBody) return;
    if (!isSupabaseConfigured()) {
      adminBookingsBody.innerHTML =
        '<tr><td colspan="9" class="admin-empty">Connect Supabase in <code>js/supabase-config.js</code> to load bookings.</td></tr>';
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "reference_code,created_at,booking_date,booking_time,cust_first_name,cust_last_name,cust_email,cust_phone,service_package,status"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      adminBookingsBody.innerHTML = `<tr><td colspan="9" class="admin-empty">Could not load bookings: ${escapeHtml(
        error.message || "error"
      )}. Run <code>supabase/bookings-reference-rls.sql</code> in the SQL editor if this is a new column/policy.</td></tr>`;
      return;
    }
    const list = data || [];
    if (!list.length) {
      adminBookingsBody.innerHTML =
        '<tr><td colspan="9" class="admin-empty">No booking requests yet.</td></tr>';
      return;
    }
    adminBookingsBody.innerHTML = list
      .map((r) => {
        const ref = escapeHtml(r.reference_code || "—");
        const created = r.created_at
          ? escapeHtml(new Date(r.created_at).toLocaleString())
          : "—";
        const bd = escapeHtml(r.booking_date || "—");
        const bt = escapeHtml(r.booking_time || "—");
        const name = escapeHtml(
          [r.cust_first_name, r.cust_last_name].filter(Boolean).join(" ").trim() || "—"
        );
        const em = escapeHtml(r.cust_email || "");
        const ph = escapeHtml(r.cust_phone || "—");
        const pkg = escapeHtml(r.service_package || "—");
        const st = escapeHtml(r.status || "—");
        return `<tr><td>${ref}</td><td>${created}</td><td>${bd}</td><td>${bt}</td><td>${name}</td><td>${em}</td><td>${ph}</td><td>${pkg}</td><td>${st}</td></tr>`;
      })
      .join("");
  }

  if (savePricingBtn) {
    savePricingBtn.addEventListener("click", () => {
      const essential = Number(priceEssential?.value || 0);
      const complete = Number(priceComplete?.value || 0);
      const signature = Number(priceSignature?.value || 0);
      const discountPct = Number(promoDiscount?.value || 0);
      if (Number.isNaN(essential) || Number.isNaN(complete) || Number.isNaN(signature) || Number.isNaN(discountPct)) {
        adminToast("Please enter valid numeric pricing values.", "error");
        return;
      }
      const currentSettings = readSiteSettings();
      const prevPromo = currentSettings.promo && typeof currentSettings.promo === "object" ? currentSettings.promo : {};
      function parseBulletLines(el) {
        if (!el) return [];
        return String(el.value || "")
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      writeSiteSettings({
        pricing: { essential, complete, signature },
        promo: {
          ...prevPromo,
          enabled: promoEnabledInput ? promoEnabledInput.checked : true,
          discountPct: Math.max(0, Math.min(100, discountPct)),
          code: String(promoCode?.value || "").trim() || "WASH15",
          text: String(promoText?.value || "").trim() || "15% OFF FOR NEW CUSTOMERS",
        },
        packageBullets: {
          essential: parseBulletLines(packageBulletsEssential),
          complete: parseBulletLines(packageBulletsComplete),
          signature: parseBulletLines(packageBulletsSignature),
        },
      });
      adminToast("Pricing, promo, and package bullets saved.", "success");
    });
  }

  if (pageEditsRoot) {
    buildPageEditForm();
  }

  if (demoDataResetBtn) {
    demoDataResetBtn.addEventListener("click", () => {
      store.removeItem(DEMO_CUSTOMERS_KEY);
      store.removeItem(DEMO_PAYMENTS_KEY);
      persistDemoData();
      renderDemoTables();
      adminToast("Sample customer and payment rows were reset.", "success");
    });
  }

  if (demoPaymentsBody) {
    demoPaymentsBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin-refund]");
      if (!btn) return;
      const id = btn.getAttribute("data-admin-refund");
      if (id) refundPayment(id);
    });
  }

  if (balanceApplyBtn && balanceCustomerSelect && balanceCreditInput && balancePointsInput) {
    balanceApplyBtn.addEventListener("click", () => {
      const email = balanceCustomerSelect.value.trim();
      if (!email) {
        adminToast("Select a customer.", "error");
        return;
      }
      const creditAdd = Number(balanceCreditInput.value);
      const pointsAdd = Number(balancePointsInput.value);
      const cOk = !Number.isNaN(creditAdd) && creditAdd >= 0;
      const pOk = !Number.isNaN(pointsAdd) && pointsAdd >= 0;
      if (!cOk || !pOk) {
        adminToast("Enter valid numbers (zero or greater).", "error");
        return;
      }
      if (creditAdd === 0 && pointsAdd === 0) {
        adminToast("Enter a store credit amount and/or reward points to add.", "error");
        return;
      }
      const customers = loadDemoCustomers();
      const idx = customers.findIndex((c) => c.email === email);
      if (idx === -1) {
        adminToast("Customer not found.", "error");
        return;
      }
      const cur = customers[idx];
      const newCredit = Math.round(((cur.creditBalance || 0) + creditAdd) * 100) / 100;
      const newPts = Math.floor((cur.rewardPoints || 0) + pointsAdd);
      customers[idx] = normalizeCustomer({
        ...cur,
        creditBalance: newCredit,
        rewardPoints: newPts,
      });
      saveCustomersArray(customers);
      balanceCreditInput.value = "";
      balancePointsInput.value = "";
      renderDemoTables();
      adminToast(
        `Updated ${customers[idx].name}: +$${creditAdd.toFixed(2)} credit, +${Math.floor(pointsAdd)} points (sample ledger).`,
        "success"
      );
    });
  }

  ensureDemoSeed();
  renderDemoTables();

  render();

  loadBookingsAdmin().catch((e) => {
    console.error("[admin] loadBookingsAdmin", e);
    if (adminBookingsBody) {
      adminBookingsBody.innerHTML =
        '<tr><td colspan="9" class="admin-empty">Could not load bookings.</td></tr>';
    }
  });
})();
