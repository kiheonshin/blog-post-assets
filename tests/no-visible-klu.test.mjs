// 화면에 보이는 글자에는 「KLU」 를 쓰지 않는다 (본인 2026-10-10 「'KLU'라는 표현은 사용하지 말자.
// 나만 아는 약어고 웹사이트에 보여질 때는 그 표현이 마음에 들지 않아」).
// 파일 이름 · 클래스 · data 속성 · CSS 변수처럼 화면에 안 보이는 식별자는 대상이 아니다(klu-system-map 등).
// 배포되는 면(.vercelignore 밖)의 HTML · SVG 글자 마디와 보이는 속성, 화면에 찍히는 assets 의 JS 문자열과
// 도슨트 문맥의 값을 본다. 2026-10-20 첫 화면 시스템 지도의 머리글에서 하나가 남아 있던 것을 걷으며 잠근다.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const KLU = /\bKLU\b/;
const VISIBLE_ATTRS = /\s(?:alt|title|aria-label|aria-description|placeholder|label)="([^"]*)"/g;

async function walk(dir, out = []) {
  for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel", "tests"].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(rel, out);
    else out.push(rel);
  }
  return out;
}

async function deployed() {
  const ignored = (await read(".vercelignore")).split("\n").map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return (await walk("")).filter((file) => !ignored.some((rule) => rule.endsWith("/") ? file.startsWith(rule) : file === rule));
}

function visibleText(markup) {
  const body = markup
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const text = body.replace(/<[^>]*>/g, "\n");
  const attrs = [...body.matchAll(VISIBLE_ATTRS)].map((match) => match[1]);
  const metas = [...body.matchAll(/<meta\s[^>]*(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*content="([^"]*)"/gi)].map((match) => match[1]);
  return [text, ...attrs, ...metas];
}

test("no deployed page or diagram shows the KLU abbreviation", async () => {
  const offenders = [];
  for (const file of (await deployed()).filter((name) => /\.(html|svg)$/.test(name))) {
    const parts = visibleText(await read(file));
    if (parts.some((part) => KLU.test(part))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("no screen string in assets scripts or docent context uses the KLU abbreviation", async () => {
  const offenders = [];
  for (const file of (await deployed()).filter((name) => name.startsWith("assets/") && /\.(m?js)$/.test(name))) {
    const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const match of code.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
      if (KLU.test(match[2])) offenders.push(`${file} : ${match[2].slice(0, 60)}`);
    }
  }
  for (const file of (await deployed()).filter((name) => /^series\/[^/]+\/assistant\/context\.json$/.test(name))) {
    const values = [];
    const collect = (value) => {
      if (typeof value === "string") values.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(JSON.parse(await read(file)));
    if (values.some((value) => KLU.test(value))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("the system map kicker uses the Life Universe name", async () => {
  const svg = await read("assets/diagrams/klu-system-map.svg");
  assert.match(svg, /class="km-kicker"[^>]*>LIFE UNIVERSE PUBLIC SURFACE MAP · SUMMARY</);
});
