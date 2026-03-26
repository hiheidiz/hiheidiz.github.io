(() => {
  "use strict";

  const tabButtons = Array.from(document.querySelectorAll('[role="tab"][data-target]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"][id]'));

  const panelById = new Map(panels.map((p) => [p.id, p]));

  /** Preserve per-panel scroll position for a nice “instant switch” feel. */
  const scrollPositions = new Map();

  function replayMusicTitleAnimation() {
    const title = document.querySelector("[data-music-title]");
    if (!title) return;
    title.classList.remove("animate__animated", "animate__zoomIn");
    // Force reflow so Animate.css can restart the same animation class.
    void title.offsetWidth;
    title.classList.add("animate__animated", "animate__zoomIn");
  }

  function setActive(targetId, { updateHash } = { updateHash: true }) {
    const nextPanel = panelById.get(targetId);
    if (!nextPanel) return;

    for (const panel of panels) {
      if (panel === nextPanel) continue;
      scrollPositions.set(panel.id, panel.scrollTop);
      panel.classList.remove("is-active");
      panel.setAttribute("aria-hidden", "true");
    }

    // Activate next
    for (const tab of tabButtons) {
      const isThis = tab.dataset.target === targetId;
      tab.classList.toggle("is-active", isThis);
      tab.setAttribute("aria-selected", String(isThis));
      tab.tabIndex = isThis ? 0 : -1;
    }

    // Show/animate panel without removing it from DOM
    for (const panel of panels) {
      if (panel.id === targetId) {
        panel.classList.add("is-active");
        panel.setAttribute("aria-hidden", "false");
        const prev = scrollPositions.get(panel.id) ?? 0;
        // Restore scroll immediately; panel is visible at this point.
        panel.scrollTop = prev;
      } else {
        panel.classList.remove("is-active");
      }
    }

    if (updateHash) {
      const newHash = `#${targetId}`;
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }

    if (targetId === "music") {
      replayMusicTitleAnimation();
      // In case music HTML is still being injected asynchronously.
      setTimeout(replayMusicTitleAnimation, 60);
    }
  }

  // Initialize aria-hidden
  for (const panel of panels) {
    const isActive = panel.classList.contains("is-active");
    panel.setAttribute("aria-hidden", isActive ? "false" : "true");
  }

  function getInitialTarget() {
    const hash = (location.hash || "").replace(/^#/, "");
    if (!hash) return "home";
    if (panelById.has(hash)) return hash;
    return "home";
  }

  // Handle tab clicks
  tabButtons.forEach((tab) => {
    tab.addEventListener("click", () => setActive(tab.dataset.target, { updateHash: true }));
  });

  // Keyboard: left/right to cycle between tabs
  tabButtons.forEach((tab, idx) => {
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = (idx + dir + tabButtons.length) % tabButtons.length;
      tabButtons[next].focus();
      setActive(tabButtons[next].dataset.target, { updateHash: true });
    });
  });

  // Route from hash on load
  const initial = getInitialTarget();
  setActive(initial, { updateHash: false });

  // Toggle star background on/off
  const starsToggle = document.getElementById("stars-toggle");
  if (starsToggle) {
    const syncLabel = () => {
      const enabled = Boolean(window.__starsBg?.isEnabled?.());
      starsToggle.setAttribute("aria-pressed", String(enabled));
      starsToggle.textContent = "✧";
      starsToggle.setAttribute(
        "aria-label",
        enabled ? "Disable stars background" : "Enable stars background"
      );
    };

    syncLabel();

    starsToggle.addEventListener("click", () => {
      window.__starsBg?.toggle?.();
      syncLabel();
    });
  }

  // Delegated handler: ensures the dropdown works even if the music section
  // is injected after initial page load.
  document.addEventListener("change", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const select = target?.closest?.("[data-audio-select]");
    if (!select) return;

    const picker = select.closest(".music-audio-picker") || document;
    const player = picker.querySelector("[data-audio-player]");
    if (!player) return;

    if (!player.dataset.audioDebugAttached) {
      player.dataset.audioDebugAttached = "1";
      player.addEventListener("error", () => {
        console.log("Audio error:", player.error, "src:", player.src);
      });
    }

    const src = select.value;
    if (!src) {
      player.removeAttribute("src");
      player.load();
      return;
    }

    player.src = src;
    player.load();
    player.currentTime = 0;
    player.play().catch(() => {
      // If the browser blocks autoplay, user can press play manually.
    });
  });

  async function loadHtmlIncludes() {
    const nodes = Array.from(document.querySelectorAll("[data-include-html]"));
    await Promise.all(
      nodes.map(async (el) => {
        const url = el.getAttribute("data-include-html");
        if (!url) return;
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) return;
        el.innerHTML = await res.text();
        // Run any section initializers after injection.
        if (el.id === "art") {
          window.__art?.initArtCarousel?.();
        }
        // Music audio picker is handled by delegated JS above.
      })
    );
  }

  loadHtmlIncludes();

  // --- Art modal: open / close via delegated clicks ---
  const artModal = document.getElementById("art-modal-overlay");

  function openArtModal() {
    if (!artModal) return;
    artModal.style.setProperty("--animate-duration", "0.5s");
    artModal.classList.add("is-open", "animate__animated", "animate__fadeIn");
    artModal.classList.remove("animate__fadeOut");
    artModal.setAttribute("aria-hidden", "false");
  }

  function closeArtModal() {
    if (!artModal || !artModal.classList.contains("is-open")) return;
    artModal.style.setProperty("--animate-duration", "0.5s");
    artModal.classList.remove("animate__fadeIn");
    artModal.classList.add("animate__fadeOut");
    artModal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      artModal.classList.remove("is-open", "animate__animated", "animate__fadeOut");
    }, 110);
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target instanceof Element && e.target.closest("[data-open-modal]");
    if (trigger) {
      e.preventDefault();
      openArtModal();
      return;
    }

    if (artModal && artModal.classList.contains("is-open")) {
      const clickedInside = e.target instanceof Element && e.target.closest(".art-modal-dialog");
      if (!clickedInside) closeArtModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeArtModal();
  });
})();

