import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function createHarness({ fetchImpl, getUserMedia } = {}) {
  let clickHandler;
  const attributes = { "aria-pressed": "false" };
  const action = {
    textContent: "대화 시작",
    addEventListener(type, handler) {
      if (type === "click") clickHandler = handler;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    getAttribute(name) {
      return attributes[name];
    },
  };
  const status = { textContent: "대화 준비됨" };
  const transcript = {
    textContent: "버튼을 누르면 마이크 연결을 시작합니다.",
  };
  const meterValues = {};
  const meter = {
    style: {
      setProperty(name, value) {
        meterValues[name] = value;
      },
    },
  };
  const root = {
    dataset: { state: "idle" },
    querySelector(selector) {
      return {
        "[data-voice-action]": action,
        "[data-voice-status]": status,
        "[data-voice-transcript]": transcript,
        "[data-voice-meter]": meter,
      }[selector];
    },
  };

  class FakeAudioContext {
    constructor() {
      this.audioWorklet = { addModule: async () => {} };
      this.state = "running";
    }

    async resume() {}

    async close() {
      this.state = "closed";
    }
  }

  const sourcePath = path.join(repoRoot, "assets", "voice-agent.js");
  const source = (await readFile(sourcePath, "utf8")).replace(
    'new URL("./pcm-capture-worklet.js", import.meta.url)',
    '"./pcm-capture-worklet.js"',
  );
  const window = {
    addEventListener() {},
    AudioContext: FakeAudioContext,
    AudioWorkletNode: class {},
  };
  const context = {
    document: {
      querySelector(selector) {
        return selector === "[data-voice-agent]" ? root : null;
      },
    },
    window,
    location: { hostname: "127.0.0.1", origin: "http://127.0.0.1:4174" },
    navigator: {
      mediaDevices: {
        getUserMedia:
          getUserMedia ??
          (async () => {
            throw new Error("getUserMedia not configured");
          }),
      },
    },
    fetch:
      fetchImpl ??
      (async () => ({
        ok: true,
        async json() {
          return { value: "test-client-secret" };
        },
      })),
    AudioContext: FakeAudioContext,
    AudioWorkletNode: window.AudioWorkletNode,
    URL,
    console,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context, { filename: sourcePath });

  return {
    action,
    status,
    transcript,
    root,
    meterValues,
    click() {
      clickHandler();
    },
  };
}

test("starting and stopping while the token is pending returns to idle", async () => {
  let resolveFetch;
  const fetchPromise = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const harness = await createHarness({
    fetchImpl: () => fetchPromise,
  });

  harness.click();
  assert.deepEqual(
    {
      state: harness.root.dataset.state,
      button: harness.action.textContent,
      pressed: harness.action.getAttribute("aria-pressed"),
      status: harness.status.textContent,
      transcript: harness.transcript.textContent,
    },
    {
      state: "connecting",
      button: "대화 종료",
      pressed: "true",
      status: "마이크와 음성 에이전트를 연결하고 있어요",
      transcript: "연결되면 바로 말씀하실 수 있습니다.",
    },
  );

  harness.click();
  resolveFetch({
    ok: true,
    async json() {
      return { value: "late-client-secret" };
    },
  });
  await flush();

  assert.deepEqual(
    {
      state: harness.root.dataset.state,
      button: harness.action.textContent,
      pressed: harness.action.getAttribute("aria-pressed"),
      status: harness.status.textContent,
      transcript: harness.transcript.textContent,
      meter: harness.meterValues["--voice-level"],
    },
    {
      state: "idle",
      button: "대화 시작",
      pressed: "false",
      status: "대화 준비됨",
      transcript: "버튼을 누르면 마이크 연결을 시작합니다.",
      meter: "0",
    },
  );
});

test("microphone permission denial returns the Korean recovery message", async () => {
  const denied = new Error("permission denied");
  denied.name = "NotAllowedError";
  const harness = await createHarness({
    getUserMedia: async () => {
      throw denied;
    },
  });

  harness.click();
  await flush();

  assert.deepEqual(
    {
      state: harness.root.dataset.state,
      button: harness.action.textContent,
      pressed: harness.action.getAttribute("aria-pressed"),
      status: harness.status.textContent,
      transcript: harness.transcript.textContent,
      meter: harness.meterValues["--voice-level"],
    },
    {
      state: "error",
      button: "대화 시작",
      pressed: "false",
      status: "연결하지 못했어요",
      transcript: "브라우저 설정에서 마이크 권한을 허용해 주세요.",
      meter: "0",
    },
  );
});
