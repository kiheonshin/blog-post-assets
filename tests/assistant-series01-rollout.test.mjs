import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const seriesOneSurfaces = [
  "series/aigc-creative-paradigm/index.html",
  "series/aigc-creative-paradigm/posts/01-skill-and-effort/index.html",
  "series/aigc-creative-paradigm/posts/02-workflow-design/index.html",
  "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/index.html",
  "series/aigc-creative-paradigm/sources/research/index.html",
  "series/aigc-creative-paradigm/sources/slides/index.html",
];

const unchangedSeriesSurfaces = [
  "series/autonomous-worlds/index.html",
  "series/co-creation-culture/index.html",
  "series/newtype-ip-dialogue/index.html",
];

test("series 01 alone opts into the staged docent interface", async () => {
  for (const file of seriesOneSurfaces) {
    const html = await read(file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.css\?v=20260802d/, file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.js\?v=20260802d/, file);
  }

  for (const file of unchangedSeriesSurfaces) {
    const html = await read(file);
    assert.doesNotMatch(html, /voice-assistant-v2\.(?:css|js)/, file);
  }
});

test("series 01 ships the already verified v2 runtime bytes", async () => {
  const script = await read("assets/assistant/voice-assistant-v2.js");
  const styles = await read("assets/assistant/voice-assistant-v2.css");
  assert.equal(sha256(script), "45d9c55141e3df64aa2a8163144ea7386e6ea5ec01c5a201afd3620d327e0876");
  assert.equal(sha256(styles), "38747b1f2d67f125d676f96abdb5e29e2a219aefb8457fc8b2a7d518ee84e6be");
  assert.match(script, /data-assistant-open-voice/);
  assert.match(script, /voiceSessionActive/);
  assert.match(script, /data-assistant-transcript-details/);
  assert.doesNotMatch(script, /data-assistant-reset/);
  assert.match(styles, /voice-assistant__voice-stage/);
  assert.match(styles, /voice-assistant__voice-session/);
});

test("series 01 context stays bound to the exact deployed surfaces", async () => {
  const context = JSON.parse(await read("series/aigc-creative-paradigm/assistant/context.json"));
  assert.equal([...context.docent.intro].length <= 20, true);
  assert.equal(context.docent.quickPrompts.length, 3);

  for (const entry of context.entries) {
    const html = await read(`${entry.url}/index.html`);
    assert.equal(entry.contentHash, `sha256:${sha256(html)}`, entry.contentId);
  }
});

test("series 02 remains unpublished while its docent work continues", async () => {
  const html = await read("series/newtype-ip-dialogue/index.html");
  const manifest = await read("assets/content-manifest.js");
  const newtype = manifest.slice(
    manifest.indexOf('slug: "newtype-ip-dialogue"'),
    manifest.indexOf('slug: "autonomous-worlds"'),
  );
  assert.doesNotMatch(html, /<kiheon-voice-assistant\b/);
  assert.match(newtype, /status:\s*"planned"/);
  assert.match(newtype, /pilotSurfaceIds:\s*\[\]/);
});
