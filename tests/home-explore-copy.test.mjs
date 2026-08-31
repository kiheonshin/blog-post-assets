import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");

test("the Explore controls omit redundant discovery status copy", async () => {
  const [home, navigation, styles] = await Promise.all([
    read("index.html"),
    read("assets/series-nav.js"),
    read("assets/site.css"),
  ]);
  const surface = `${home}\n${navigation}\n${styles}`;

  assert.doesNotMatch(surface, /DISCOVERY CONTROLS/i);
  assert.doesNotMatch(navigation, /전체 공개 기록/);
  assert.doesNotMatch(navigation, /`기록 \$\{items\.length\}건`/);
  assert.doesNotMatch(navigation, /archive-status/);
  assert.match(home, /series-nav\.js\?v=20260831b/);
});
