(function () {
  var section = document.querySelector(".map-gallery-section");
  if (!section) return;

  var rail = section.querySelector("[data-map-gallery-rail]");
  var prev = section.querySelector(".map-gallery-nav--prev");
  var next = section.querySelector(".map-gallery-nav--next");
  var lightbox = section.querySelector("[data-map-gallery-lightbox]");
  var lightboxImg = section.querySelector("[data-map-gallery-lightbox-img]");
  var lightboxClose = section.querySelector("[data-map-gallery-lightbox-close]");
  if (!rail || !prev || !next) return;
  var isDragging = false;
  var hasDragged = false;
  var dragStartX = 0;
  var dragStartScrollLeft = 0;
  var dragThreshold = 6;
  var velocityX = 0;
  var lastPointerX = 0;
  var lastPointerTime = 0;
  var momentumFrame = null;

  function getStep() {
    var firstCard = rail.querySelector(".map-gallery-card");
    if (!firstCard) return rail.clientWidth * 0.85;
    var styles = window.getComputedStyle(rail);
    var gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
    return firstCard.getBoundingClientRect().width + gap;
  }

  function updateNavState() {
    var maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    prev.disabled = rail.scrollLeft <= 2;
    next.disabled = rail.scrollLeft >= maxScrollLeft - 2;
  }

  function slide(direction) {
    rail.scrollBy({
      left: getStep() * direction,
      behavior: "smooth",
    });
  }

  function cancelMomentum() {
    if (!momentumFrame) return;
    cancelAnimationFrame(momentumFrame);
    momentumFrame = null;
  }

  function startMomentum() {
    if (Math.abs(velocityX) < 0.01) return;
    cancelMomentum();
    var friction = 0.96;
    function tick() {
      rail.scrollLeft -= velocityX * 16;
      velocityX *= friction;
      if (Math.abs(velocityX) > 0.02) {
        momentumFrame = requestAnimationFrame(tick);
        return;
      }
      momentumFrame = null;
    }
    momentumFrame = requestAnimationFrame(tick);
  }

  prev.addEventListener("click", function () {
    slide(-1);
  });

  next.addEventListener("click", function () {
    slide(1);
  });

  rail.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    cancelMomentum();
    isDragging = true;
    hasDragged = false;
    velocityX = 0;
    dragStartX = e.clientX;
    dragStartScrollLeft = rail.scrollLeft;
    lastPointerX = e.clientX;
    lastPointerTime = performance.now();
    rail.classList.add("is-dragging");
    try {
      rail.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  rail.addEventListener("pointermove", function (e) {
    if (!isDragging) return;
    var deltaX = e.clientX - dragStartX;
    if (Math.abs(deltaX) > dragThreshold) {
      hasDragged = true;
    }
    rail.scrollLeft = dragStartScrollLeft - deltaX;
    var now = performance.now();
    var dt = now - lastPointerTime;
    if (dt > 0) {
      velocityX = (e.clientX - lastPointerX) / dt;
    }
    lastPointerX = e.clientX;
    lastPointerTime = now;
  });

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    rail.classList.remove("is-dragging");
    if (!hasDragged) {
      velocityX = 0;
    }
    startMomentum();
  }

  rail.addEventListener("pointerup", endDrag);
  rail.addEventListener("pointercancel", endDrag);
  rail.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse") {
      endDrag();
    }
  });

  rail.addEventListener(
    "click",
    function (e) {
      var card = e.target.closest(".map-gallery-card");
      if (!card) return;
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
        return;
      }
      var img = card.querySelector("img");
      if (!img || !lightbox || !lightboxImg) return;
      e.preventDefault();
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt || "Recent vehicle photo preview";
      if (typeof lightbox.showModal === "function") {
        lightbox.showModal();
      } else {
        lightbox.setAttribute("open", "");
      }
    },
    true
  );

  rail.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });

  if (lightboxClose && lightbox) {
    lightboxClose.addEventListener("click", function () {
      lightbox.close();
    });
  }

  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      var panel = e.target.closest(".map-gallery-lightbox__panel");
      if (!panel) {
        lightbox.close();
      }
    });
  }

  rail.addEventListener("scroll", updateNavState, { passive: true });
  window.addEventListener("resize", updateNavState);

  if (typeof lucide !== "undefined" && lucide && typeof lucide.createIcons === "function") {
    lucide.createIcons({ attrs: { "stroke-width": 2 } });
  }

  updateNavState();
})();
