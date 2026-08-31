import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("the filter surface is named Explore rather than Archive", async () => {
  const html = await read("index.html");
  assert.match(html, /<h2 id="archive-title" class="library-section__marker" aria-label="기록 탐색">Explore<\/h2>/);
  assert.doesNotMatch(html, /aria-label="아카이브로 찾기">Archive<\/h2>/);
  assert.match(html, /assets\/site\.css\?v=20260831a/);
  assert.match(html, /assets\/series-nav\.js\?v=20260831b/);
});

test("the Life Universe source card uses sentence case", async () => {
  const manifest = await read("assets/content-manifest.js");
  assert.match(manifest, /id: "universe-intro",[\s\S]*?title: "Kiheon life universe 소개"/);
  assert.doesNotMatch(manifest, /title: "KIHEON LIFE UNIVERSE 소개"/);
});

test("each result exposes filter metadata before its title", async () => {
  const source = await read("assets/series-nav.js");
  assert.match(source, /archive-item__kind/);
  assert.match(source, /archive-item__series/);
  assert.match(source, /archive-item__published/);
  assert.match(source, /archive-item__source-years/);
  assert.match(source, /time\.textContent = `발행 \$\{item\.published\.replaceAll/);
  assert.match(source, /article\.append\(meta, title, facets\)/);
});

test("Explore results use an index scale below Series and product cards", async () => {
  const css = await read("assets/site.css");
  const script = await read("assets/series-nav.js");
  assert.match(css, /\.archive-item\s*\{[\s\S]*grid-template-areas:\s*"meta"\s*"title"\s*"facets"/);
  assert.match(css, /\.archive-item__meta\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.archive-item__title\s*\{[\s\S]*font-family:\s*var\(--font-body\)[\s\S]*font-size:\s*1rem/);
  assert.doesNotMatch(script, /archive-item__context/);
});

test("Series and Explore replace fixed-size pages instead of growing downward", async () => {
  const script = await read("assets/series-nav.js");
  const css = await read("assets/site.css");
  assert.match(script, /const SERIES_PAGE_SIZE = 6;/);
  assert.match(script, /const EXPLORE_PAGE_SIZE = 8;/);
  assert.match(script, /const EXPLORE_PRIMARY_TOPIC_LIMIT = 8;/);
  assert.match(script, /const pageSeries = contentLibrary\.series\.slice\([\s\S]*start \+ SERIES_PAGE_SIZE/);
  assert.match(script, /const visibleItems = items\.slice\(start, start \+ EXPLORE_PAGE_SIZE\)/);
  assert.match(script, /this\.previousButton\.setAttribute\("aria-controls", this\.results\.id\)/);
  assert.match(script, /this\.nextButton\.setAttribute\("aria-controls", this\.results\.id\)/);
  assert.match(script, /url\.searchParams\.set\("page", String\(this\.page\)\)/);
  assert.match(script, /this\.topics\s*\.slice\(0, EXPLORE_PRIMARY_TOPIC_LIMIT\)/);
  assert.match(css, /\.archive-pagination\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /archive-library\s*\{[\s\S]*border:\s*1px solid var\(--rule\)/);
  assert.match(css, /\.archive-controls\s*\{[\s\S]*border-block-end:\s*1px solid var\(--rule\)/);
  assert.match(css, /\.series-pager__segments\s*\{/);
  assert.doesNotMatch(script, /SEARCH RESULTS|archive-status-row__label/);
  assert.doesNotMatch(script, /moreButton|visibleLimit|series-directory/);
});
