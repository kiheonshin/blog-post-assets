import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 헌장 §8 ③-2 : 발행면에는 단축 링크를 쓰지 않는다. 착지가 숨기 때문이다.
//
// 왜 여기에 두나 (C30) : 이 규칙을 실제로 재는 러너는 아카이브 쪽
// `00-admin/ops/status/audit-published-links.py` 인데, 그것은 이 저장소 밖에 있고
// 세 표면을 네트워크로 확인한다. 공개 저장소의 스위트가 로컬 아카이브 경로에 기대게
// 만들 수는 없고, 네트워크를 타는 검사는 스위트에 둘 것이 못 된다.
//
// 그래서 **네트워크 없이 판정되는 절반만** 여기에 박는다. 단축 링크와 http:// 는
// 파일만 보고 판정되고, 이것이 나머지 절반(죽음·무관착지)이 생기는 통로다.
// 나머지 절반은 발행 push 전에 러너를 돌려 본다 · 그 규칙은 README 발행 절차에 적었다.
//
// 단축 목록의 정본은 아카이브 쪽 `classify-link-landing.py` 의 SHORTENERS 다.
// 아래는 2026-09-06 시점의 사본 31 개 · 정본이 늘면 여기도 늘린다.
const SHORTENERS = new Set([
  "amzn.to", "aol.it", "bit.ly", "buff.ly", "dlvr.it", "durl.me", "fb.me", "flic.kr",
  "goo.gl", "han.gl", "ift.tt", "instagr.am", "is.gd", "j.mp", "kck.st", "lnkd.in",
  "me2.do", "mee.bo", "nyti.ms", "on.fb.me", "ow.ly", "rebrand.ly", "t.co",
  "tinyurl.com", "tmblr.co", "trib.al", "twitpic.com", "url.kr", "vo.la", "wp.me",
  "youtu.be",
]);

const HREF = /(?:href|src)\s*=\s*["'](https?:\/\/[^"'\s<>]+)["']/gi;
const SKIP_DIRS = new Set(["node_modules", ".git", ".astro", ".vercel"]);

// 러너와 같은 방식으로 등록 가능 도메인을 잡는다(`co.kr` 같은 2단계 접미사 포함).
function registrable(host) {
  const parts = host.split(".");
  const second = parts.at(-2);
  if (parts.length >= 3 && ["co", "ne", "or", "ac", "go", "re", "com", "net", "org"].includes(second) && parts.at(-1).length === 2) {
    return parts.slice(-3).join(".");
  }
  return parts.length >= 2 ? parts.slice(-2).join(".") : host;
}

async function externalLinks() {
  const found = [];
  const walk = async (dir) => {
    for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(rel);
      else if (entry.name.endsWith(".html")) {
        const html = await readFile(path.join(repoRoot, rel), "utf8");
        for (const [, url] of html.matchAll(HREF)) found.push({ file: rel, url });
      }
    }
  };
  await walk("");
  return found;
}

test("the published surface carries no link shorteners", async () => {
  const offenders = (await externalLinks())
    .filter(({ url }) => SHORTENERS.has(registrable(new URL(url).hostname.toLowerCase())))
    .map(({ file, url }) => `${file} → ${url}`);
  assert.deepEqual(offenders, [], "단축 링크는 착지를 숨긴다 (헌장 §8 ③-2)");
});

test("the published surface links over https only", async () => {
  const offenders = (await externalLinks())
    .filter(({ url }) => url.startsWith("http://"))
    .map(({ file, url }) => `${file} → ${url}`);
  assert.deepEqual(offenders, []);
});

// 이 스위트가 헛돌지 않는지 스스로 잰다. 위 두 검사는 「하나도 없다」를 주장하므로,
// 훑기가 조용히 0 개를 읽어도 초록이다 · 실제로 파일을 읽고 있는지 못박아 둔다.
test("the link scan actually reaches the published pages", async () => {
  const links = await externalLinks();
  assert.ok(links.length > 200, `외부 링크 ${links.length} 개 · 훑기가 파일을 못 읽고 있다`);
  assert.ok(links.some(({ file }) => file.startsWith("series/")), "series/ 를 훑지 못했다");
  assert.ok(links.some(({ file }) => file === "index.html"), "홈을 훑지 못했다");
});
