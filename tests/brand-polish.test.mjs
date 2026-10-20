// 브랜딩 최종 폴리싱 (2026-10-20 · 계약 v1.1 §1 · §6 · 메인 세션 지시 ①~⑤)을 잠근다.
// 정문 이름 두 층 : 문서 제목 꼬리는 사람(Kiheon Shin), 체계 이름(Kiheon Life Universe)은 바닥 서명 · 소개 문장 · 관측소에서만.
// 긴 줄표(U+2014)는 우리가 쓰는 자리에 쓰지 않는다 : 원자료 본문을 글자 그대로 옮긴 인용만 예외.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const DASH = "\u2014";
const TAIL = " · Kiheon Shin";

async function walk(dir, out = []) {
  for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel", "tests"].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(rel, out);
    else out.push(rel);
  }
  return out;
}

async function deployedFiles() {
  const ignored = (await read(".vercelignore")).split("\n").map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return (await walk("")).filter((file) => !ignored.some((rule) =>
    rule.endsWith("/") ? file.startsWith(rule) : file === rule || file.split("/")[0] === rule));
}

async function publicPages() {
  const pages = [];
  for (const file of await deployedFiles()) {
    if (!file.endsWith("index.html")) continue;
    const html = await read(file);
    if (/http-equiv="refresh"/i.test(html)) continue;
    pages.push({ file, html });
  }
  return pages;
}

const metaContent = (html, key) =>
  html.match(new RegExp(`<meta (?:property|name)="${key.replace(":", "\\:")}" content="([^"]*)"`))?.[1];

test("every public page title and share title end with the person's name", async () => {
  const wrong = [];
  for (const { file, html } of await publicPages()) {
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    if (!title?.endsWith(TAIL)) wrong.push(`${file} title`);
    const og = metaContent(html, "og:title");
    if (!og?.endsWith(TAIL)) wrong.push(`${file} og:title`);
    const twitter = metaContent(html, "twitter:title");
    if (twitter !== undefined && !twitter.endsWith(TAIL)) wrong.push(`${file} twitter:title`);
  }
  assert.deepEqual(wrong, []);
});

// 원자료 본문을 글자 그대로 옮긴 인용 : 2025년 9월 연구 노트 원문의 붙여 쓴 줄표 넷.
const VERBATIM = new Map([["series/aigc-creative-paradigm/sources/research/index.html", 4]]);

test("no em dash in authored text on any deployed page, apart from verbatim source quotes", async () => {
  const found = [];
  for (const file of await deployedFiles()) {
    if (!file.endsWith(".html")) continue;
    const visible = (await read(file))
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "");
    const count = visible.split(DASH).length - 1;
    const allowed = VERBATIM.get(file) ?? 0;
    if (count !== allowed) found.push(`${file} ${count}`);
    if (allowed) {
      const spaced = visible.match(new RegExp(`\\s${DASH}|${DASH}\\s`, "g")) ?? [];
      assert.deepEqual(spaced, [], `${file} : 띄어 쓴 줄표는 우리가 쓴 구분자다`);
    }
  }
  assert.deepEqual(found, []);
});

test("deployed scripts keep em dashes only inside comments", async () => {
  const found = [];
  for (const file of await deployedFiles()) {
    if (!/\.(m?js)$/.test(file)) continue;
    const code = (await read(file))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
    if (code.includes(DASH)) found.push(file);
  }
  assert.deepEqual(found, []);
});

test("published text files and public docs carry no em dash", async () => {
  const found = [];
  for (const file of await deployedFiles()) {
    if (!/(\.txt|\.xml|content\.md)$/.test(file) && !(file.startsWith("docs/") && file.endsWith(".md"))) continue;
    if ((await read(file)).includes(DASH)) found.push(file);
  }
  assert.deepEqual(found, []);
});

// 바닥 서명 : 체계 이름은 공개 글 귀속과 함께 한 줄로, 면마다 한 번(계약 v1.1 §1 · 2026-10-20).
const SIGN = '<p class="site-footer__sign"><span class="site-footer__system">Kiheon Life Universe</span> · 신기헌의 디지털 트윈 프로젝트</p>';

test("every public page carries the system signature exactly once, in the same words", async () => {
  const wrong = [];
  for (const { file, html } of await publicPages()) {
    const exact = html.split(SIGN).length - 1;
    const any = html.split('class="site-footer__sign"').length - 1;
    if (exact !== 1 || any !== 1) wrong.push(`${file} ${exact}/${any}`);
  }
  assert.deepEqual(wrong, []);
});

test("the signature sits inside the page footer, after the footer's own labels", async () => {
  const wrong = [];
  for (const { file, html } of await publicPages()) {
    const at = html.indexOf(SIGN);
    const footer = html.lastIndexOf("<footer", at);
    const close = html.indexOf("</footer>", at);
    if (footer < 0 || close < 0 || html.indexOf("</footer>", footer) !== close) wrong.push(file);
  }
  assert.deepEqual(wrong, []);
});

test("the public brand docs follow contract v1.1: one sans set, two-layer names, no /map route", async () => {
  const brand = await read("docs/brand/kiheon-life-universe-brand-system-v1.md");
  assert.match(brand, /^# Kiheon Life Universe Brand System v1\.1$/m);
  assert.doesNotMatch(brand.replace(/산세리프/g, ""), /세리프/);
  assert.match(brand, /\| 정문 \(누구의 사이트인가\) \| 신기헌 · Kiheon Shin \|/);
  assert.match(brand, /\| 체계 \(무엇이 이 사이트를 굴리는가\) \| Kiheon Life Universe \|/);
  assert.match(brand, /\| Slides \| 발표 서사와 화면 \| kiheon\.app 보호면 \| 공개 전 \|/);
  const roadmap = await read("docs/product/kiheon-life-universe-surface-roadmap-20260831.md");
  assert.doesNotMatch(roadmap, /observatory\.vercel\.app\/map/);
  assert.match(roadmap, /\| Universe \| `https:\/\/kiheon\.com\/universe\/`/);
});
