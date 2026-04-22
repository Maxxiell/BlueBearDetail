(function () {
  var form = document.querySelector("form.contact-form");
  if (!form) return;
  var submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var endpoint = form.getAttribute("action");
    if (!endpoint) return;
    if (submitBtn) submitBtn.disabled = true;
    try {
      var res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new FormData(form),
      });
      if (!res.ok) {
        throw new Error("Form submit failed");
      }
      form.reset();
      if (typeof window.bbdShowToast === "function") {
        window.bbdShowToast("Message sent. We’ll get back to you soon.", {
          variant: "success",
        });
      }
    } catch (_e) {
      if (typeof window.bbdShowToast === "function") {
        window.bbdShowToast("Could not send message right now. Please try again.", {
          variant: "error",
        });
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
