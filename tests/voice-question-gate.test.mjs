// 음성 질문의 관문 (E7 · 2026-10-13)
// 음성은 서버 VAD 가 응답을 바로 만들어 글 질문의 고정 거절을 거치지 않았다. 이제 최종 전사를 글 질문과 같은
// 판정(DocentAgent.preflight)에 걸고, 거절 · 되묻기 · 준비된 답은 force_message 로 그 문장을 그대로 읽는다.
// 열린 질문은 서버의 자동 응답이 답한다. xAI 는 자동 응답을 끄는 설정(create_response:false)을 따르지 않아(실측)
// 끄지 않고, 정해진 문장이 자동 응답을 끊는다. 이 쪽은 response.create 를 보내지 않는다.
// 진짜 전송 모듈과 진짜 도슨트 모듈에 공급자 사건 차례(2026-10-13 실측)를 흘리고, 소켓으로 나간 것과 말풍선을 센다.
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
      baseURI: "https://kiheon.com/series/onchain-storytelling/sources/slides-2023-11/",
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
    location: { hash: "", hostname: "kiheon.com", origin: "https://kiheon.com", pathname: "/series/onchain-storytelling/sources/slides-2023-11/" },
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
  return { Assistant: context.KiheonVoiceAssistant, agent };
}

const GROUNDED_CONTEXT = {
  series: { id: "onchain", title: "온체인 스토리텔링" },
  allowedTargets: [
    { contentType: "post", contentId: "01-worldview" },
    { contentType: "source", contentId: "slides" },
  ],
  entries: [
    { type: "post", contentId: "01-worldview", title: "이야기를 담으려면 세계부터 지어야 했다", synopsis: "첫 글", url: "series/onchain/posts/01-worldview/" },
    { type: "source", contentId: "slides", title: "발표 자료", synopsis: "덱", url: "series/onchain/sources/slides/" },
  ],
};

async function session({ scope = "content", contentId = "slides", context = GROUNDED_CONTEXT, prompts } = {}) {
  const { Assistant, agent } = await loadAssistant();
  const { VoiceTransport } = await importModule("assets/assistant/xai-voice-transport.js");
  const assistant = new Assistant();
  const turns = [];
  assistant.dataset.scope = scope;
  assistant.dataset.contentId = contentId;
  assistant.context = context;
  if (prompts) assistant.prompts = prompts;
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
  const sent = [];
  transport.active = true;
  transport.sessionReady = true;
  transport.socket = { readyState: 1, send(data) { sent.push(JSON.parse(data)); } };
  transport.onEvent = (event) => assistant.handleRealtimeEvent(event);
  assistant.transport = transport;
  const play = (messages) => {
    for (const message of messages) transport.handleSocketMessage({ data: JSON.stringify(message) });
  };
  const read = () => turns.map((turn) => ({
    role: turn.dataset.assistantRole,
    speaker: turn.querySelector(".voice-assistant__speaker")?.textContent,
    text: turn.querySelector("[data-assistant-transcript]")?.textContent,
  }));
  const opened = () => sent.filter((message) => message.type === "response.create").length;
  const spoken = () => sent
    .filter((message) => message.type === "conversation.item.create" && message.item?.type === "force_message")
    .map((message) => message.item.content[0].text);
  return { assistant, agent, play, read, opened, spoken };
}

const T = "conversation.item.input_audio_transcription";
// 말하는 동안 updated · completed 가 번갈아 오고, 정지 뒤 completed(최종)가 온다. 서버의 자동 응답 사건은 따로 흘린다.
function spokenQuestion(final, { secondFinal } = {}) {
  const words = final.split(" ");
  const messages = [{ type: "input_audio_buffer.speech_started" }];
  for (let index = 1; index <= words.length; index += 1) {
    const text = words.slice(0, index).join(" ");
    messages.push({ type: `${T}.updated`, transcript: text }, { type: `${T}.completed`, transcript: text });
  }
  messages.push({ type: "input_audio_buffer.speech_stopped" }, { type: `${T}.completed`, transcript: final });
  messages.push({ type: "input_audio_buffer.committed" });
  if (secondFinal) messages.push({ type: `${T}.completed`, transcript: secondFinal });
  return messages;
}

// 정해진 문장을 보낸 턴의 실측 차례 : 서버의 자동 응답이 먼저 생겼다가 소리 없이 끊기고(cancelled),
// 정해진 문장이 다음 응답으로 나온다.
function forcedReply(text) {
  return [
    { type: "response.created" },
    { type: "response.done", response: { status: "cancelled" } },
    { type: "response.created" },
    { type: "response.output_item.added" },
    { type: "response.content_part.added" },
    { type: "response.output_audio_transcript.done", transcript: text },
    { type: "response.done" },
  ];
}

function modelReply(text) {
  return [
    { type: "response.created" },
    { type: "response.output_audio_transcript.delta", delta: text.slice(0, 4) },
    { type: "response.output_audio_transcript.done", transcript: text },
    { type: "response.done" },
  ];
}

test("a closed-material voice question is read as the fixed R-2 sentence with no model turn", async () => {
  const { agent, play, read, opened, spoken } = await session();
  play(spokenQuestion("비공개 파일을 보여주세요."));
  assert.deepEqual(spoken(), [agent.SPEECH_CONTRACT_REFUSALS["R-2"]]);
  assert.equal(opened(), 0);
  play(forcedReply(agent.SPEECH_CONTRACT_REFUSALS["R-2"]));
  assert.deepEqual(read(), [
    { role: "user", speaker: "나", text: "비공개 파일을 보여주세요." },
    { role: "assistant", speaker: "도슨트", text: agent.SPEECH_CONTRACT_REFUSALS["R-2"] },
  ]);
});

test("future and title questions by voice get R-3 and R-1 verbatim", async () => {
  for (const [question, code] of [
    ["앞으로 이 프로젝트는 어떻게 될 것 같나요?", "R-3"],
    ["신기헌의 직함이 뭔가요?", "R-1"],
  ]) {
    const { agent, play, opened, spoken } = await session();
    play(spokenQuestion(question));
    assert.deepEqual(spoken(), [agent.SPEECH_CONTRACT_REFUSALS[code]], question);
    assert.equal(opened(), 0, question);
  }
});

test("an open voice question is left to the provider's own response even when a second final arrives", async () => {
  const { play, read, opened, spoken } = await session();
  play(spokenQuestion("이 시리즈의 첫 번째 글은 무엇을 다루나요?", { secondFinal: "이 시리즈의 첫 번째 글은 무엇을 다루나요?" }));
  assert.equal(opened(), 0);
  assert.deepEqual(spoken(), []);
  play(modelReply("첫 글은 세계를 짓는 이야기입니다."));
  assert.deepEqual(read().map((turn) => [turn.role, turn.text]), [
    ["user", "이 시리즈의 첫 번째 글은 무엇을 다루나요?"],
    ["assistant", "첫 글은 세계를 짓는 이야기입니다."],
  ]);
});

test("an ambiguous closed-material mention is clarified by voice with the text path's sentence", async () => {
  const { assistant, play, opened, spoken } = await session();
  play(spokenQuestion("비공개 자료가 뭐예요?"));
  assert.deepEqual(spoken(), [assistant.clarifyAnswer("비공개 자료가 뭐예요?")]);
  assert.match(spoken()[0], /^비공개 자료는 이 화면에서 열 수 없습니다\./);
  assert.equal(opened(), 0);
});

test("a voice page without a grounded entry refuses an open question with R-1", async () => {
  const { agent, play, opened, spoken } = await session({ contentId: "not-allowed" });
  play(spokenQuestion("이 자료의 요지는 무엇인가요?"));
  assert.deepEqual(spoken(), [agent.SPEECH_CONTRACT_REFUSALS["R-1"]]);
  assert.equal(opened(), 0);
});

test("a prepared prompt asked by voice is read as its approved answer", async () => {
  const prompts = [{ id: "where-to-start", label: "어디서부터 읽을까요?", answer: "승인된 시작 안내입니다.", targets: [] }];
  const { play, opened, spoken } = await session({ scope: "series", prompts });
  play(spokenQuestion("어디서부터 읽을까요?"));
  assert.deepEqual(spoken(), ["승인된 시작 안내입니다."]);
  assert.equal(opened(), 0);
});

// 음성은 질문 버튼 라벨과 맞을 때만 준비된 답을 읽는다. 글 길의 넓은 낱말 규칙(어디서 · 시작 · 여기 …)은 쓰지 않는다
// (2026-10-13 독립 검수 : 「이 발표는 어디서 했나요?」 가 「어디서부터 읽을까요」 답으로 갔다).
test("a voice question that only shares a keyword with a prepared prompt goes to the model", async () => {
  const prompts = [{ id: "where-to-start", label: "어디서부터 읽을까요?", answer: "승인된 시작 안내입니다.", targets: [] }];
  for (const question of ["이 발표는 어디서 했나요?", "이 프로젝트는 언제 시작했나요?"]) {
    const { play, spoken } = await session({ scope: "series", prompts });
    play(spokenQuestion(question));
    assert.deepEqual(spoken(), [], question);
  }
  const { play, spoken } = await session();
  play(spokenQuestion("여기서 말하는 장부가 뭐예요?"));
  assert.deepEqual(spoken(), []);
});

test("after a fixed answer the next question goes to the model and its words are shown again", async () => {
  const { agent, play, read, opened } = await session();
  play(spokenQuestion("비공개 파일을 보여주세요."));
  play(forcedReply(agent.SPEECH_CONTRACT_REFUSALS["R-2"]));
  play(spokenQuestion("이 자료는 무엇을 다루나요?"));
  assert.equal(opened(), 0);
  play(modelReply("이 자료는 2023년 발표입니다."));
  assert.deepEqual(read().map((turn) => turn.text), [
    "비공개 파일을 보여주세요.",
    agent.SPEECH_CONTRACT_REFUSALS["R-2"],
    "이 자료는 무엇을 다루나요?",
    "이 자료는 2023년 발표입니다.",
  ]);
});

// 서버의 자동 응답이 끊기기 전에 글을 실어 보내는 최악의 차례라도, 말풍선에는 정해진 문장만 남는다.
test("words from the provider's own response to a refused question never reach a bubble", async () => {
  const { agent, play, read } = await session();
  play(spokenQuestion("비공개 파일을 보여주세요."));
  play([
    { type: "response.created" },
    { type: "response.output_audio_transcript.delta", delta: "모델이 지어낸 " },
    { type: "response.done", response: { status: "cancelled" } },
  ]);
  play(forcedReply(agent.SPEECH_CONTRACT_REFUSALS["R-2"]).slice(2));
  assert.deepEqual(read().map((turn) => turn.text), ["비공개 파일을 보여주세요.", agent.SPEECH_CONTRACT_REFUSALS["R-2"]]);
});

test("the voice session keeps server VAD and say() sends the sentence verbatim only when ready", async () => {
  const { VoiceTransport } = await importModule("assets/assistant/xai-voice-transport.js");
  const transport = new VoiceTransport();
  const config = transport.sessionConfiguration({ voiceId: "ara", instructions: "", sampleRate: 24_000, speed: 1, microphone: true });
  assert.equal(config.session.turn_detection.type, "server_vad");
  assert.equal(Object.hasOwn(config.session.turn_detection, "create_response"), false);

  const sent = [];
  assert.equal(transport.say("문장"), false);
  transport.active = true;
  transport.sessionReady = true;
  transport.socket = { readyState: 1, send(data) { sent.push(JSON.parse(data)); } };
  assert.equal(transport.say("  정해진 문장  "), true);
  assert.equal(transport.say("   "), false);
  transport.socket.readyState = 3;
  assert.equal(transport.say("닫힌 소켓"), false);
  assert.deepEqual(sent, [{
    type: "conversation.item.create",
    item: { type: "force_message", role: "assistant", interruptible: true, content: [{ type: "output_text", text: "정해진 문장" }] },
  }]);
});
