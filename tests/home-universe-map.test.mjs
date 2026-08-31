import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function postFiles() {
  const seriesRoot = path.join(repoRoot, "series");
  const series = await readdir(seriesRoot, { withFileTypes: true });
  const files = [];
  for (const item of series.filter((entry) => entry.isDirectory())) {
    const postsRoot = path.join(seriesRoot, item.name, "posts");
    let posts;
    try {
      posts = await readdir(postsRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const post of posts.filter((entry) => entry.isDirectory())) {
      const file = path.join(postsRoot, post.name, "index.html");
      try {
        await readFile(file);
        files.push(file);
      } catch {}
    }
  }
  return files.sort();
}

function universeMap(html) {
  return html.match(/<section class="universe-map"[\s\S]*?<\/section>/)?.[0] ?? "";
}

test("the Universe project lineup appears once after Explore", async () => {
  const html = await read("index.html");
  const map = universeMap(html);
  assert.ok(map);
  assert.equal((html.match(/<section class="universe-map"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<nav class="library-paths"/);
  assert.doesNotMatch(html, /<header class="library-head">[\s\S]*?<p class="lead">/);
  assert.match(html, /<\/header>\s*<section id="series"/);
  assert.ok(html.indexOf('<section id="series"') < html.indexOf('<section id="archive"'));
  assert.ok(html.indexOf('<section id="archive"') < html.indexOf('<section class="universe-map"'));
  assert.doesNotMatch(html, /class="world-atlas-entry"/);
  assert.match(map, /<section class="universe-map" aria-labelledby="home-universe-title">/);
  assert.match(map, /<p class="universe-map__eyebrow">PRODUCT LINEUP · KIHEON LIFE UNIVERSE<\/p>/);
  assert.match(map, /<h2 id="home-universe-title">프로젝트 소개와 공개 표면<\/h2>/);
  assert.doesNotMatch(map, /<h2[^>]*>KIHEON LIFE UNIVERSE<\/h2>/);
  assert.match(map, /assets\/diagrams\/klu-system-map\.svg\?v=20260831c/);
  assert.match(html, /assets\/world-atlas-entry\.css\?v=20260831b/);
});

test("four public surfaces are links and two unopened products are not", async () => {
  const map = universeMap(await read("index.html"));
  const openCards = map.match(/<a class="universe-map__surface[^>]+data-access="open"[^>]*>/g) ?? [];
  const closedCards = map.match(/<article class="universe-map__surface[^>]+data-access="closed"[^>]*>/g) ?? [];
  assert.equal(openCards.length, 4);
  assert.equal(closedCards.length, 2);

  assert.match(map, /href="\.\/"[^>]*data-access="open"/);
  assert.match(map, /href="archive\/"[^>]*data-access="open"/);
  assert.match(map, /href="archive\/world-atlas\/"[^>]*data-access="open"/);
  assert.match(map, /href="https:\/\/kiheon\.com\/universe\/"[^>]*data-access="open"/);

  const inside = map.match(/<article class="universe-map__surface universe-map__surface--closed universe-map__surface--inside"[\s\S]*?<\/article>/)?.[0] ?? "";
  const slides = map.match(/<article class="universe-map__surface universe-map__surface--closed universe-map__surface--slides"[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.ok(inside);
  assert.ok(slides);
  assert.doesNotMatch(inside, /<a\b|href=/);
  assert.doesNotMatch(slides, /<a\b|href=/);
  assert.match(inside, /링크 없음[\s\S]*아직 공개되지 않음/);
  assert.match(slides, /링크 없음[\s\S]*아직 공개되지 않음/);
});

test("the verified system diagram and product order stay fixed", async () => {
  const [html, svg, receiptRaw] = await Promise.all([
    read("index.html"),
    read("assets/diagrams/klu-system-map.svg"),
    read("assets/diagrams/klu-system-map.receipt.json"),
  ]);
  const map = universeMap(html);
  const receipt = JSON.parse(receiptRaw);
  assert.equal(receipt.node_count, 13);
  assert.equal(receipt.edge_count, 12);
  assert.equal(receipt.bounds_ok, true);
  assert.deepEqual(receipt.overlaps, []);
  assert.deepEqual(receipt.warnings, []);
  assert.equal(receipt.renderer, "instrument-grid-v1");
  assert.equal(receipt.forbidden_display_terms, 0);
  assert.equal(receipt.svg_sha256, sha256(svg));
  assert.match(svg, /data-node-id="vault"[\s\S]*data-node-id="relations"[\s\S]*data-node-id="brand"[\s\S]*data-node-id="actors"[\s\S]*data-node-id="operations"[\s\S]*data-node-id="products"/);
  assert.match(svg, /data-node-id="outside"[\s\S]*data-node-id="inside"/);
  assert.match(svg, /class="km-membrane" x="72" y="180" width="896" height="80"/);
  assert.match(svg, /data-node-id="products"><rect x="302" y="300" width="436" height="172"/);
  assert.match(svg, /data-node-id="inside"[\s\S]*y="436"/);
  assert.doesNotMatch(svg, /세계 모델|World Atlas|Life World|marker-end|<marker\b/i);
  assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b|<use\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  assert.match(map, /BLOG[\s\S]*PUBLIC ARCHIVE[\s\S]*UNIVERSE[\s\S]*OUTSIDE[\s\S]*INSIDE[\s\S]*SLIDES/);
});

test("the Universe map does not repeat below individual posts", async () => {
  const files = await postFiles();
  assert.ok(files.length > 0);
  for (const file of files) {
    const html = await readFile(file, "utf8");
    assert.doesNotMatch(html, /class="universe-map"/, file);
    assert.match(html, /assets\/post\.css\?v=20260809a/, file);
  }
});

test("the shared stylesheet preserves link and non-link affordances", async () => {
  const css = await read("assets/world-atlas-entry.css");
  assert.match(css, /a\.universe-map__surface:hover/);
  assert.match(css, /\.universe-map__surface--closed\s*\{[\s\S]*border-style:\s*dashed/);
  assert.match(css, /\.universe-map__surface--closed \.universe-map__dot\s*\{[\s\S]*background:\s*transparent/);
  assert.doesNotMatch(css, /\.world-atlas-entry\s*\{/);
});
