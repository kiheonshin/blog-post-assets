import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const seriesSurfaces = {
  "aigc-creative-paradigm": [
    "series/aigc-creative-paradigm/index.html",
    "series/aigc-creative-paradigm/posts/01-skill-and-effort/index.html",
    "series/aigc-creative-paradigm/posts/02-workflow-design/index.html",
    "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/index.html",
    "series/aigc-creative-paradigm/sources/research/index.html",
    "series/aigc-creative-paradigm/sources/slides/index.html",
  ],
  "newtype-ip-dialogue": [
    "series/newtype-ip-dialogue/index.html",
    "series/newtype-ip-dialogue/posts/01-not-blocking-potential/index.html",
    "series/newtype-ip-dialogue/posts/02-engine-as-ip/index.html",
    "series/newtype-ip-dialogue/posts/03-already-have-the-eye/index.html",
  ],
  "autonomous-worlds": [
    "series/autonomous-worlds/index.html",
    "series/autonomous-worlds/posts/01-engine-city-to-autonomous-world/index.html",
    "series/autonomous-worlds/posts/02-more-than-a-mirror/index.html",
    "series/autonomous-worlds/posts/03-what-we-want-to-create/index.html",
    "series/autonomous-worlds/sources/talk/index.html",
    "series/autonomous-worlds/sources/script/index.html",
    "series/autonomous-worlds/sources/slides/index.html",
  ],
  "co-creation-culture": [
    "series/co-creation-culture/index.html",
    "series/co-creation-culture/posts/01-whose-creativity/index.html",
    "series/co-creation-culture/posts/02-at-the-boundary/index.html",
    "series/co-creation-culture/posts/03-when-records-become-stories/index.html",
    "series/co-creation-culture/sources/slides-2023-06/index.html",
    "series/co-creation-culture/sources/slides-2023-11/index.html",
  ],
};

test("all four series use the same xAI Realtime v2 interface", async () => {
  for (const file of Object.values(seriesSurfaces).flat()) {
    const html = await read(file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.css\?v=20260803simple1/, file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.js\?v=20260803grok2/, file);
    assert.doesNotMatch(html, /assets\/assistant\/voice-assistant\.(?:css|js)/, file);
  }
});

test("all four series share the verified Grok built-in voice runtime", async () => {
  const script = await read("assets/assistant/voice-assistant-v2.js");
  const styles = await read("assets/assistant/voice-assistant-v2.css");
  assert.equal(sha256(script), "e1d5f74330c470888d96cbddc1b9a0e7a41a8f4091f0cde1ccca11e1fc485e60");
  assert.equal(sha256(styles), "e3a5965c8871746fe8574867ae0e5eb76b4a2672f9c392fe6d6f6d070b8fc53b");
  assert.match(script, /data-assistant-open-voice/);
  assert.match(script, /voiceSessionActive/);
  assert.match(script, /data-assistant-transcript-details/);
  assert.match(script, /xai-voice-transport\.js\?v=20260803grok1/);
  assert.match(script, /GROK_BUILT_IN_VOICES/);
  assert.match(script, /\["Ara", "따뜻하고 자연스러운 대화"\]/);
  assert.doesNotMatch(script, /신기헌 보이스|kiheon-custom/);
  assert.match(script, /신기헌 본인이 아닙니다/);
  assert.doesNotMatch(script, /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/);
  assert.doesNotMatch(script, /data-assistant-reset/);
  assert.match(styles, /voice-assistant__voice-stage/);
  assert.match(styles, /voice-assistant__voice-session/);
  assert.equal((script.match(/class="voice-assistant__voice-ring"/g) ?? []).length, 1);
  assert.match(script, /event\.type === "input_level"/);
  assert.match(script, /--voice-ring-scale/);
  assert.doesNotMatch(styles, /voice-assistant__voice-ring:nth-child/);
  assert.match(styles, /voice-assistant-ring-turn/);
  assert.match(styles, /voice-assistant-ring-speak/);
});

test("all four series contexts stay bound to their exact public surfaces", async () => {
  for (const seriesId of Object.keys(seriesSurfaces)) {
    const context = JSON.parse(await read(`series/${seriesId}/assistant/context.json`));
    assert.equal(context.docent.quickPrompts.length, 3, seriesId);
    for (const entry of context.entries) {
      const html = await read(`${entry.url}/index.html`);
      assert.equal(entry.contentHash, `sha256:${sha256(html)}`, entry.contentId);
    }
  }
});

test("the manifest publishes all four docent contexts and their 23 surfaces", async () => {
  const manifest = await read("assets/content-manifest.js");
  for (const [seriesId, surfaces] of Object.entries(seriesSurfaces)) {
    const start = manifest.indexOf(`slug: "${seriesId}"`);
    const nextStart = manifest.indexOf("\n    {", start + 1);
    const block = manifest.slice(start, nextStart === -1 ? undefined : nextStart);
    assert.match(block, /status:\s*"ready"/, seriesId);
    assert.equal((block.match(new RegExp(`${seriesId}:(?:series|post|source):`, "g")) ?? []).length, surfaces.length, seriesId);
  }
});
