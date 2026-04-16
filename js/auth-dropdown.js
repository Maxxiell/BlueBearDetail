import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

const ADMIN_AUTH_KEY = "bbdAdminAuth";
const ADMIN_AUTH_COOKIE = "bbdps_bbdAdminAuth__0";
const AVATAR_STORAGE_KEY = "bbdAccountAvatar";
const DEFAULT_AVATAR_URL = "logos/bearpoly.jpg";
const ADMIN_EMAIL_ALLOWED = "deleteddata@outlook.com";
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
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (_e) {}
        },
      };

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  return m ? m[1] : "";
}

function isAdminAuthenticated() {
  try {
    if (store.getItem(ADMIN_AUTH_KEY) === "1") return true;
  } catch (_e) {
  }
  return readCookie(ADMIN_AUTH_COOKIE) === "1";
}

function clearAdminAuth() {
  store.removeItem(ADMIN_AUTH_KEY);
  document.cookie = "bbdps_bbdAdminAuth__n=; path=/; max-age=0; samesite=lax";
  document.cookie = "bbdps_bbdAdminAuth__0=; path=/; max-age=0; samesite=lax";
}

function normalizedEmail(session) {
  if (!session || !session.user || typeof session.user.email !== "string") return "";
  return session.user.email.trim().toLowerCase();
}

function isAvatarUrl(url) {
  return (
    typeof url === "string" &&
    !!url.trim() &&
    (/^data:image\//i.test(url.trim()) ||
      /^https?:\/\//i.test(url.trim()) ||
      /^[./a-zA-Z0-9_-].*\.(png|jpe?g|webp|gif)$/i.test(url.trim()))
  );
}

function setupMenu(root) {
  const trigger = root.querySelector(".account-menu__trigger");
  const dropdown = root.querySelector(".account-menu__dropdown");
  const dashboardEl = root.querySelector('.account-menu__item[href="account.html"]');
  const loginEl = root.querySelector(".account-menu__item--login");
  const signupEl = root.querySelector(".account-menu__item--signup");
  const logoutEl = root.querySelector(".account-menu__item--logout");
  let settingsEl = root.querySelector('.account-menu__item[href="settings.html"]');
  let adminEl = root.querySelector(".account-menu__item--admin");

  if (!trigger || !dropdown) return;

  const icon = trigger.querySelector(".account-menu__lucide");
  if (!icon) return;

  let wrap = trigger.querySelector(".account-menu__trigger-visual");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.className = "account-menu__trigger-visual";
    trigger.insertBefore(wrap, icon);
    wrap.appendChild(icon);
  } else if (!wrap.contains(icon)) {
    wrap.appendChild(icon);
  }

  let avatarEl = wrap.querySelector(".account-menu__avatar");
  if (!avatarEl) {
    avatarEl = document.createElement("img");
    avatarEl.className = "account-menu__avatar";
    avatarEl.alt = "";
    avatarEl.decoding = "async";
    avatarEl.hidden = true;
    avatarEl.setAttribute("aria-hidden", "true");
    wrap.insertBefore(avatarEl, icon);
  }

  function applyTriggerAvatar(authed) {
    let customUrl = store.getItem(AVATAR_STORAGE_KEY);
    let url = isAvatarUrl(customUrl) ? customUrl.trim() : DEFAULT_AVATAR_URL;
    const hasPhoto =
      !!authed &&
      isAvatarUrl(url);

    if (hasPhoto) {
      avatarEl.src = url.trim();
      avatarEl.hidden = false;
      avatarEl.setAttribute("aria-hidden", "false");
      icon.setAttribute("hidden", "");
      icon.setAttribute("aria-hidden", "true");
    } else {
      avatarEl.removeAttribute("src");
      avatarEl.hidden = true;
      avatarEl.setAttribute("aria-hidden", "true");
      icon.removeAttribute("hidden");
      icon.setAttribute("aria-hidden", "false");
    }
  }

  if (!adminEl) {
    adminEl = document.createElement("a");
    adminEl.href = "admin.html";
    adminEl.role = "menuitem";
    adminEl.className = "account-menu__item account-menu__item--admin";
    adminEl.textContent = "Admin";
    adminEl.hidden = true;
    dropdown.insertBefore(adminEl, logoutEl || null);
  }

  if (!settingsEl) {
    settingsEl = document.createElement("a");
    settingsEl.href = "settings.html";
    settingsEl.role = "menuitem";
    settingsEl.className = "account-menu__item account-menu__item--settings";
    settingsEl.textContent = "Settings";
    settingsEl.hidden = true;
    dropdown.insertBefore(settingsEl, logoutEl || adminEl || null);
  }

  function injectMenuIcon(el) {
    if (!el || el.querySelector(".account-menu__item-icon")) return;
    var labelText = (el.textContent || "").replace(/\s+/g, " ").trim();
    var iconClass = "fa-circle";
    if (el.classList.contains("account-menu__item--admin")) iconClass = "fa-shield-halved";
    else if (el.classList.contains("account-menu__item--login")) iconClass = "fa-right-to-bracket";
    else if (el.classList.contains("account-menu__item--signup")) iconClass = "fa-user-plus";
    else if (el.classList.contains("account-menu__item--logout")) iconClass = "fa-arrow-right-from-bracket";
    else if (el.classList.contains("account-menu__item--settings")) iconClass = "fa-gear";
    else if (el.getAttribute("href") === "account.html") iconClass = "fa-gauge-high";

    el.textContent = "";
    var icon = document.createElement("i");
    icon.className = "fa-solid " + iconClass + " account-menu__item-icon";
    icon.setAttribute("aria-hidden", "true");
    var label = document.createElement("span");
    label.className = "account-menu__item-label";
    label.textContent = labelText;
    el.appendChild(icon);
    el.appendChild(label);
  }

  [loginEl, signupEl, logoutEl, settingsEl, adminEl].forEach(injectMenuIcon);
  injectMenuIcon(dashboardEl);

  function positionDropdown() {
    if (dropdown.hidden || window.matchMedia("(max-width: 767px)").matches) {
      dropdown.style.transform = "";
      return;
    }
    dropdown.style.transform = "";
    const rect = dropdown.getBoundingClientRect();
    const viewportPad = 8;
    let shift = 0;
    if (rect.right > window.innerWidth - viewportPad) {
      shift = (window.innerWidth - viewportPad) - rect.right;
    }
    if (rect.left < viewportPad) {
      shift = viewportPad - rect.left;
    }
    if (shift !== 0) {
      dropdown.style.transform = `translateX(${Math.round(shift)}px)`;
    }
  }

  function setOpen(open) {
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    dropdown.hidden = !open;
    if (open) {
      positionDropdown();
    } else {
      dropdown.style.transform = "";
    }
  }

  function close() {
    setOpen(false);
  }

  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    const open = trigger.getAttribute("aria-expanded") !== "true";
    setOpen(open);
  });

  document.addEventListener("click", function (e) {
    if (!root.contains(e.target)) close();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  window.addEventListener("resize", positionDropdown);

  function syncAuth(session) {
    var configured = isSupabaseConfigured();
    var sessionAuthed = !!(session && session.user);
    var adminAuthed = !configured && isAdminAuthenticated();
    var authed = configured ? sessionAuthed : adminAuthed;
    var email = normalizedEmail(session);
    var canSeeAdmin = configured ? authed && email === ADMIN_EMAIL_ALLOWED : adminAuthed;
    var onLogin = /login\.html$/i.test(window.location.pathname);
    var onSignup = /signup\.html$/i.test(window.location.pathname);
    if (dashboardEl) {
      dashboardEl.hidden = !authed;
      dashboardEl.toggleAttribute("aria-current", /account\.html$/i.test(window.location.pathname));
    }
    if (settingsEl) {
      settingsEl.hidden = !authed;
      settingsEl.toggleAttribute("aria-current", /settings\.html$/i.test(window.location.pathname));
    }
    if (loginEl) loginEl.hidden = authed || onLogin;
    if (signupEl) signupEl.hidden = authed || onSignup;
    if (logoutEl) logoutEl.hidden = !authed;
    if (adminEl) adminEl.hidden = !canSeeAdmin;
    applyTriggerAvatar(authed);
  }

  window.addEventListener("bbd-account-avatar-changed", function () {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(function (res) {
        syncAuth(res.data && res.data.session ? res.data.session : null);
      });
    } else {
      syncAuth(null);
    }
  });

  window.addEventListener("storage", function (e) {
    if (e.key !== AVATAR_STORAGE_KEY) return;
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(function (res) {
        syncAuth(res.data && res.data.session ? res.data.session : null);
      });
    } else {
      syncAuth(null);
    }
  });

  if (logoutEl) {
    logoutEl.addEventListener("click", async function () {
      clearAdminAuth();
      if (isSupabaseConfigured()) {
        try {
          await supabase.auth.signOut();
        } catch (_e) {}
      }
      close();
      window.location.href = "signed-out.html";
    });
  }

  if (isSupabaseConfigured()) {
    supabase.auth.onAuthStateChange(function (_event, session) {
      syncAuth(session);
    });

    supabase.auth.getSession().then(function (_ref) {
      var session = _ref.data.session;
      syncAuth(session);
    });
  } else {
    syncAuth(null);
  }
}

document.querySelectorAll("[data-account-menu]").forEach(setupMenu);

if (typeof lucide !== "undefined" && lucide.createIcons) {
  lucide.createIcons({ attrs: { "stroke-width": 2 } });
}
