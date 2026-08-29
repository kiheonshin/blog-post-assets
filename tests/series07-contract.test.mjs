import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seriesRoot = path.join(repoRoot, "series/went-in-first");
const read = (relative) => readFile(path.join(seriesRoot, relative), "utf8");

test("Series 07 keeps identifying family labels and child ages out of the source package", async () => {
  const manifest = JSON.parse(await read("assets/source-pokemon/manifest.json"));
  const blocked = ["P1-S004", "P1-S005", "P1-S006", "P2-S044"];
  const ids = new Set(manifest.assets.map((asset) => asset.pageId));

  assert.equal(manifest.selectedTotal, 146);
  assert.equal(manifest.withheldTotal, 132);
  for (const id of blocked) assert.equal(ids.has(id), false, id);

  for (const file of ["p1-s004.jpg", "p1-s005.jpg", "p1-s006.jpg", "p2-s044.jpg"]) {
    await assert.rejects(access(path.join(seriesRoot, "assets/source-pokemon", file)));
  }

  const source = await read("sources/pokemon-talk/index.html");
  assert.doesNotMatch(source, /p1-s00[456]|P1-S00[456]|p2-s044|P2-S044|8살/);
});

test("Series 07 article media remains explicit, single-column, and non-autoplaying", async () => {
  const expected = new Map([
    ["01-parent-enters-first", { figures: 10, gifs: 1, videos: 3 }],
    ["02-pokemon-uncle", { figures: 8, gifs: 2, videos: 0 }],
    ["03-plan-and-action", { figures: 3, gifs: 1, videos: 0 }],
  ]);

  for (const [slug, count] of expected) {
    const html = await read(`posts/${slug}/index.html`);
    assert.equal([...html.matchAll(/class="media-figure /g)].length, count.figures, slug);
    assert.equal([...html.matchAll(/class="motion-gif"/g)].length, count.gifs, slug);
    assert.equal([...html.matchAll(/<iframe /g)].length, count.videos, slug);
    assert.doesNotMatch(html, /media-pair|autoplay/i, slug);
  }

  const css = await read("review.css");
  assert.match(css, /\.media-figure\{/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /\.media-pair/);
});
