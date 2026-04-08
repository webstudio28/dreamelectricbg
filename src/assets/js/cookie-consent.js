(function () {
  var COOKIE_NAME = "dreamelectric_cookie_consent_v1";
  var SIX_MONTHS_SECONDS = 60 * 60 * 24 * 183;

  function isSecureContext() {
    return window.location && window.location.protocol === "https:";
  }

  function getCookie(name) {
    var all = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < all.length; i++) {
      var part = all[i].trim();
      if (!part) continue;
      if (part.indexOf(name + "=") === 0) return decodeURIComponent(part.slice(name.length + 1));
    }
    return null;
  }

  function setCookie(name, value, maxAgeSeconds) {
    var cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=" + maxAgeSeconds + "; Path=/; SameSite=Lax";
    if (isSecureContext()) cookie += "; Secure";
    document.cookie = cookie;
  }

  function deleteCookie(name) {
    setCookie(name, "", 0);
  }

  function parseConsent(raw) {
    if (!raw) return null;
    // Expected: "analytics=granted" or "analytics=denied"
    var parts = raw.split("=");
    if (parts.length !== 2) return null;
    if (parts[0] !== "analytics") return null;
    if (parts[1] !== "granted" && parts[1] !== "denied") return null;
    return { analytics: parts[1] };
  }

  function serializeConsent(consent) {
    var val = consent && consent.analytics;
    if (val !== "granted" && val !== "denied") return null;
    return "analytics=" + val;
  }

  var listeners = [];
  var state = parseConsent(getCookie(COOKIE_NAME));

  function notify() {
    if (!state) return;
    window.dispatchEvent(new CustomEvent("cookieconsent:change", { detail: { analytics: state.analytics } }));
    if (state.analytics === "granted") {
      window.dispatchEvent(new CustomEvent("cookieconsent:analytics-granted"));
    } else {
      window.dispatchEvent(new CustomEvent("cookieconsent:analytics-denied"));
    }
    listeners.forEach(function (fn) {
      try {
        fn({ analytics: state.analytics });
      } catch (e) {}
    });
  }

  function showBanner() {
    var el = document.getElementById("cookie-banner");
    if (!el) return;
    el.removeAttribute("hidden");
    el.classList.remove("opacity-0", "pointer-events-none");
    el.classList.add("opacity-100");
  }

  function hideBanner() {
    var el = document.getElementById("cookie-banner");
    if (!el) return;
    el.setAttribute("hidden", "");
    el.classList.add("opacity-0", "pointer-events-none");
    el.classList.remove("opacity-100");
  }

  function setConsent(next) {
    var raw = serializeConsent(next);
    if (!raw) return;
    setCookie(COOKIE_NAME, raw, SIX_MONTHS_SECONDS);
    state = parseConsent(raw);
    hideBanner();
    notify();
  }

  function reset() {
    deleteCookie(COOKIE_NAME);
    state = null;
    showBanner();
    window.dispatchEvent(new CustomEvent("cookieconsent:reset"));
  }

  function syncPreferencesUI() {
    var analyticsToggle = document.getElementById("cookie-toggle-analytics");
    if (!analyticsToggle) return;
    var current = state ? state.analytics : null;
    // Default to enabled until user saves a preference.
    analyticsToggle.checked = current ? current === "granted" : true;
  }

  function closePreferencesModalIfOpen() {
    var modal = document.getElementById("modal-cookie-preferences");
    if (!modal || modal.hasAttribute("hidden")) return;
    var closeBtn = modal.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.click();
  }

  function initUI() {
    var acceptBtn = document.getElementById("cookie-accept-analytics");
    var savePrefsBtn = document.getElementById("cookie-preferences-save");
    var analyticsToggle = document.getElementById("cookie-toggle-analytics");

    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        setConsent({ analytics: "granted" });
      });
    }

    if (savePrefsBtn) {
      savePrefsBtn.addEventListener("click", function () {
        var granted = analyticsToggle && analyticsToggle.checked;
        setConsent({ analytics: granted ? "granted" : "denied" });
        closePreferencesModalIfOpen();
      });
    }

    syncPreferencesUI();

    // When preferences modal is opened, sync toggles to current value.
    document.addEventListener("click", function (e) {
      var opener = e.target.closest('[data-modal-open][href="#modal-cookie-preferences"],[data-modal-open][data-modal-open="modal-cookie-preferences"],[data-modal-open][data-modal-open="#modal-cookie-preferences"]');
      if (opener) {
        // Hide the banner when user enters preferences.
        hideBanner();
        // Wait a tick for modal to be visible and focus changes to settle.
        window.setTimeout(syncPreferencesUI, 0);
        return;
      }

      var policyOpener = e.target.closest('[data-modal-open][href="#modal-privacy-policy"],[data-modal-open][data-modal-open="modal-privacy-policy"],[data-modal-open][data-modal-open="#modal-privacy-policy"]');
      if (policyOpener) {
        // Hide the banner when user opens privacy policy.
        hideBanner();
      }
    });

    if (!state) showBanner();
    else {
      hideBanner();
      notify();
    }
  }

  window.CookieConsent = {
    get: function () {
      return state ? { analytics: state.analytics } : null;
    },
    set: function (consent) {
      setConsent(consent);
    },
    open: function () {
      openSettings();
    },
    reset: function () {
      reset();
    },
    onChange: function (fn) {
      if (typeof fn !== "function") return function () {};
      listeners.push(fn);
      return function unsubscribe() {
        listeners = listeners.filter(function (x) { return x !== fn; });
      };
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
