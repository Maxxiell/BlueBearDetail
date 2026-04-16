/**
 * Preview unlock: Ctrl+H opens password (xxyyxx) to reveal gated “coming soon” sections.
 * sessionStorage key — clear tab or use “Show visitor view” in the dialog to lock again.
 */
(function () {
  var STORAGE_KEY = "bbd_feature_preview_unlocked";
  var PASSWORD = "xxyyxx";
  var DIALOG_ID = "bbd-preview-unlock-dialog";

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function syncGateInert() {
    var unlocked = document.body.classList.contains("bbd-preview-unlocked");
    document.querySelectorAll(".bbd-coming-soon-gate__track").forEach(function (el) {
      if (unlocked) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
  }

  function setUnlocked(yes) {
    try {
      if (yes) sessionStorage.setItem(STORAGE_KEY, "1");
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_e) {}
    document.body.classList.toggle("bbd-preview-unlocked", !!yes);
    syncGateInert();
  }

  function ensureDialog() {
    var existing = document.getElementById(DIALOG_ID);
    if (existing) return existing;

    var dlg = document.createElement("dialog");
    dlg.id = DIALOG_ID;
    dlg.className = "bbd-preview-unlock-dialog";
    dlg.setAttribute("aria-labelledby", "bbd-preview-unlock-title");

    dlg.innerHTML =
      '<div class="bbd-preview-unlock-dialog__panel">' +
      '<div class="bbd-preview-unlock-dialog__header">' +
      '<h2 id="bbd-preview-unlock-title" class="bbd-preview-unlock-dialog__title">Preview access</h2>' +
      '<button type="button" class="bbd-preview-unlock-dialog__close" aria-label="Close dialog">&times;</button>' +
      "</div>" +
      '<div class="bbd-preview-unlock-dialog__body">' +
      '<div class="bbd-preview-unlock-dialog__panel-locked" hidden>' +
      '<label class="bbd-preview-unlock-dialog__label" for="bbd-preview-unlock-input">Password</label>' +
      '<input type="password" id="bbd-preview-unlock-input" class="bbd-preview-unlock-dialog__input" autocomplete="off" autocapitalize="off" spellcheck="false" />' +
      '<p class="bbd-preview-unlock-dialog__error" id="bbd-preview-unlock-error" hidden role="alert">Incorrect password.</p>' +
      "</div>" +
      '<div class="bbd-preview-unlock-dialog__panel-unlocked" hidden>' +
      "<p>You’re viewing the full memberships, subscriptions, and gift card content for development or review.</p>" +
      "</div>" +
      "</div>" +
      '<div class="bbd-preview-unlock-dialog__footer">' +
      '<button type="button" class="btn btn-outline" data-action="cancel">Close</button>' +
      '<button type="button" class="btn btn-primary" data-action="submit-locked" hidden>Unlock preview</button>' +
      '<button type="button" class="btn btn-primary" data-action="submit-unlocked" hidden>Show visitor view</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(dlg);

    var input = dlg.querySelector("#bbd-preview-unlock-input");
    var err = dlg.querySelector("#bbd-preview-unlock-error");
    var panelLocked = dlg.querySelector(".bbd-preview-unlock-dialog__panel-locked");
    var panelUnlocked = dlg.querySelector(".bbd-preview-unlock-dialog__panel-unlocked");
    var btnSubmitLocked = dlg.querySelector('[data-action="submit-locked"]');
    var btnSubmitUnlocked = dlg.querySelector('[data-action="submit-unlocked"]');
    var btnClose = dlg.querySelector(".bbd-preview-unlock-dialog__close");
    var btnCancel = dlg.querySelector('[data-action="cancel"]');

    function tryUnlock() {
      var val = (input && input.value) ? String(input.value).trim() : "";
      if (val === PASSWORD) {
        if (err) err.hidden = true;
        setUnlocked(true);
        if (input) input.value = "";
        dlg.close();
      } else {
        if (err) err.hidden = false;
        if (input) {
          input.focus();
          input.select();
        }
      }
    }

    function lockVisitor() {
      setUnlocked(false);
      dlg.close();
    }

    btnSubmitLocked.addEventListener("click", tryUnlock);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          tryUnlock();
        }
      });
    }

    btnSubmitUnlocked.addEventListener("click", lockVisitor);

    function closeDialog() {
      if (err) err.hidden = true;
      if (input) input.value = "";
      dlg.close();
    }

    btnClose.addEventListener("click", closeDialog);
    btnCancel.addEventListener("click", closeDialog);

    dlg.addEventListener("close", function () {
      if (err) err.hidden = true;
    });

    dlg.updateMode = function () {
      var unlocked = isUnlocked();
      panelLocked.hidden = unlocked;
      panelUnlocked.hidden = !unlocked;
      btnSubmitLocked.hidden = unlocked;
      btnSubmitUnlocked.hidden = !unlocked;
      btnCancel.textContent = "Close";
      dlg.querySelector("#bbd-preview-unlock-title").textContent = unlocked ? "Preview mode" : "Preview access";
    };

    return dlg;
  }

  function openDialog() {
    var dlg = ensureDialog();
    dlg.updateMode();
    requestAnimationFrame(function () {
      dlg.showModal();
      if (!isUnlocked()) {
        var input = document.getElementById("bbd-preview-unlock-input");
        if (input) input.focus();
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.key !== "h" && e.key !== "H") return;
    e.preventDefault();
    openDialog();
  });

  setUnlocked(isUnlocked());
})();
