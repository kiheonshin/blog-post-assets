// 공개 준비 (2026-10-20 · 브랜딩 ⑤) : sitemap.xml 은 공개 · 검색 허용 면만, 없는 주소는 같은 머리와 바닥의 404 면으로.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { indexablePages, renderSitemap } from "../scripts/build-sitemap.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("sitemap.xml is current and lists only indexable public pages", async () => {
  assert.equal(await read("sitemap.xml"), await renderSitemap(repoRoot));
  const pages = await indexablePages(repoRoot);
  assert.ok(pages.length > 40, `${pages.length}`);
  assert.ok(pages.includes("https://kiheon.com/"));
  for (const hidden of ["https://kiheon.com/archive/", "https://kiheon.com/privacy/", "https://kiheon.com/archive/world-atlas/"]) {
    assert.ok(!pages.includes(hidden), `${hidden} 는 noindex 다`);
  }
  assert.ok(pages.every((url) => url.startsWith("https://kiheon.com/") && url.endsWith("/")));
});

test("robots.txt points crawlers to the sitemap", async () => {
  assert.match(await read("robots.txt"), /^Sitemap: https:\/\/kiheon\.com\/sitemap\.xml$/m);
});

test("the 404 page keeps the shared header and footer and offers one way home", async () => {
  const html = await read("404.html");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<title>[^<]+ · Kiheon Shin<\/title>/);
  assert.match(html, /<header class="site-header"><div class="site-header__in">\s*<a class="brand" href="https:\/\/kiheon\.com\/">KIHEON SHIN<\/a>/);
  assert.equal(html.split('class="site-footer__sign"').length - 1, 1);
  assert.match(html, /<span class="site-footer__system">Kiheon Life Universe<\/span> · 신기헌의 디지털 트윈 프로젝트/);
  const targets = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((match) => match[1]).filter((href) => !href.startsWith("#"));
  assert.ok(targets.length > 0);
  assert.deepEqual([...new Set(targets)], ["https://kiheon.com/"]);
  // 없는 주소는 어느 깊이에서든 이 면을 받는다 : 상대 경로는 그 깊이에서 깨지므로 정본 주소로 적는다.
  const assets = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 3);
  assert.ok(assets.every((href) => href.startsWith("https://kiheon.com/assets/")), assets.join(" "));
});

// 저장소 뿌리의 미디엄 가져오기 원본은 배포되지만 검색에서는 뺀다(본인 2026-10-20 「noindex 추가」).
// 넘김 껍데기는 원본이 아니라 세지 않는다. 미디엄 가져오기는 주소를 읽어 가므로 noindex 와 함께 쓸 수 있다.
test("the Medium import originals at the repository root stay out of search", async () => {
  const originals = [];
  for (const name of (await readdir(repoRoot)).filter((entry) => /^import-.*\.html$/.test(entry)).sort()) {
    const html = await read(name);
    if (/http-equiv="refresh"/i.test(html)) continue;
    originals.push(name);
    assert.match(html, /<meta name="robots" content="noindex">/, name);
  }
  assert.equal(originals.length, 7, originals.join(" "));
});

// 보안 규칙(CSP)은 Report-Only 로 먼저 건다(본인 2026-10-20 「Report-Only 먼저」). 정식 적용은 본인 결정 뒤.
// 2026-10-20 초안 검증 : 공개 69 + 404 + 관측소 5, 폭 셋 225 칸 위반 0(대조 실행 둘로 탐침 확인).
test("vercel.json carries the CSP as Report-Only for every path, with the sources the site needs", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const rule = (config.headers ?? []).find((entry) => entry.source === "/(.*)");
  assert.ok(rule, "모든 경로 머리글 규칙");
  const keys = rule.headers.map((header) => header.key);
  assert.ok(keys.includes("Content-Security-Policy-Report-Only"));
  assert.ok(!keys.includes("Content-Security-Policy"), "정식 적용은 본인 결정 뒤");
  const policy = rule.headers.find((header) => header.key === "Content-Security-Policy-Report-Only").value;
  const directives = Object.fromEntries(policy.split(";").map((part) => part.trim()).filter(Boolean)
    .map((part) => { const [name, ...values] = part.split(/\s+/); return [name, values]; }));
  // 본인 점검기(kiheon.app)가 공개 면을 iframe 으로 품는다.
  assert.deepEqual(directives["frame-ancestors"], ["'self'", "https://kiheon.app"]);
  // 첫 화면 시스템 지도는 <object> 로 들어가고 크롬은 그 문서를 frame-src 로도 본다.
  assert.ok(directives["object-src"].includes("'self'"));
  assert.ok(directives["frame-src"].includes("'self'") && directives["frame-src"].includes("https://www.youtube-nocookie.com"));
  // 음성 도슨트 : 토큰 주소의 출처와 실시간 소켓.
  const transport = await read("assets/assistant/xai-voice-transport.js");
  const token = new URL(transport.match(/PRODUCTION_TOKEN_ENDPOINT =\s*"([^"]+)"/)[1]).origin;
  assert.ok(directives["connect-src"].includes(token), token);
  assert.ok(directives["connect-src"].includes("wss://api.x.ai"));
  // Report-Only 에서는 무시되고 경고만 남는 지시는 넣지 않는다.
  assert.ok(!("upgrade-insecure-requests" in directives));
});
