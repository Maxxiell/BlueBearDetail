(function () {
  if (typeof window.bbdShowToast !== "function") return;

  var form = document.querySelector("form.contact-form");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    window.bbdShowToast("Connect this form to your email provider or backend when you’re ready.", {
      variant: "info",
    });
  });
})();
