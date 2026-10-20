// 공개 준비 (2026-10-20 · 브랜딩 ⑤) : sitemap.xml 은 공개 · 검색 허용 면만, 없는 주소는 같은 머리와 바닥의 404 면으로.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
