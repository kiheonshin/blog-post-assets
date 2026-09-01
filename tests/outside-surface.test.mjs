import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("Outside remains a noindex candidate on the legacy compatible route", async () => {
  const html = await read("archive/world-atlas/index.html");
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html, /<title>Outside · Public Archive · Kiheon Shin<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/kiheon\.com\/archive\/world-atlas\/">/);
  assert.match(html, />PUBLIC ARCHIVE \/ OUTSIDE</);
  assert.match(html, />기록을 펼쳐 장면과 관계를 비교합니다</);
  assert.doesNotMatch(html, />\s*(World Atlas|Inner World|Life World)\s*</);
});

test("Outside keeps the shared seam visible without opening Inside", async () => {
  const html = await read("archive/world-atlas/index.html");
  const css = await read("archive/world-atlas/world-atlas.css");
  const context = JSON.parse(await read("archive/world-atlas/world-atlas-context.json"));
  assert.match(html, /class="shared-seam/);
  assert.match(html, />SHARED SEAM</);
  assert.match(html, />보호된 반대 면</);
  assert.match(html, />기록 안으로 들어가는 면 · 링크 없음</);
  assert.equal(context.sharedSeam.inside.name, "Inside");
  assert.equal(context.sharedSeam.inside.accessLabel, "보호됨 · 링크 없음");
  assert.equal(context.counts.futureExperienceLinks, 0);
  assert.ok(context.boundaries.every((boundary) => boundary.linkable === false));
  assert.doesNotMatch(html, /href="[^"]*(inside|inner-world|universe\/world)/i);
  assert.match(css, /\.shared-seam__side \{[\s\S]*align-items: center;[\s\S]*text-align: center;/);
  assert.match(css, /\.shared-seam__side--outside > p \{[\s\S]*text-align: left;/);
  assert.match(css, /\.shared-seam__side--inside > p \{[\s\S]*text-align: right;/);
});

test("Outside zone navigation scales from data instead of a five-item layout", async () => {
  const html = await read("archive/world-atlas/index.html");
  const css = await read("archive/world-atlas/world-atlas.css");
  const script = await read("archive/world-atlas/world-atlas.js");
  const context = JSON.parse(await read("archive/world-atlas/world-atlas-context.json"));

  assert.match(html, /data-zone-tablist/);
  assert.match(html, /data-zone-panel/);
  assert.doesNotMatch(html, /FIVE PUBLIC SERIES/);
  assert.match(css, /grid-auto-flow: column/);
  assert.match(css, /grid-auto-columns: minmax\(13rem, 18rem\)/);
  assert.doesNotMatch(css, /repeat\(5,/);
  assert.match(script, /state\.context\.zones\.length/);
  assert.match(script, /context\.zones\[0\]\.id/);
  assert.doesNotMatch(script, /zoneId:\s*"zone-01"/);

  assert.equal(context.counts.zones, context.zones.length);
  assert.equal(context.counts.relations, context.relations.length);
  assert.equal(new Set(context.zones.map((zone) => zone.id)).size, context.zones.length);
  for (const zone of context.zones) {
    assert.match(zone.assetPairId, /^outside-inside-zone-/);
    assert.match(zone.sourceRef, /^site:series\//);
    assert.notEqual(zone.observed, zone.readingProposal);
    await access(path.join(repoRoot, "archive/world-atlas", zone.image.src));
  }
});

test("Outside gives wide images the full stage and an accessible full-view dialog", async () => {
  const html = await read("archive/world-atlas/index.html");
  const css = await read("archive/world-atlas/world-atlas.css");
  const script = await read("archive/world-atlas/world-atlas.js");
  assert.match(html, /<dialog class="image-dialog"/);
  assert.match(html, /data-dialog-close aria-label="전체 보기 닫기"/);
  assert.match(css, /\.image-open img[\s\S]*object-fit: contain/);
  assert.match(css, /\.outside-page img \{[\s\S]*height: auto/);
  assert.doesNotMatch(css, /position:\s*fixed[^}]*sidebar/i);
  assert.match(script, /dialog\.showModal\(\)/);
  assert.match(script, /state\.dialogReturnFocus\?\.focus\(\)/);
  assert.match(script, /ArrowRight/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /event\.key === "Home"/);
  assert.match(script, /event\.key === "End"/);
  assert.match(script, /focusSelected = false/);
  assert.match(script, /data-zone-tablist[\s\S]*\.focus\(\)/);
});

test("Outside exposes observation and interpretation as separate contracts", async () => {
  const script = await read("archive/world-atlas/world-atlas.js");
  const context = JSON.parse(await read("archive/world-atlas/world-atlas-context.json"));
  assert.equal(context.labels.observed, "관찰 사실");
  assert.equal(context.labels.reading, "해석 후보");
  assert.match(script, /labels\.observed/);
  assert.match(script, /labels\.reading/);
  assert.match(script, /relation\.observedDifference/);
  assert.match(script, /relation\.readingProposal/);
  const zoneIds = new Set(context.zones.map((zone) => zone.id));
  for (const relation of context.relations) {
    assert.ok(relation.zoneIds.every((id) => zoneIds.has(id)));
    assert.notEqual(relation.observedDifference, relation.readingProposal);
  }
});

test("Outside candidate files contain no private contract fields or long dash glyph", async () => {
  const files = [
    "archive/world-atlas/index.html",
    "archive/world-atlas/world-atlas.css",
    "archive/world-atlas/world-atlas.js",
    "archive/world-atlas/world-atlas-context.json",
  ];
  for (const file of files) {
    const content = await read(file);
    assert.doesNotMatch(content, /\u2014/, file);
    assert.doesNotMatch(content, /\/Volumes\/|\/Users\/|90-raw-staging|private:family|local-only|sourcePath|kr_title|summary_1line/, file);
  }
});

test("Outside folds boundary detail into the seam and drops the relations stage", async () => {
  const html = await read("archive/world-atlas/index.html");
  const css = await read("archive/world-atlas/world-atlas.css");
  const script = await read("archive/world-atlas/world-atlas.js");

  // 본인 지시 2026-09-01: 03 Relations 절과 04 Boundaries 절은 화면에서 내린다.
  assert.doesNotMatch(html, /두 장면을 같은 폭에서 비교합니다/);
  assert.doesNotMatch(html, /id="relations"/);
  assert.doesNotMatch(html, /id="boundaries"/);
  assert.doesNotMatch(html, /03 Relations|04 Boundaries/);

  // 경계 정보는 사라지지 않고 seam 위 툴팁으로 남는다 — hover와 focus 둘 다.
  assert.match(html, /class="seam-tip" id="seam-tip-outside"/);
  assert.match(html, /class="seam-tip" id="seam-tip-boundary"/);
  assert.match(html, /class="seam-tip" id="seam-tip-inside"/);
  assert.match(html, /PUBLIC-REFERENCE-SURFACE/);
  assert.match(html, /PROTECTED-EXPERIENCE-NOT-LINKED/);
  assert.match(html, /aria-describedby="seam-tip-outside"/);
  assert.match(css, /\.shared-seam__side:hover \.seam-tip/);
  assert.match(css, /\.shared-seam__side:focus-visible \.seam-tip/);

  // 지표는 화면에 있는 것을 센다 — Relations 카운트는 Evidence 로 바뀌었다.
  assert.match(html, /data-evidence-count/);
  assert.doesNotMatch(html, /data-relation-count/);
  assert.match(script, /data-evidence-count/);

  // 데이터 계약은 그대로다 — 관계는 읽기 API 로만 남는다.
  assert.match(script, /getRelation/);
  assert.doesNotMatch(script, /renderRelationTabs|renderBoundaries/);
  assert.doesNotMatch(css, /\.relation-|\.boundary-/);
});
