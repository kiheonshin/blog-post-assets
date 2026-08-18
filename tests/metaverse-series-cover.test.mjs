import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

// 자산이 실물 JPEG 인지까지 본다. 파일이 없거나 0바이트여도 마크업 검사만으로는
// 통과해 버리고, 그러면 발행면에 깨진 이미지가 남는다.
async function assertRealJpeg(relative) {
  const file = path.join(repoRoot, relative);
  const [bytes, metadata] = await Promise.all([readFile(file), stat(file)]);
  assert.ok(metadata.size > 100_000, relative);
  assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], relative);
  assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9], relative);
}

test("the Metaverse Era series registers its cover in the manifest", async () => {
  const manifest = await read("assets/content-manifest.js");

  assert.match(
    manifest,
    /cover: "series\/metaverse-era\/assets\/series-banner\.jpg"/,
  );
  // coverAlt 가 비면 SeriesNav 가 alt="undefined" 를 찍는다.
  const entry =
    manifest.match(/slug: "metaverse-era"[\s\S]*?published:/)?.[0] ?? "";
  assert.match(entry, /coverAlt:\s*\n?\s*"[^"]{20,}"/);

  await assertRealJpeg("series/metaverse-era/assets/series-banner.jpg");
});

// ★ 이 잠금이 오늘의 사고를 막는다. series-nav.js 가 content-manifest.js 를
//   하드코딩 토큰으로 import 하기 때문에(assets/series-nav.js:5) 매니페스트만
//   고치고 토큰을 안 올리면, 재방문자는 캐시된 옛 매니페스트를 받아 cover 를
//   못 읽고 랜딩면 배너가 src="undefined" 로 깨진다. 로컬 브라우저에서 실제로 그랬다.
test("the manifest import token matches what every surface loads", async () => {
  const nav = await read("assets/series-nav.js");
  const token = nav.match(/content-manifest\.js\?v=([0-9a-z]+)/)?.[1];
  assert.ok(token, "series-nav.js 가 매니페스트를 토큰 없이 부른다");

  const landing = await read("series/metaverse-era/index.html");
  assert.match(landing, new RegExp(`series-nav\\.js\\?v=${token}`));
});

test("the Metaverse Era landing page uses the shared series-nav CTA", async () => {
  const landing = await read("series/metaverse-era/index.html");

  // 다른 여섯 시리즈와 같은 엘리먼트여야 배너가 선다.
  assert.match(landing, /<series-nav data-series="metaverse-era"><\/series-nav>/);
  assert.doesNotMatch(landing, /<series-post-links data-series="metaverse-era">/);

  // og:image · og:image:secure_url · twitter:image 셋이 배너를 가리킨다.
  assert.equal(
    (landing.match(/series\/metaverse-era\/assets\/series-banner\.jpg/g) ?? [])
      .length,
    3,
  );
  assert.match(landing, /<meta property="og:image:height" content="800">/);
});

test("each Metaverse Era post carries its own hero and social preview", async () => {
  const posts = [
    ["01-no-money-talk", "hero-1.jpg"],
    ["02-size-and-price", "hero-2.jpg"],
    ["03-clocking-in", "hero-3.jpg"],
  ];

  for (const [slug, asset] of posts) {
    const html = await read(`series/metaverse-era/posts/${slug}/index.html`);
    const publicPath = `series/metaverse-era/assets/${asset}`;

    // hero <img> 1 + og:image 2 + twitter:image 1
    assert.equal((html.match(new RegExp(publicPath, "g")) ?? []).length, 4, slug);
    assert.match(html, /<figure class="hero">/, slug);
    assert.match(html, /<meta property="og:image:height" content="900">/, slug);
    // 커버가 없던 시절의 자리표시가 남아 있으면 안 된다.
    assert.doesNotMatch(html, /히어로 도판 자리/, slug);

    await assertRealJpeg(publicPath);
  }
});
