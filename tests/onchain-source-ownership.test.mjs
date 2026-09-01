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

test("the new canonical route reuses source assets and the old route remains", async () => {
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
  assert.doesNotMatch(current, /<kiheon-voice-assistant/);
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
