const CONTEXT_URL = "world-atlas-context.json";

const state = {
  context: null,
  zoneId: "zone-01",
  relationId: "relation-01",
};

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

function getImagePlan({ zoneId = state.zoneId, relationId = state.relationId } = {}) {
  const zone = zoneById(zoneId);
  const relation = relationById(relationId);
  if (!zone) return notFound(zoneId);
  if (!relation) return notFound(relationId);

  const zoneSlots = state.context.zones.map((item) => ({
    slot: `zone-selector-${item.number}`,
    zoneId: item.id,
    src: item.image.src,
    alt: item.image.alt,
  }));
  const endpointSlots = relation.zoneIds.map((endpointId, index) => {
    const endpoint = zoneById(endpointId);
    return {
      slot: `relation-endpoint-${index + 1}`,
      zoneId: endpoint.id,
      src: endpoint.image.src,
      alt: endpoint.image.alt,
    };
  });

  return copy({
    slots: [
      ...zoneSlots,
      { slot: "zone-detail", zoneId: zone.id, src: zone.image.src, alt: zone.image.alt },
      ...endpointSlots,
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

function renderZoneTabs() {
  const tablist = document.querySelector("[data-zone-tablist]");
  if (!tablist) return;
  tablist.innerHTML = state.context.zones.map((zone) => {
    const selected = zone.id === state.zoneId;
    return `
      <button class="plate-tab${selected ? " is-active" : ""}"
        id="tab-${escapeHtml(zone.id)}"
        type="button"
        role="tab"
        aria-selected="${selected}"
        aria-controls="zone-detail"
        tabindex="${selected ? "0" : "-1"}"
        data-zone-id="${escapeHtml(zone.id)}">
        <img src="${escapeHtml(zone.image.src)}" alt="${escapeHtml(zone.image.alt)}">
        <span><b>${escapeHtml(zone.number)}</b> ${escapeHtml(zone.shortLabel)}</span>
      </button>`;
  }).join("");
  bindTablist(tablist, "zone", state.context.zones.map((zone) => zone.id));
}

function renderZonePanel() {
  const zone = zoneById(state.zoneId);
  const panel = document.querySelector("[data-zone-panel]");
  if (!zone || !panel) return;
  panel.dataset.zoneId = zone.id;
  panel.setAttribute("aria-labelledby", `tab-${zone.id}`);
  panel.innerHTML = `
    <figure class="focus-visual">
      <img src="${escapeHtml(zone.image.src)}" alt="${escapeHtml(zone.image.alt)}">
    </figure>
    <div class="focus-number" aria-hidden="true">${escapeHtml(zone.number)}</div>
    <div class="focus-copy">
      <p class="state-label observed">${escapeHtml(state.context.labels.observed)}</p>
      <h3>${escapeHtml(zone.title)}</h3>
      <p>${escapeHtml(zone.observed)}</p>
    </div>
    <div class="focus-question">
      <p class="state-label reading">${escapeHtml(state.context.labels.reading)}</p>
      <p>${escapeHtml(zone.readingProposal)}</p>
      <p class="zone-question">${escapeHtml(zone.question)}</p>
      <a href="${escapeHtml(zone.publicSource.url)}">${escapeHtml(zone.publicSource.label)}<span class="visually-hidden">: ${escapeHtml(zone.title)}</span></a>
    </div>`;
}

function renderZoneList() {
  const target = document.querySelector("[data-zone-list]");
  if (!target) return;
  const accents = ["orange", "green", "blue", "ochre", "lavender"];
  target.innerHTML = state.context.zones.map((zone, index) => `
    <article class="zone-row accent-${accents[index]}">
      <p class="zone-no">${escapeHtml(zone.number)}</p>
      <div><p class="zone-kicker">${escapeHtml(zone.kicker)}</p><h3>${escapeHtml(zone.publicLabel)}</h3></div>
      <p>${escapeHtml(zone.question)}</p>
    </article>`).join("");
}

function renderObjects() {
  const target = document.querySelector("[data-object-list]");
  if (!target) return;
  const glyphs = ["frame", "disc", "line", "person", "archive", "steps"];
  target.innerHTML = state.context.objects.map((item, index) => `
    <article>
      <span class="object-glyph ${glyphs[index]}" aria-hidden="true"></span>
      <p class="state-label observed">${escapeHtml(state.context.labels.observed)}</p>
      <h3>${escapeHtml(item.label)}</h3>
      <p>${escapeHtml(item.observed)}</p>
      <p class="object-reading"><b>${escapeHtml(state.context.labels.reading)}</b> ${escapeHtml(item.readingProposal)}</p>
    </article>`).join("");
}

function renderMaterials() {
  const target = document.querySelector("[data-material-list]");
  if (!target) return;
  const accents = ["orange", "green", "blue", "ochre", "lavender"];
  target.innerHTML = state.context.materials.map((item, index) => `
    <article class="swatch ${accents[index]}">
      <span aria-hidden="true"></span>
      <p><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.observed)}</small></p>
    </article>`).join("");
}

function renderRelationTabs() {
  const tablist = document.querySelector("[data-relation-tablist]");
  if (!tablist) return;
  tablist.innerHTML = state.context.relations.map((relation, index) => {
    const selected = relation.id === state.relationId;
    return `
      <button class="relation-tab${selected ? " is-active" : ""}"
        id="tab-${escapeHtml(relation.id)}"
        type="button"
        role="tab"
        aria-label="${escapeHtml(relation.accessibleName)}"
        aria-selected="${selected}"
        aria-controls="relation-detail"
        tabindex="${selected ? "0" : "-1"}"
        data-relation-id="${escapeHtml(relation.id)}">
        <span class="relation-order">${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(relation.selectorLabel)}</strong>
        <span>${escapeHtml(relation.sharedQuestion)}</span>
        <em>${escapeHtml(state.context.labels.notConfirmed)}</em>
      </button>`;
  }).join("");
  bindTablist(tablist, "relation", state.context.relations.map((relation) => relation.id));
}

function renderRelationPanel() {
  const relation = relationById(state.relationId);
  const panel = document.querySelector("[data-relation-panel]");
  if (!relation || !panel) return;
  const endpoints = relation.zoneIds.map((id) => zoneById(id));
  panel.dataset.relationId = relation.id;
  panel.setAttribute("aria-labelledby", `tab-${relation.id}`);
  panel.innerHTML = `
    <header>
      <p class="eyebrow">EDITORIAL RELATIONSHIP · NOT FINAL</p>
      <h3>${escapeHtml(relation.title)}</h3>
      <p>${escapeHtml(relation.sharedQuestion)}</p>
      <p class="relation-display-note">좌우는 비교를 위한 배치입니다. 출발과 도착, 높고 낮음, 가까움과 멂을 나타내지 않습니다.</p>
    </header>
    ${endpoints.map((zone) => `
      <figure data-relation-endpoint data-zone-id="${escapeHtml(zone.id)}">
        <img src="${escapeHtml(zone.image.src)}" alt="${escapeHtml(zone.image.alt)}">
        <figcaption><b>${escapeHtml(zone.number)}</b> ${escapeHtml(zone.publicLabel)}</figcaption>
      </figure>`).join("")}
    <div class="relation-reading observed-block">
      <p class="state-label observed">${escapeHtml(state.context.labels.observed)}</p>
      <p>${escapeHtml(relation.observedDifference)}</p>
    </div>
    <div class="relation-reading candidate-block">
      <p class="state-label reading">${escapeHtml(state.context.labels.reading)} · ${escapeHtml(state.context.labels.notConfirmed)}</p>
      <p>${escapeHtml(relation.readingProposal)}</p>
    </div>`;
}

function renderBoundaries() {
  const target = document.querySelector("[data-boundary-list]");
  if (!target) return;
  target.innerHTML = state.context.boundaries.map((item, index) => `
    <article class="${index === 1 ? "future-state" : ""}" aria-label="${escapeHtml(item.title)} 상태, 링크 아님">
      <p class="boundary-status ${index === 0 ? "current" : "future"}">${index === 0 ? "공개 참고면" : "향후 경험 · 링크 아님"}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${index === 0 ? "구역, 시각 요소, 색과 표면, 관계 제안을 읽는 현재 참고면입니다." : escapeHtml(item.description)}</p>
      <code>${escapeHtml(item.pathText)}</code>
      <span class="non-link">${index === 0 ? "현재 참고면" : "링크 아님"}</span>
    </article>`).join("");
}

function bindTablist(tablist, kind, ids) {
  const selector = `[data-${kind}-id][role="tab"]`;
  tablist.querySelectorAll(selector).forEach((tab) => {
    tab.addEventListener("click", () => select(kind, tab.dataset[`${kind}Id`]));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = ids.indexOf(tab.dataset[`${kind}Id`]);
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % ids.length;
      if (event.key === "ArrowLeft") next = (current - 1 + ids.length) % ids.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = ids.length - 1;
      select(kind, ids[next]);
      tablist.querySelector(`[data-${kind}-id="${ids[next]}"]`).focus();
    });
  });
}

function select(kind, id) {
  if (kind === "zone" && zoneById(id)) {
    state.zoneId = id;
    renderZoneTabs();
    renderZonePanel();
  }
  if (kind === "relation" && relationById(id)) {
    state.relationId = id;
    renderRelationTabs();
    renderRelationPanel();
  }
}

function renderAll() {
  renderZoneTabs();
  renderZonePanel();
  renderZoneList();
  renderObjects();
  renderMaterials();
  renderRelationTabs();
  renderRelationPanel();
  renderBoundaries();
}

async function initialize() {
  try {
    const response = await fetch(CONTEXT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`context ${response.status}`);
    state.context = await response.json();
    installReadSurface();
    renderAll();
    document.body.setAttribute("data-world-atlas-ready", "true");
  } catch {
    const notice = document.querySelector("[data-load-state]");
    document.body.setAttribute("data-world-atlas-ready", "false");
    if (notice) {
      notice.textContent = "참고면을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.";
      notice.hidden = false;
    }
  }
}

initialize();
