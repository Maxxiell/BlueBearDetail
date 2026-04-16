/**
 * Package "who is this for" dialogs on services.html.
 */
(function () {
  var dialog = document.getElementById("package-info-dialog");
  var titleEl = document.getElementById("package-info-dialog-title");
  var bodyEl = document.getElementById("package-info-dialog-body");
  if (!dialog || !titleEl || !bodyEl) return;

  var sections = {
    essential: {
      title: "Essential — who it’s for",
      body:
        "<p><strong>Best fit</strong> Daily drivers that stay relatively clean—quick exterior refresh and light interior tidy between deeper details.</p>" +
        "<p><strong>Vehicle condition</strong> Works best with light dust, routine dirt, and manageable interiors. Heavy mud, thick pet hair, stains, smoke odor, or long-neglected cabins usually need more time or a higher package.</p>" +
        "<p><strong>Pricing</strong> Package prices are <strong>starting points</strong>. We confirm scope on site; if your vehicle needs extra labor or products, we’ll discuss an updated quote before work begins.</p>",
    },
    complete: {
      title: "Complete — who it’s for",
      body:
        "<p><strong>Best fit</strong> Customers who want a full interior shampoo or steam treatment <strong>and</strong> exterior decontamination and protection in one visit—our most popular all-in-one option.</p>" +
        "<p><strong>Vehicle condition</strong> Great for typical family wear, commuting grime, and seasonal buildup. Severe pet hair, biohazards, flood smells, or paint that needs correction may require a different scope or add-on time.</p>" +
        "<p><strong>Pricing</strong> Listed pricing assumes a standard condition vehicle. After inspection, we may adjust for size, soil level, or special requests—common for mobile detailers across Colorado.</p>",
    },
    signature: {
      title: "Signature — who it’s for",
      body:
        "<p><strong>Best fit</strong> Enthusiasts and owners who want gloss and clarity dialed up—paint enhancement polish and optional ceramic-style protection, with trim and engine-bay finishing as needed.</p>" +
        "<p><strong>Vehicle condition</strong> Paint is assessed in person: heavy swirls, sanding marks, or XXL vehicles change time and materials. We plan protection (including ceramic add-ons) around what we see at inspection.</p>" +
        "<p><strong>Pricing</strong> <strong>Final price</strong> depends on vehicle size, paint defects, and add-ons. We align with typical Denver-area correction and coating workflows—always confirmed after we’ve seen the car.</p>",
    },
  };

  function openFor(key) {
    var s = sections[key];
    if (!s) return;
    titleEl.textContent = s.title;
    bodyEl.innerHTML = s.body;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  document.querySelectorAll("[data-open-package]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openFor(btn.getAttribute("data-open-package"));
    });
  });

  dialog.querySelectorAll("[data-close-package-dialog]").forEach(function (el) {
    el.addEventListener("click", function () {
      dialog.close();
    });
  });

  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });
})();
