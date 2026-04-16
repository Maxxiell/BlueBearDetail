/**
 * Profile photo: crop/zoom, save to localStorage (bbdAccountAvatar).
 * Mount any block with [data-bbd-account-avatar] (admin dashboard + account dashboard).
 */
(function () {
  const AVATAR_KEY = "bbdAccountAvatar";
  const DEFAULT_AVATAR_URL = "logos/bearpoly.jpg";
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
  const DISPLAY_SIZE = 280;
  const EXPORT_SIZE = 360;
  const JPEG_QUALITY = 0.82;
  const MAX_FILE_MB = 8;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  let cropModalCounter = 0;

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} [variant]
   */
  function toast(message, variant) {
    if (typeof window.bbdShowToast === "function") {
      window.bbdShowToast(message, { variant: variant || "info" });
    }
  }

  function safeRead() {
    return store.getItem(AVATAR_KEY);
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

  function resolveAvatarUrl() {
    const custom = safeRead();
    if (isAvatarUrl(custom)) return custom.trim();
    return DEFAULT_AVATAR_URL;
  }

  function safeWrite(url) {
    try {
      if (url) store.setItem(AVATAR_KEY, url);
      else store.removeItem(AVATAR_KEY);
      window.dispatchEvent(new CustomEvent("bbd-account-avatar-changed"));
      return true;
    } catch (err) {
      toast("Could not save (storage may be full). Try a smaller image.", "error");
      return false;
    }
  }

  /**
   * @param {HTMLElement} root
   */
  function mountAvatarEditor(root) {
    const preview = root.querySelector("[data-bbd-avatar-preview]");
    const placeholder = root.querySelector("[data-bbd-avatar-placeholder]");
    const fileInput = root.querySelector("[data-bbd-avatar-file]");
    const saveBtn = root.querySelector("[data-bbd-avatar-save]");
    const removeBtn = root.querySelector("[data-bbd-avatar-remove]");

    if (!preview || !placeholder || !fileInput || !saveBtn || !removeBtn) return;

    const theme = (root.getAttribute("data-bbd-avatar-theme") || "admin").toLowerCase();
    const isAccount = theme === "account";

    let pendingDataUrl = null;
    /** @type {HTMLImageElement | null} */
    let cropImg = null;
    let panX = 0;
    let panY = 0;
    let zoomFactor = 1;
    /** @type {HTMLCanvasElement | null} */
    let cropCanvas = null;
    /** @type {HTMLDivElement | null} */
    let cropModal = null;
    /** @type {((e: KeyboardEvent) => void) | null} */
    let cropEscHandler = null;
    let dragActive = false;
    let dragLastX = 0;
    let dragLastY = 0;

    function showPreview(url) {
      if (isAvatarUrl(url)) {
        preview.src = String(url).trim();
        preview.hidden = false;
        placeholder.hidden = true;
      } else {
        preview.removeAttribute("src");
        preview.hidden = true;
        placeholder.hidden = false;
      }
    }

    function loadFromStorage() {
      pendingDataUrl = null;
      showPreview(resolveAvatarUrl());
    }

    function clampPan() {
      if (!cropImg) return;
      const S = DISPLAY_SIZE;
      const iw = cropImg.naturalWidth;
      const ih = cropImg.naturalHeight;
      const coverScale = Math.max(S / iw, S / ih);
      const scale = coverScale * zoomFactor;
      const w = iw * scale;
      const h = ih * scale;
      const minPanX = S / 2 - w / 2;
      const maxPanX = w / 2 - S / 2;
      const minPanY = S / 2 - h / 2;
      const maxPanY = h / 2 - S / 2;
      panX = Math.max(minPanX, Math.min(maxPanX, panX));
      panY = Math.max(minPanY, Math.min(maxPanY, panY));
    }

    function drawCropPreview() {
      if (!cropImg || !cropCanvas) return;
      const ctx = cropCanvas.getContext("2d");
      if (!ctx) return;
      const S = DISPLAY_SIZE;
      const iw = cropImg.naturalWidth;
      const ih = cropImg.naturalHeight;
      const coverScale = Math.max(S / iw, S / ih);
      const scale = coverScale * zoomFactor;
      const w = iw * scale;
      const h = ih * scale;
      const x = S / 2 - w / 2 + panX;
      const y = S / 2 - h / 2 + panY;

      ctx.save();
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, S, S);
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cropImg, x, y, w, h);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    function exportCircularJpeg() {
      if (!cropImg) return "";
      const E = EXPORT_SIZE;
      const D = DISPLAY_SIZE;
      const k = E / D;
      const iw = cropImg.naturalWidth;
      const ih = cropImg.naturalHeight;
      const coverE = Math.max(E / iw, E / ih);
      const scale = coverE * zoomFactor;
      const w = iw * scale;
      const h = ih * scale;
      const panXE = panX * k;
      const panYE = panY * k;
      const x = E / 2 - w / 2 + panXE;
      const y = E / 2 - h / 2 + panYE;

      const out = document.createElement("canvas");
      out.width = E;
      out.height = E;
      const octx = out.getContext("2d");
      if (!octx) return "";
      octx.save();
      octx.beginPath();
      octx.arc(E / 2, E / 2, E / 2, 0, Math.PI * 2);
      octx.clip();
      octx.drawImage(cropImg, x, y, w, h);
      octx.restore();
      return out.toDataURL("image/jpeg", JPEG_QUALITY);
    }

    function closeCropModal() {
      if (cropEscHandler) {
        document.removeEventListener("keydown", cropEscHandler);
        cropEscHandler = null;
      }
      if (cropModal && cropModal.parentNode) {
        cropModal.parentNode.removeChild(cropModal);
      }
      cropModal = null;
      cropCanvas = null;
      cropImg = null;
      document.body.style.overflow = "";
    }

    function openCropModal(dataUrl) {
      const uid = "bbd-avatar-crop-" + String(++cropModalCounter);
      const img = new Image();
      img.onload = function () {
        cropImg = img;
        panX = 0;
        panY = 0;
        zoomFactor = 1;
        clampPan();

        cropModal = document.createElement("div");
        cropModal.className = "admin-avatar-crop-modal";
        cropModal.setAttribute("role", "dialog");
        cropModal.setAttribute("aria-modal", "true");
        cropModal.setAttribute("aria-labelledby", uid + "-title");

        const backdrop = document.createElement("div");
        backdrop.className = "admin-avatar-crop-modal__backdrop";
        backdrop.tabIndex = -1;

        const dialog = document.createElement("div");
        dialog.className = "admin-avatar-crop-modal__dialog";

        const title = document.createElement("h3");
        title.id = uid + "-title";
        title.className = "admin-avatar-crop-modal__title";
        title.textContent = "Adjust profile photo";

        const sub = document.createElement("p");
        sub.className = "admin-avatar-crop-modal__sub";
        sub.textContent =
          "Drag to reposition. Use the slider or trackpad to zoom. Preview is circular like your header icon.";

        const stage = document.createElement("div");
        stage.className = "admin-avatar-crop-modal__stage";

        cropCanvas = document.createElement("canvas");
        cropCanvas.width = DISPLAY_SIZE;
        cropCanvas.height = DISPLAY_SIZE;
        cropCanvas.className = "admin-avatar-crop-modal__canvas";
        cropCanvas.setAttribute("aria-label", "Photo crop preview — drag to move");

        stage.appendChild(cropCanvas);

        const zoomRow = document.createElement("div");
        zoomRow.className = "admin-avatar-crop-modal__zoom";

        const zoomRangeId = uid + "-zoom-range";
        const zoomLabel = document.createElement("label");
        zoomLabel.className = "admin-avatar-crop-modal__zoom-label";
        zoomLabel.setAttribute("for", zoomRangeId);
        zoomLabel.textContent = "Zoom";

        const zoomRange = document.createElement("input");
        zoomRange.type = "range";
        zoomRange.id = zoomRangeId;
        zoomRange.className = "admin-avatar-crop-modal__range";
        zoomRange.min = String(ZOOM_MIN * 100);
        zoomRange.max = String(ZOOM_MAX * 100);
        zoomRange.step = "1";
        zoomRange.value = String(zoomFactor * 100);

        zoomRow.appendChild(zoomLabel);
        zoomRow.appendChild(zoomRange);

        const actions = document.createElement("div");
        actions.className = "admin-avatar-crop-modal__actions";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = isAccount ? "btn btn-outline" : "btn btn-admin-ghost";
        cancelBtn.textContent = "Cancel";

        const applyBtn = document.createElement("button");
        applyBtn.type = "button";
        applyBtn.className = isAccount ? "btn btn-primary" : "btn btn-admin-primary";
        applyBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Use this photo';

        actions.appendChild(cancelBtn);
        actions.appendChild(applyBtn);

        dialog.appendChild(title);
        dialog.appendChild(sub);
        dialog.appendChild(stage);
        dialog.appendChild(zoomRow);
        dialog.appendChild(actions);
        cropModal.appendChild(backdrop);
        cropModal.appendChild(dialog);
        document.body.appendChild(cropModal);
        document.body.style.overflow = "hidden";

        function onZoomInput() {
          const v = Number(zoomRange.value) / 100;
          zoomFactor = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));
          clampPan();
          drawCropPreview();
        }

        zoomRange.addEventListener("input", onZoomInput);

        cropCanvas.addEventListener(
          "wheel",
          function (e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -4 : 4;
            const next = Math.max(ZOOM_MIN * 100, Math.min(ZOOM_MAX * 100, Number(zoomRange.value) + delta));
            zoomRange.value = String(next);
            onZoomInput();
          },
          { passive: false }
        );

        cropCanvas.addEventListener("pointerdown", function (e) {
          dragActive = true;
          dragLastX = e.clientX;
          dragLastY = e.clientY;
          try {
            cropCanvas.setPointerCapture(e.pointerId);
          } catch (_err) {}
        });

        cropCanvas.addEventListener("pointermove", function (e) {
          if (!dragActive) return;
          const dx = e.clientX - dragLastX;
          const dy = e.clientY - dragLastY;
          dragLastX = e.clientX;
          dragLastY = e.clientY;
          panX += dx;
          panY += dy;
          clampPan();
          drawCropPreview();
        });

        function endDrag(e) {
          dragActive = false;
          try {
            if (e.pointerId != null) cropCanvas.releasePointerCapture(e.pointerId);
          } catch (_err) {}
        }
        cropCanvas.addEventListener("pointerup", endDrag);
        cropCanvas.addEventListener("pointercancel", endDrag);
        cropCanvas.style.touchAction = "none";

        cancelBtn.addEventListener("click", function () {
          closeCropModal();
        });

        applyBtn.addEventListener("click", function () {
          const jpeg = exportCircularJpeg();
          if (!jpeg) {
            toast("Could not create image.", "error");
            return;
          }
          pendingDataUrl = jpeg;
          showPreview(jpeg);
          closeCropModal();
        });

        backdrop.addEventListener("click", function () {
          closeCropModal();
        });

        cropEscHandler = function (e) {
          if (e.key === "Escape") {
            e.preventDefault();
            closeCropModal();
          }
        };
        document.addEventListener("keydown", cropEscHandler);

        drawCropPreview();
        cancelBtn.focus();
      };
      img.onerror = function () {
        toast("Could not load that image.", "error");
      };
      img.src = dataUrl;
    }

    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast("File is too large (max " + MAX_FILE_MB + " MB).", "error");
        fileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        const raw = reader.result;
        if (typeof raw !== "string") return;
        openCropModal(raw);
      };
      reader.readAsDataURL(file);
      fileInput.value = "";
    });

    saveBtn.addEventListener("click", function () {
      const url = pendingDataUrl != null ? pendingDataUrl : safeRead();
      if (!url || !/^data:image\//i.test(url)) {
        toast("Choose and adjust an image first.", "info");
        return;
      }
      if (safeWrite(url)) {
        pendingDataUrl = null;
        toast("Profile photo saved.", "success");
      }
    });

    removeBtn.addEventListener("click", function () {
      pendingDataUrl = null;
      if (!safeRead()) {
        showPreview(DEFAULT_AVATAR_URL);
        toast("Already using the default photo.", "info");
        return;
      }
      if (safeWrite(null)) {
        showPreview(DEFAULT_AVATAR_URL);
        toast("Custom profile photo removed. Default restored.", "success");
      }
    });

    loadFromStorage();
  }

  document.querySelectorAll("[data-bbd-account-avatar]").forEach(mountAvatarEditor);
})();
