import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seriesRoot = path.join(repoRoot, "series");
const korean = "이 글은 신기헌의 디지털 트윈 프로젝트를 바탕으로 AI 에이전트가 100% 작성하고 편집했다.";
const english = "Written and edited 100% by an AI agent from the Kiheon Shin Digital Twin project.";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

test("every normal series post shares one canonical footer and tool layer", async () => {
  const candidates = (await walk(seriesRoot))
    .filter((file) => file.endsWith(`${path.sep}index.html`))
    .filter((file) => file.includes(`${path.sep}posts${path.sep}`))
    .filter((file) => !file.includes(`${path.sep}full${path.sep}`))
    .sort();

  // 되돌림 페이지는 글이 아니라 옛 주소를 새 주소로 넘기는 껍데기다 — 본문이 없으니
  // 말미 계약을 지킬 수 없다. 세지 않고 빼되 **몇 장인지 함께 못 박는다.** 조용히
  // 거르면, 진짜 글이 껍데기로 오인돼 빠져도 이 검사가 말해 주지 않는다.
  const pages = [];
  const redirects = [];
  for (const file of candidates) {
    const html = await readFile(file, "utf8");
    (/<meta http-equiv="refresh"/.test(html) ? redirects : pages).push(file);
  }
  // 1 [2026-09-05] handed-down/posts/02 — df6c611 이 개명하며 안 남긴 옛 주소를 되살렸다.
  assert.equal(redirects.length, 1);

  // 24 → 25 [2026-09-01] 시리즈 08 「덕질의 상속」 2편이 로컬 후보로 섰다.
  // 이 수는 **말미 계약을 지키는 면의 수**이지 발행 면의 수가 아니다 —
  // went-in-first 3면과 where-worlds-meet(옛 handed-down) 1면은 noindex·매니페스트
  // 미등재의 미발행 면이다.
  assert.equal(pages.length, 25);
  for (const file of pages) {
    const html = await readFile(file, "utf8");
    const relative = path.relative(repoRoot, file);
    const footerAt = html.indexOf('<footer class="foot" id="authorship">');
    const toolsAt = html.indexOf('<div class="post-tools">');
    const rowAt = html.indexOf('class="post-tools__row"');
    const dynamicLinksAt = html.indexOf("<series-post-links ");
    const staticLinksAt = html.indexOf('<nav class="serieslinks"');
    const linksAt = Math.max(dynamicLinksAt, staticLinksAt);

    assert.ok(footerAt >= 0, relative);
    assert.ok(toolsAt > footerAt, relative);
    assert.ok(linksAt > toolsAt && linksAt < rowAt, relative);
    assert.ok(rowAt > linksAt, relative);
    assert.match(html, /시리즈 홈으로/);
    assert.match(html, /assets\/agent-handoff\.js/);
    assert.match(html, /assets\/post\.css/);
    assert.match(html, /assets\/site\.css/);
    assert.equal(html.split(korean).length - 1, 1, relative);
    assert.equal(html.split(english).length - 1, 1, relative);
    assert.doesNotMatch(html, /Originally published at https:\/\/kiheon\.com/);
    assert.doesNotMatch(html, /local-state|local\.css/);

    const markdown = path.join(path.dirname(file), "content.md");
    assert.ok((await stat(markdown)).size > 500, path.relative(repoRoot, markdown));
  }
});
