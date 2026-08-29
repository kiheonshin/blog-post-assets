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
  const pages = (await walk(seriesRoot))
    .filter((file) => file.endsWith(`${path.sep}index.html`))
    .filter((file) => file.includes(`${path.sep}posts${path.sep}`))
    .filter((file) => !file.includes(`${path.sep}full${path.sep}`))
    .sort();

  assert.equal(pages.length, 24);
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
    assert.doesNotMatch(html, /Originally published at https:\/\/kiheonshin\.github\.io/);
    assert.doesNotMatch(html, /local-state|local\.css/);

    const markdown = path.join(path.dirname(file), "content.md");
    assert.ok((await stat(markdown)).size > 500, path.relative(repoRoot, markdown));
  }
});
