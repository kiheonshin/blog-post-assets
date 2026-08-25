#!/usr/bin/env node
/**
 * 라우팅 계약 검사 — 슬래시 정규화와 프록시 깊이를 함께 본다.
 *
 * 왜 있나 : 이 사이트는 도메인을 옮기며 두 번 조용히 깨졌다.
 *   ① GitHub Pages 가 붙여 주던 슬래시를 Vercel 은 안 붙여, 페이지 전용 CSS 가 404
 *   ② 그걸 고치려 trailingSlash 를 켜자 프록시된 유니버스 뷰의 경로가 한 단계 깊어져
 *      데이터가 404 — 화면은 200 이라 눈에 안 띄었다
 *
 * 그래서 200 을 성공으로 치지 않는다. 페이지를 연 뒤 그 페이지가 실제로 부르는
 * 상대 자산까지 따라가 확인한다.
 *
 * 사용 : node tests/check-routing.mjs [https://kiheon.com]
 */
const BASE = process.argv[2] || "https://kiheon.com";

const PAGES = [
  "/", "/archive", "/archive/world-atlas", "/archive/chronicle",
  "/series/metaverse-era", "/series/metaverse-era/posts/01-no-money-talk",
];
// 프록시 뒤 유니버스 뷰 — 화면과 투영 데이터를 함께 본다
const UNIVERSE_VIEWS = ["/universe", "/universe/ontology", "/universe/graph", "/universe/identity"];
// 프록시가 넓히면 안 되는 것 — 비공개 자산은 뒤에서도 닫혀 있어야 한다
const MUST_STAY_CLOSED = [
  "/universe/identity-dashboard/", "/universe/status-projection.json",
  "/universe/observatory-data.json", "/universe/build_observatory.py",
];

const failures = [];
const note = (msg) => failures.push(msg);

async function get(url) {
  const res = await fetch(url, { redirect: "follow" });
  return { status: res.status, finalUrl: res.url, text: await res.text() };
}

async function checkSlashNormalises(path) {
  const { status, finalUrl } = await get(BASE + path);
  if (status !== 200) return note(`${path} → HTTP ${status}`);
  if (path !== "/" && !finalUrl.endsWith("/") && !/\.[a-z0-9]+$/i.test(finalUrl)) {
    note(`${path} → 슬래시로 정규화되지 않음 (${finalUrl})`);
  }
}

async function checkRelativeAssets(path) {
  const { status, finalUrl, text } = await get(BASE + path);
  if (status !== 200) return note(`${path} → HTTP ${status}`);
  const refs = [...text.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => !/^(https?:|\/|#|data:|mailto:|javascript:)/.test(h))
    .filter((h) => !h.includes("' + "))   // JS 템플릿 조각은 자산이 아니다
    .slice(0, 6);
  for (const ref of refs) {
    const url = new URL(ref, finalUrl).href;
    const res = await fetch(url);
    if (!res.ok) note(`${path} → 자산 ${ref} 가 ${res.status} (${url})`);
  }
}

async function checkUniverseData(view) {
  const { status, finalUrl } = await get(BASE + view);
  if (status !== 200) return note(`${view} → HTTP ${status}`);
  // 투영 데이터가 뷰 깊이와 무관하게 잡혀야 한다
  const dataUrl = new URL("nodes-data.js", finalUrl).href;
  const res = await fetch(dataUrl);
  if (!res.ok) return note(`${view} → 투영 데이터 ${res.status} (${dataUrl})`);
  const body = await res.text();
  if (!body.includes("ONTOLOGY_PROJECTION")) note(`${view} → 투영 데이터 내용이 아님`);
}

async function checkStaysClosed(path) {
  const res = await fetch(BASE + path, { redirect: "follow" });
  if (res.ok) note(`★ ${path} 가 열려 있다 — 프록시가 공개 범위를 넓혔다`);
}

const run = async () => {
  for (const p of PAGES) { await checkSlashNormalises(p); await checkRelativeAssets(p); }
  for (const v of UNIVERSE_VIEWS) await checkUniverseData(v);
  for (const p of MUST_STAY_CLOSED) await checkStaysClosed(p);

  if (failures.length) {
    console.error(`✗ 라우팅 계약 위반 ${failures.length}건`);
    for (const f of failures) console.error(`  · ${f}`);
    process.exit(1);
  }
  console.log(`✔ 라우팅 계약 통과 — 페이지 ${PAGES.length} · 유니버스 뷰 ${UNIVERSE_VIEWS.length} · 비공개 ${MUST_STAY_CLOSED.length}`);
};
run();
