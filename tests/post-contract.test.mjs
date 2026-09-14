import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// 왜 있나 (C48 ⑦ ⑧) : 발행 글의 말미 계보 줄(게이트 25 ①)과 안 보이는 근거 메타(게이트 43 ①)는
// 매니페스트에서 나온다. 글 면이나 미러를 새로 쓰는 빌더는 이 둘을 모르므로, 빌더를 다시 돌리고
// 계약 생성기를 안 돌리면 조용히 빠진다. 여기서 그 빠짐을 잡는다.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(repoRoot, relative), "utf8");
const manifest = JSON.parse(await read("series/manifest.json"));
const publicSeries = manifest.series.filter((s) => s.public);
const hiddenSeries = manifest.series.filter((s) => !s.public);

// 게이트 25 ① : 저작 고지 뒤의 계보 한 줄. 인용은 2025년 기고문 원문 그대로다.
const LINEAGE = "이 방식은 저자가 2025년의 한 기고문에서 스스로 설명한 것이다. "
  + "「이 일련의 과정에서 중요한 것은 글의 완성도만이 아니었다. 실험의 설계와 전개 과정, "
  + "그리고 그 안에 담긴 근본적인 질문 자체가 그보다 중요하게 다가왔다.」";

test("public posts carry the manifest's source ids as invisible page meta", async () => {
  let withIds = 0;
  for (const s of publicSeries) {
    for (const p of s.posts) {
      const html = await read(`series/${s.slug}/posts/${p.slug}/index.html`);
      const metas = [...html.matchAll(/<meta name="source-ids" content="([^"]*)">/g)];
      if (p.sourceIds.length === 0) {
        assert.equal(metas.length, 0, p.slug);
        continue;
      }
      // 공개 메타에는 node · deck 만 싣는다. 다른 접두는 이름이 든 슬러그이거나 작업 기록이다.
      for (const id of p.sourceIds) assert.match(id, /^(?:node|deck):[A-Za-z0-9:._-]+$/, id);
      assert.equal(metas.length, 1, p.slug);
      assert.equal(metas[0][1], p.sourceIds.join(" "), p.slug);
      withIds += 1;
    }
  }
  // 초고 머리말에 근거가 적힌 발행 글이 이만큼이다(2026-09-15). 줄면 어디서 빠졌는지 본다.
  assert.equal(withIds, 12);
});

test("public posts close with the lineage line right after the authorship notice", async () => {
  let seen = 0;
  for (const s of publicSeries) {
    for (const p of s.posts) {
      const html = await read(`series/${s.slug}/posts/${p.slug}/index.html`);
      const start = html.indexOf('<footer class="foot" id="authorship">');
      const foot = html.slice(start, html.indexOf("</footer>", start));
      assert.equal(foot.split('<p class="lineage">').length - 1, 1, p.slug);
      assert.ok(foot.includes(`<p class="lineage">${LINEAGE}<!--src:node:280--></p>`), p.slug);
      assert.ok(foot.indexOf('<p class="lineage">') < foot.indexOf('<p class="en">'), p.slug);
      const markdown = await read(`series/${s.slug}/posts/${p.slug}/content.md`);
      assert.equal(markdown.split(`- **계보** ${LINEAGE}\n`).length - 1, 1, p.slug);
      seen += 1;
    }
  }
  assert.equal(seen, 21);
});

test("posts of series kept off the list do not carry the lineage line yet", async () => {
  for (const s of hiddenSeries) {
    for (const p of s.posts) {
      const html = await read(`series/${s.slug}/posts/${p.slug}/index.html`);
      assert.doesNotMatch(html, /class="lineage"/, `${s.slug}/${p.slug}`);
      assert.doesNotMatch(html, /<meta name="source-ids"/, `${s.slug}/${p.slug}`);
    }
  }
});
