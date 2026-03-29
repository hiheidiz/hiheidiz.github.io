(() => {
  "use strict";

  function initSciolyDrag() {
    const minerals = document.querySelectorAll(".scioly-mineral");
    const container = document.querySelector(".scioly-inner");
    const targets = Array.from(document.querySelectorAll(".scioly-drop-target[data-drop]"));
    const timelineDots = document.querySelector(".scioly-timeline-dots");
    if (!minerals.length || !container || !targets.length || !timelineDots) return;

    let active = null;
    let offsetX = 0;
    let offsetY = 0;
    let previousSlot = null;
    const slotToMineral = new Map();

    const mineralImages = [
      { name: "talc", src: "scioly/mineralpics/talc.jpg" },
      // Gypsum is represented by this selenite image.
      { name: "gypsum", src: "scioly/mineralpics/selenite.jpg" },
      { name: "calcite", src: "scioly/mineralpics/calcite.jpg" },
      { name: "fluorite", src: "scioly/mineralpics/fluorite.jpg" },
      { name: "apatite", src: "scioly/mineralpics/apatite.jpg" },
      { name: "orthoclase", src: "scioly/mineralpics/orthoclase.jpg" },
      { name: "quartz", src: "scioly/mineralpics/quartz.jpg" },
      { name: "topaz", src: "scioly/mineralpics/topaz.png" },
      { name: "corundum", src: "scioly/mineralpics/corundum.jpg" },
      { name: "diamond", src: "scioly/mineralpics/diamond.jpg" },
    ];
    const expectedOrder = [
      "talc",
      "gypsum",
      "calcite",
      "fluorite",
      "apatite",
      "orthoclase",
      "quartz",
      "topaz",
      "corundum",
      "diamond",
    ];

    function mineralMatchesSlot(placed, expected) {
      return placed === expected || (expected === "gypsum" && placed === "selenite");
    }

    function updateSolvedState() {
      minerals.forEach((el) => el.classList.remove("is-wrong-slot"));

      let solved = true;
      const misplaced = [];

      for (let i = 0; i < expectedOrder.length; i++) {
        const slotId = String(i + 1);
        const mineralEl = slotToMineral.get(slotId);
        if (!mineralEl) {
          solved = false;
          continue;
        }
        const placed = mineralEl.dataset.mineral;
        const expected = expectedOrder[i];
        if (!mineralMatchesSlot(placed, expected)) {
          solved = false;
          misplaced.push(mineralEl);
        }
      }

      const allFilled = slotToMineral.size === expectedOrder.length;
      if (allFilled && !solved) {
        misplaced.forEach((el) => el.classList.add("is-wrong-slot"));
      }

      timelineDots.classList.toggle("is-solved", solved);
    }

    function shuffle(list) {
      const arr = [...list];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function renderMineralImages() {
      const randomized = shuffle(mineralImages);
      minerals.forEach((el, idx) => {
        const item = randomized[idx % randomized.length];
        el.dataset.mineral = item.name;
        el.innerHTML = `<img src="${item.src}" alt="${item.name}" draggable="false" />`;
      });
    }

    function getSlotId(targetEl) {
      return targetEl.getAttribute("data-drop");
    }

    function getTargetBySlotId(slotId) {
      return targets.find((t) => getSlotId(t) === slotId) || null;
    }

    function setSlotOccupied(slotId, occupied) {
      const target = getTargetBySlotId(slotId);
      if (!target) return;
      target.classList.toggle("is-occupied", Boolean(occupied));
    }

    function clearPositionStyles(el) {
      el.style.left = "";
      el.style.top = "";
      el.style.width = "";
      el.style.height = "";
    }

    function snapToSlot(el, slotId) {
      const targetEl = targets.find((t) => getSlotId(t) === slotId);
      if (!targetEl) return false;
      const rect = targetEl.getBoundingClientRect();

      el.classList.add("is-snapped");
      el.classList.remove("is-dragging");
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      el.dataset.snappedSlot = slotId;
      slotToMineral.set(slotId, el);
      setSlotOccupied(slotId, true);
      updateSolvedState();
      return true;
    }

    function releaseFromSlot(el) {
      const slotId = el.dataset.snappedSlot;
      if (!slotId) return;
      if (slotToMineral.get(slotId) === el) {
        slotToMineral.delete(slotId);
      }
      setSlotOccupied(slotId, false);
      delete el.dataset.snappedSlot;
      el.classList.remove("is-snapped");
      updateSolvedState();
    }

    function resetToTray(el) {
      el.classList.remove("is-dragging", "is-snapped");
      clearPositionStyles(el);
      delete el.dataset.snappedSlot;
      updateSolvedState();
    }

    function findBestDropTarget(el) {
      const SNAP_TOLERANCE = 24;
      const elRect = el.getBoundingClientRect();
      const elCx = elRect.left + elRect.width / 2;
      const elCy = elRect.top + elRect.height / 2;

      let best = null;
      let bestDist = Infinity;

      for (const target of targets) {
        const r = target.getBoundingClientRect();

        // Expanded bounds allow near misses to count.
        const inExpandedBounds =
          elCx >= r.left - SNAP_TOLERANCE &&
          elCx <= r.right + SNAP_TOLERANCE &&
          elCy >= r.top - SNAP_TOLERANCE &&
          elCy <= r.bottom + SNAP_TOLERANCE;

        if (!inExpandedBounds) continue;

        const tx = r.left + r.width / 2;
        const ty = r.top + r.height / 2;
        const dist = Math.hypot(elCx - tx, elCy - ty);
        if (dist < bestDist) {
          bestDist = dist;
          best = target;
        }
      }

      return best;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      const el = e.target.closest(".scioly-mineral");
      if (!el) return;

      active = el;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      previousSlot = el.dataset.snappedSlot || null;
      if (previousSlot) releaseFromSlot(el);

      el.classList.add("is-dragging");
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;

      container.classList.add("is-dragging-mineral");

      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!active) return;
      active.style.left = `${e.clientX - offsetX}px`;
      active.style.top = `${e.clientY - offsetY}px`;
    }

    function onPointerUp() {
      if (!active) return;
      const target = findBestDropTarget(active);
      const slotId = target ? getSlotId(target) : null;

      if (slotId && !slotToMineral.has(slotId)) {
        snapToSlot(active, slotId);
      } else {
        // If dropped outside any valid empty slot, return to tray (removes from line).
        resetToTray(active);
      }

      container.classList.remove("is-dragging-mineral");
      active = null;
      previousSlot = null;
    }

    renderMineralImages();

    document.addEventListener("pointerdown", (e) => {
      if (e.target instanceof Element && e.target.closest(".scioly-mineral")) {
        onPointerDown(e);
      }
    });
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  window.__scioly = window.__scioly || {};
  window.__scioly.initSciolyDrag = initSciolyDrag;
})();
