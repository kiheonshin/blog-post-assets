import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

const onchainSurfaces = [
  "series/onchain-storytelling/index.html",
  "series/onchain-storytelling/posts/01-worldview/index.html",
  "series/onchain-storytelling/posts/02-methodology/index.html",
  "series/onchain-storytelling/posts/03-expansion/index.html",
  "series/onchain-storytelling/sources/proposal-idea-notes/index.html",
  "series/onchain-storytelling/sources/proposal-mxtwn-x/index.html",
  "series/onchain-storytelling/sources/proposal-sapienz-town/index.html",
  "series/onchain-storytelling/sources/proposal-strategy-diagrams/index.html",
];

test("the On-chain Storytelling series cover replaces the placeholder", async () => {
  const [manifest, seriesHome] = await Promise.all([
    read("assets/content-manifest.js"),
    read(onchainSurfaces[0]),
  ]);

  assert.match(
    manifest,
    /cover: "series\/onchain-storytelling\/assets\/series-banner\.jpg\?v=20260809a"/,
  );
  assert.doesNotMatch(
    manifest.match(/slug: "onchain-storytelling"[\s\S]*?posts: \[/)?.[0] ?? "",
    /cover-placeholder/,
  );
  assert.equal(
    (seriesHome.match(/series\/onchain-storytelling\/assets\/series-banner\.jpg/g) ?? [])
      .length,
    3,
  );
});

test("the current cache versions reach the home and every On-chain surface", async () => {
  assert.match(await read("index.html"), /series-nav\.js\?v=20260815a/);

  for (const file of onchainSurfaces) {
    assert.match(await read(file), /series-nav\.js\?v=20260815a/, file);
  }
});

test("the installed cover is a non-empty JPEG asset", async () => {
  const file = path.join(
    repoRoot,
    "series/onchain-storytelling/assets/series-banner.jpg",
  );
  const [bytes, metadata] = await Promise.all([readFile(file), stat(file)]);

  assert.ok(metadata.size > 100_000);
  assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9]);
});

test("each On-chain Storytelling post uses its own hero and social preview", async () => {
  const posts = [
    ["01-worldview", "hero-1.jpg"],
    ["02-methodology", "hero-2.jpg"],
    ["03-expansion", "hero-3.jpg"],
  ];

  for (const [slug, asset] of posts) {
    const html = await read(
      `series/onchain-storytelling/posts/${slug}/index.html`,
    );
    const publicPath = `series/onchain-storytelling/assets/${asset}`;

    assert.equal((html.match(new RegExp(publicPath, "g")) ?? []).length, 3);
    assert.match(
      html,
      new RegExp(`src="\\.\\.\\/\\.\\.\\/assets/${asset}\\?v=20260808d"`),
    );
    assert.doesNotMatch(html, /cover-placeholder/);

    const file = path.join(
      repoRoot,
      "series/onchain-storytelling/assets",
      asset,
    );
    const [bytes, metadata] = await Promise.all([readFile(file), stat(file)]);
    assert.ok(metadata.size > 100_000);
    assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8]);
    assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9]);
  }
});
