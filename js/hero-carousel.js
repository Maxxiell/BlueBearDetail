/**
 * Rotates hero background images every 7s (two-layer crossfade).
 * Text theme per slide: 'w' = white headline/eyebrow, 'b' = dark text (.hero__card--dark-text).
 */
(function () {
  var slidesEl = document.querySelector(".hero__slides");
  var card = document.querySelector(".hero__card");
  if (!slidesEl || !card) return;

  var imgs = slidesEl.querySelectorAll(".hero__slide");
  if (imgs.length < 2) return;

  var qs = "?auto=format&fit=crop&w=1920&q=85";
  /** Aligns with urls[] order (lines 15–31): w = white text, b = black text */
  var heroTextTheme = [
    "w",
    "w",
    "w",
    "w",
    "w",
    "w",
    "w",
    "b",
    "w",
    "b",
    "b",
    "w",
    "w",
    "w",
    "w",
    "w",
    "b",
  ];

  var urls = [
    "https://images.unsplash.com/photo-1721264532439-a4f1bb8448f1" + qs,
    "https://images.unsplash.com/photo-1733598479294-10c9e190a099" + qs,
    "https://images.unsplash.com/photo-1697469037615-9eb82d573069" + qs,
    "https://images.unsplash.com/photo-1742226110929-ac57ea90f303" + qs,
    "https://images.unsplash.com/photo-1760309497567-460dd5344e4f" + qs,
    "https://images.unsplash.com/photo-1760688966178-a3745cc0e722" + qs,
    "https://images.unsplash.com/photo-1527581849771-416a9d62308e" + qs,
    "https://images.unsplash.com/photo-1629880434796-fb3c48b1e21d" + qs,
    "https://images.unsplash.com/photo-1762236096071-bf1ccbff48ff" + qs,
    "https://images.unsplash.com/photo-1726042967387-e507ae83e9b9" + qs,
    "https://images.unsplash.com/photo-1705458003730-b3a99dc12e71" + qs,
    "https://images.unsplash.com/photo-1587304878169-505d63fd6b0c" + qs,
    "https://images.unsplash.com/photo-1682428600498-169de440c44c" + qs,
    "https://images.unsplash.com/photo-1515569067071-ec3b51335dd0" + qs,
    "https://images.unsplash.com/photo-1645389415669-efda4b4c1ea4" + qs,
    "https://images.unsplash.com/photo-1628176638611-6ba885391a36" + qs,
    "https://images.unsplash.com/photo-1720593445832-74f2934885de" + qs,
  ];

  function applyHeroTheme(slideIndex) {
    var mode = heroTextTheme[slideIndex] || "w";
    card.classList.toggle("hero__card--dark-text", mode === "b");
  }

  imgs[0].crossOrigin = "anonymous";
  imgs[1].crossOrigin = "anonymous";

  var currentIndex = 0;
  var activeLayer = 0;

  imgs[0].setAttribute("data-loaded-url", urls[0]);
  imgs[0].classList.add("is-active");

  applyHeroTheme(0);

  function goTo(nextIndex) {
    var inactive = 1 - activeLayer;
    var el = imgs[inactive];
    var url = urls[nextIndex];

    function apply() {
      el.classList.add("is-active");
      imgs[activeLayer].classList.remove("is-active");
      activeLayer = inactive;
      currentIndex = nextIndex;
      applyHeroTheme(currentIndex);
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
    return setInterval(function () {
      goNext();
    }, 7000);
  }

  var advanceTimer = startAutoAdvance();

  function restartAutoAdvance() {
    clearInterval(advanceTimer);
    advanceTimer = startAutoAdvance();
  }

  var hits = document.querySelector(".hero__carousel-hits");
  if (hits) {
    var prevBtn = hits.querySelector(".hero__carousel-hit--prev");
    var nextBtn = hits.querySelector(".hero__carousel-hit--next");

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
