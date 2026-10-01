import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "assets/assistant/docent-inspector-bridge.js"), "utf8");
const load = () => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Math.random()}`);

test("only the owner origin or a local test parent may connect", async () => {
  const { inspectorParentAllowed } = await load();
  assert.equal(inspectorParentAllowed("https://kiheon.app", "kiheon.com"), true);
  assert.equal(inspectorParentAllowed("https://kiheon.app.evil.test", "kiheon.com"), false);
  assert.equal(inspectorParentAllowed("http://127.0.0.1:47851", "127.0.0.1"), true);
  assert.equal(inspectorParentAllowed("http://127.0.0.1:47851", "kiheon.com"), false);
  assert.equal(inspectorParentAllowed("http://localhost:47851", "127.0.0.1"), false);
});

test("a trace sends only allowlisted structure, never question or transcript bytes", async () => {
  const { sanitizeInspectorEvent } = await load();
  const canary = "PRIVATE_QUESTION_CANARY";
  const observed = sanitizeInspectorEvent({
    type: "observed", traceId: 2, input: canary, prompt: canary,
    observation: {
      contextReady: true, lowSignal: false, allowedEntryCount: 5,
      currentSectionId: canary, memory: [{ text: canary }],
    },
  }, { scope: "series", instanceId: "kiheon-voice-assistant-1", contentId: "research" });
  assert.deepEqual(observed, {
    type: "observed", channel: "text", scope: "series",
    instanceId: "kiheon-voice-assistant-1", contentId: "research",
    traceId: 2, contextReady: true, lowSignal: false, allowedEntryCount: 5,
  });
  const voice = sanitizeInspectorEvent({ type: "user_transcript", transcript: canary, final: true });
  assert.equal(voice.characterCount, canary.length);
  assert.equal(voice.final, true);
  assert.equal(JSON.stringify([observed, voice]).includes(canary), false);
  assert.equal(sanitizeInspectorEvent({ type: "unknown", answer: canary }), null);
});

test("only an opted-in iframe accepts a parent handshake and sends safe events", async () => {
  const parent = {};
  const messages = [];
  let listener;
  globalThis.window = {
    parent,
    location: { search: "?inspector=1", hostname: "kiheon.com" },
    addEventListener: (name, fn) => { if (name === "message") listener = fn; },
  };
  try {
    const { emitInspectorEvent } = await load();
    const nonce = "01234567-89ab-cdef-0123-456789abcdef";
    const port = { postMessage: (data) => messages.push(data), close: () => {} };
    const data = { schema: "klu-docent-inspector-v1", kind: "connect", version: 1, nonce };
    listener({ origin: "https://kiheon.app.evil.test", source: parent, data, ports: [port] });
    listener({ origin: "https://kiheon.app", source: {}, data, ports: [port] });
    assert.equal(messages.length, 0);
    listener({ origin: "https://kiheon.app", source: parent, data, ports: [port] });
    emitInspectorEvent({ type: "turn_completed", traceId: 1, route: "generated", answer: "PRIVATE_ANSWER_CANARY" });
    assert.equal(messages[0].kind, "ready");
    assert.equal(messages[1].kind, "event");
    assert.equal(messages[1].event.route, "generated");
    assert.equal(JSON.stringify(messages).includes("PRIVATE_ANSWER_CANARY"), false);
  } finally {
    delete globalThis.window;
  }
});
