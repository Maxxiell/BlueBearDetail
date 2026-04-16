/**
 * Contact page photo column: two-layer crossfade through Unsplash images.
 * Source photos: unsplash.com (red car in snow, snow/ice, foam wash, blue wash, water droplets).
 */
(function () {
  var root = document.querySelector(".contact-photo-carousel");
  var slidesEl = root ? root.querySelector(".contact-photo-carousel__slides") : null;
  if (!slidesEl) return;

  var imgs = slidesEl.querySelectorAll(".contact-photo-carousel__slide");
  if (imgs.length < 2) return;

  var qs = "?auto=format&fit=crop&w=900&q=85";
  var urls = [
    "https://images.unsplash.com/photo-1711982583856-616ed8e9fb76" + qs,
    "https://images.unsplash.com/photo-1739731481222-1a62f19acc10" + qs,
    "https://images.unsplash.com/photo-1754369400781-9229bddbbd82" + qs,
    "https://images.unsplash.com/photo-1754070909138-7d62886c4f00" + qs,
    "https://images.unsplash.com/photo-1611239179213-d972da54091a" + qs,
  ];

  imgs[0].crossOrigin = "anonymous";
  imgs[1].crossOrigin = "anonymous";

  var currentIndex = 0;
  var activeLayer = 0;

  imgs[0].setAttribute("data-loaded-url", urls[0]);
  imgs[0].classList.add("is-active");

  function goTo(nextIndex) {
    var inactive = 1 - activeLayer;
    var el = imgs[inactive];
    var url = urls[nextIndex];

    function apply() {
      el.classList.add("is-active");
      imgs[activeLayer].classList.remove("is-active");
      activeLayer = inactive;
      currentIndex = nextIndex;
    }

    if (el.getAttribute("data-loaded-url") === url) {
      apply();
      return;
    }

    var finished = false;
    function done() {
      if (finished) return;
      finished = true;
      el.onload = null;
      el.onerror = null;
      el.setAttribute("data-loaded-url", url);
      apply();
    }

    el.crossOrigin = "anonymous";
    el.onload = done;
    el.onerror = function () {
      el.removeAttribute("data-loaded-url");
    };
    el.src = url;
    if (el.complete) {
      done();
    }
  }

  function goNext() {
    goTo((currentIndex + 1) % urls.length);
  }

  function goPrev() {
    goTo((currentIndex - 1 + urls.length) % urls.length);
  }

  function startAutoAdvance() {
    return setInterval(goNext, 6500);
  }

  var advanceTimer = startAutoAdvance();

  function restartAutoAdvance() {
    clearInterval(advanceTimer);
    advanceTimer = startAutoAdvance();
  }

  var hits = root.querySelector(".contact-photo-carousel__hits");
  if (hits) {
    var prevBtn = hits.querySelector(".contact-photo-carousel__hit--prev");
    var nextBtn = hits.querySelector(".contact-photo-carousel__hit--next");

    function onManualNav() {
      restartAutoAdvance();
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goPrev();
        onManualNav();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goNext();
        onManualNav();
      });
    }

    var swipeStartX = 0;
    var swipeStartY = 0;
    var swipeTracking = false;
    var swipeHandled = false;

    hits.addEventListener(
      "pointerdown",
      function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
        swipeTracking = true;
        swipeHandled = false;
        try {
          hits.setPointerCapture(e.pointerId);
        } catch (err) {}
      },
      true
    );

    hits.addEventListener(
      "pointerup",
      function (e) {
        if (!swipeTracking) return;
        swipeTracking = false;
        var dx = e.clientX - swipeStartX;
        var dy = e.clientY - swipeStartY;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        swipeHandled = true;
        if (dx > 0) {
          goPrev();
        } else {
          goNext();
        }
        onManualNav();
      },
      true
    );

    hits.addEventListener(
      "pointercancel",
      function () {
        swipeTracking = false;
      },
      true
    );

    hits.addEventListener(
      "click",
      function (e) {
        if (!swipeHandled) return;
        e.preventDefault();
        e.stopPropagation();
        swipeHandled = false;
      },
      true
    );
  }
})();
