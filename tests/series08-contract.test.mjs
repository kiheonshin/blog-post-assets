import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seriesRoot = path.join(repoRoot, "series/where-worlds-meet");
const read = (relative) => readFile(path.join(seriesRoot, relative), "utf8");
const readRepo = (relative) => readFile(path.join(repoRoot, relative), "utf8");

const pages = ["index.html", "posts/02-child-pokemon-and-me/index.html"];

// 시리즈 08 은 본문만 발행 적격이고 도판·커버는 아직 판정 전이다. 이 파일은 그 경계를
// 기계로 세워 둔다 — 다음 회차가 무심코 이미지를 심으면 여기서 걸린다.
test("Series 08 carries no figure while the redaction gate is open", async () => {
  // node:247 의 human-redaction-required 5건(D022·D139·D177·D178·D220)과 정본 278장의
  // 공개 가능 장 선정이 모두 [대기]다. 그 둘이 풀리기 전에는 도판이 한 건도 설 수 없다.
  for (const page of pages) {
    const html = await read(page);
    assert.equal([...html.matchAll(/<img\b/g)].length, 0, page);
    assert.equal([...html.matchAll(/<iframe\b/g)].length, 0, page);
    assert.equal([...html.matchAll(/class="media-figure/g)].length, 0, page);
    assert.equal([...html.matchAll(/class="hero"/g)].length, 0, page);
  }
});

test("Series 08 stays unpublished on every registry the site reads", async () => {
  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/, page);
    // 미발행 면은 정본 주소를 주장하지 않고 공유 카드를 미리 심지 않는다.
    assert.doesNotMatch(html, /rel="canonical"/, page);
    assert.doesNotMatch(html, /property="og:/, page);
    assert.doesNotMatch(html, /googletagmanager/, page);
  }
  assert.doesNotMatch(await readRepo("assets/content-manifest.js"), /where-worlds-meet/);
  assert.doesNotMatch(await readRepo("llms.txt"), /where-worlds-meet/);
});

test("Series 08 keeps working material off the public surface", async () => {
  const surfaces = [...pages, "posts/02-child-pokemon-and-me/content.md"];
  for (const surface of surfaces) {
    const text = await read(surface);
    // 출처 ID·작업 경로·연락처는 ③층의 표기다. ④발행본에 실리면 누출이다.
    assert.doesNotMatch(text, /node:\d+/, surface);
    assert.doesNotMatch(text, /owner:\d{4}-\d{2}-\d{2}/, surface);
    assert.doesNotMatch(text, /\/Volumes\/|file:\/\//, surface);
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.]+/, surface);
    // 마스킹 규약 §6 — 아이는 「아이」 통칭. 나이·학교·생일은 닫힌다.
    assert.doesNotMatch(text, /\d+살|\d+세\b|초등학교|유치원|생일/, surface);
  }
});

test("Series 08 quotes stay in the site's own grammar", async () => {
  const html = await read("posts/02-child-pokemon-and-me/index.html");
  // 발행 24면에는 blockquote·mark·em·strong 이 한 건도 없다. 이 사이트의 인용 문법은
  // 문단 안의 낫표뿐이고, 08 이 새 요소를 들이면 그것이 새 문법이 된다.
  assert.doesNotMatch(html, /<blockquote|<mark\b|<em>|<strong>|<q>/);
  // 승인 발화 12건 + 목록 항목명 「덕질의 상속」 1건 = 낫표 쌍 13.
  assert.equal([...html.matchAll(/「/g)].length, 13);
  assert.equal([...html.matchAll(/」/g)].length, 13);
});

test("Series 08 links only to parts that exist", async () => {
  for (const page of pages) {
    const html = await read(page);
    // 1편은 차단, 3편은 본인 집필 대기다. 없는 주소를 걸면 깨진 링크가 되고,
    // 목록에서 빼면 세 편짜리 시리즈라는 사실이 사라진다 — 링크가 아닌 카드로 둔다.
    assert.doesNotMatch(html, /01-learning-the-worlds\//, page);
    assert.doesNotMatch(html, /03-keeping-and-handing-over\//, page);
    assert.match(html, /세계를 배우러 먼저 다닌 시간/, page);
    assert.match(html, /저장하고 건네고 함께 자라는 법/, page);
  }
});
