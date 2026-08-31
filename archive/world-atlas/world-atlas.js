const CONTEXT_URL = "world-atlas-context.json";

const state = {
  context: null,
  zoneId: null,
  relationId: null,
  dialogReturnFocus: null,
};

const icons = Object.freeze({
  arrowRight: `<svg class="interface-icon" data-icon="arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`,
  arrowBack: `<svg class="interface-icon interface-icon--back" data-icon="arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>`,
  external: `<svg class="interface-icon" data-icon="external-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 5h5v5"></path><path d="m12 12 7-7"></path><path d="M19 13v6H5V5h6"></path></svg>`,
});

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function notFound(requestedId) {
  return { error: "not-found", requestedId };
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function zoneById(id) {
  return findById(state.context.zones, id);
}

function relationById(id) {
  return findById(state.context.relations, id);
}

function list(type) {
  const allowed = ["zones", "objects", "materials", "relations", "boundaries"];
  if (!allowed.includes(type)) return notFound(type);
  return copy(state.context[type]);
}

function getZone(zoneId) {
  const zone = zoneById(zoneId);
  return zone ? copy(zone) : notFound(zoneId);
}

function getRelation(relationId) {
  const relation = relationById(relationId);
  return relation ? copy(relation) : notFound(relationId);
}

function getSelectedContext({ kind, id } = {}) {
  if (kind === "zone") {
    const zone = zoneById(id);
    if (!zone) return notFound(id);
    return copy({
      kind,
      id: zone.id,
      title: zone.title,
      labels: state.context.labels,
      observed: zone.observed,
      readingProposal: zone.readingProposal,
      purpose: zone.purpose,
      question: zone.question,
      publicSource: zone.publicSource,
    });
  }

  if (kind === "relation") {
    const relation = relationById(id);
    if (!relation) return notFound(id);
    return copy({
      kind,
      id: relation.id,
      title: relation.title,
      labels: state.context.labels,
      observed: relation.observedDifference,
      readingProposal: relation.readingProposal,
      status: relation.status,
      zoneIds: relation.zoneIds,
      sharedQuestion: relation.sharedQuestion,
      observedDifference: relation.observedDifference,
    });
  }

  return notFound(id ?? kind);
}

function getImagePlan({ zoneId = state.zoneId } = {}) {
  const zone = zoneById(zoneId);
  if (!zone) return notFound(zoneId);

  const zoneSlots = state.context.zones.map((item) => ({
    slot: `zone-selector-${item.number}`,
    zoneId: item.id,
    src: item.image.src,
    alt: item.image.alt,
  }));

  return copy({
    slots: [
      ...zoneSlots,
      { slot: "zone-detail", zoneId: zone.id, src: zone.image.src, alt: zone.image.alt },
    ],
    uniqueAssets: state.context.zones.map((item) => item.image.src),
  });
}

function installReadSurface() {
  window.worldAtlasRead = Object.freeze({
    list,
    getZone,
    getRelation,
    getSelectedContext,
    getImagePlan,
  });
}

function validateContext(context) {
  const collections = ["zones", "objects", "materials", "relations", "boundaries"];
  if (!context || collections.some((key) => !Array.isArray(context[key]))) {
    throw new Error("Outside context collections are incomplete");
  }
  if (context.zones.length === 0 || context.relations.length === 0) {
    throw new Error("Outside requires at least one zone and relation");
  }
  const zoneIds = new Set(context.zones.map((zone) => zone.id));
  if (zoneIds.size !== context.zones.length) {
    throw new Error("Outside zone ids must be unique");
  }
  if (context.relations.some((relation) => relation.zoneIds.some((id) => !zoneIds.has(id)))) {
    throw new Error("Outside relation references an unknown zone");
  }
}

function renderCounts() {
  document.querySelector("[data-zone-count]").textContent = String(state.context.zones.length).padStart(2, "0");
  const evidenceCount = state.context.objects.length + state.context.materials.length;
  document.querySelector("[data-evidence-count]").textContent = String(evidenceCount).padStart(2, "0");
  document.querySelector("[data-zone-range]").textContent = `${state.context.zones.length}개 구역`;
}

function renderSharedSeam() {
  const seam = state.context.sharedSeam;
  const target = document.querySelector("[data-shared-seam]");
  if (!seam || !target) return;
  const sides = target.querySelectorAll(".shared-seam__side");
  sides[0].querySelector("h2").textContent = seam.outside.name;
  sides[0].querySelector("span").textContent = seam.outside.role;
  sides[1].querySelector("h2").textContent = seam.inside.name;
  sides[1].querySelector("span").textContent = `${seam.inside.role} · ${seam.inside.accessLabel}`;
  target.querySelector(".shared-seam__boundary p").textContent = seam.boundaryCopy;
}

function renderZoneTabs() {
  const tablist = document.querySelector("[data-zone-tablist]");
  tablist.innerHTML = state.context.zones.map((zone, index) => {
    const selected = zone.id === state.zoneId;
    return `<button class="zone-tab" type="button" role="tab"
      id="tab-${escapeHtml(zone.id)}"
      aria-selected="${selected}"
      aria-controls="zone-detail"
      tabindex="${selected ? "0" : "-1"}"
      data-zone-id="${escapeHtml(zone.id)}">
      <img src="${escapeHtml(zone.image.src)}" alt="" width="1600" height="800" loading="${index < 3 ? "eager" : "lazy"}" decoding="async">
      <span class="zone-tab__copy">
        <span class="zone-tab__number">${escapeHtml(zone.number)} · ${escapeHtml(zone.shortLabel)}</span>
        <strong>${escapeHtml(zone.publicLabel)}</strong>
        <small>${escapeHtml(zone.title)}</small>
      </span>
    </button>`;
  }).join("");
  bindTablist(tablist, "zone", state.context.zones.map((zone) => zone.id));
}

function renderZonePanel() {
  const zone = zoneById(state.zoneId);
  const panel = document.querySelector("[data-zone-panel]");
  if (!zone || !panel) return;
  const index = state.context.zones.findIndex((item) => item.id === zone.id);
  const previous = state.context.zones[(index - 1 + state.context.zones.length) % state.context.zones.length];
  const next = state.context.zones[(index + 1) % state.context.zones.length];
  const labels = state.context.labels;

  panel.dataset.zoneId = zone.id;
  panel.setAttribute("aria-labelledby", `tab-${zone.id}`);
  panel.innerHTML = `
    <header class="zone-stage__head">
      <div>
        <p class="zone-stage__kicker">${escapeHtml(zone.number)} · ${escapeHtml(zone.kicker)}</p>
        <h3>${escapeHtml(zone.title)}</h3>
        <p>${escapeHtml(zone.purpose)}</p>
      </div>
      <p class="zone-stage__count">${String(index + 1).padStart(2, "0")} / ${String(state.context.zones.length).padStart(2, "0")}</p>
    </header>
    <figure class="zone-visual">
      <button class="image-open" type="button"
        data-open-image
        data-image-src="${escapeHtml(zone.image.src)}"
        data-image-alt="${escapeHtml(zone.image.alt)}"
        data-image-title="${escapeHtml(zone.title)}"
        data-image-caption="${escapeHtml(zone.observed)}"
        aria-label="${escapeHtml(zone.title)} 장면 전체 보기">
        <img src="${escapeHtml(zone.image.src)}" alt="${escapeHtml(zone.image.alt)}" width="1600" height="800" loading="eager" decoding="async">
        <span class="image-open__label">전체 보기</span>
      </button>
      <figcaption>${escapeHtml(zone.image.alt)}</figcaption>
    </figure>
    <div class="zone-stage__reading">
      <section class="reading-block reading-block--question">
        <p class="reading-label">질문</p>
        <p>${escapeHtml(zone.question)}</p>
      </section>
      <section class="reading-block">
        <p class="reading-label reading-label--observed">${escapeHtml(labels.observed)}</p>
        <p>${escapeHtml(zone.observed)}</p>
      </section>
      <section class="reading-block">
        <p class="reading-label reading-label--proposal">${escapeHtml(labels.reading)}</p>
        <p>${escapeHtml(zone.readingProposal)}</p>
      </section>
    </div>
    <nav class="zone-stage__actions" aria-label="구역 이동과 공개 출처">
      <button class="zone-step" type="button" data-zone-step="${escapeHtml(previous.id)}">${icons.arrowBack}<span>이전 구역</span></button>
      <a class="public-source-link" href="${escapeHtml(zone.publicSource.url)}" target="_blank" rel="noopener"><span>${escapeHtml(zone.publicSource.label)}</span>${icons.external}</a>
      <button class="zone-step" type="button" data-zone-step="${escapeHtml(next.id)}"><span>다음 구역</span>${icons.arrowRight}</button>
    </nav>`;
}

function renderObjects() {
  const target = document.querySelector("[data-object-list]");
  target.innerHTML = state.context.objects.map((item) => {
    const current = item.zoneIds.includes(state.zoneId);
    const tags = item.zoneIds.map((id) => zoneById(id)).filter(Boolean).map((zone) => `<span class="zone-tag">${escapeHtml(zone.number)}</span>`).join("");
    return `<article class="object-card${current ? " is-current" : ""}" data-object-id="${escapeHtml(item.id)}">
      <div><h4>${escapeHtml(item.label)}</h4><div class="zone-tags" aria-label="연결 구역">${tags}</div></div>
      <div><p>${escapeHtml(item.observed)}</p><p class="visually-hidden">${escapeHtml(item.readingProposal)}</p></div>
    </article>`;
  }).join("");
}

function renderMaterials() {
  const target = document.querySelector("[data-material-list]");
  target.innerHTML = state.context.materials.map((item) => {
    const zone = zoneById(item.zoneId);
    const current = item.zoneId === state.zoneId;
    return `<article class="material-card${current ? " is-current" : ""}" data-material-id="${escapeHtml(item.id)}">
      <div><div class="material-chip" aria-hidden="true"></div><h4>${escapeHtml(item.label)}</h4><div class="zone-tags"><span class="zone-tag">${escapeHtml(zone.number)}</span></div></div>
      <div><p>${escapeHtml(item.observed)}</p><p class="visually-hidden">${escapeHtml(item.screenRoleProposal)}</p></div>
    </article>`;
  }).join("");
}

function bindTablist(tablist, kind, ids) {
  const selector = `[data-${kind}-id][role="tab"]`;
  tablist.querySelectorAll(selector).forEach((tab) => {
    tab.addEventListener("click", () => select(kind, tab.dataset[`${kind}Id`], true));
    tab.addEventListener("keydown", (event) => {
      const current = ids.indexOf(tab.dataset[`${kind}Id`]);
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % ids.length;
      if (event.key === "ArrowLeft") next = (current - 1 + ids.length) % ids.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = ids.length - 1;
      if (next === current) return;
      event.preventDefault();
      select(kind, ids[next], true);
    });
  });
}

function select(kind, id, focusSelected = false) {
  if (kind === "zone" && zoneById(id)) {
    state.zoneId = id;
    renderZoneTabs();
    renderZonePanel();
    renderObjects();
    renderMaterials();
    if (focusSelected) {
      document.querySelector(`[data-zone-tablist] [data-zone-id="${id}"]`)?.focus();
    }
  }
}

function openImage(button) {
  const dialog = document.querySelector("[data-image-dialog]");
  state.dialogReturnFocus = button;
  dialog.querySelector("[data-dialog-image]").src = button.dataset.imageSrc;
  dialog.querySelector("[data-dialog-image]").alt = button.dataset.imageAlt;
  dialog.querySelector("[data-dialog-title]").textContent = button.dataset.imageTitle;
  dialog.querySelector("[data-dialog-caption]").textContent = button.dataset.imageCaption;
  dialog.showModal();
  dialog.querySelector("[data-dialog-close]").focus();
}

function installInteractionHandlers() {
  const dialog = document.querySelector("[data-image-dialog]");
  document.addEventListener("click", (event) => {
    const imageButton = event.target.closest("[data-open-image]");
    if (imageButton) openImage(imageButton);
    const zoneStep = event.target.closest("[data-zone-step]");
    if (zoneStep) select("zone", zoneStep.dataset.zoneStep, true);
  });
  dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    state.dialogReturnFocus?.focus();
    state.dialogReturnFocus = null;
  });
}

function renderAll() {
  renderCounts();
  renderSharedSeam();
  renderZoneTabs();
  renderZonePanel();
  renderObjects();
  renderMaterials();
}

async function initialize() {
  try {
    const response = await fetch(CONTEXT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`context ${response.status}`);
    const context = await response.json();
    validateContext(context);
    state.context = context;
    state.zoneId = context.zones[0].id;
    state.relationId = context.relations[0].id;
    installReadSurface();
    installInteractionHandlers();
    renderAll();
    document.body.setAttribute("data-world-atlas-ready", "true");
  } catch (error) {
    console.error("Outside context load failed", error);
    const notice = document.querySelector("[data-load-state]");
    document.body.setAttribute("data-world-atlas-ready", "false");
    if (notice) {
      notice.textContent = "참고면을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.";
      notice.hidden = false;
    }
  }
}

initialize();
