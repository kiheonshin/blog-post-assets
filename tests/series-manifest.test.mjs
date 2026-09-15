import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// 왜 있나 (C48 ⑤ ⑥) : 시리즈를 목록에 올리는 일이 사람 손에 있었다. 폴더를 새로 만들고
// 목록 둘에 손으로 적어야 했고, 그 등재가 늦어 시리즈 하나가 빠진 채 나갔다(H1). 반대로 폴더를
// 훑어 목록을 만들면 미완성 시리즈가 조용히 올라간다. 그래서 `series/manifest.json` 하나가
// 「올릴 것 · 안 올릴 것」을 쥐고, 이 파일은 저장소가 그 매니페스트와 맞는지 본다.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(repoRoot, relative), "utf8");
const manifest = JSON.parse(await read("series/manifest.json"));
const publicSeries = manifest.series.filter((s) => s.public);
const hiddenSeries = manifest.series.filter((s) => !s.public);

const dirsOf = async (relative) => (await readdir(path.join(repoRoot, relative), { withFileTypes: true })
  .catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name).sort();

test("the manifest declares every series folder and every post folder once", async () => {
  const slugs = manifest.series.map((s) => s.slug);
  assert.deepEqual([...slugs].sort(), await dirsOf("series"));
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of manifest.series) {
    assert.deepEqual(s.posts.map((p) => p.slug).sort(), await dirsOf(`series/${s.slug}/posts`), s.slug);
    for (const name of s.sources ?? []) {
      assert.ok((await stat(path.join(repoRoot, `series/${s.slug}/sources/${name}/index.html`))).isFile(), name);
    }
  }
});

test("series kept off the list stay off every registry and off the root domain", async () => {
  const llms = await read("llms.txt");
  const library = await read("assets/content-manifest.js");
  const vercel = JSON.parse(await read("vercel.json"));
  const redirects = vercel.redirects ?? [];
  // 빈 목록을 초록으로 읽지 않는다 : 지금 셋이다(게이트 46 ② · 27 ①).
  assert.equal(hiddenSeries.length, 3);
  // trailingSlash true 면 정식 주소가 모두 빗금으로 끝난다. Vercel 은 source 를 strict 하게 맞추므로
  // 「/:path*」 꼴은 그 주소에 걸리지 않는다(C52 · 게이트 30 push 뒤 실측 200). 끝을 「/(.*)」 로 쓴다.
  // 주소마다 실제로 걸리는지는 이 스위트가 아니라 push 전 넘김 흉내가 잰다.
  if (vercel.trailingSlash === true) {
    assert.ok(!redirects.some((r) => r.source.endsWith("/:path*")), "끝 빗금 주소에 걸리지 않는 source 꼴이 있다");
  }
  for (const s of hiddenSeries) {
    assert.doesNotMatch(llms, new RegExp(`/series/${s.slug}/`), s.slug);
    assert.doesNotMatch(library, new RegExp(`series/${s.slug}/`), s.slug);
    const rule = redirects.find((r) => r.source === `/series/${s.slug}/(.*)`);
    assert.ok(rule, `${s.slug} : 루트 도메인에서 내리는 되돌림이 없다`);
    assert.equal(rule.permanent, false, s.slug);
    for (const p of s.posts) assert.deepEqual(p.sourceIds, [], `${s.slug}/${p.slug}`);
  }
  // 미완성 시리즈를 모아 보이던 미리보기 면도 루트 도메인에서는 내린다.
  assert.ok(redirects.some((r) => r.source === "/previews/(.*)" && r.permanent === false));
  for (const s of publicSeries) {
    assert.match(llms, new RegExp(`/series/${s.slug}/`), s.slug);
    assert.ok(!redirects.some((r) => r.source.startsWith(`/series/${s.slug}/`)), s.slug);
    // 도슨트가 없는 시리즈의 공개 원자료는 매니페스트가 적은 것만 목록에 오른다.
    for (const name of s.sources ?? []) assert.match(llms, new RegExp(`/series/${s.slug}/sources/${name}/`), name);
  }
});
