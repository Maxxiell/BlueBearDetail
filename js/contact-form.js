(function () {
  var form = document.querySelector("form.contact-form");
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');
  var splash = document.getElementById("contact-success-splash");

  function setSubmitting(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = !!isLoading;
    submitBtn.textContent = isLoading ? "Sending..." : "Send";
  }

  function showErrorToast(message) {
    if (typeof window.bbdShowToast === "function") {
      window.bbdShowToast(message, { variant: "error" });
    }
  }

  function showSuccessSplashAndRedirect() {
    if (!splash) {
      window.location.href = "index.html";
      return;
    }
    splash.hidden = false;
    document.body.classList.add("contact-success-active");
    if (typeof lucide !== "undefined" && lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons({ attrs: { "stroke-width": 2.25 } });
    }
    setTimeout(function () {
      window.location.href = "index.html";
    }, 2200);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var endpoint = form.getAttribute("action") || "https://formspree.io/f/xpqkyyyo";
    var fd = new FormData(form);
    var name = String(fd.get("name") || "").trim();
    var email = String(fd.get("email") || "").trim();
    var message = String(fd.get("message") || "").trim();
    var captchaToken = String(fd.get("g-recaptcha-response") || "").trim();
    if (!name || !email || !message) {
      showErrorToast("Please fill out name, email, and message.");
      return;
    }
    if (!captchaToken) {
      showErrorToast("Please complete the reCAPTCHA checkbox.");
      return;
    }

    setSubmitting(true);
    try {
      var res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (!res.ok) {
        throw new Error("Contact submit failed");
      }
      form.reset();
      if (typeof grecaptcha !== "undefined" && grecaptcha && typeof grecaptcha.reset === "function") {
        grecaptcha.reset();
      }
      showSuccessSplashAndRedirect();
    } catch (err) {
      console.error("[contact-form]", err);
      if (typeof grecaptcha !== "undefined" && grecaptcha && typeof grecaptcha.reset === "function") {
        grecaptcha.reset();
      }
      showErrorToast("Could not send message right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });
})();
