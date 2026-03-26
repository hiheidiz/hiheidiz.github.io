(() => {
  "use strict";

  function initArtCarousel() {
    const carousel = document.querySelector("[data-art-carousel]");
    const viewport = document.querySelector("[data-art-carousel-viewport]");
    if (!carousel || !viewport) return;
    const items = Array.from(carousel.querySelectorAll(".art-carousel-item"));
    const cssCountRaw = getComputedStyle(carousel).getPropertyValue("--item-count").trim();
    const cssCount = Number(cssCountRaw);
    const count = Number.isFinite(cssCount) && cssCount > 0 ? cssCount : Math.max(1, items.length);

    let angle = 0;
    let dragging = false;
    let lastX = 0;
    let activePointerId = null;
    let keyAnimRaf = null;
    let keysRaf = null;
    let heldDir = 0; // -1 = right, +1 = left (matches our inverted rotation)

    function setAngle(deg) {
      angle = deg;
      carousel.style.setProperty("--art-rotation", `${angle}deg`);
      updateItemScales();
    }

    function stopKeySpin() {
      if (keysRaf != null) cancelAnimationFrame(keysRaf);
      keysRaf = null;
      heldDir = 0;
    }

    function startKeySpin(dir) {
      heldDir = dir;
      if (keysRaf != null) return;

      const speedDegPerSec = 140; // tweak for faster/slower hold-spin
      let last = performance.now();

      const tick = (now) => {
        const dt = Math.min(50, now - last) / 1000;
        last = now;
        if (heldDir !== 0) {
          setAngle(angle + heldDir * speedDegPerSec * dt);
          keysRaf = requestAnimationFrame(tick);
        } else {
          keysRaf = null;
        }
      };

      keysRaf = requestAnimationFrame(tick);
    }

    function updateItemScales() {
      // Exaggerate “inside the ring” sizing: biggest near left/right edges (~±90deg).
      // We approximate each item's relative angle = (itemIndex * step + angle).
      const step = 360 / count;
      for (let idx = 0; idx < items.length; idx++) {
        const el = items[idx];
        const iRaw = el.style.getPropertyValue("--i").trim();
        const i = iRaw ? Number(iRaw) : idx;
        const relDeg = i * step + angle;
        const rad = (relDeg * Math.PI) / 180;
        // |sin| peaks at 90deg (sides), 0 at 0/180 (front/back).
        const side = Math.abs(Math.sin(rad));
        const scale = 0.9 + 0.55 * Math.pow(side, 1.6); // more dramatic near sides
        el.style.setProperty("--art-item-scale", scale.toFixed(3));
      }
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      activePointerId = e.pointerId;
      stopKeySpin();
      viewport.classList.add("is-dragging");
      try {
        viewport.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      viewport.style.transition = "none";
    }

    function onPointerMove(e) {
      if (!dragging || e.pointerId !== activePointerId) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      // Invert direction so dragging feels reversed.
      setAngle(angle - dx * 0.45);
    }

    function endDrag() {
      dragging = false;
      activePointerId = null;
      viewport.classList.remove("is-dragging");
    }

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("keydown", (e) => {
      if (e.repeat) {
        // holding the key will still generate repeats in some browsers;
        // we ignore and let our RAF loop run.
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        startKeySpin(+1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        startKeySpin(-1);
      }
    });

    viewport.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" && heldDir === +1) stopKeySpin();
      if (e.key === "ArrowRight" && heldDir === -1) stopKeySpin();
    });

    // If focus leaves the viewport, stop spinning.
    viewport.addEventListener("blur", stopKeySpin);

    setAngle(0);
  }

  // Expose for the main loader (after injecting HTML).
  window.__art = window.__art || {};
  window.__art.initArtCarousel = initArtCarousel;
})();

