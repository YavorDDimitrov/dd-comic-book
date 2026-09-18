(() => {
  "use strict";

  // ---- Page manifest: cover first, then page1..page6, in reading order ----
  const PAGES = [
    { src: "assets/images/front_cover.jpg", label: "Front Cover" },
    { src: "assets/images/page1.jpg", label: "Page 1" },
    { src: "assets/images/page2.jpg", label: "Page 2" },
    { src: "assets/images/page3.jpg", label: "Page 3" },
    { src: "assets/images/page4.jpg", label: "Page 4" },
    { src: "assets/images/page5.jpg", label: "Page 5" },
    { src: "assets/images/page6.jpg", label: "Page 6" },
    { src: "assets/images/page7.jpg", label: "Page 7" },
    { src: "assets/images/page8.jpg", label: "Page 8" },
    { src: "assets/images/page9.jpg", label: "Page 9" },
    { src: "assets/images/page10.jpg", label: "Page 10" },
    { src: "assets/images/page11.jpg", label: "Page 11" },
    { src: "assets/images/page12.jpg", label: "Page 12" },
    { src: "assets/images/back_cover.jpg", label: "Back Cover" },
  ];

  const pagesEl = document.getElementById("pages");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const counterEl = document.getElementById("page-counter");
  const bookWrap = document.getElementById("book-wrap");
  const muteBtn = document.getElementById("mute-btn");
  const iconOn = document.getElementById("icon-on");
  const iconOff = document.getElementById("icon-off");
  const audio = document.getElementById("bg-audio");
  const startOverlay = document.getElementById("start-overlay");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const bookEl = document.getElementById("book");

  const N = PAGES.length;
  const LAST = N - 1; // index of the back cover — the book's final resting page
  let current = 0;    // index of the currently-showing, not-yet-flipped page (0..LAST)
  let animating = false;
  let userMuted = false;

  // ---------- Build the page stack ----------
  const pageEls = PAGES.map((p, i) => {
    const el = document.createElement("div");
    el.className = "page";
    el.style.zIndex = String(N - i);

    const front = document.createElement("div");
    front.className = "page-face front";
    const img = document.createElement("img");
    img.src = p.src;
    img.alt = p.label;
    img.draggable = false;
    front.appendChild(img);

    const back = document.createElement("div");
    back.className = "page-face back";
    const backCard = document.createElement("div");
    backCard.className = "back-card";
    const span = document.createElement("span");
    span.textContent = "DD AND THE NEW ADVENTURE";
    backCard.appendChild(span);
    back.appendChild(backCard);

    el.appendChild(front);
    el.appendChild(back);
    pagesEl.appendChild(el);
    return el;
  });

  const STORY_PAGES = N - 2; // total pages between cover and back cover

  function updateCounter() {
    let label;
    if (current === 0) label = "Front Cover";
    else if (current === LAST) label = "Back Cover";
    else label = `Page ${current} of ${STORY_PAGES}`;
    counterEl.textContent = label;
    counterEl.classList.toggle("visible", current > 0);
  }

  function updateArrows() {
    const atLast = current === LAST;
    prevBtn.classList.toggle("hidden", current === 0 || animating);
    nextBtn.classList.toggle("hidden", atLast || animating);
    restartBtn.classList.toggle("hidden", !atLast || animating);
  }

  // brief physical "settle" wobble played once the book reaches its last page
  function triggerCloseFlourish() {
    bookEl.classList.add("book-closing");
    window.setTimeout(() => bookEl.classList.remove("book-closing"), 620);
  }

  // brief "lift" wobble played when leaving the last page, as if reopening the cover
  function triggerOpenFlourish() {
    bookEl.classList.add("book-opening");
    window.setTimeout(() => bookEl.classList.remove("book-opening"), 620);
  }

  function goNext() {
    if (animating || current >= LAST) return;
    animating = true;
    const el = pageEls[current];
    el.classList.add("turning");
    el.style.zIndex = String(100 + current); // rises above the stack while/after turning
    el.classList.add("flipped");
    current += 1;
    updateArrows();
    updateCounter();
    const reachedLast = current === LAST;
    window.setTimeout(() => {
      if (reachedLast) {
        triggerCloseFlourish();
        window.setTimeout(() => { animating = false; updateArrows(); }, 620);
      } else {
        animating = false;
        updateArrows();
      }
    }, 900);
  }

  function goPrev() {
    if (animating || current <= 0) return;
    animating = true;
    const wasLast = current === LAST;

    const doFlip = () => {
      current -= 1;
      const el = pageEls[current];
      el.style.zIndex = String(N - current);
      el.classList.remove("flipped");
      updateArrows();
      updateCounter();
      window.setTimeout(() => { animating = false; updateArrows(); }, 900);
    };

    if (wasLast) {
      // let the "reopening" wobble read for a beat before the page lifts
      triggerOpenFlourish();
      window.setTimeout(doFlip, 200);
    } else {
      doFlip();
    }
  }

  // "Start from beginning": spin the whole book around like flipping it over
  // in your hands, swapping to the reset (all-unflipped) state while the
  // book is edge-on and effectively invisible, so no mirrored content is
  // ever seen.
  function resetPagesInstant() {
    pageEls.forEach((el, i) => {
      el.classList.remove("turning");
      el.style.transition = "none";
      el.classList.remove("flipped");
      el.style.zIndex = String(N - i);
      void el.offsetWidth; // force reflow so the transition removal takes effect
      el.style.transition = "";
    });
  }

  function startFromBeginning() {
    if (animating || current !== LAST) return;
    animating = true;
    restartBtn.classList.add("hidden");

    const DUR = 420;
    bookEl.style.transition = `transform ${DUR}ms cubic-bezier(.5,0,.5,1), opacity ${DUR}ms ease`;
    bookEl.style.transform = "rotateY(90deg) scaleX(0.05)";
    bookEl.style.opacity = "0.15";

    window.setTimeout(() => {
      // jump to the mirrored edge-on angle with no transition, and reset the
      // page stack, all while the book is visually a sliver — the swap is invisible
      bookEl.style.transition = "none";
      bookEl.style.transform = "rotateY(-90deg) scaleX(0.05)";
      resetPagesInstant();
      current = 0;
      void bookEl.offsetWidth;

      bookEl.style.transition = `transform ${DUR}ms cubic-bezier(.5,0,.5,1), opacity ${DUR}ms ease`;
      bookEl.style.transform = "rotateY(0deg) scaleX(1)";
      bookEl.style.opacity = "1";

      window.setTimeout(() => {
        bookEl.style.transition = "";
        bookEl.style.transform = "";
        bookEl.style.opacity = "";
        animating = false;
        updateArrows();
        updateCounter();
      }, DUR + 30);
    }, DUR);
  }

  nextBtn.addEventListener("click", goNext);
  prevBtn.addEventListener("click", goPrev);
  restartBtn.addEventListener("click", startFromBeginning);

  // click the visible page itself: right half = next, left half = prev
  pagesEl.addEventListener("click", (e) => {
    const rect = pagesEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width / 2) goNext(); else goPrev();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") goNext();
    if (e.key === "ArrowLeft") goPrev();
  });

  // basic swipe support
  let touchStartX = null;
  pagesEl.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  pagesEl.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { dx < 0 ? goNext() : goPrev(); }
    touchStartX = null;
  }, { passive: true });

  updateArrows();
  updateCounter();

  // ---------- Audio / mute ----------
  function setMuted(muted) {
    userMuted = muted;
    audio.muted = muted;
    muteBtn.classList.toggle("is-muted", muted);
    muteBtn.setAttribute("aria-pressed", String(muted));
    iconOn.style.display = muted ? "none" : "block";
    iconOff.style.display = muted ? "block" : "none";
  }

  function tryPlay() {
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => { /* autoplay blocked until a user gesture; start overlay handles that */ });
    }
  }

  muteBtn.addEventListener("click", () => setMuted(!userMuted));

  // ---------- Entrance: start overlay -> spin the book into view ----------
  function beginExperience() {
    startOverlay.classList.add("hidden");
    setMuted(false);
    tryPlay();

    bookWrap.classList.add("enter-run");
    bookWrap.addEventListener("animationend", function onEnd(ev) {
      if (ev.target === bookEl) {
        // lock in the settled state with inline styles, then drop the
        // entrance rule entirely — otherwise its higher CSS specificity
        // would permanently block the later close/open/restart animations
        // from ever being able to touch #book's `transform`/`animation`.
        bookWrap.style.opacity = "1";
        bookEl.style.transform = "none";
        bookWrap.classList.remove("enter-run");
        bookWrap.removeEventListener("animationend", onEnd);
      }
    });
  }

  startBtn.addEventListener("click", beginExperience);
  // allow starting with Enter/Space too
  startBtn.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") beginExperience();
  });

  // ---------- Lightweight starfield background ----------
  (function starfield() {
    const canvas = document.getElementById("stars");
    const ctx = canvas.getContext("2d");
    let w, h, stars;

    function resize() {
      w = canvas.width = window.innerWidth;
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
})();
