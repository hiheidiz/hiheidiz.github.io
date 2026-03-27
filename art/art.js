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
    let keysRaf = null;
    let heldDir = 0;

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

      const speedDegPerSec = 140;
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
      const step = 360 / count;
      for (let idx = 0; idx < items.length; idx++) {
        const el = items[idx];
        const iRaw = el.style.getPropertyValue("--i").trim();
        const i = iRaw ? Number(iRaw) : idx;
        const relDeg = i * step + angle;
        const rad = (relDeg * Math.PI) / 180;
        const side = Math.abs(Math.sin(rad));
        const scale = 0.9 + 0.55 * Math.pow(side, 1.6);
        el.style.setProperty("--art-item-scale", scale.toFixed(3));
      }
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest("[data-open-modal]")) return;
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
      if (e.repeat) {}
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

    viewport.addEventListener("blur", stopKeySpin);

    // Clicks inside the 3D preserve-3d context don't bubble to document,
    // so we catch modal triggers directly at the viewport level.
    let dragDistance = 0;
    viewport.addEventListener("pointerdown", () => { dragDistance = 0; }, true);
    viewport.addEventListener("pointermove", () => { dragDistance++; }, true);

    viewport.addEventListener("click", (e) => {
      if (dragDistance > 3) return;
      const trigger = e.target instanceof Element && e.target.closest("[data-open-modal]");
      if (!trigger) return;

      const projectId = trigger.getAttribute("data-open-modal");
      if (!projectId) return;

      const modal = document.getElementById("art-modal-overlay");
      if (!modal) return;

      const contentEl = modal.querySelector(".art-modal-content");
      if (contentEl) {
        contentEl.innerHTML = "<p style='text-align:center;padding:2rem;color:var(--muted)'>Loading…</p>";
      }

      modal.style.setProperty("--animate-duration", "0.5s");
      modal.classList.add("is-open", "animate__animated", "animate__fadeIn");
      modal.classList.remove("animate__fadeOut");
      modal.setAttribute("aria-hidden", "false");

      if (contentEl) {
        fetch(`artprojects/${projectId}/index.html`, { cache: "no-cache" })
          .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
          .then((html) => { contentEl.innerHTML = html; })
          .catch(() => { contentEl.innerHTML = "<p style='text-align:center;padding:2rem;color:#f87171'>Failed to load project.</p>"; });
      }
    });

    // Replace tile content with cover.jpg if the image exists in the project folder.
    for (const item of items) {
      const projectId = item.getAttribute("data-open-modal");
      if (!projectId) continue;
      const coverUrl = `artprojects/${projectId}/cover.jpg`;
      const img = new Image();
      img.src = coverUrl;
      const label = item.querySelector(".art-tile-inner span")?.textContent?.trim() || projectId;
      img.addEventListener("load", () => {
        const inner = item.querySelector(".art-tile-inner");
        if (!inner) return;

        const tileH = parseFloat(getComputedStyle(item).getPropertyValue("--tile-h")) || 300;
        const aspect = img.naturalWidth / img.naturalHeight;
        item.style.setProperty("--tile-w", `${Math.round(tileH * aspect)}px`);

        inner.classList.add("art-tile-inner--cover");
        inner.innerHTML = "";
        img.alt = label;
        img.draggable = false;
        inner.appendChild(img);

        const caption = document.createElement("span");
        caption.className = "art-tile-caption";
        caption.textContent = label;
        inner.appendChild(caption);
      });
    }

    setAngle(0);
  }

  window.__art = window.__art || {};
  window.__art.initArtCarousel = initArtCarousel;
})();
