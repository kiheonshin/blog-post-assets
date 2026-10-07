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
import { pathToFileURL } from "node:url";

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

const withIndex = (paths) => paths.flatMap((path) => [path, `${path}index.html`]);
// 정규 도메인에서 내린 경로만 검사한다. GitHub 공개면이나 배포 정책은 바꾸지 않는다.
// raw 문자열을 그대로 요청해야 provider의 인코딩 정규화 공백을 발견할 수 있다.
export const HIDDEN_PATHS = Object.freeze([
  ...["went-in-first", "where-worlds-meet", "handed-down"].flatMap((slug) => {
    const encoded = `%${slug.charCodeAt(0).toString(16)}${slug.slice(1)}`;
    return [`/series/${slug}`, ...withIndex([
      `/series/${slug}/`, `/series/${encoded}/`, `/s%65ries/${slug}/`,
      `/series%2F${slug}/`, `/series%2f${slug}/`,
    ])];
  }),
  "/previews", "/previews/",
  ...withIndex([
    "/previews/series-00-08/", "/%70reviews/series-00-08/",
    "/previews/s%65ries-00-08/", "/previews%2Fseries-00-08/", "/previews%2fseries-00-08/",
    "/series/went-in-first/posts/01-parent-enters-first/",
    "/series/%77ent-in-first/posts/01-parent-enters-first/",
    "/series/went-in-first/posts/%301-parent-enters-first/",
    "/series/went-in-first%2Fposts%2F01-parent-enters-first/",
  ]),
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export async function runRoutingChecks({ base = "https://kiheon.com", fetchImpl = globalThis.fetch } = {}) {
  let baseUrl;
  try { baseUrl = new URL(base); }
  catch { throw new Error("검사 기준은 유효한 HTTP(S) 루트여야 한다"); }
  if (!/^https?:$/.test(baseUrl.protocol) || baseUrl.username || baseUrl.password
      || baseUrl.search || baseUrl.hash || baseUrl.pathname !== "/") {
    throw new Error("검사 기준은 인증 정보·쿼리 없는 HTTP(S) 루트여야 한다");
  }
  const failures = [];
  const note = (msg) => failures.push(msg);
  const urlFor = (path) => new URL(path, baseUrl).href;
  const safePath = (url) => {
    try { return new URL(url, baseUrl).pathname; }
    catch { return "유효하지 않은 경로"; }
  };
  const request = async (url, options) => {
    try { return await fetchImpl(url, options); }
    catch { note(`${safePath(url)} → 요청 실패`); return null; }
  };

  async function checkSlashNormalises(path) {
    const res = await request(urlFor(path), { redirect: "follow" });
    if (!res) return;
    if (res.status !== 200) return note(`${path} → HTTP ${res.status}`);
    const finalPath = safePath(res.url);
    if (path !== "/" && !finalPath.endsWith("/") && !/\.[a-z0-9]+$/i.test(finalPath)) {
      note(`${path} → 슬래시로 정규화되지 않음 (${finalPath})`);
    }
  }

  async function checkRelativeAssets(path) {
    const res = await request(urlFor(path), { redirect: "follow" });
    if (!res) return;
    if (res.status !== 200) return note(`${path} → HTTP ${res.status}`);
    const text = await res.text();
    const refs = [...text.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => !/^(https?:|\/|#|data:|mailto:|javascript:)/.test(h))
      .filter((h) => !h.includes("' + "))   // JS 템플릿 조각은 자산이 아니다
      .slice(0, 6);
    for (const ref of refs) {
      const url = new URL(ref, res.url).href;
      const asset = await request(url);
      if (asset && !asset.ok) note(`${path} → 자산 ${safePath(url)} HTTP ${asset.status}`);
    }
  }

  async function checkUniverseData(view) {
    const res = await request(urlFor(view), { redirect: "follow" });
    if (!res) return;
    if (res.status !== 200) return note(`${view} → HTTP ${res.status}`);
    // 투영 데이터가 뷰 깊이와 무관하게 잡혀야 한다
    const dataUrl = new URL("nodes-data.js", res.url).href;
    const data = await request(dataUrl);
    if (!data) return;
    if (!data.ok) return note(`${view} → 투영 데이터 ${safePath(dataUrl)} HTTP ${data.status}`);
    const body = await data.text();
    if (!body.includes("ONTOLOGY_PROJECTION")) note(`${view} → 투영 데이터 내용이 아님`);
  }

  async function checkStaysClosed(path) {
    const res = await request(urlFor(path), { redirect: "follow" });
    if (res && res.ok) note(`${path} → 비공개 경로 열림 HTTP ${res.status}`);
  }

  async function checkHiddenPath(path) {
    let current = new URL(urlFor(path));
    const visited = new Set();
    const routeKey = (pathname) => decodeURIComponent(pathname).replace(/\/index\.html$/, "/").replace(/\/+$/, "");
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if (visited.has(current.href)) return note(`${path} → 숨김 경로 리다이렉트 순환`);
      visited.add(current.href);
      // 숨김 경로에서는 성공·실패와 무관하게 body/text/title을 읽지 않는다.
      let res;
      try { res = await fetchImpl(current.href, { redirect: "manual" }); }
      catch { return note(`${path} → 숨김 경로 요청 실패`); }
      if (current.pathname === "/") {
        if (res.status !== 200) note(`${path} → 되돌림 루트 HTTP ${res.status}`);
        return;
      }
      if (res.status === 404 || res.status === 410) return;
      if (!REDIRECT_STATUSES.has(res.status)) return note(`${path} → 숨김 경로 HTTP ${res.status}`);
      const location = res.headers?.get("location");
      let next;
      try {
        if (!location) throw new Error();
        next = new URL(location, current);
      } catch { return note(`${path} → 유효하지 않은 되돌림 HTTP ${res.status}`); }
      if (next.origin !== baseUrl.origin || next.username || next.password || next.search || next.hash) {
        return note(`${path} → 허용하지 않은 되돌림 HTTP ${res.status}`);
      }
      try {
        if (next.pathname !== "/" && routeKey(next.pathname) !== routeKey(path)) throw new Error();
      } catch { return note(`${path} → 숨김 경로와 무관한 되돌림 HTTP ${res.status}`); }
      current = next;
    }
    note(`${path} → 숨김 경로 리다이렉트 횟수 초과`);
  }

  for (const p of PAGES) { await checkSlashNormalises(p); await checkRelativeAssets(p); }
  for (const v of UNIVERSE_VIEWS) await checkUniverseData(v);
  for (const p of MUST_STAY_CLOSED) await checkStaysClosed(p);
  for (const p of HIDDEN_PATHS) await checkHiddenPath(p);

  return { failures, counts: { pages: PAGES.length, universeViews: UNIVERSE_VIEWS.length,
    closed: MUST_STAY_CLOSED.length, hidden: HIDDEN_PATHS.length } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { failures, counts } = await runRoutingChecks({ base: process.argv[2] || "https://kiheon.com" });
  if (failures.length) {
    console.error(`✗ 라우팅 계약 위반 ${failures.length}건`);
    for (const f of failures) console.error(`  · ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ 라우팅 계약 통과 — 페이지 ${counts.pages} · 유니버스 뷰 ${counts.universeViews} · 비공개 ${counts.closed} · 숨김 변형 ${counts.hidden}`);
  }
}
