import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

function inventory(html) {
  return html.match(/<section class="prose arc-stock"[\s\S]*?<\/section>/)?.[0] ?? "";
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
  assert.ok(html);
  assert.match(html, />공개 자료와 Local Vault 기록</);

  const openRows = html.match(/<div data-access="open">[\s\S]*?<\/div>/g) ?? [];
  const closedRows = html.match(/<div data-access="closed">[\s\S]*?<\/div>/g) ?? [];
  assert.ok(openRows.length >= 11);
  assert.equal(closedRows.length, 2);

  for (const row of openRows) {
    assert.match(row, /<a href=/);
    assert.match(row, /열람 가능/);
  }
  for (const row of closedRows) {
    assert.doesNotMatch(row, /<a\b|href=/);
    assert.match(row, /원본만 보존/);
  }
});

test("Archive inventory styles retain visible availability text", async () => {
  const css = await read("assets/archive.css");
  assert.match(css, /\.arc-summary/);
  assert.match(css, /\.arc-stock__status/);
  assert.match(css, /\.arc-stock \[data-access="open"\] \.arc-stock__status/);
  assert.doesNotMatch(css, /\.archive-inner-layer|\.archive-inner-card/);
});
