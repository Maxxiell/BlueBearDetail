/**
 * Non-blocking toast stack (top-right). window.bbdShowToast(message, { variant, duration }).
 */
(function () {
  var CONTAINER_ID = "bbd-toast-stack";
  var DEFAULT_MS = 4200;

  function ensureStack() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = CONTAINER_ID;
      el.className = "bbd-toast-stack";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-relevant", "additions");
      document.body.appendChild(el);
    }
    return el;
  }

  /**
   * @param {string} message
   * @param {{ variant?: 'success'|'error'|'info', duration?: number }} [opts]
   */
  function show(message, opts) {
    if (typeof message !== "string" || !message) return;

    opts = opts || {};
    var variant = opts.variant === "success" || opts.variant === "error" ? opts.variant : "info";
    var duration =
      typeof opts.duration === "number" && opts.duration >= 0 ? opts.duration : DEFAULT_MS;

    var stack = ensureStack();
    var toast = document.createElement("div");
    toast.className = "bbd-toast bbd-toast--" + variant;
    toast.setAttribute("role", "status");
    toast.textContent = message;
    stack.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("bbd-toast--show");
    });

    window.setTimeout(function () {
      toast.classList.remove("bbd-toast--show");
      toast.classList.add("bbd-toast--leave");
      window.setTimeout(function () {
        toast.remove();
        if (stack.childElementCount === 0) {
          stack.remove();
        }
      }, 280);
    }, duration);
  }

  window.bbdShowToast = show;
})();
