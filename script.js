(() => {
  "use strict";

  const tabButtons = Array.from(document.querySelectorAll('[role="tab"][data-target]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"][id]'));

  const panelById = new Map(panels.map((p) => [p.id, p]));

  /** Preserve per-panel scroll position for a nice “instant switch” feel. */
  const scrollPositions = new Map();

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
})();

