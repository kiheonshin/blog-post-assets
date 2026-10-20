// 공개 면 마감 고침 넷 (2026-10-20 · 메인 세션 전체 검수 C1~C4)을 잠근다.
// C1 면을 옮긴 뒤 페이지 데이터 안 상대 주소가 옛 자리를 가리키던 것 · C2 좁은 화면에서 슬라이드 무대가 넘치던 것 ·
// C3 공유 그림(og:image)이 없던 공개 면 · C4 두 면이 같은 제목을 쓰던 것.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

async function walk(dir, out = []) {
  for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel", "tests"].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(rel, out);
    else out.push(rel);
  }
  return out;
}

async function deployedPages() {
  const ignored = (await read(".vercelignore")).split("\n").map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const pages = [];
  for (const file of await walk("")) {
    if (!file.endsWith("index.html")) continue;
    if (ignored.some((rule) => rule.endsWith("/") ? file.startsWith(rule) : file === rule)) continue;
    const html = await read(file);
    if (/http-equiv="refresh"/i.test(html)) continue;
    pages.push({ file, html });
  }
  return pages;
}

function resolvesInRepo(fromFile, href) {
  const clean = href.split(/[?#]/, 1)[0];
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  if (target.startsWith("universe/") || target === "universe") return true; // 공개 관측소는 반출본 배포(vercel rewrites)
  const full = path.join(repoRoot, target);
  return clean.endsWith("/") ? existsSync(path.join(full, "index.html")) : existsSync(full) || existsSync(path.join(full, "index.html"));
}

test("relative links in anchors and in page data resolve to files that exist", async () => {
  const broken = [];
  for (const { file, html } of await deployedPages()) {
    const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((match) => match[1]);
    const data = [...html.matchAll(/"(?:href|thumb)":\s*"([^"]+)"/g)].map((match) => match[1]);
    for (const href of [...anchors, ...data]) {
      if (/^(?:[a-z]+:|\/\/|#|\/api\/)/.test(href) || href.includes("'") || href.includes("${")) continue;
      const local = href.startsWith("/") ? path.posix.relative(path.posix.dirname(file), href.slice(1)) || "." : href;
      if (!resolvesInRepo(file, local)) broken.push(`${file} -> ${href}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("every public page has a share image that exists on the site", async () => {
  const missing = [];
  for (const { file, html } of await deployedPages()) {
    const image = html.match(/<meta property="og:image" content="https:\/\/kiheon\.com\/([^"?#]+)[^"]*"/);
    if (!image || !existsSync(path.join(repoRoot, image[1]))) missing.push(file);
  }
  assert.deepEqual(missing, []);
});

test("no two public pages share a title", async () => {
  const seen = new Map();
  const duplicates = [];
  for (const { file, html } of await deployedPages()) {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    if (!title) continue;
    if (seen.has(title)) duplicates.push(`${seen.get(title)} = ${file}`);
    else seen.set(title, file);
  }
  assert.deepEqual(duplicates, []);
});

test("the intro deck stage scales to the screen width below 1280px and prints at full size", async () => {
  const html = await read("series/life-universe/sources/universe-intro/index.html");
  assert.match(html, /\.deck-stage \{\s*width: calc\(var\(--ks-slide-w\) \* var\(--deck-scale, 1\)\);\s*height: calc\(var\(--ks-slide-h\) \* var\(--deck-scale, 1\)\);/);
  assert.match(html, /\.slide \{\s*transform: scale\(var\(--deck-scale, 1\)\);\s*transform-origin: top left;/);
  assert.match(html, /page-break-after: always;\s*transform: none;/);
  assert.match(html, /const scale = width >= 1280 \? 1 : Math\.max\(0\.1, \(width - 32\) \/ 1280\);/);
  assert.match(html, /setProperty\("--deck-scale", String\(scale\)\)/);
});
