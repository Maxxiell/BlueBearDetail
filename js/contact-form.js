import { supabase } from "./auth-client.js";
import { isSupabaseConfigured } from "./supabase-config.js";

var FORMSPREE_FALLBACK_ENDPOINT = "https://formspree.io/f/xpqkyyyo";

var form = document.querySelector("form.contact-form");
if (!form) {
  // no-op when not on contact page
} else {
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

    var fd = new FormData(form);
    var payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim().toLowerCase(),
      phone: String(fd.get("phone") || "").trim(),
      message: String(fd.get("message") || "").trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      showErrorToast("Please fill out name, email, and message.");
      return;
    }

    setSubmitting(true);
    try {
      var sent = false;
      if (isSupabaseConfigured()) {
        try {
          var invoked = await supabase.functions.invoke("send-contact-email", {
            body: payload,
          });
          if (!invoked.error) {
            sent = true;
          }
        } catch (_supabaseErr) {
          sent = false;
        }
      }

      if (!sent) {
        var fallbackRes = await fetch(FORMSPREE_FALLBACK_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!fallbackRes.ok) {
          throw new Error("Fallback contact submit failed");
        }
      }

      form.reset();
      showSuccessSplashAndRedirect();
    } catch (err) {
      console.error("[contact-form]", err);
      showErrorToast("Could not send message right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  });
}
