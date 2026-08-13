/* ==================================================================
   MARTIN GROW — main.js
   Vanilla replacements for the former React interactivity:
   header scroll state, mobile menu, FAQ accordion, reveal-on-scroll.
   ================================================================== */
(function () {
  "use strict";

  /* ------------------- Header theme (dark over hero) -------------- */
  var header = document.getElementById("site-header");
  var hero = document.getElementById("top");

  function updateHeader() {
    if (!header) return;
    // Nav stays identical (logo + background) at every scroll position.
    header.setAttribute("data-nav-theme", "dark");
  }

  if (header) {
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader);
    // The hero's height can shift once the background image loads.
    window.addEventListener("load", updateHeader);
  }

  /* ------------------------- Hero slideshow ----------------------- */
  // Cinematic crossfade between the hero background photos. Opacity-only
  // (GPU-friendly). The incoming image fades in on top of the current one,
  // which is only hidden after the fade completes — so there is never a
  // dip to the base colour and never a hard cut.
  (function heroSlideshow() {
    var slides = Array.prototype.slice.call(
      document.querySelectorAll(".hero__slide")
    );
    if (slides.length < 2) return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // hold the first frame
    }

    var FADE_MS = 2600; // matches the CSS opacity transition
    var HOLD_MS = 10000; // ~7.4s fully visible, then a 2.6s crossfade
    var current = 0;

    window.setInterval(function () {
      var incoming = (current + 1) % slides.length;
      var outgoing = current;
      // Bring the incoming image to the top and fade it in.
      slides[incoming].style.zIndex = "2";
      slides[incoming].classList.add("is-active");
      // Once it is fully opaque, hide the previous one beneath it.
      window.setTimeout(function () {
        slides[outgoing].classList.remove("is-active");
        slides[outgoing].style.zIndex = "0";
        slides[incoming].style.zIndex = "1";
      }, FADE_MS + 120);
      current = incoming;
    }, HOLD_MS);
  })();

  /* --------------------- Hero scroll-out (Scene 01 → 02) ---------- */
  // As the visitor begins scrolling, the hero content gently fades and lifts
  // so the hero gracefully gives space to the next scene. Subtle, GPU-only.
  (function heroScrollOut() {
    var heroEl = document.getElementById("top");
    if (!heroEl) return;
    var content = heroEl.querySelector(".hero__content");
    var cue = heroEl.querySelector(".hero__scroll");
    if (!content) return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // hold still for reduced-motion
    }
    var ticking = false;
    var apply = function () {
      ticking = false;
      var h = heroEl.offsetHeight || window.innerHeight;
      var p = Math.min(1, Math.max(0, window.scrollY / (h * 0.72)));
      content.style.opacity = String(1 - p);
      content.style.transform = "translate3d(0," + (-p * 42).toFixed(2) + "px,0)";
      if (cue) cue.style.opacity = String(Math.max(0, 1 - p * 2.4));
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(apply);
        }
      },
      { passive: true }
    );
    apply();
  })();

  /* ----------------------------- Accordion ------------------------ */
  var triggers = document.querySelectorAll(".accordion__trigger");
  triggers.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var panelId = btn.getAttribute("aria-controls");
      var panel = document.getElementById(panelId);
      if (!panel) return;
      var isOpen = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      panel.hidden = isOpen;
    });
  });

  /* -------------------------- Reveal on scroll -------------------- */
  // Scroll-geometry based (not IntersectionObserver) so reveals are
  // reliable everywhere a static file is opened, and never leave content
  // stuck invisible. Each element reveals once when it enters the viewport.
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll(".reveal")
  );
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function revealAll() {
    revealEls.forEach(function (el) {
      el.setAttribute("data-visible", "true");
    });
    revealEls = [];
  }

  if (reduceMotion) {
    revealAll();
  } else {
    var ticking = false;
    var checkReveals = function () {
      ticking = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      for (var i = revealEls.length - 1; i >= 0; i--) {
        var el = revealEls[i];
        var r = el.getBoundingClientRect();
        // Reveal a touch before fully in view (mirrors the old -8% margin).
        if (r.top < vh * 0.92 && r.bottom > 0) {
          el.setAttribute("data-visible", "true");
          revealEls.splice(i, 1);
        }
      }
    };
    var onScroll = function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(checkReveals);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", checkReveals);
    // Failsafe: never let content remain hidden.
    window.setTimeout(function () {
      if (revealEls.length) checkReveals();
    }, 1200);
    checkReveals(); // initial in-view pass
  }

})();

/* ================================================================== */
/*  Booking modal — calendar → time → contact, then a premium         */
/*  confirmation with an optional 3-question micro-discovery step.    */
/*  No backend: confirming quietly opens a pre-filled email.          */
/* ================================================================== */
(function bookingModal() {
  "use strict";

  var modal = document.getElementById("booking-modal");
  if (!modal) return;

  var dialog = modal.querySelector(".booking-modal__dialog");
  var panels = Array.prototype.slice.call(modal.querySelectorAll("[data-step]"));

  var BOOK_EMAIL = "hello@martingrow.com";
  var DURATION_MIN = 30;
  var MAX_MONTHS_AHEAD = 3;
  var SLOTS = [
    { label: "9:00 AM" },
    { label: "10:00 AM" },
    { label: "11:00 AM" },
    { label: "1:00 PM" },
    { label: "2:00 PM" },
    { label: "3:00 PM" },
    { label: "4:00 PM" },
  ];
  var MONTHS = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  var WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
  var WEEKDAYS_LONG = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
  ];

  var calMonth = modal.querySelector("[data-cal-month]");
  var calGrid = modal.querySelector("[data-cal-grid]");
  var calWeekdays = modal.querySelector("[data-cal-weekdays]");
  var calPrev = modal.querySelector("[data-cal-prev]");
  var calNext = modal.querySelector("[data-cal-next]");
  var slotsEl = modal.querySelector("[data-slots]");
  var selectedDateLabel = modal.querySelector("[data-selected-date]");
  var nameInput = modal.querySelector("#booking-name");
  var phoneInput = modal.querySelector("#booking-phone");
  var contactError = modal.querySelector("[data-contact-error]");
  var confirmBtn = modal.querySelector("[data-confirm]");
  var prepareBtn = modal.querySelector("[data-prepare]");
  var discoverySendBtn = modal.querySelector("[data-discovery-send]");

  var now = new Date();
  var curY = now.getFullYear();
  var curM = now.getMonth();
  var today0 = new Date(curY, curM, now.getDate());

  var state = { viewY: curY, viewM: curM, date: null, slot: null, name: "", phone: "" };
  var lastTrigger = null;

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function fmtLong(d) {
    return WEEKDAYS_LONG[d.getDay()] + " " + d.getDate() + " de " + MONTHS[d.getMonth()];
  }

  /* ------------------------------ open/close --------------------- */
  function openModal(trigger) {
    lastTrigger = trigger || null;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    resetFlow();
    showPanel("date");
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  function resetFlow() {
    state = { viewY: curY, viewM: curM, date: null, slot: null, name: "", phone: "" };
    if (nameInput) nameInput.value = "";
    if (phoneInput) phoneInput.value = "";
    if (contactError) {
      contactError.hidden = true;
      contactError.textContent = "";
    }
    renderCal();
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest('a[href="#book"], [data-booking-open]');
    if (trigger) {
      e.preventDefault();
      openModal(trigger);
      return;
    }
    if (e.target.closest("[data-booking-close]")) {
      e.preventDefault();
      closeModal();
    }
  });

  window.addEventListener("keydown", function (e) {
    if (modal.hidden) return;
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  /* -------------------------------- panels ------------------------ */
  function showPanel(key) {
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-step") === key);
    });
    var active = modal.querySelector('[data-step="' + key + '"]');
    if (!active) return;
    // Prefer the day cell / slot / field over the calendar's own prev-month
    // chevron, which would otherwise win as the first <button> in the DOM.
    var focusable =
      active.querySelector("input, textarea") ||
      active.querySelector(".sched__day:not([disabled])") ||
      active.querySelector(".sched__slot") ||
      active.querySelector("button:not(.sched__nav)");
    if (focusable) window.setTimeout(function () { focusable.focus(); }, 80);
  }

  Array.prototype.forEach.call(modal.querySelectorAll("[data-step-back]"), function (btn) {
    btn.addEventListener("click", function () {
      showPanel(btn.getAttribute("data-step-back"));
    });
  });

  /* ------------------------------ calendar ------------------------ */
  function monthsFromCur() {
    return (state.viewY - curY) * 12 + (state.viewM - curM);
  }
  function shiftMonth(delta) {
    var target = monthsFromCur() + delta;
    if (target < 0 || target > MAX_MONTHS_AHEAD) return;
    var d = new Date(state.viewY, state.viewM + delta, 1);
    state.viewY = d.getFullYear();
    state.viewM = d.getMonth();
    renderCal();
  }
  if (calPrev) calPrev.addEventListener("click", function () { shiftMonth(-1); });
  if (calNext) calNext.addEventListener("click", function () { shiftMonth(1); });

  function renderCal() {
    if (!calGrid) return;
    if (calWeekdays && !calWeekdays.children.length) {
      calWeekdays.innerHTML = WEEKDAYS.map(function (d) { return "<span>" + d + "</span>"; }).join("");
    }
    if (calMonth) calMonth.textContent = capitalize(MONTHS[state.viewM]) + " " + state.viewY;
    if (calPrev) calPrev.disabled = monthsFromCur() <= 0;
    if (calNext) calNext.disabled = monthsFromCur() >= MAX_MONTHS_AHEAD;
    calGrid.innerHTML = "";
    var first = new Date(state.viewY, state.viewM, 1);
    var startDow = (first.getDay() + 6) % 7; // Monday = 0
    var daysInMonth = new Date(state.viewY, state.viewM + 1, 0).getDate();
    var i;
    for (i = 0; i < startDow; i++) {
      var blank = document.createElement("span");
      blank.className = "sched__day sched__day--empty";
      calGrid.appendChild(blank);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var dObj = new Date(state.viewY, state.viewM, day);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sched__day";
      btn.textContent = String(day);
      var isPast = dObj < today0;
      var isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
      if (isPast || isWeekend) {
        btn.disabled = true;
      } else {
        btn.setAttribute("aria-label", fmtLong(dObj));
        (function (d) {
          btn.addEventListener("click", function () { selectDate(d); });
        })(dObj);
      }
      if (state.date && sameDay(state.date, dObj)) btn.setAttribute("aria-pressed", "true");
      calGrid.appendChild(btn);
    }
  }

  function selectDate(dObj) {
    state.date = dObj;
    state.slot = null;
    renderCal();
    if (selectedDateLabel) selectedDateLabel.textContent = fmtLong(dObj);
    renderSlots();
    window.setTimeout(function () { showPanel("time"); }, 220);
  }

  /* ------------------------------- slots --------------------------- */
  function renderSlots() {
    if (!slotsEl) return;
    slotsEl.innerHTML = "";
    SLOTS.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sched__slot";
      b.textContent = s.label;
      b.addEventListener("click", function () { selectSlot(s); });
      slotsEl.appendChild(b);
    });
  }
  function selectSlot(s) {
    state.slot = s;
    Array.prototype.forEach.call(slotsEl.querySelectorAll(".sched__slot"), function (b) {
      b.setAttribute("aria-pressed", b.textContent === s.label ? "true" : "false");
    });
    window.setTimeout(function () { showPanel("contact"); }, 220);
  }

  /* ------------------------------ contact -------------------------- */
  if (confirmBtn) confirmBtn.addEventListener("click", confirmBooking);
  [nameInput, phoneInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBooking();
      }
    });
  });

  function confirmBooking() {
    var name = nameInput ? nameInput.value.trim() : "";
    var phone = phoneInput ? phoneInput.value.trim() : "";
    var phoneDigits = phone.replace(/[^\d]/g, "");
    if (!name || phoneDigits.length < 7) {
      if (contactError) {
        contactError.textContent = !name
          ? "Agrega tu nombre completo."
          : "Ingresa un número de WhatsApp válido.";
        contactError.hidden = false;
      }
      return;
    }
    if (contactError) contactError.hidden = true;
    state.name = name;
    state.phone = phone;

    var human = fmtLong(state.date) + " a las " + state.slot.label;
    var mailto = buildBookingMailto(name, phone, human);
    showPanel("success");
    window.setTimeout(function () {
      try { window.location.href = mailto; } catch (e) {}
    }, 80);
  }

  function buildBookingMailto(name, phone, human) {
    var subject = "Nueva cita — " + name;
    var body =
      "Nombre: " + name +
      "\nWhatsApp: " + phone +
      "\nHorario solicitado: " + human + " (" + DURATION_MIN + " min)" +
      "\n\nEnviado desde martingrow.com";
    return "mailto:" + BOOK_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  /* --------------------------- prepare / discovery ------------------ */
  if (prepareBtn) prepareBtn.addEventListener("click", function () { showPanel("discovery"); });

  /* Single-select choice with a quiet pressed state — no auto-advance,
     since this optional step has two more fields around it. */
  Array.prototype.forEach.call(modal.querySelectorAll(".booking-choices .booking-choice"), function (btn) {
    btn.addEventListener("click", function () {
      var group = btn.parentElement;
      Array.prototype.forEach.call(group.querySelectorAll(".booking-choice"), function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
    });
  });

  if (discoverySendBtn) {
    discoverySendBtn.addEventListener("click", function () {
      var business = valueOf("disc-business");
      var objective = "";
      var pressed = modal.querySelector('[data-step="discovery"] .booking-choice[aria-pressed="true"]');
      if (pressed) objective = pressed.getAttribute("data-value");
      var challenge = valueOf("disc-challenge");

      var subject = "Preparación de reunión — " + (state.name || "cliente");
      var bodyText =
        "Negocio: " + (business || "—") +
        "\nObjetivo principal: " + (objective || "—") +
        "\nPrincipal reto: " + (challenge || "—") +
        "\n\nEnviado desde martingrow.com";
      var mailto = "mailto:" + BOOK_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(bodyText);

      renderThanks();
      window.setTimeout(function () {
        try { window.location.href = mailto; } catch (e) {}
      }, 80);
    });
  }

  function valueOf(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function renderThanks() {
    var panel = modal.querySelector('[data-step="discovery"]');
    if (!panel) return;
    var first = state.name ? state.name.split(/\s+/)[0] : "";
    panel.innerHTML =
      '<h2 class="booking-step__q">Gracias' + (first ? ", " + first : "") + '.</h2>' +
      '<p class="booking-step__hint">Nos vemos en la llamada.</p>';
    window.setTimeout(closeModal, 1400);
  }

  /* ----------------------------- focus trap ---------------------- */
  function trapFocus(e) {
    var nodes = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var list = Array.prototype.filter.call(nodes, function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  renderCal();
})();
