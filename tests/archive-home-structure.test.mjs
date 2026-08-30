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
  assert.doesNotMatch(html, /archive-atlas-layer|archive-inner-layer/);
  assert.doesNotMatch(html, />World Atlas<|>Inner World</);
  assert.doesNotMatch(html, /world-atlas-entry\.css/);
  assert.match(html, /원자료 모듈 4개 · 자료 인벤토리 9종/);
});

test("the material inventory distinguishes seven pages from two preserved originals", async () => {
  const html = inventory(await read("archive/index.html"));
  assert.ok(html);
  assert.match(html, />자료 인벤토리</);

  const openRows = html.match(/<div data-access="open">[\s\S]*?<\/div>/g) ?? [];
  const closedRows = html.match(/<div data-access="closed">[\s\S]*?<\/div>/g) ?? [];
  assert.equal(openRows.length, 7);
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
  assert.match(css, /\.arc-stock__status/);
  assert.match(css, /\.arc-stock \[data-access="open"\] \.arc-stock__status/);
  assert.doesNotMatch(css, /\.archive-inner-layer|\.archive-inner-card/);
});
