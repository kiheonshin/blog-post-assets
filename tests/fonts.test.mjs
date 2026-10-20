// 글꼴 한 벌 (2026-10-18 본인 결정 · 2026-10-20 kiheon.com 적용)
// 영문 · 숫자 Geist + 한글 Pretendard · 고정폭 Geist Mono. 제목과 본문 모두 산세리프다.
// 묶음은 build_life_universe_fonts.py 가 짓는다(원본 해시 확인 · 한글은 KS X 1001 2,350 + 저장소에 쓰인 글자).
// 이 시험은 묶음 짝 · 주소 판 · 라이선스 · 옛 꼴 0 · 모든 공개 면에 글꼴 정의가 닿는지를 잠근다.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const FAMILIES = { sans: "Life Universe Sans", mono: "Life Universe Mono", hangul: "Life Universe Hangul" };
const WEIGHTS = { sans: "100 900", mono: "100 900", hangul: "45 930" };

async function walk(dir, out = []) {
  for (const entry of await readdir(path.join(repoRoot, dir), { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel", "tests"].includes(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(rel, out);
    else out.push(rel);
  }
  return out;
}

async function publicPages() {
  const manifest = JSON.parse(await read("series/manifest.json"));
  const hidden = new Set(manifest.series.filter((series) => !series.public).map((series) => series.slug));
  return (await walk("")).filter((file) => file.endsWith(".html")
    && !file.startsWith("import-")
    && !["source-research.html", "source-slides.html"].includes(file)
    && !(file.startsWith("series/") && hidden.has(file.split("/")[1])));
}

test("the font folder holds the three faces, two licences, the stylesheet and the coverage record", async () => {
  const files = (await readdir(path.join(repoRoot, "assets/fonts"))).sort();
  assert.deepEqual(files, [
    "OFL-Geist.txt", "OFL-Pretendard.txt", "fonts.css", "hangul-coverage.json",
    "life-universe-hangul.woff2", "life-universe-mono.woff2", "life-universe-sans.woff2",
  ]);
  for (const licence of ["OFL-Geist.txt", "OFL-Pretendard.txt"]) {
    assert.match(await read(`assets/fonts/${licence}`), /SIL Open Font License/, licence);
  }
});

test("the coverage record matches the built faces and holds every Hangul syllable the site uses", async () => {
  const record = JSON.parse(await read("assets/fonts/hangul-coverage.json"));
  for (const [key, entry] of Object.entries(record.files)) {
    const bytes = await readFile(path.join(repoRoot, "assets/fonts", entry.file));
    assert.equal(sha256(bytes), entry.sha256, key);
  }
  const covered = new Set(record.ranges.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, index) => from + index)));
  assert.equal(covered.size, record.count);
  let ksx = 0;
  const decoder = new TextDecoder("euc-kr");
  for (let lead = 0xb0; lead <= 0xc8; lead += 1) {
    for (let trail = 0xa1; trail <= 0xfe; trail += 1) {
      const ch = decoder.decode(new Uint8Array([lead, trail]));
      if (/^[가-힣]$/u.test(ch)) { ksx += 1; assert.ok(covered.has(ch.codePointAt(0)), ch); }
    }
  }
  assert.equal(ksx, 2350);
  const used = new Set();
  for (const file of (await walk("")).filter((name) => /\.(html|mjs|js|json|css)$/.test(name))) {
    for (const ch of await read(file)) if (/[가-힣]/u.test(ch)) used.add(ch.codePointAt(0));
  }
  const missing = [...used].filter((cp) => !covered.has(cp)).map((cp) => String.fromCodePoint(cp));
  assert.deepEqual(missing, []);
});

test("site.css and fonts/fonts.css declare the same three faces with the file hash as the version", async () => {
  const record = JSON.parse(await read("assets/fonts/hangul-coverage.json"));
  for (const [css, prefix] of [["assets/site.css", "./fonts/"], ["assets/fonts/fonts.css", "./"]]) {
    const text = await read(css);
    const faces = [...text.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1]);
    assert.equal(faces.length, 3, css);
    for (const [key, family] of Object.entries(FAMILIES)) {
      const face = faces.find((body) => body.includes(`font-family: "${family}"`));
      assert.ok(face, `${css} ${family}`);
      const file = record.files[key].file;
      assert.ok(face.includes(`url("${prefix}${file}?v=${record.files[key].sha256.slice(0, 10)}") format("woff2")`), `${css} ${family} url`);
      assert.ok(face.includes(`font-weight: ${WEIGHTS[key]}`), `${css} ${family} weight`);
      assert.ok(face.includes("font-display: swap"), `${css} ${family} display`);
    }
    assert.match(text, /button,\s*input,\s*select,\s*textarea\s*\{\s*font-family: inherit;/, css);
    assert.match(text, /code,\s*kbd,\s*samp,\s*pre\s*\{\s*font-family: var\(--font-mono/, css);
    assert.doesNotMatch(text, /KLU/, css);
  }
  const site = await read("assets/site.css");
  assert.match(site, /--font-display: "Life Universe Sans", "Life Universe Hangul",/);
  assert.match(site, /--font-body: "Life Universe Sans", "Life Universe Hangul",/);
  assert.match(site, /--font-mono: "Life Universe Mono", "Life Universe Hangul", ui-monospace,/);
});

test("no public page or shared style keeps the old serif or Courier-prone stacks", async () => {
  const pages = await publicPages();
  const styles = (await walk("assets")).filter((file) => file.endsWith(".css") && file !== "assets/assistant/voice-assistant.css");
  const old = /SFMono-Regular|"Roboto Mono"|Noto Sans Mono CJK KR|Iowan Old Style|AppleMyungjo|Nanum Myeongjo|Noto Serif CJK KR/;
  const offenders = [];
  for (const file of [...pages, ...styles, "assets/diagrams/klu-system-map.svg"]) {
    if (old.test(await read(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("every public page reaches the font definitions through site.css or fonts/fonts.css", async () => {
  const fontsCssVersion = sha256(await readFile(path.join(repoRoot, "assets/fonts/fonts.css"))).slice(0, 10);
  const missing = [];
  for (const file of await publicPages()) {
    const html = await read(file);
    if (/<link[^>]+href="[^"]*assets\/site\.css\?v=20261020brand1"/.test(html)) continue;
    const link = html.match(/<link[^>]+href="[^"]*assets\/fonts\/fonts\.css\?v=([0-9a-f]{10})"/);
    if (!link) { missing.push(file); continue; }
    assert.equal(link[1], fontsCssVersion, file);
  }
  assert.deepEqual(missing, []);
});

test("the system map embeds the same three faces because an object document does not inherit page fonts", async () => {
  const record = JSON.parse(await read("assets/fonts/hangul-coverage.json"));
  const svg = await read("assets/diagrams/klu-system-map.svg");
  for (const [key, family] of Object.entries(FAMILIES)) {
    assert.ok(svg.includes(`@font-face{font-family:"${family}";src:url("../fonts/${record.files[key].file}?v=${record.files[key].sha256.slice(0, 10)}")`), family);
  }
  assert.match(await read("index.html"), /assets\/diagrams\/klu-system-map\.svg\?v=20261020font1/);
});
