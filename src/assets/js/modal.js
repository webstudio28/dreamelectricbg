(function () {
  var lockCount = 0;
  var prev = null;

  function lockScroll() {
    lockCount += 1;
    if (lockCount > 1) return;

    var docEl = document.documentElement;
    var body = document.body;
    var scrollbarWidth = window.innerWidth - docEl.clientWidth;

    prev = {
      htmlOverflow: docEl.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      bodyClass: body.className,
    };

    // Lock both html + body to avoid mobile/browser inconsistencies.
    docEl.style.overflow = "hidden";
    body.style.overflow = "hidden";

    // Prevent layout change when scrollbar disappears (desktop/responsive emulation).
    if (scrollbarWidth > 0) {
      body.style.paddingRight = scrollbarWidth + "px";
    }

    body.classList.add("modal-open");
  }

  function unlockScroll() {
    if (lockCount === 0) return;
    lockCount -= 1;
    if (lockCount > 0) return;

    var docEl = document.documentElement;
    var body = document.body;
    if (prev) {
      docEl.style.overflow = prev.htmlOverflow || "";
      body.style.overflow = prev.bodyOverflow || "";
      body.style.paddingRight = prev.bodyPaddingRight || "";
      // Only remove our class; keep any other classes intact.
      body.classList.remove("modal-open");
    } else {
      docEl.style.overflow = "";
      body.style.overflow = "";
      body.style.paddingRight = "";
      body.classList.remove("modal-open");
    }
    prev = null;
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.removeAttribute("hidden");
    el.classList.remove("opacity-0", "pointer-events-none");
    el.classList.add("opacity-100");
    lockScroll();
    var focusable = el.querySelectorAll('button, [href], input, select, textarea');
    var first = focusable[0];
    if (first) first.focus();
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("hidden", "");
    el.classList.add("opacity-0", "pointer-events-none");
    el.classList.remove("opacity-100");
    unlockScroll();
    el.setAttribute("aria-hidden", "true");
  }

  function handleClose(e) {
    var id = e.target.closest("[aria-modal=true]");
    if (!id) return;
    closeModal(id.id);
  }

  document.addEventListener("click", function (e) {
    var seeMore = e.target.closest(".service-see-more");
    if (seeMore) {
      e.preventDefault();
      var card = seeMore.closest(".service-card");
      if (!card) return;
      var titleEl = card.querySelector("h3");
      var bodyEl = card.querySelector(".service-full-description");
      var title = titleEl ? titleEl.textContent.trim() : "Service";
      var body = bodyEl ? bodyEl.textContent.trim() : "";
      var modalTitle = document.getElementById("modal-service-detail-title");
      var modalBody = document.getElementById("modal-service-detail-body");
      if (modalTitle) modalTitle.textContent = title;
      if (modalBody) modalBody.textContent = body;
      openModal("modal-service-detail");
      return;
    }
    var opener = e.target.closest("[data-modal-open]");
    if (opener) {
      e.preventDefault();
      var id = opener.getAttribute("data-modal-open") || opener.getAttribute("href");
      if (id && id.startsWith("#")) id = id.slice(1);
      if (id) openModal(id);
      return;
    }
    var closer = e.target.closest("[data-modal-close]");
    if (closer) {
      e.preventDefault();
      var modal = closer.closest("[aria-modal=true]");
      if (modal) closeModal(modal.id);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector("[aria-modal=true]:not([hidden])");
    if (open) closeModal(open.id);
  });
})();
