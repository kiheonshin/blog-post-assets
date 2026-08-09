import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const archiveModules = ["chronicle", "transcript", "codex", "screening"];

test("each Archive source module declares the shared favicon", async () => {
  for (const module of archiveModules) {
    const html = await readFile(
      path.join(repoRoot, "archive", module, "index.html"),
      "utf8",
    );

    assert.equal(
      (html.match(/<link rel="icon" href="\.\.\/\.\.\/assets\/favicon\.svg" type="image\/svg\+xml">/g) ?? [])
        .length,
      1,
      module,
    );
  }

  const favicon = await stat(path.join(repoRoot, "assets", "favicon.svg"));
  assert.ok(favicon.isFile());
  assert.ok(favicon.size > 0);
});
