// 한 발화 = 말풍선 하나 (2026-10-13 · 음성 도슨트 출시 규칙 「같은 발화를 여러 대화 턴으로 만들지 않는다」)
// 실제 공급자(xAI) 측정 차례를 진짜 전송 모듈과 진짜 도슨트 모듈에 흘려 사용자 말풍선을 센다.
// 말하는 동안 updated 와 completed 가 번갈아 오고, speech_stopped 뒤에 completed 가 한두 번 더 온다.
// 검수 모의 재생에서 깨졌던 셋(띄어쓰기만 다른 두 번째 최종 · 답 조각 뒤의 최종 · 정지 뒤 최종 없음)을 잠근다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function importModule(rel) {
  const url = pathToFileURL(path.join(repoRoot, rel));
  url.searchParams.set("test", String(Math.random()));
  return import(url.href);
}

function makeElement() {
  return {
    className: "",
    dataset: {},
    children: [],
    textContent: "",
    isConnected: true,
    append(...children) { this.children.push(...children); },
    querySelector(selector) {
      if (selector === ".voice-assistant__speaker") {
        return this.children.find((child) => child.className === "voice-assistant__speaker") ?? null;
      }
      if (selector === "[data-assistant-transcript]") {
        return this.children.find((child) => Object.hasOwn(child.dataset, "assistantTranscript")) ?? null;
      }
      return null;
    },
  };
}

async function loadAssistant() {
  const agent = await importModule("assets/assistant/docent-agent.js");
  class ElementStub {
    constructor() { this.dataset = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
    addEventListener() {}
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }
  const context = vm.createContext({
    AbortController,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    DocentAgent: agent.DocentAgent,
    mentionsProtectedMaterial: agent.mentionsProtectedMaterial,
    mentionsFactFabrication: agent.mentionsFactFabrication,
    needsSourceChoiceClarification: agent.needsSourceChoiceClarification,
    emitInspectorEvent() {},
    GROK_BUILT_IN_VOICES: Object.freeze(["ara", "eve", "rex", "sal", "leo"]),
    HTMLElement: ElementStub,
    URL,
    VOICE_OFFLINE_MESSAGE: "offline",
    VoiceTransport: class { reset() {} destroy() {} interrupt() {} stopVoiceSession() {} },
    clearTimeout,
    console,
    customElements: { define() {}, get() { return undefined; } },
    document: {
      baseURI: "https://kiheon.com/series/aigc-creative-paradigm/",
      activeElement: null,
      addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
      documentElement: { classList: { add() {}, remove() {} } },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement: () => makeElement(),
    },
    fetch: async () => ({ ok: false }),
    innerHeight: 800,
    location: { hash: "", hostname: "kiheon.com", origin: "https://kiheon.com", pathname: "/series/aigc-creative-paradigm/" },
    navigator: {},
    setTimeout,
    window: { addEventListener() {}, removeEventListener() {} },
  });
  context.globalThis = context;
  let source = await readFile(path.join(repoRoot, "assets/assistant/voice-assistant-v2.js"), "utf8");
  source = source
    .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";/g, (_, names) => names.split(",")
      .map((name) => name.trim()).filter(Boolean)
      .map((name) => `const ${name} = globalThis.${name};`).join(" "))
    .replace("export class KiheonVoiceAssistant", "class KiheonVoiceAssistant")
    .replace(/if \(!customElements\.get\("kiheon-voice-assistant"\)\) \{[\s\S]*?\}\s*$/,
      "globalThis.KiheonVoiceAssistant = KiheonVoiceAssistant;");
  vm.runInContext(source, context);
  return context.KiheonVoiceAssistant;
}

async function session() {
  const Assistant = await loadAssistant();
  const { VoiceTransport } = await importModule("assets/assistant/xai-voice-transport.js");
  const assistant = new Assistant();
  const turns = [];
  assistant.dataset.scope = "series";
  assistant.context = { series: { id: "s", title: "시험" }, allowedTargets: [], entries: [] };
  assistant.targets = { childElementCount: 0, hidden: true, replaceChildren() {}, append() {} };
  assistant.transcriptLog = {
    scrollHeight: 0,
    scrollTop: 0,
    setAttribute() {},
    querySelector(selector) {
      if (selector === "[data-assistant-listening]") {
        return turns.find((turn) => Object.hasOwn(turn.dataset, "assistantListening")) ?? null;
      }
      if (selector === ".voice-assistant__turn:last-of-type") return turns.at(-1) ?? null;
      return null;
    },
    insertBefore(turn) {
      turn.remove = () => {
        const at = turns.indexOf(turn);
        if (at >= 0) turns.splice(at, 1);
        turn.isConnected = false;
      };
      turns.push(turn);
    },
  };
  assistant.voiceSessionActive = true;
  const transport = new VoiceTransport();
  transport.active = true;
  transport.onEvent = (event) => assistant.handleRealtimeEvent(event);
  assistant.transport = transport;
  const play = (messages) => {
    for (const message of messages) transport.handleSocketMessage({ data: JSON.stringify(message) });
  };
  const read = () => turns.map((turn) => ({
    role: turn.dataset.assistantRole,
    listening: Object.hasOwn(turn.dataset, "assistantListening"),
    speaker: turn.querySelector(".voice-assistant__speaker")?.textContent,
    text: turn.querySelector("[data-assistant-transcript]")?.textContent,
  }));
  return { assistant, play, read };
}

const T = "conversation.item.input_audio_transcription";
// 2026-10-13 실측 차례(시리즈 첫 면) : 정지 앞 updated · completed 넷 · 정지 뒤 completed 둘(응답 생성 앞뒤).
function utterance(final, { secondFinal = final, secondAfterAnswer = false, postStop = true } = {}) {
  const words = final.split(" ");
  const partials = words.map((_, index) => words.slice(0, index + 1).join(" "));
  const before = [{ type: "input_audio_buffer.speech_started" }];
  for (const text of partials) {
    before.push({ type: `${T}.updated`, transcript: text }, { type: `${T}.completed`, transcript: text });
  }
  before.push({ type: "input_audio_buffer.speech_stopped" });
  const answer = [
    { type: "response.output_item.added" },
    { type: "response.content_part.added" },
    { type: "response.output_audio_transcript.delta", delta: "답변 " },
    { type: "response.output_audio_transcript.delta", delta: "조각" },
    { type: "response.output_audio_transcript.done", transcript: "답변 조각" },
    { type: "response.done" },
  ];
  if (!postStop) return [...before, { type: "response.created" }, { type: "input_audio_buffer.committed" }, ...answer];
  const second = { type: `${T}.completed`, transcript: secondFinal };
  const out = [...before, { type: `${T}.completed`, transcript: final }, { type: "response.created" }, { type: "input_audio_buffer.committed" }];
  if (!secondAfterAnswer) return [...out, second, ...answer];
  return [...out, ...answer.slice(0, 3), second, ...answer.slice(3)];
}

test("one spoken question leaves one user bubble with the final transcript", async () => {
  const { play, read } = await session();
  play(utterance("이 시리즈에서 가장 먼저 읽을 글을 추천해 주세요."));
  const users = read().filter((turn) => turn.role === "user");
  assert.equal(users.length, 1);
  assert.deepEqual(users[0], { role: "user", listening: false, speaker: "나", text: "이 시리즈에서 가장 먼저 읽을 글을 추천해 주세요." });
  assert.deepEqual(read().map((turn) => turn.role), ["user", "assistant"]);
});

test("two questions in one voice session leave two user bubbles", async () => {
  const { play, read } = await session();
  play(utterance("첫 번째 글은 무엇인가요?"));
  play(utterance("두 번째 글은 무엇인가요?"));
  assert.deepEqual(read().filter((turn) => turn.role === "user").map((turn) => turn.text),
    ["첫 번째 글은 무엇인가요?", "두 번째 글은 무엇인가요?"]);
});

test("a later final that differs only in spacing corrects the same bubble", async () => {
  const { assistant, play, read } = await session();
  play(utterance("이 시리즈에서 가장 먼저 읽을 글을 추천해주세요.", { secondFinal: "이 시리즈에서 가장 먼저 읽을 글을 추천해 주세요." }));
  const users = read().filter((turn) => turn.role === "user");
  assert.equal(users.length, 1);
  assert.equal(users[0].text, "이 시리즈에서 가장 먼저 읽을 글을 추천해 주세요.");
  assert.equal(assistant.latestVoiceQuestion, "이 시리즈에서 가장 먼저 읽을 글을 추천해 주세요.");
});

test("a later final arriving after the first answer piece does not add a bubble under the answer", async () => {
  const { play, read } = await session();
  play(utterance("연구 노트는 어디서 보나요?", { secondAfterAnswer: true }));
  assert.deepEqual(read().map((turn) => turn.role), ["user", "assistant"]);
});

test("a heard question with no final after the stop stays when the next question starts", async () => {
  const { play, read } = await session();
  play(utterance("발표 자료는 몇 장인가요?", { postStop: false }));
  play(utterance("영상은 몇 편인가요?"));
  const users = read().filter((turn) => turn.role === "user");
  assert.deepEqual(users.map((turn) => [turn.speaker, turn.text, turn.listening]), [
    ["나", "발표 자료는 몇 장인가요?", false],
    ["나", "영상은 몇 편인가요?", false],
  ]);
});

test("a sound with no words leaves no user bubble when the next question starts", async () => {
  const { play, read } = await session();
  play([{ type: "input_audio_buffer.speech_started" }, { type: "input_audio_buffer.speech_stopped" }]);
  play(utterance("글은 몇 편인가요?"));
  assert.deepEqual(read().filter((turn) => turn.role === "user").map((turn) => turn.text), ["글은 몇 편인가요?"]);
});

test("voice keyterms stay within 100 even for a long outline", async () => {
  const Assistant = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  assistant.context = {
    series: { title: "시리즈" },
    allowedTargets: [{ contentType: "post", contentId: "post-1" }],
    entries: [{
      contentId: "post-1",
      type: "post",
      url: "series/x/posts/post-1/",
      title: "첫 글",
      outline: Array.from({ length: 150 }, (_, index) => ({ title: `소제목 ${index}` })),
    }],
  };
  const terms = Array.from(assistant.voiceKeyterms());
  assert.equal(terms.length, 100);
  assert.equal(terms.every((term) => [...term].length <= 20), true);
});

// 출시 규칙 §상태 문구 : 「연결 중」과 「말씀해 주세요」를 구분해 언제 말해야 하는지 알게 하고, 끝내는 법을 글로 둔다.
test("the voice stage separates connecting from the moment to speak and says how to end", async () => {
  const Assistant = await loadAssistant();
  const assistant = new Assistant();
  assistant.voiceStageTitle = { textContent: "" };
  assistant.voiceStageCopy = { textContent: "" };
  assistant.setState("connecting", "마이크를 켜고 연결하고 있어요");
  const connecting = assistant.voiceStageTitle.textContent;
  assistant.setState("listening", "말씀해 주세요");
  assert.equal(assistant.voiceStageTitle.textContent, "말씀해 주세요");
  assert.notEqual(connecting, "말씀해 주세요");
  assert.match(connecting, /연결/);
  assert.match(assistant.voiceStageCopy.textContent, /끝냅니다/);
});
