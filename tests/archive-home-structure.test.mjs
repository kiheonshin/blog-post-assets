import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

function inventory(html) {
  return html.match(/<section class="arc-stock"[\s\S]*?<\/section>/)?.[0] ?? "";
}

test("Archive keeps product navigation on the homepage only", async () => {
  const html = await read("archive/index.html");
  const summary = JSON.parse(await read("assets/archive-summary.json"));
  assert.doesNotMatch(html, /archive-atlas-layer|archive-inner-layer/);
  assert.doesNotMatch(html, />World Atlas<|>Inner World</);
  assert.doesNotMatch(html, /Life World|세계 모델|월드 모델|월드 스킨/);
  assert.doesNotMatch(html, /world-atlas-entry\.css/);
  assert.match(html, /PUBLIC ARCHIVE/);
  const period = `${summary.sourceYears.at(0)}–${summary.sourceYears.at(-1)}`;
  assert.deepEqual([summary.sourceYears.at(0), summary.sourceYears.at(-1)], [2017, 2026]);
  assert.match(html, new RegExp(`공개 시리즈 ${summary.counts.publicSeries}개 · 글 ${summary.counts.publishedPosts}편 · 등록 자료 ${summary.counts.manifestSources}개`));
  assert.match(html, new RegExp(`발표 아카이브 ${summary.counts.presentationArchiveItems}편 · ${period}`));
  for (const [key, value] of Object.entries({
    publicSeries: summary.counts.publicSeries,
    publishedPosts: summary.counts.publishedPosts,
    manifestSources: summary.counts.manifestSources,
    presentationArchiveItems: summary.counts.presentationArchiveItems,
  })) {
    assert.match(html, new RegExp(`data-archive-count="${key}">${value}<`));
  }
  assert.match(html, new RegExp(`data-archive-range="sourceYears">${period}<`));
  assert.match(html, /Local Vault/);
});

test("the material inventory distinguishes public links from Local Vault originals", async () => {
  const html = inventory(await read("archive/index.html"));
  const summary = JSON.parse(await read("assets/archive-summary.json"));
  assert.ok(html);
  assert.match(html, />공개 자료와 Local Vault 기록</);
  assert.match(html, /data-archive-inventory/);
  assert.match(html, /data-archive-inventory-search/);
  assert.match(html, /data-archive-inventory-filter="open"/);
  assert.match(html, /data-archive-inventory-filter="closed"/);
  assert.match(html, /class="library-section__marker">공개 자료와 Local Vault 기록/);
  assert.match(html, /data-archive-inventory-filter-count="open"/);

  const openRows = html.match(/<div class="arc-stock__row" data-access="open"[^>]*>[\s\S]*?<\/div>/g) ?? [];
  const closedRows = html.match(/<div class="arc-stock__row" data-access="closed"[^>]*>[\s\S]*?<\/div>/g) ?? [];
  assert.ok(openRows.length >= 11);
  assert.equal(closedRows.length, 2);

  for (const row of openRows) {
    assert.match(row, /<a class="arc-stock__link" href=/);
    assert.match(row, /열람 가능/);
    assert.match(row, /자료 보기/);
  }
  const registeredRows = html.match(/data-source-key="[^"]+"/g) ?? [];
  assert.equal(registeredRows.length, summary.registeredSources.length);
  assert.equal(new Set(registeredRows).size, registeredRows.length);
  for (const source of summary.registeredSources) {
    assert.match(html, new RegExp(source.displayTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(source.description.length >= 20, source.title);
  }
  assert.doesNotMatch(html, />자율 세계 기록<|>11월 발표 자료<|>11월 발표 녹음 전사</);
  for (const row of closedRows) {
    assert.doesNotMatch(row, /<a\b|href=/);
    assert.match(row, /Local Vault/);
  }
});

test("Archive inventory styles retain visible availability text", async () => {
  const css = await read("assets/archive.css");
  assert.match(css, /\.arc-summary/);
  assert.match(css, /\.arc-stock__status/);
  assert.match(css, /\.arc-stock__viewport/);
  assert.match(css, /\.arc-stock__filters button\[aria-pressed="true"\]/);
  assert.match(css, /\.arc-stock__link/);
  assert.match(css, /\.arc-stock__title/);
  assert.match(css, /max-height: min\(70svh, 52rem\)/);
  assert.match(css, /grid-template-columns: minmax\(22rem, 1\.05fr\)/);
  assert.match(css, /block-size: 9\.5rem/);
  assert.match(css, /block-size: 13\.5rem/);
  assert.match(css, /block-size: 15rem/);
  assert.match(css, /-webkit-line-clamp: 2/);
  assert.match(css, /-webkit-line-clamp: 3/);
  assert.match(css, /\.arc-stock__action \.klu-icon/);
  assert.match(css, /margin-inline-end: var\(--space-2\)/);
  assert.match(css, /\.arc-stock \[data-access="open"\] \.arc-stock__status/);
  assert.doesNotMatch(css, /\.archive-inner-layer|\.archive-inner-card/);
});

test("Archive inventory script filters by status and search text", async () => {
  const script = await read("assets/archive-register.js");
  assert.match(script, /data-archive-inventory-search/);
  assert.match(script, /data-archive-inventory-filter/);
  assert.match(script, /data-archive-inventory-filter-count/);
  assert.match(script, /toLocaleLowerCase\("ko-KR"\)/);
  assert.match(script, /row\.hidden = !isVisible/);
});

test("Archive actions use the shared KLU interface icon asset", async () => {
  const html = inventory(await read("archive/index.html"));
  const icons = await read("assets/icons/klu-interface-icons.svg");
  const iconUses = html.match(/klu-interface-icons\.svg#arrow-right/g) ?? [];
  assert.equal(iconUses.length, 17);
  for (const id of ["arrow-right", "external-link", "search", "lock"]) {
    assert.match(icons, new RegExp('<symbol id="' + id + '"'));
  }
  assert.match(icons, /viewBox="0 0 24 24"/);
  assert.match(icons, /stroke="currentColor"/);
  assert.doesNotMatch(
    icons,
    /<script\b|<foreignObject\b|<image\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i,
  );
});

test("Archive candidate surfaces avoid the long dash glyph", async () => {
  for (const file of [
    "archive/index.html",
    "assets/archive.css",
    "assets/archive-summary.json",
    "assets/archive-register.js",
    "scripts/build-archive-summary.mjs",
  ]) {
    assert.doesNotMatch(await read(file), /\u2014/, file);
  }
});
