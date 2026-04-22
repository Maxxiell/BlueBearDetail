(function () {
  var cards = document.querySelectorAll("[data-flip-card]");
  if (!cards.length) return;

  cards.forEach(function (card) {
    card.addEventListener("click", function (e) {
      var target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a, button")) return;
      card.classList.toggle("is-flipped");
    });

    card.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      card.classList.toggle("is-flipped");
    });

    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Flip service card for details");
  });
})();
