import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("the 2023-11 source is shelved by On-chain Storytelling", async () => {
  const manifest = await read("assets/content-manifest.js");
  const coCreation = manifest.match(
    /slug: "co-creation-culture"[\s\S]*?slug: "onchain-storytelling"/,
  )?.[0] ?? "";
  const onchain = manifest.match(
    /slug: "onchain-storytelling"[\s\S]*?slug: "metaverse-era"/,
  )?.[0] ?? "";

  assert.doesNotMatch(coCreation, /id: "slides-2023-11"/);
  assert.match(onchain, /id: "slides-2023-11"/);
  assert.match(
    onchain,
    /href: "series\/onchain-storytelling\/sources\/slides-2023-11\/"/,
  );
});

// 2026-10-13 본인 결정(4-나 ① · 6-나 ①) : 도슨트를 옛 주소 면에서 정본 덱 면으로 옮겼다.
// 이 시험은 그 전까지 「정본 면에는 도슨트가 없다」를 잠그고 있었다. 결속 전의 계약은
// 결속하는 순간 틀린 계약이 되므로, 느슨하게 풀지 않고 새 상태를 정확히 잠근다 :
// 정본 면에는 onchain 문맥을 읽는 도슨트가 하나 있고, 옛 주소 면에는 하나도 없다.
test("the new canonical route reuses source assets, carries the docent, and the old route remains without it", async () => {
  const currentPath =
    "series/onchain-storytelling/sources/slides-2023-11/index.html";
  const legacyPath =
    "series/co-creation-culture/sources/slides-2023-11/index.html";
  const [current, legacy] = await Promise.all([read(currentPath), read(legacyPath)]);

  assert.match(
    current,
    /<link rel="canonical" href="https:\/\/kiheon\.com\/series\/onchain-storytelling\/sources\/slides-2023-11\/">/,
  );
  assert.match(current, /data-series="onchain-storytelling"/);
  assert.equal((current.match(/<kiheon-voice-assistant/g) ?? []).length, 1);
  assert.match(
    current,
    /<kiheon-voice-assistant\s+data-scope="content"\s+data-series="onchain-storytelling"\s+data-content-type="source"\s+data-content-id="slides-2023-11"\s+data-context="\.\.\/\.\.\/assistant\/context\.json"><\/kiheon-voice-assistant>/,
  );
  assert.doesNotMatch(legacy, /<kiheon-voice-assistant|voice-assistant-v2/);
  assert.match(
    current,
    /"dir": "\.\.\/\.\.\/\.\.\/co-creation-culture\/assets\/src-t2\/"/,
  );
  assert.equal((current.match(/\{"n": \d+, "c":/g) ?? []).length, 71);

  assert.match(
    legacy,
    /<link rel="canonical" href="https:\/\/kiheon\.com\/series\/co-creation-culture\/sources\/slides-2023-11\/">/,
  );

  const attributes = [...current.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:https?:|#|mailto:|javascript:)/.test(value));
  for (const value of attributes) {
    const [pathname] = value.split(/[?#]/, 1);
    const target = path.resolve(path.dirname(path.join(repoRoot, currentPath)), pathname);
    const metadata = await stat(target);
    if (metadata.isDirectory()) await stat(path.join(target, "index.html"));
  }
});
