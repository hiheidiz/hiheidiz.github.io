(() => {
  "use strict";

  const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

  function probeImageUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(ok);
      };
      const t = window.setTimeout(() => finish(false), 4000);
      img.onload = () => {
        window.clearTimeout(t);
        finish(true);
      };
      img.onerror = () => {
        window.clearTimeout(t);
        finish(false);
      };
      img.src = url;
    });
  }

  async function resolveSlideUrl(projectId, n) {
    for (const ext of IMAGE_EXT) {
      const url = `artprojects/${projectId}/${n}.${ext}`;
      /* eslint-disable no-await-in-loop */
      if (await probeImageUrl(url)) return url;
    }
    return null;
  }

  async function collectSlides(projectId) {
    const slides = [];
    for (let n = 1; n <= 48; n++) {
      /* eslint-disable no-await-in-loop */
      const url = await resolveSlideUrl(projectId, n);
      if (!url) break;
      slides.push(url);
    }
    return slides;
  }

  function parseCaptionLines(text) {
    if (!text || !String(text).trim()) return [];
    return String(text).replace(/\r\n/g, "\n").split("\n");
  }

  /** First `#` / `##` / `###` line becomes the centered title; remainder is body copy. */
  function splitMarkdownTitle(markdown) {
    const normalized = String(markdown).replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    let headingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*#{1,3}\s+\S/.test(lines[i])) {
        headingIdx = i;
        break;
      }
    }
    if (headingIdx === -1) {
      return { titleMd: null, bodyMd: normalized };
    }
    const titleLine = lines[headingIdx].trim();
    const titleText = titleLine.replace(/^\s*#{1,3}\s+/, "");
    const before = lines.slice(0, headingIdx).join("\n").trimEnd();
    const after = lines.slice(headingIdx + 1).join("\n").replace(/^\n+/, "");
    const bodyParts = [];
    if (before) bodyParts.push(before);
    if (after) bodyParts.push(after);
    // Force the modal title to render as an `h1` for the same “big heading”
    // feel as SciOly windows.
    return { titleMd: `# ${titleText}`, bodyMd: bodyParts.join("\n\n") };
  }

  function buildSlideshowSlide(slides, captions) {
    let idx = 0;

    function render() {
      const url = slides[idx];
      const cap = captions[idx] != null ? captions[idx].trim() : "";
      img.src = url;
      img.alt = cap || `Slide ${idx + 1}`;
      captionEl.textContent = cap;
      captionEl.hidden = !cap;
      counterEl.textContent = slides.length ? `${idx + 1} / ${slides.length}` : "";
      prevBtn.disabled = idx <= 0;
      nextBtn.disabled = idx >= slides.length - 1;
    }

    const wrap = document.createElement("div");
    wrap.className = "art-project-slideshow";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Project images");

    const frame = document.createElement("div");
    frame.className = "art-project-slideshow__frame";

    const img = document.createElement("img");
    img.className = "art-project-slideshow__img";
    img.draggable = false;
    frame.appendChild(img);

    const captionEl = document.createElement("p");
    captionEl.className = "art-project-slideshow__caption";

    const nav = document.createElement("div");
    nav.className = "art-project-slideshow__nav";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "art-project-slideshow__btn";
    prevBtn.textContent = "←";
    prevBtn.setAttribute("aria-label", "Previous image");

    const counterEl = document.createElement("span");
    counterEl.className = "art-project-slideshow__counter";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "art-project-slideshow__btn";
    nextBtn.textContent = "→";
    nextBtn.setAttribute("aria-label", "Next image");

    prevBtn.addEventListener("click", () => {
      if (idx > 0) {
        idx -= 1;
        render();
      }
    });
    nextBtn.addEventListener("click", () => {
      if (idx < slides.length - 1) {
        idx += 1;
        render();
      }
    });

    nav.append(prevBtn, counterEl, nextBtn);
    wrap.append(frame, captionEl, nav);

    render();

    window.__artSlideshow = {
      prev: () => {
        if (idx > 0) {
          idx -= 1;
          render();
        }
      },
      next: () => {
        if (idx < slides.length - 1) {
          idx += 1;
          render();
        }
      },
    };

    return wrap;
  }

  async function loadArtProjectContent(projectId, contentEl) {
    const renderMd = window.__app?.renderSimpleMarkdown;
    const base = `artprojects/${projectId}`;

    const [mdRes, capRes, slides] = await Promise.all([
      fetch(`${base}/text.md`, { cache: "no-cache" }),
      fetch(`${base}/captions.txt`, { cache: "no-cache" }),
      collectSlides(projectId),
    ]);

    const markdown = mdRes.ok ? await mdRes.text() : "";
    const capText = capRes.ok ? await capRes.text() : "";
    const captions = parseCaptionLines(capText);

    const root = document.createElement("div");
    root.className = "art-project-modal";

    const cols = document.createElement("div");
    cols.className = "art-project-modal__cols";

    const textCol = document.createElement("div");
    textCol.className = "art-project-modal__text";
    const mdWrap = document.createElement("div");
    mdWrap.className = "scioly-window art-project-modal__markdown";

    if (markdown.trim() && typeof renderMd === "function") {
      const { titleMd, bodyMd } = splitMarkdownTitle(markdown);
      if (titleMd) {
        const titleEl = document.createElement("div");
        titleEl.className = "art-project-modal__title scioly-window";
        titleEl.innerHTML = renderMd(titleMd);
        root.appendChild(titleEl);
      }
      if (bodyMd.trim()) {
        mdWrap.innerHTML = renderMd(bodyMd);
      }
    } else if (markdown.trim()) {
      mdWrap.innerHTML = `<p>${markdown.replace(/</g, "&lt;")}</p>`;
    } else if (typeof renderMd === "function") {
      const stub = "## No text yet\n\nAdd **text.md** in this project folder.";
      const { titleMd, bodyMd } = splitMarkdownTitle(stub);
      const titleEl = document.createElement("div");
      titleEl.className = "art-project-modal__title scioly-window";
      titleEl.innerHTML = renderMd(titleMd);
      root.appendChild(titleEl);
      mdWrap.innerHTML = renderMd(bodyMd);
    } else {
      mdWrap.innerHTML =
        "<h2>No text yet</h2><p>Add <strong>text.md</strong> in this project folder.</p>";
    }
    textCol.appendChild(mdWrap);

    const galleryCol = document.createElement("div");
    galleryCol.className = "art-project-modal__gallery";

    if (slides.length) {
      galleryCol.appendChild(buildSlideshowSlide(slides, captions));
    } else {
      const empty = document.createElement("div");
      empty.className = "art-project-slideshow art-project-slideshow--empty";
      empty.innerHTML =
        "<p>Add numbered images <code>1.jpg</code>, <code>2.jpg</code>, … (or .png / .webp) in this folder. Optional <code>captions.txt</code>: one caption per line matching slide order.</p>";
      galleryCol.appendChild(empty);
      window.__artSlideshow = null;
    }

    cols.append(textCol, galleryCol);
    root.appendChild(cols);
    contentEl.innerHTML = "";
    contentEl.appendChild(root);
  }

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
      if (document.getElementById("art-modal-overlay")?.classList.contains("is-open")) return;
      if (e.repeat) {
        /* */
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
      if (document.getElementById("art-modal-overlay")?.classList.contains("is-open")) return;
      if (e.key === "ArrowLeft" && heldDir === +1) stopKeySpin();
      if (e.key === "ArrowRight" && heldDir === -1) stopKeySpin();
    });

    viewport.addEventListener("blur", stopKeySpin);

    let dragDistance = 0;
    viewport.addEventListener(
      "pointerdown",
      () => {
        dragDistance = 0;
      },
      true
    );
    viewport.addEventListener(
      "pointermove",
      () => {
        dragDistance++;
      },
      true
    );

    viewport.addEventListener("click", (e) => {
      if (dragDistance > 3) return;
      const trigger = e.target instanceof Element && e.target.closest("[data-open-modal]");
      if (!trigger) return;

      const projectId = trigger.getAttribute("data-open-modal");
      if (!projectId) return;

      const modal = document.getElementById("art-modal-overlay");
      if (!modal) return;

      items.forEach((it) => it.classList.remove("is-glowing"));
      trigger.classList.add("is-glowing");

      const contentEl = modal.querySelector(".art-modal-content");
      if (contentEl) {
        contentEl.innerHTML =
          "<p style='text-align:center;padding:2rem;color:var(--muted)'>Loading…</p>";
      }

      modal.style.setProperty("--animate-duration", "0.5s");
      modal.classList.add("is-open", "animate__animated", "animate__fadeIn");
      modal.classList.remove("animate__fadeOut");
      modal.setAttribute("aria-hidden", "false");

      if (contentEl) {
        loadArtProjectContent(projectId, contentEl).catch(() => {
          contentEl.innerHTML =
            "<p style='text-align:center;padding:2rem;color:#f87171'>Failed to load project.</p>";
        });
      }
    });

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

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("art-modal-overlay");
    if (!modal?.classList.contains("is-open")) return;
    const api = window.__artSlideshow;
    if (!api) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      api.prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      api.next();
    }
  });

  window.__art = window.__art || {};
  window.__art.initArtCarousel = initArtCarousel;
})();
