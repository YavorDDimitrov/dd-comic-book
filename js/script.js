(() => {
  "use strict";

  const BOOK_TITLE = "THE TALE OF DD\nAND THE SEVEN\nCOMPANIONS";

  // ---- Full reading order, used in single-page (mobile) mode ----
  const ALL_PAGES = [
    "front_cover", "page1", "page2", "page3", "page4", "page5", "page6",
    "page7", "page8", "page9", "page10", "page11", "page12", "back_cover",
  ];

  // ---- Desktop two-page spread pairs: [leftPage, rightPage] ----
  // null = blank inside-cover title card
  const SPREADS = [
    [null,     "front_cover"],
    ["page1",  "page2"],
    ["page3",  "page4"],
    ["page5",  "page6"],
    ["page7",  "page8"],
    ["page9",  "page10"],
    ["page11", "page12"],
    [null,     "back_cover"],
  ];

  const src = (name) => `assets/images/${name}.jpg`;

  // ---- Viewport mode detection ----
  const isDesktop = window.matchMedia("(min-width: 900px) and (pointer: fine)").matches;
  document.body.classList.toggle("spread-mode", isDesktop);

  // ---- DOM refs ----
  const leftContainer  = document.getElementById("pages-left");
  const rightContainer = document.getElementById("pages-right");
  const prevBtn        = document.getElementById("prev-btn");
  const nextBtn        = document.getElementById("next-btn");
  const counterEl      = document.getElementById("page-counter");
  const bookWrap       = document.getElementById("book-wrap");
  const bookEl         = document.getElementById("book");
  const muteBtn        = document.getElementById("mute-btn");
  const iconOn         = document.getElementById("icon-on");
  const iconOff        = document.getElementById("icon-off");
  const audio          = document.getElementById("bg-audio");
  const restartBtn     = document.getElementById("restart-btn");

  // ---------- Build helpers ----------

  function makeBackCard() {
    const card = document.createElement("div");
    card.className = "back-card";
    const span = document.createElement("span");
    span.textContent = BOOK_TITLE;
    card.appendChild(span);
    return card;
  }

  /**
   * Build a stack of flip-able page leaves inside a container.
   * Each entry in `names` is an image basename (or null for a blank title card).
   */
  function buildStack(container, names) {
    const n = names.length;
    return names.map((name, i) => {
      const el = document.createElement("div");
      el.className = "page";
      el.style.zIndex = String(n - i);

      const front = document.createElement("div");
      front.className = "page-face front";
      if (name) {
        const img = document.createElement("img");
        img.src = src(name);
        img.alt = name.replace(/_/g, " ");
        img.draggable = false;
        front.appendChild(img);
      } else {
        front.appendChild(makeBackCard());
      }

      const back = document.createElement("div");
      back.className = "page-face back";
      back.appendChild(makeBackCard());

      el.appendChild(front);
      el.appendChild(back);
      container.appendChild(el);
      return el;
    });
  }

  /**
   * Build a static left-hand panel for desktop spread mode.
   * Shows either a page image or a blank title card, updated instantly
   * when the user navigates. This replaces the old dual-stack approach
   * that caused the "two books" rendering bug.
   */
  function buildLeftPanel(container) {
    const wrapper = document.createElement("div");
    wrapper.className = "left-panel";

    const imgEl = document.createElement("img");
    imgEl.className = "left-panel-img";
    imgEl.draggable = false;

    const cardEl = makeBackCard();

    wrapper.appendChild(imgEl);
    wrapper.appendChild(cardEl);
    container.appendChild(wrapper);

    return { wrapper, imgEl, cardEl };
  }

  // ---------- Assemble the view for the current viewport ----------

  let leftPanel = null;

  // Desktop: right stack holds the right-hand page of each spread.
  // Mobile:  right stack holds every page in sequential reading order.
  const rightStack = buildStack(
    rightContainer,
    isDesktop ? SPREADS.map((s) => s[1]) : ALL_PAGES
  );

  if (isDesktop) {
    leftPanel = buildLeftPanel(leftContainer);
    // Pre-load all left-panel images so they swap instantly on navigation
    SPREADS.forEach(([leftName]) => {
      if (leftName) {
        const preload = new Image();
        preload.src = src(leftName);
      }
    });
  }

  const N    = rightStack.length;   // total turnable positions
  const LAST = N - 1;
  let current   = 0;                // current spread/page index
  let animating = false;            // lock to prevent overlapping flips
  let userMuted = false;

  // ---------- Desktop left-panel management ----------

  /** Update the static left panel to show the correct page for the current spread. */
  function updateLeftPanel() {
    if (!leftPanel) return;
    const leftName = SPREADS[current][0];
    if (leftName) {
      leftPanel.imgEl.src = src(leftName);
      leftPanel.imgEl.alt = leftName.replace(/_/g, " ");
      leftPanel.imgEl.style.display = "block";
      leftPanel.cardEl.style.display = "none";
    } else {
      leftPanel.imgEl.style.display = "none";
      leftPanel.cardEl.style.display = "";   // restore CSS default (flex)
    }
  }

  // Set the initial left-panel state
  if (isDesktop) updateLeftPanel();

  // ---------- Flip mechanics ----------

  function flipForward(idx) {
    const el = rightStack[idx];
    el.classList.add("turning");
    el.style.zIndex = String(100 + idx);   // rise above the unflipped stack
    el.classList.add("flipped");
  }

  function flipBackward(idx) {
    const el = rightStack[idx];
    el.classList.add("turning");
    // Keep z-index high (100 + idx) during the backward flip animation
    // so the page is visible while rotating back. It is reset to its
    // resting value inside onFlipDone after the transition ends.
    el.classList.remove("flipped");
  }

  /**
   * Wait for a page's CSS flip transition to complete, then run `cb`.
   * Uses transitionend with a safety timeout so the callback always fires,
   * even if the browser swallows the event (common on mobile).
   */
  function onFlipDone(idx, cb) {
    const el = rightStack[idx];
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", handler);
      cb();
    }

    function handler(e) {
      if (e.propertyName === "transform") finish();
    }

    el.addEventListener("transitionend", handler);
    // Safety: guarantee the callback fires even if transitionend is swallowed
    setTimeout(finish, 1000);
  }

  /** Instantly reset the entire right stack to its initial (all-unflipped) state. */
  function resetStackInstant() {
    rightStack.forEach((el, i) => {
      el.classList.remove("turning", "flipped");
      el.style.transition = "none";
      el.style.zIndex = String(N - i);
      void el.offsetWidth;   // force reflow so the transition removal takes effect
      el.style.transition = "";
    });
  }

  // ---------- UI state helpers ----------

  function labelFor(idx) {
    if (isDesktop) {
      if (idx === 0)    return "Front Cover";
      if (idx === LAST) return "Back Cover";
      const rp = idx * 2;
      return `Pages ${rp - 1}\u2013${rp}`;
    }
    if (idx === 0)    return "Front Cover";
    if (idx === LAST) return "Back Cover";
    return `Page ${idx} of ${N - 2}`;
  }

  function updateCounter() {
    counterEl.textContent = labelFor(current);
    counterEl.classList.toggle("visible", current > 0);
  }

  function updateArrows() {
    prevBtn.classList.toggle("hidden", current === 0);
    nextBtn.classList.toggle("hidden", current === LAST);
    restartBtn.classList.toggle("hidden", current !== LAST);
  }

  function triggerCloseFlourish() {
    bookEl.classList.add("book-closing");
    setTimeout(() => bookEl.classList.remove("book-closing"), 620);
  }

  function triggerOpenFlourish() {
    bookEl.classList.add("book-opening");
    setTimeout(() => bookEl.classList.remove("book-opening"), 620);
  }

  // ---------- Navigation ----------

  function goNext() {
    if (animating || current >= LAST) return;
    animating = true;

    const fromIdx = current;
    flipForward(fromIdx);
    current += 1;

    if (isDesktop) updateLeftPanel();
    updateCounter();

    // Show/hide prev and next based on new position
    prevBtn.classList.toggle("hidden", current === 0);
    nextBtn.classList.toggle("hidden", current === LAST);

    const reachedLast = current === LAST;

    onFlipDone(fromIdx, () => {
      rightStack[fromIdx].classList.remove("turning");

      if (reachedLast) {
        triggerCloseFlourish();
        spawnFireworks();
        // Delay unlocking + showing restart until the close flourish is done
        setTimeout(() => {
          animating = false;
          updateArrows();
        }, 620);
      } else {
        animating = false;
      }
    });
  }

  function goPrev() {
    if (animating || current <= 0) return;
    animating = true;

    const wasLast = current === LAST;

    function doFlip() {
      current -= 1;
      const idx = current;
      flipBackward(idx);

      if (isDesktop) updateLeftPanel();
      updateArrows();
      updateCounter();

      onFlipDone(idx, () => {
        // Reset z-index to its resting position now that the animation is complete
        rightStack[idx].style.zIndex = String(N - idx);
        rightStack[idx].classList.remove("turning");
        animating = false;
      });
    }

    if (wasLast) {
      triggerOpenFlourish();
      setTimeout(doFlip, 200);
    } else {
      doFlip();
    }
  }

  function startFromBeginning() {
    if (animating || current !== LAST) return;
    animating = true;
    restartBtn.classList.add("hidden");

    const DUR = 420;
    bookEl.style.transition =
      `transform ${DUR}ms cubic-bezier(.5,0,.5,1), opacity ${DUR}ms ease`;
    bookEl.style.transform = "rotateY(90deg) scaleX(0.05)";
    bookEl.style.opacity   = "0.15";

    setTimeout(() => {
      bookEl.style.transition = "none";
      bookEl.style.transform  = "rotateY(-90deg) scaleX(0.05)";

      resetStackInstant();
      current = 0;
      if (isDesktop) updateLeftPanel();
      void bookEl.offsetWidth;

      bookEl.style.transition =
        `transform ${DUR}ms cubic-bezier(.5,0,.5,1), opacity ${DUR}ms ease`;
      bookEl.style.transform = "rotateY(0deg) scaleX(1)";
      bookEl.style.opacity   = "1";

      setTimeout(() => {
        bookEl.style.transition = "";
        bookEl.style.transform  = "";
        bookEl.style.opacity    = "";
        animating = false;
        updateArrows();
        updateCounter();
      }, DUR + 30);
    }, DUR);
  }

  // ---------- Event listeners ----------

  nextBtn.addEventListener("click", goNext);
  prevBtn.addEventListener("click", goPrev);
  restartBtn.addEventListener("click", startFromBeginning);

  // Click / tap zones on the book itself
  if (isDesktop) {
    rightContainer.addEventListener("click", goNext);
    leftContainer.addEventListener("click", goPrev);
  } else {
    // ---- Mobile: swipe + tap, with conflict prevention ----
    let swipeFired  = false;
    let touchStartX = null;
    let touchStartY = null;

    rightContainer.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
      swipeFired  = false;
    }, { passive: true });

    rightContainer.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Only count a horizontal swipe if dx is dominant over dy
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        swipeFired = true;
        dx < 0 ? goNext() : goPrev();
      }
      touchStartX = null;
      touchStartY = null;
    }, { passive: true });

    rightContainer.addEventListener("click", (e) => {
      // Ignore the click if a swipe was just handled
      if (swipeFired) { swipeFired = false; return; }
      const rect = rightContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      x > rect.width / 2 ? goNext() : goPrev();
    });
  }

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
  });

  updateArrows();
  updateCounter();

  // ---------- Audio / mute ----------

  function setMuted(muted) {
    userMuted = muted;
    audio.muted = muted;
    muteBtn.classList.toggle("is-muted", muted);
    muteBtn.setAttribute("aria-pressed", String(muted));
    iconOn.style.display  = muted ? "none" : "block";
    iconOff.style.display = muted ? "block" : "none";
  }

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();     // don't let this bubble to the gesture handlers
    setMuted(!userMuted);
    // If the user just unmuted, try to resume playback
    if (!userMuted && audio.paused) {
      audio.play().catch(() => {});
    }
  });

  // Try autoplay; if the browser blocks it, play on first user gesture.
  setMuted(false);
  audio.play().catch(() => {});

  /** Attempt to start audio on the user's first gesture (tap, click, key). */
  function onFirstGesture() {
    if (userMuted) return;                     // respect the user's explicit mute
    if (!audio.paused) {
      removeGestureListeners();                // already playing — clean up
      return;
    }
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(removeGestureListeners)           // success — stop listening
       .catch(() => {/* still blocked; keep listening for next gesture */});
    }
  }

  function removeGestureListeners() {
    window.removeEventListener("pointerdown", onFirstGesture, true);
    window.removeEventListener("keydown",     onFirstGesture, true);
    window.removeEventListener("touchstart",  onFirstGesture, true);
    window.removeEventListener("click",       onFirstGesture, true);
  }

  // Listen on all common gesture types for maximum compatibility
  window.addEventListener("pointerdown", onFirstGesture, true);
  window.addEventListener("keydown",     onFirstGesture, true);
  window.addEventListener("touchstart",  onFirstGesture, true);
  window.addEventListener("click",       onFirstGesture, true);

  // ---------- Entrance: spin the book into view ----------

  requestAnimationFrame(() => {
    bookWrap.classList.add("enter-run");

    let entranceDone = false;

    function finishEntrance() {
      if (entranceDone) return;
      entranceDone = true;
      bookWrap.style.opacity = "1";
      bookEl.style.transform = "none";
      bookWrap.classList.remove("enter-run");
      bookWrap.removeEventListener("animationend", onAnimEnd);
    }

    function onAnimEnd(ev) {
      if (ev.target === bookEl) finishEntrance();
    }

    bookWrap.addEventListener("animationend", onAnimEnd);
    // Fallback: force visibility if animationend never fires (mobile quirk)
    setTimeout(finishEntrance, 2000);
  });

  // ---------- Lightweight starfield background ----------

  (function starfield() {
    const canvas = document.getElementById("stars");
    const ctx = canvas.getContext("2d");
    let w, h, stars;

    function resize() {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.floor((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        tw: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.006,
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const alpha = 0.35 + 0.65 * Math.abs(Math.sin(s.tw + t * s.speed));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#e9edf7";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(draw);
  })();

  // ---------- Fireworks burst (played when the back cover is reached) ----------

  const spawnFireworks = (function fireworksModule() {
    const canvas = document.getElementById("fireworks");
    const ctx = canvas.getContext("2d");
    const COLORS = ["#ff7a1a", "#f5d442", "#e13c3c", "#f4f1e8", "#8fa3c7"];
    let w, h;
    let particles = [];
    let running   = false;
    let stopAt    = 0;
    let lastBurst = 0;

    function resize() {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resize);
    resize();

    function burst(x, y) {
      const count = 46 + Math.floor(Math.random() * 20);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
        const speed = 2.2 + Math.random() * 3.4;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.008 + Math.random() * 0.01,
          color,
          size: 1.6 + Math.random() * 1.8,
        });
      }
    }

    function frame(t) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      if (t - lastBurst > 650 && t < stopAt - 900) {
        lastBurst = t;
        burst(w * (0.25 + Math.random() * 0.5), h * (0.2 + Math.random() * 0.28));
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;     // gravity
        p.life -= p.decay;
      });
      particles = particles.filter((p) => p.life > 0);

      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (t < stopAt || particles.length) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        ctx.clearRect(0, 0, w, h);
      }
    }

    return function spawn() {
      particles = [];
      running   = true;
      lastBurst = 0;
      const start = performance.now();
      stopAt = start + 4200;
      burst(w * 0.5, h * 0.32);
      requestAnimationFrame(frame);
    };
  })();
})();
