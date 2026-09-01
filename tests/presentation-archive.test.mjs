import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveRoot = "series/metaverse-era/sources/presentations";
const read = (relative) => readFile(path.join(repoRoot, relative), "utf8");
const slugs = [
  "young-art-interview-2017",
  "commons-protocol-economy-2021",
  "korean-art-nft-2021",
  "day3-nft-artists-2022",
  "web3-digital-creation-2022",
];

const titles = [
  "2017 젊은 예술, 생각을 디자인하다 인터뷰",
  "2021 커먼즈펍 — 모든 것이 연결되는 프로토콜 기반의 가상경제",
  "2021 한국미술 — NFT가 제도권 예술에 가져온 변화",
  "2022 DAY 3 — NFT와 예술가",
  "2022 웹3.0 시대 — 디지털·온라인 환경에서 창작하기",
];

const lineageSlugs = [
  "web3-next-billion-2024",
  "metaverse-beyond-experience-2024",
  "generative-ai-metaverse-2024",
];

const lineageTitles = [
  "2024 웹3 확장 지도 — 프로토콜에서 다음 10억 명까지",
  "우리의 경험 너머의 메타버스 — 경험·정체성·웹3·커뮤니티의 통합",
  "생성 AI 시대의 새로운 메타버스 — 자율 세계 발표의 후기 재편집",
];

const allSlugs = [...slugs, ...lineageSlugs];

test("the archive builds one index and eight human-readable detail pages", async () => {
  const index = await read(`${archiveRoot}/index.html`);
  assert.match(index, /<h1>공개 발표와 자료의 연결<\/h1>/);
  // 본인 승인 2026-09-01(G3)으로 공개됐다. 이전에는 후보라 noindex 를 잠갔는데,
  // 이제는 그 반대를 잠근다 — 아홉 면 어디에도 noindex 가 되살아나면 안 되고,
  // 발견 경로(content-manifest)에 등재돼 있어야 한다. 적격성 근거는
  // 아틀라스 판정 `2026-09-01-0640`(2022 원 덱 2벌 스윕 청정).
  assert.doesNotMatch(index, /noindex/);
  assert.match(index, /영상 5편 · 자료 계보 3편/);
  assert.equal([...index.matchAll(/<li id="[^"]+">/g)].length, 8);

  for (const [position, slug] of slugs.entries()) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    assert.match(detail, new RegExp(`<h1>${titles[position]}</h1>`));
    assert.match(detail, /<meta name="source-ids" content="node:234 node:237 node:243">/);
    assert.match(detail, /<nav class="pa-toc" aria-label="이 페이지 차례">/);
  }

  for (const [position, slug] of lineageSlugs.entries()) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    assert.match(detail, new RegExp(`<h1>${lineageTitles[position]}</h1>`));
    assert.match(detail, new RegExp(`<meta name="source-ids" content="node:${244 + position} deck:`));
    assert.match(detail, /<nav class="pa-toc" aria-label="이 페이지 차례">/);
    assert.match(detail, /텍스트 판본 구조 제공/);
  }
});

test("raw video IDs are secondary metadata, never primary labels", async () => {
  const ids = ["7L-8FyzNpHg", "oeq1ovBkqIQ", "Crd8MXo4WTQ", "7txZShIZHxk", "gnr2FTcNz84"];
  const index = await read(`${archiveRoot}/index.html`);
  for (const id of ids) assert.doesNotMatch(index, new RegExp(id));

  for (const [position, slug] of slugs.entries()) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    const h1 = detail.match(/<h1>(.*?)<\/h1>/)?.[1] ?? "";
    assert.equal(h1, titles[position]);
    assert.match(detail, /<summary>기술 정보<\/summary>/);
  }
});

test("speaker boundaries and page evidence stay explicit", async () => {
  const day3 = await read(`${archiveRoot}/day3-nft-artists-2022/index.html`);
  assert.match(day3, /00:01:32–00:54:08 신기헌 발표만 사용/);
  assert.match(day3, /00:25:10–00:54:08/);
  assert.match(day3, /watch\?v=7txZShIZHxk&amp;t=1510s/);
  assert.doesNotMatch(day3, /watch\?v=7txZShIZHxk&amp;t=1500s/);
  assert.match(day3, /00:54:08 이후/);
  assert.match(day3, /화자 분리 전 사용하지 않음/);

  const commons = await read(`${archiveRoot}/commons-protocol-economy-2021/index.html`);
  assert.match(commons, /\.\.\/\.\.\/slides-2021-04-20\/#7/);
  assert.match(commons, /\.\.\/\.\.\/\.\.\/assets\/deck-c2\/slide-007\.jpg/);

  const kams = await read(`${archiveRoot}/korean-art-nft-2021/index.html`);
  assert.match(kams, /\.\.\/\.\.\/slides-2021-10-27\/#104/);
  assert.match(kams, /\.\.\/\.\.\/\.\.\/assets\/deck-f\/slide-104\.jpg/);
});

test("archive slide links follow the source-deck numeric hash contract", async () => {
  const viewer = await read("assets/source-deck.js");
  assert.match(viewer, /parseInt\(location\.hash\.slice\(1\), 10\)/);
  assert.match(viewer, /if \(h >= 1 && h <= S\.length\) open\(h\)/);

  for (const slug of ["commons-protocol-economy-2021", "korean-art-nft-2021"]) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    const sourceLinks = [...detail.matchAll(/href="\.\.\/\.\.\/slides-[^"]+\/#([^"]+)"/g)];
    assert.ok(sourceLinks.length > 0, `${slug} has no source-deck links`);
    for (const link of sourceLinks) assert.match(link[1], /^\d+$/);
    assert.doesNotMatch(detail, /slides-[^"]+\/#s\d+/);
  }
});

test("video access is explicit and never autoplaying or embedded", async () => {
  for (const slug of slugs) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    assert.match(detail, /https:\/\/www\.youtube\.com\/watch\?v=/);
    assert.doesNotMatch(detail, /autoplay/i);
    assert.doesNotMatch(detail, /<iframe|<video/);
  }
});

test("2024 lineage pages expose structure without media or downloads", async () => {
  const expectedDeckIds = [
    ["deck:2024-09-10:e629e2442293", "deck:2024-09-10:207288c53476"],
    ["deck:2024-10-29:4397cc1d1089", "deck:2024-10-29:7e7e64fe4964"],
    [
      "deck:2024-10-29:60f7768c0da3",
      "deck:2024-10-29:8977edf7401d",
      "deck:2024-07-07:c04072cabb73",
    ],
  ];
  for (const [position, slug] of lineageSlugs.entries()) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    assert.match(detail, /현재 이 페이지에서는 제목과 판본 구조만 제공하며 원본 파일과 내장 미디어는 공개하지 않습니다/);
    assert.match(detail, /id="versions"/);
    assert.match(detail, /id="notes"/);
    assert.match(detail, /id="lineage"/);
    assert.doesNotMatch(detail, /<iframe|<video|<img|autoplay|download/i);
    assert.doesNotMatch(detail, /youtube\.com|\.pptx(?:[?"#]|$)|\.pdf(?:[?"#]|$)/i);
    for (const deckId of expectedDeckIds[position]) assert.match(detail, new RegExp(deckId));
  }
});

test("the local candidate contains no private paths or forbidden source material", async () => {
  const forbidden = [
    "/Volumes/SSD",
    "/Users/artifact",
    "OneDrive-",
    "90-raw-staging",
    "UNOPND",
    "app.notion.com",
  ];
  for (const relative of ["index.html", ...allSlugs.map((slug) => `${slug}/index.html`)]) {
    const html = await read(`${archiveRoot}/${relative}`);
    for (const value of forbidden) assert.doesNotMatch(html, new RegExp(value));
  }
});

test("2022 pages do not link or rehost unapproved deck assets", async () => {
  for (const slug of ["day3-nft-artists-2022", "web3-digital-creation-2022"]) {
    const detail = await read(`${archiveRoot}/${slug}/index.html`);
    assert.doesNotMatch(detail, /deck-[a-z0-9]+\/slide-|slides-2022|\.pdf|\.pptx/i);
    assert.match(detail, /2022년 덱 이미지와 원본 파일은 싣지 않습니다/);
  }
});

test("public copy omits internal governance wording", async () => {
  const forbidden = [
    "후보",
    "비공개 대기",
    "공개 가능 여부",
    "로컬 검토",
    "승인 대기",
    "근거:",
    "pipeline PASS",
    "owner gate",
    "local-only",
  ];
  for (const relative of ["index.html", ...allSlugs.map((slug) => `${slug}/index.html`)]) {
    const html = await read(`${archiveRoot}/${relative}`);
    for (const value of forbidden) assert.doesNotMatch(html, new RegExp(value));
    const body = html.match(/<body[\s\S]*?<\/body>/)?.[0] ?? "";
    const visibleText = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.doesNotMatch(visibleText, /node:/i);
    assert.doesNotMatch(visibleText, /공개 범위.{0,20}확정|확정.{0,20}공개 범위/);
  }
});

test("the Web3 page links all available 2021 public source evidence", async () => {
  const web3 = await read(`${archiveRoot}/web3-digital-creation-2022/index.html`);
  assert.match(web3, /\.\.\/\.\.\/slides-2021-03-27\//);
  for (const page of [100, 115, 81, 108, 107, 130]) {
    assert.match(web3, new RegExp(`\\.\\.\\/\\.\\.\\/slides-2021-10-27\\/#${page}`));
  }
  assert.doesNotMatch(web3, /slides-2022|deck-[a-z0-9]+\/slide-/i);
});

test("every local href, image and in-page anchor resolves", async () => {
  const pages = ["index.html", ...allSlugs.map((slug) => `${slug}/index.html`)];
  for (const relative of pages) {
    const absolute = path.join(repoRoot, archiveRoot, relative);
    const html = await read(`${archiveRoot}/${relative}`);
    const attributes = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const value of attributes) {
      if (/^(?:https?:|#)/.test(value)) continue;
      const [pathname] = value.split(/[?#]/, 1);
      const target = path.resolve(path.dirname(absolute), pathname);
      const metadata = await stat(target);
      await readFile(metadata.isDirectory() ? path.join(target, "index.html") : target);
    }
    for (const anchor of [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])) {
      assert.match(html, new RegExp(`id="${anchor}"`), `${relative}#${anchor}`);
    }
  }
});

test("the presentation archive is registered where the site finds its own pages", async () => {
  // 검색에 열어 두고 사이트 내부 색인에는 안 넣으면, 사람은 검색으로만 닿고
  // 사이트 안에서는 길이 없다. 두 쪽을 함께 잠근다.
  const manifest = await read("assets/content-manifest.js");
  assert.match(manifest, /series\/metaverse-era\/sources\/presentations\//);
  assert.match(manifest, /공개 발표와 자료의 연결/);
});
