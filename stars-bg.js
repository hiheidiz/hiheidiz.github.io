(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReducedMotion) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  let enabled = true;
  let rafId = null;

  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const rootStyles = getComputedStyle(document.documentElement);
  const cyan = rootStyles.getPropertyValue("--accent").trim() || "#7dd3ff";
  const warm = "#fbbf24";

  const rand = (min, max) => min + Math.random() * (max - min);

  function drawFourPointStar(x, y, size, rot, fillStyle, alpha) {
    // 4-point star made from an 8-vertex "outer/inner" polygon.
    const rOuter = size / 3;
    const rInner = size / 8;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (2 * Math.PI * i) / 8;
      const r = i % 2 === 0 ? rOuter : rInner;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  let stars = [];
  let lastHourMod = null;

  function makeStar({ x, y } = {}) {
    const colorRoll = Math.random();
    return {
      x: x ?? rand(0, w),
      y: y ?? rand(0, Math.max(1, h - 10)),
      size: rand(10, 26),
      rot: rand(0, Math.PI * 1),
      vx: rand(0.05, 0.1),
      rotV: rand(0.03, 0.05) * 0.15,
      phase: rand(0, Math.PI * 2),
      tw: rand(0.4, 1.2),
      color: colorRoll < 0.75 ? cyan : warm,
      baseAlpha: rand(0.15, 0.65),
    };
  }

  function rebuildStars() {
    const hourMod = new Date().getHours() % 12;
    if (hourMod === lastHourMod) return;

    lastHourMod = hourMod;
    const count = hourMod * 10; // = hour mod 12 * 10

    stars = Array.from({ length: count }, () => makeStar());
  }

  // Clicking spawns a single star that travels across the screen.
  const clickStars = [];
  function spawnClickStar(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (w / Math.max(1, rect.width));
    const y = (clientY - rect.top) * (h / Math.max(1, rect.height));

    clickStars.push(makeStar({ x, y }));
  }

  const onClick = (e) => {
    // If you click on an interactive element, still allow sparkle.
    spawnClickStar(e.clientX, e.clientY);
  };

  window.addEventListener("click", onClick, { passive: true });

  let lastT = performance.now();
  let t = 0;

  function animate(now) {
    if (!enabled) return;
    const dt = Math.min(50, now - lastT) / 1000;
    lastT = now;
    t += dt;

    // Keep background color fully coming from the page; only draw stars.
    ctx.clearRect(0, 0, w, h);

    // Rebuild when the hour rolls over (keeps star count = hour%12*10).
    const hourMod = new Date().getHours() % 12;
    if (hourMod !== lastHourMod) rebuildStars();

    for (const s of stars) {
      s.x += s.vx;
      s.y += Math.sin(t * 0.15 + s.phase) * 0.02; // super subtle drift
      s.rot += s.rotV;

      if (s.x > w + 40) {
        s.x = -40;
        s.y = rand(0, Math.max(1, h - 10));
      }

      const twinkle = 0.55 + 0.45 * Math.sin(t * s.tw + s.phase);
      const alpha = Math.min(0.95, s.baseAlpha * twinkle);

      drawFourPointStar(s.x, s.y, s.size, s.rot, s.color, alpha);
    }

    // Update + draw click-created stars (same behavior/params as background stars).
    for (let i = clickStars.length - 1; i >= 0; i--) {
      const s = clickStars[i];
      s.x += s.vx;
      s.y += Math.sin(t * 0.15 + s.phase) * 0.02;
      s.rot += s.rotV;

      const twinkle = 0.55 + 0.45 * Math.sin(t * s.tw + s.phase);
      const alpha = Math.min(0.95, s.baseAlpha * twinkle);
      drawFourPointStar(s.x, s.y, s.size, s.rot, s.color, alpha);

      // Remove once it leaves the screen.
      if (s.x > w + 60) {
        clickStars.splice(i, 1);
      }
    }

    rafId = requestAnimationFrame(animate);
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);

    if (!enabled) {
      // Stop drawing and remove interactivity.
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      window.removeEventListener("click", onClick);

      clickStars.length = 0;
      ctx.clearRect(0, 0, w, h);
      canvas.style.display = "none";
      return;
    }

    // Re-enable
    canvas.style.display = "block";
    window.addEventListener("click", onClick, { passive: true });
    rebuildStars();
    lastT = performance.now();
    rafId = requestAnimationFrame(animate);
  }

  // Expose a tiny controller for the nav toggle.
  window.__starsBg = {
    isEnabled: () => enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
  };

  rebuildStars();
  rafId = requestAnimationFrame(animate);
})();

