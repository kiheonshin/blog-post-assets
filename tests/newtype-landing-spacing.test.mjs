import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("Newtype keeps the authorship rule inside the landing grid like AIGC", async () => {
  const [newtype, aigc] = await Promise.all([
    read("series/newtype-ip-dialogue/index.html"),
    read("series/aigc-creative-paradigm/index.html"),
  ]);
  const closingPattern = /<\/section>\s+<div class="foot">[\s\S]*?<\/div>\s+<\/div>\s+<\/div><\/main>/;

  assert.match(aigc, closingPattern);
  assert.match(newtype, closingPattern);
});
