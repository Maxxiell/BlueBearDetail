(function () {
  var SITE_SETTINGS_KEY = "bbdSiteSettings";
  var STORE_NAME = "bbdPersistentStore";
  var FALLBACK_BASE_PRICES = { essential: 119.99, complete: 249.99, signature: 339.99 };
  var FALLBACK_PACKAGE_BULLETS = {
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

  var CARD_PROMO_LABEL = "With Promo";

  function createPersistentStore() {
    var COOKIE_PREFIX = "bbdps_";
    var CHUNK_SIZE = 3500;
    var MAX_AGE = 60 * 60 * 24 * 365;
    var MAX_COOKIE_ENCODED_LENGTH = 6000;
    var COOKIE_MIRROR_KEYS = {
      bbdSiteSettings: true,
      bbdAdminBlockedSchedule: true,
      bbdAdminAuth: true,
    };

    function safeStorageGet(key) {
      try {
        return localStorage.getItem(key);
      } catch (_e) {
        return null;
      }
    }

    function safeStorageSet(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_e) {}
    }

    function safeStorageRemove(key) {
      try {
        localStorage.removeItem(key);
      } catch (_e) {}
    }

    function cookieBase(key) {
      return COOKIE_PREFIX + String(key).replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function shouldMirrorToCookie(key) {
      return !!COOKIE_MIRROR_KEYS[String(key)];
    }

    function setCookie(name, value, maxAge) {
      document.cookie =
        name +
        "=" +
        value +
        "; path=/; max-age=" +
        String(maxAge == null ? MAX_AGE : maxAge) +
        "; samesite=lax";
    }

    function readCookie(name) {
      var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
      return m ? m[1] : "";
    }

    function clearCookieChunks(base) {
      var n = parseInt(readCookie(base + "__n"), 10);
      var max = Number.isFinite(n) && n > 0 ? n : 80;
      setCookie(base + "__n", "", 0);
      for (var i = 0; i < max; i += 1) setCookie(base + "__" + i, "", 0);
    }

    function writeCookieLarge(key, raw) {
      var base = cookieBase(key);
      clearCookieChunks(base);
      var encoded = encodeURIComponent(String(raw));
      if (encoded.length > MAX_COOKIE_ENCODED_LENGTH) return;
      var total = Math.max(1, Math.ceil(encoded.length / CHUNK_SIZE));
      setCookie(base + "__n", String(total), MAX_AGE);
      for (var i = 0; i < total; i += 1) {
        var part = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        setCookie(base + "__" + i, part, MAX_AGE);
      }
    }

    function readCookieLarge(key) {
      if (!shouldMirrorToCookie(key)) return null;
      var base = cookieBase(key);
      var n = parseInt(readCookie(base + "__n"), 10);
      if (!Number.isFinite(n) || n <= 0) return null;
      var merged = "";
      for (var i = 0; i < n; i += 1) {
        var chunk = readCookie(base + "__" + i);
        if (!chunk) return null;
        merged += chunk;
      }
      try {
        return decodeURIComponent(merged);
      } catch (_e) {
        return null;
      }
    }

    function cleanupLegacyCookieMirror() {
      var allowedBases = Object.keys(COOKIE_MIRROR_KEYS).map(function (key) {
        return cookieBase(key);
      });
      document.cookie.split(";").forEach(function (part) {
        var raw = part.trim();
        if (!raw) return;
        var eq = raw.indexOf("=");
        var name = eq === -1 ? raw : raw.slice(0, eq);
        if (name.indexOf(COOKIE_PREFIX) !== 0) return;
        var keep = allowedBases.some(function (base) {
          return name.indexOf(base + "__") === 0;
        });
        if (!keep) setCookie(name, "", 0);
      });
    }

    cleanupLegacyCookieMirror();

    return {
      getItem: function (key) {
        var local = safeStorageGet(key);
        if (local != null) {
          if (shouldMirrorToCookie(key)) writeCookieLarge(key, local);
          else clearCookieChunks(cookieBase(key));
          return local;
        }
        var cookie = readCookieLarge(key);
        if (cookie != null) safeStorageSet(key, cookie);
        return cookie;
      },
      setItem: function (key, value) {
        var text = String(value);
        safeStorageSet(key, text);
        if (shouldMirrorToCookie(key)) writeCookieLarge(key, text);
        else clearCookieChunks(cookieBase(key));
      },
      removeItem: function (key) {
        safeStorageRemove(key);
        clearCookieChunks(cookieBase(key));
      },
    };
  }

  var store = window[STORE_NAME];
  if (!store || typeof store.getItem !== "function" || typeof store.setItem !== "function") {
    store = createPersistentStore();
    window[STORE_NAME] = store;
  }

  function readSettings() {
    try {
      var raw = store.getItem(SITE_SETTINGS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function money(value) {
    var n = Number(value);
    if (Number.isNaN(n)) return "$0.00";
    return "$" + n.toFixed(2);
  }

  /**
   * Merge legacy indexOffer into virtual page edit keys when pageEdits omits them.
   */
  function mergedPageEdits(settings) {
    var edits = Object.assign({}, settings.pageEdits || {});
    var offer = settings.indexOffer || {};
    if (!edits["index.offerHeading"] && typeof offer.heading === "string" && offer.heading.trim()) {
      edits["index.offerHeading"] = offer.heading.trim();
    }
    if (!edits["index.offerCopy"] && typeof offer.copy === "string" && offer.copy.trim()) {
      edits["index.offerCopy"] = offer.copy.trim();
    }
    return edits;
  }

  function applyPageEdits(settings) {
    var edits = mergedPageEdits(settings);
    document.querySelectorAll("[data-bbd]").forEach(function (el) {
      var key = el.getAttribute("data-bbd");
      if (!key || edits[key] == null) return;
      var val = String(edits[key]).trim();
      if (val === "") return;
      el.textContent = val;
    });
  }

  function applyPackageBullets(settings) {
    if (!/services\.html$/i.test(window.location.pathname)) return;
    var pb = settings.packageBullets && typeof settings.packageBullets === "object" ? settings.packageBullets : {};
    ["essential", "complete", "signature"].forEach(function (key) {
      var ul = document.querySelector('ul[data-package-bullets="' + key + '"]');
      if (!ul) return;
      var lines =
        Array.isArray(pb[key]) && pb[key].length > 0 ? pb[key] : FALLBACK_PACKAGE_BULLETS[key];
      if (!lines || !lines.length) return;
      ul.innerHTML = "";
      lines.forEach(function (line) {
        var t = String(line).trim();
        if (!t) return;
        var li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      });
    });
  }

  function applyServices(settings) {
    if (!/services\.html$/i.test(window.location.pathname)) return;

    var pricing = settings.pricing || {};
    var promo = settings.promo || {};
    var promoOn = promo.enabled !== false;

    var discount = Number(promo.discountPct);
    if (Number.isNaN(discount)) discount = 15;
    discount = Math.max(0, Math.min(100, discount));

    var promoText =
      typeof promo.text === "string" && promo.text.trim() ? promo.text.trim() : "15% FOR NEW CUSTOMERS";
    var fullMarquee = promoText;

    var main = document.querySelector("main.page-services");
    if (main) {
      main.classList.toggle("page-services--promo-on", promoOn);
      main.classList.toggle("page-services--promo-off", !promoOn);
    }

    var marqueeWrap = document.querySelector("[data-promo-marquee-wrap]");
    if (marqueeWrap) marqueeWrap.hidden = !promoOn;

    document.querySelectorAll(".promo-marquee__track span").forEach(function (el) {
      el.textContent = fullMarquee;
    });

    var serviceKeys = ["essential", "complete", "signature"];
    serviceKeys.forEach(function (key) {
      var priceWrap = document.querySelector('[data-service-price="' + key + '"]');
      if (!priceWrap) return;
      var oldEl = priceWrap.querySelector(".package-card__price-old");
      var newEl = priceWrap.querySelector(".package-card__price-num");
      var lineEl = document.querySelector('[data-service-promo-line="' + key + '"]');
      var lineTextEl = lineEl ? lineEl.querySelector(".package-card__promo-note__text") : null;

      var base = Number(pricing[key]);
      if (Number.isNaN(base) || base <= 0) base = FALLBACK_BASE_PRICES[key] || 0;

      var discounted = base * (1 - discount / 100);

      if (promoOn) {
        if (oldEl) {
          oldEl.hidden = false;
          oldEl.textContent = money(base);
        }
        if (newEl) newEl.textContent = money(discounted);
        if (lineEl && lineTextEl) {
          lineTextEl.textContent = CARD_PROMO_LABEL;
          lineEl.hidden = false;
        }
      } else {
        if (oldEl) oldEl.hidden = true;
        if (newEl) newEl.textContent = money(base);
        if (lineEl) lineEl.hidden = true;
      }
    });
  }

  function apply() {
    var settings = readSettings();
    applyPageEdits(settings);
    applyPackageBullets(settings);
    applyServices(settings);
  }

  window.bbdMergeRemoteSiteSettings = function (remote) {
    if (!remote || typeof remote !== "object") return;
    var cur = readSettings();
    var merged = Object.assign({}, cur, remote);
    store.setItem(SITE_SETTINGS_KEY, JSON.stringify(merged));
    apply();
  };

  window.addEventListener("storage", function (e) {
    if (e.key !== SITE_SETTINGS_KEY) return;
    if (e.newValue == null) return;
    apply();
  });

  apply();
})();
