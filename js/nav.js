(function () {
  document.querySelectorAll(".footer-year").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();

(function () {
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.querySelector(".nav-panel");
  if (!toggle || !panel) return;

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.classList.toggle("is-open", open);
  }

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
  });

  panel.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  panel.querySelectorAll(".account-menu__item").forEach(function (el) {
    el.addEventListener("click", function () {
      setOpen(false);
    });
  });
})();
