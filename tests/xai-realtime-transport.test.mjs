import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transportPath = path.join(repoRoot, "assets", "assistant", "xai-voice-transport.js");

async function importTransport() {
  const url = pathToFileURL(transportPath);
  url.searchParams.set("test", String(Math.random()));
  return import(url.href);
}

function tokenResponse(overrides = {}) {
  return {
    ok: true,
    async json() {
      return {
        value: "ephemeral-test-token",
        expires_at: 1_800_000_000,
        default_voice: "ara",
        voices: ["ara", "eve", "rex", "sal", "leo"],
        model: "grok-voice-think-fast-1.0",
        ...overrides,
      };
    },
  };
}

class FakeSocket {
  static instances = [];

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    FakeSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.dispatch("open", {});
    });
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  send(value) {
    this.sent.push(value);
    if (typeof value === "string" && JSON.parse(value).type === "session.update") {
      queueMicrotask(() => this.dispatch("message", {
        data: JSON.stringify({ type: "session.updated" }),
      }));
    }
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.dispatch("close", {});
  }
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 24_000;
    this.currentTime = 0;
    this.destination = {};
    this.state = "running";
    this.audioWorklet = { addModule: async () => {} };
  }

  async resume() {}
  async close() { this.state = "closed"; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createGain() {
    return { gain: { value: 1 }, connect() {}, disconnect() {} };
  }
}

class FakeWorkletNode {
  constructor() {
    this.port = {};
  }
  connect() {}
  disconnect() {}
}

test.beforeEach(() => {
  FakeSocket.instances.length = 0;
});

test("token request exposes only a short-lived built-in-voice connection contract", async () => {
  const { VoiceTransport } = await importTransport();
  const calls = [];
  const transport = new VoiceTransport({
    endpoint: "https://example.test/api/xai-client-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return tokenResponse();
    },
  });

  const token = await transport.requestToken();
  assert.equal(token.default_voice, "ara");
  assert.deepEqual(token.voices, ["ara", "eve", "rex", "sal", "leo"]);
  assert.equal(token.model, "grok-voice-think-fast-1.0");
  assert.deepEqual(calls.map(({ url, options }) => ({
    url,
    method: options.method,
    mode: options.mode,
    credentials: options.credentials,
    cache: options.cache,
  })), [{
    url: "https://example.test/api/xai-client-secret",
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  }]);
});

test("token request rejects custom or unknown voice contracts", async () => {
  const { VoiceTransport } = await importTransport();
  const transport = new VoiceTransport({
    endpoint: "https://example.test/token",
    fetchImpl: async () => tokenResponse({
      default_voice: "custom01",
      voices: ["custom01"],
    }),
  });

  await assert.rejects(transport.requestToken(), { code: "invalid_response" });
});

test("voice session pins the xAI model and configures Korean duplex audio", async () => {
  const { VoiceTransport } = await importTransport();
  const released = [];
  const events = [];
  const transport = new VoiceTransport({
    endpoint: "https://example.test/token",
    fetchImpl: async () => tokenResponse(),
    WebSocketImpl: FakeSocket,
    AudioContextImpl: FakeAudioContext,
    AudioWorkletNodeImpl: FakeWorkletNode,
    mediaDevices: {
      async getUserMedia() {
        return { getTracks: () => [{ stop: () => released.push("track") }] };
      },
    },
  });

  await transport.startVoiceSession({
    voiceId: "sal",
    instructions: "공개 문맥만 사용합니다.",
    speed: 1.15,
    keyterms: ["신기헌", "AIGC", "스무 글자를 넘는 키워드는 음성 세션에서 제외됩니다"],
    onEvent: (event) => events.push(event.type),
  });

  const socket = FakeSocket.instances[0];
  assert.match(socket.url, /model=grok-voice-think-fast-1\.0/);
  assert.deepEqual(socket.protocols, ["xai-client-secret.ephemeral-test-token"]);
  const update = socket.sent
    .filter((value) => typeof value === "string")
    .map((value) => JSON.parse(value))
    .find((message) => message.type === "session.update");
  assert.equal(update.session.voice, "sal");
  assert.equal(update.session.reasoning.effort, "none");
  assert.equal(update.session.turn_detection.type, "server_vad");
  assert.equal(update.session.audio.input.transport, "binary");
  assert.equal(update.session.audio.input.transcription.model, "grok-transcribe");
  assert.equal(update.session.audio.input.transcription.language_hint, "ko");
  assert.deepEqual(update.session.audio.input.transcription.keyterms, ["신기헌", "AIGC"]);
  assert.equal(update.session.audio.output.transport, "binary");
  assert.equal(update.session.audio.output.speed, 1.15);
  assert.ok(events.includes("ready"));
  assert.ok(events.includes("session_started"));

  transport.stopVoiceSession();
  assert.deepEqual(released, ["track"]);
});

test("xAI cumulative transcripts update a single user utterance", async () => {
  // 2026-10-13 실제 공급자 차례(라이브 측정) : 말하는 동안 updated 와 completed 가 번갈아 여러 번 오고,
  // speech_stopped 뒤에 completed 가 다시 온다. speech_stopped 뒤의 완료 전사만 최종이다(출시 규칙 · 2b01e7d).
  // 예전 이 시험은 completed 하나를 최종으로 보았고, 라이브에서는 한 발화가 말풍선 넷이 됐다.
  const { VoiceTransport } = await importTransport();
  const events = [];
  const transport = new VoiceTransport();
  transport.active = true;
  transport.onEvent = (event) => events.push(event);
  const send = (message) => transport.handleSocketMessage({ data: JSON.stringify(message) });
  send({ type: "input_audio_buffer.speech_started" });
  send({ type: "conversation.item.input_audio_transcription.updated", transcript: "포스팅 1의 내" });
  send({ type: "conversation.item.input_audio_transcription.completed", transcript: "포스팅 1의 내" });
  send({ type: "conversation.item.input_audio_transcription.updated", transcript: "포스팅 1의 내용이 궁금해" });
  send({ type: "conversation.item.input_audio_transcription.completed", transcript: "포스팅 1의 내용이 궁금해" });
  send({ type: "input_audio_buffer.speech_stopped" });
  send({ type: "conversation.item.input_audio_transcription.completed", transcript: "포스팅 1의 내용이 궁금해" });

  assert.deepEqual(
    events.filter((event) => event.type === "user_transcript").map(({ transcript, final }) => ({ transcript, final })),
    [
      { transcript: "포스팅 1의 내", final: false },
      { transcript: "포스팅 1의 내", final: false },
      { transcript: "포스팅 1의 내용이 궁금해", final: false },
      { transcript: "포스팅 1의 내용이 궁금해", final: false },
      { transcript: "포스팅 1의 내용이 궁금해", final: true },
    ],
  );
});

// 2b01e7d(2026-08-05) 에서 옮긴 시험 : 세션 준비 전에 들어온 말소리(30 프레임 = 3초)를 잃지 않는다.
test("voice connection preserves ordinary speech recorded before the session is ready", async () => {
  const { VoiceTransport } = await importTransport();
  const sent = [];
  const transport = new VoiceTransport();
  transport.active = true;
  transport.socket = {
    readyState: 1,
    send(frame) { sent.push(frame); },
  };

  const frames = Array.from({ length: 30 }, (_, index) => new Uint8Array([index]).buffer);
  for (const frame of frames) transport.sendAudio(frame);
  transport.handleSocketMessage({
    data: JSON.stringify({ type: "session.updated" }),
  });

  assert.deepEqual(sent, frames);
});

// 2026-10-13 독립 검수 제안 : 전송 경계 20자 · 100개(공급자가 긴 keyterm 을 거부한 실측 · 출시 규칙).
test("transport drops keyterms over 20 characters and caps at 100", async () => {
  const { VoiceTransport } = await importTransport();
  const transport = new VoiceTransport({ endpoint: "https://example.test/token" });
  const many = Array.from({ length: 130 }, (_, index) => `낱말${index}`);
  const config = transport.sessionConfiguration({
    voiceId: "ara", instructions: "", sampleRate: 24000, speed: 1, microphone: true,
    keyterms: ["신기헌", "스무 글자를 넘는 키워드는 음성 세션에서 제외됩니다", ...many],
  });
  const sentTerms = config.session.audio.input.transcription.keyterms;
  assert.equal(sentTerms.length, 100);
  assert.equal(sentTerms.every((term) => [...term].length <= 20), true);
  assert.equal(sentTerms.includes("스무 글자를 넘는 키워드는 음성 세션에서 제외됩니다"), false);
});

// 2026-10-13 독립 검수 제안 : 같은 세션 두 번째 발화도 그 발화의 speech_stopped 뒤에만 최종이다.
test("a second utterance in the same session is final only after its own speech_stopped", async () => {
  const { VoiceTransport } = await importTransport();
  const events = [];
  const transport = new VoiceTransport({ endpoint: "https://example.test/token" });
  transport.active = true;
  transport.onEvent = (event) => events.push(event);
  const send = (message) => transport.handleSocketMessage({ data: JSON.stringify(message) });
  for (const text of ["첫 질문", "둘째 질문"]) {
    send({ type: "input_audio_buffer.speech_started" });
    send({ type: "conversation.item.input_audio_transcription.completed", transcript: text.slice(0, 2) });
    send({ type: "input_audio_buffer.speech_stopped" });
    send({ type: "conversation.item.input_audio_transcription.completed", transcript: text });
  }
  assert.deepEqual(
    events.filter((event) => event.type === "user_transcript").map(({ final }) => final),
    [false, true, false, true],
  );
});
