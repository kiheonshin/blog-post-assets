import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transportPath = path.join(repoRoot, "assets", "assistant", "voice-transport.js");
const agentPath = path.join(repoRoot, "assets", "assistant", "docent-agent.js");
const assistantPath = path.join(repoRoot, "assets", "assistant", "voice-assistant.js");

async function importTransport() {
  const source = await readFile(transportPath, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function importAgent() {
  const source = await readFile(agentPath, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function loadAssistant() {
  const { DocentAgent } = await importAgent();
  let transportInstances = 0;
  class TransportStub {
    constructor() {
      transportInstances += 1;
    }
    reset() {}
    destroy() {}
  }
  class ElementStub {
    constructor() {
      this.dataset = {};
      this.classList = { add() {} };
    }
    addEventListener() {}
    removeEventListener() {}
    querySelector() { return null; }
  }
  class CustomEventStub {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }
  const documentStub = {
    baseURI: "https://kiheonshin.github.io/blog-post-assets/series/aigc-creative-paradigm/",
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    documentElement: { classList: { add() {}, remove() {} } },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const windowStub = {
    addEventListener() {},
    removeEventListener() {},
  };
  const context = vm.createContext({
    AbortController,
    CustomEvent: CustomEventStub,
    DocentAgent,
    HTMLElement: ElementStub,
    URL,
    VOICE_OFFLINE_MESSAGE: "이 기기에서 개인 연결을 켜고, 브라우저의 기기 연결 요청을 허용한 뒤 다시 시도해 주세요. 연결되지 않아도 준비된 안내는 이용할 수 있습니다.",
    VoiceTransport: TransportStub,
    clearTimeout,
    console,
    customElements: { define() {}, get() { return undefined; } },
    document: documentStub,
    fetch: async () => ({ ok: false }),
    innerHeight: 800,
    location: {
      hash: "",
      hostname: "kiheonshin.github.io",
      origin: "https://kiheonshin.github.io",
      pathname: "/blog-post-assets/series/aigc-creative-paradigm/",
    },
    navigator: {},
    setTimeout,
    speechSynthesis: { cancel() {}, speak() {} },
    window: windowStub,
  });
  context.globalThis = context;
  let source = await readFile(assistantPath, "utf8");
  source = source
    .replace(
      'import { VoiceTransport, VOICE_OFFLINE_MESSAGE } from "./voice-transport.js?v=20260801b";',
      "const VoiceTransport = globalThis.VoiceTransport; const VOICE_OFFLINE_MESSAGE = globalThis.VOICE_OFFLINE_MESSAGE;",
    )
    .replace(
      'import { DocentAgent } from "./docent-agent.js?v=20260803contract1";',
      "const DocentAgent = globalThis.DocentAgent;",
    )
    .replace("export class KiheonVoiceAssistant", "class KiheonVoiceAssistant")
    .replace(
      /if \(!customElements\.get\("kiheon-voice-assistant"\)\) \{[\s\S]*?\}\s*$/,
      "globalThis.KiheonVoiceAssistant = KiheonVoiceAssistant; globalThis.currentHeading = currentHeading;",
    );
  vm.runInContext(source, context, { filename: assistantPath });
  return {
    Assistant: context.KiheonVoiceAssistant,
    context,
    currentHeading: context.currentHeading,
    getTransportInstances: () => transportInstances,
  };
}

test("transport construction never probes the loopback service", async () => {
  const { VoiceTransport } = await importTransport();
  const calls = [];
  new VoiceTransport({ fetchImpl: (...args) => calls.push(args) });
  assert.deepEqual(calls, []);
});

test("default browser fetch keeps its Window receiver", async () => {
  const originalFetch = globalThis.fetch;
  let receiver;
  globalThis.fetch = function () {
    receiver = this;
    return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
  };
  try {
    const { VoiceTransport } = await importTransport();
    const transport = new VoiceTransport();
    assert.equal(await transport.checkAvailability(), true);
    assert.equal(receiver, globalThis);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("transport uses the public-page-to-loopback request contract", async () => {
  const { VoiceTransport, voiceTransportEndpoints } = await importTransport();
  const calls = [];
  const transport = new VoiceTransport({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === voiceTransportEndpoints.health) {
        return { ok: true, json: async () => ({ ok: true, provider: "hidden" }) };
      }
      return { ok: true, json: async () => ({ output_text: "준비된 답변" }) };
    },
  });

  assert.equal(await transport.ask("질문"), "준비된 답변");
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(({ url, options }) => ({
      url,
      method: options.method,
      mode: options.mode,
      credentials: options.credentials,
      cache: options.cache,
      targetAddressSpace: options.targetAddressSpace,
    })),
    [
      {
        url: "http://127.0.0.1:8787/health",
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        targetAddressSpace: "loopback",
      },
      {
        url: "http://127.0.0.1:8787/v1/responses",
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        targetAddressSpace: "loopback",
      },
    ],
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), { input: "질문" });
});

test("voice activation completes health before asking for microphone access", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const order = [];
  assistant.voiceButton = {
    setAttribute() {},
    textContent: "",
  };
  assistant.claimAudio = () => order.push("claim");
  assistant.setState = () => {};
  assistant.showAnswer = () => {};
  assistant.transport = {
    checkAvailability: async () => order.push("health"),
    reset() {},
  };
  assistant.startListening = async () => order.push("microphone");

  await assistant.startVoice();
  assert.deepEqual(order, ["claim", "health", "microphone"]);
});

test("offline voice activation never asks for a microphone and gives the recovery action", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  let microphoneCalls = 0;
  assistant.voiceButton = { setAttribute() {}, textContent: "" };
  assistant.claimAudio = () => {};
  assistant.setState = () => {};
  assistant.showAnswer = (speaker, text) => answers.push({ speaker, text });
  assistant.releaseMicrophone = () => {};
  assistant.transport = {
    checkAvailability: async () => { throw new Error("offline"); },
    reset() {},
  };
  assistant.startListening = async () => { microphoneCalls += 1; };

  await assistant.startVoice();
  assert.equal(microphoneCalls, 0);
  assert.equal(
    answers.at(-1).text,
    "이 기기에서 개인 연결을 켜고, 브라우저의 기기 연결 요청을 허용한 뒤 다시 시도해 주세요. 연결되지 않아도 준비된 안내는 이용할 수 있습니다.",
  );
  assert.doesNotMatch(answers.at(-1).text, /Mac|Windows|Android|iPhone/iu);
});

test("typed questions remain available without speech input", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const states = [];
  const answers = [];
  assistant.showAnswer = (speaker, text) => answers.push({ speaker, text });
  assistant.setState = (state, message) => states.push({ state, message });
  assistant.groundedInput = (question) => `public:${question}`;
  assistant.transport = {
    ask: async (input) => {
      assert.equal(input, "public:글로 묻습니다");
      return "글로 받은 답입니다";
    },
  };

  await assistant.askQuestion("글로 묻습니다", { speak: false });
  assert.deepEqual(states.map(({ state }) => state), ["thinking", "thinking", "thinking", "thinking", "idle"]);
  assert.deepEqual(states.slice(0, -1).map(({ message }) => message), [
    "질문을 살펴보고 있어요",
    "공개 자료를 확인하고 있어요",
    "도슨트가 답을 만들고 있어요",
    "답변을 확인하고 있어요",
  ]);
  assert.equal(answers.at(-1).text, "글로 받은 답입니다");
});

test("filler speech asks a natural follow-up without calling the bridge", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  const spoken = [];
  let bridgeCalls = 0;
  assistant.dataset.scope = "series";
  assistant.showAnswer = (speaker, text) => answers.push({ speaker, text });
  assistant.setState = () => {};
  assistant.speak = (text) => spoken.push(text);
  assistant.transport = { ask: async () => { bridgeCalls += 1; } };

  await assistant.askQuestion("아아", { speak: true });
  assert.equal(bridgeCalls, 0);
  assert.match(answers.at(-1).text, /듣고 있어요/);
  assert.match(answers.at(-1).text, /무엇이 궁금한지/);
  assert.deepEqual(spoken, [answers.at(-1).text]);
  assert.deepEqual(Array.from(assistant.dialogueHistory, (turn) => turn.role), ["사용자", "도슨트"]);
});

test("thinking state exposes a visible and accessible LLM activity signal", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const attributes = {};
  assistant.status = { textContent: "" };
  assistant.statusCopy = { textContent: "" };
  assistant.transcriptLog = {
    setAttribute(name, value) { attributes[name] = value; },
  };

  assistant.setState("thinking", "도슨트가 답을 만들고 있어요");
  assert.equal(assistant.dataset.state, "thinking");
  assert.equal(assistant.statusCopy.textContent, "도슨트가 답을 만들고 있어요");
  assert.equal(attributes["aria-busy"], "true");

  assistant.setState("idle", "안내 준비됨");
  assert.equal(attributes["aria-busy"], "false");
  assert.match(assistant.conversationMarkup(), /voice-assistant__activity/);
});

test("conversation log keeps the question when the answer arrives", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const turns = [];
  let initialPresent = true;
  const initial = { remove: () => { initialPresent = false; } };
  context.document.createElement = () => ({
    children: [],
    dataset: {},
    append(...children) { this.children.push(...children); },
  });
  assistant.targets = {
    childElementCount: 0,
    hidden: true,
    replaceChildren() {},
    append() {},
  };
  assistant.transcriptLog = {
    scrollHeight: 200,
    scrollTop: 0,
    querySelector: () => initialPresent ? initial : null,
    insertBefore: (turn) => turns.push(turn),
  };

  assistant.showAnswer("질문", "첫 질문");
  assistant.showAnswer("안내", "첫 답변");
  assert.equal(turns.length, 2);
  assert.equal(turns[0].children[0].textContent, "나");
  assert.equal(turns[0].children[1].textContent, "첫 질문");
  assert.equal(turns[0].dataset.assistantRole, "user");
  assert.equal(turns[1].children[0].textContent, "도슨트");
  assert.equal(turns[1].children[1].textContent, "첫 답변");
  assert.equal(turns[1].dataset.assistantRole, "assistant");
});

test("speech recognition revisions update one listening bubble", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const turns = [];
  context.document.createElement = () => ({
    children: [],
    dataset: {},
    append(...children) { this.children.push(...children); },
    querySelector(selector) {
      if (selector === ".voice-assistant__speaker") return this.children[0];
      if (selector === "[data-assistant-transcript]") return this.children[1];
      return null;
    },
  });
  assistant.targets = { childElementCount: 0, hidden: true, replaceChildren() {}, append() {} };
  assistant.resetButton = { disabled: true };
  assistant.transcriptLog = {
    scrollHeight: 200,
    scrollTop: 0,
    querySelector(selector) {
      if (selector === "[data-assistant-listening]") {
        return turns.find((turn) => Object.hasOwn(turn.dataset, "assistantListening")) ?? null;
      }
      if (selector === ".voice-assistant__turn:last-of-type") return turns.at(-1) ?? null;
      return null;
    },
    insertBefore(turn) { turns.push(turn); },
  };

  assistant.showAnswer("듣는 중", "아");
  assistant.showAnswer("듣는 중", "아아");
  assistant.showAnswer("질문", "아아");
  assert.equal(turns.length, 1);
  assert.equal(turns[0].children[0].textContent, "나");
  assert.equal(turns[0].children[1].textContent, "아아");
  assert.equal(Object.hasOwn(turns[0].dataset, "assistantListening"), false);
});

test("speech recognition keeps every revised segment in one submitted question", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const turns = [];
  const asked = [];
  const result = (transcript, isFinal) => ({
    0: { transcript },
    isFinal,
    length: 1,
  });
  context.document.createElement = () => ({
    children: [],
    dataset: {},
    isConnected: true,
    append(...children) { this.children.push(...children); },
    querySelector(selector) {
      if (selector === ".voice-assistant__speaker") return this.children[0];
      if (selector === "[data-assistant-transcript]") return this.children[1];
      return null;
    },
  });
  assistant.targets = { childElementCount: 0, hidden: true, replaceChildren() {}, append() {} };
  assistant.resetButton = { disabled: true };
  assistant.transcriptLog = {
    scrollHeight: 200,
    scrollTop: 0,
    querySelector(selector) {
      if (selector === "[data-assistant-listening]") {
        return turns.find((turn) => Object.hasOwn(turn.dataset, "assistantListening")) ?? null;
      }
      if (selector === ".voice-assistant__turn:last-of-type") return turns.at(-1) ?? null;
      return null;
    },
    insertBefore(turn) { turns.push(turn); },
  };
  assistant.releaseMicrophone = () => {};
  assistant.resetVoiceButton = () => {};
  assistant.askQuestion = async (question, options) => asked.push({ question, options });
  assistant.listening = true;
  assistant.recognition = {};

  assistant.handleRecognitionResult({
    resultIndex: 0,
    results: [result("포스팅 1의 내", false)],
  });
  assistant.handleRecognitionResult({
    resultIndex: 1,
    results: [result("포스팅 1의 ", true), result("내용이 궁금", false)],
  });

  assert.equal(turns.length, 1);
  assert.equal(turns[0].children[0].textContent, "말하는 중");
  assert.equal(turns[0].children[1].textContent, "포스팅 1의 내용이 궁금");
  assert.equal(asked.length, 0);

  assistant.handleRecognitionResult({
    resultIndex: 1,
    results: [result("포스팅 1의 ", true), result("내용이 궁금해", true)],
  });

  assert.equal(turns.length, 1);
  assert.equal(turns[0].children[0].textContent, "나");
  assert.equal(turns[0].children[1].textContent, "포스팅 1의 내용이 궁금해");
  assert.equal(Object.hasOwn(turns[0].dataset, "assistantListening"), false);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].question, "포스팅 1의 내용이 궁금해");
  assert.equal(asked[0].options.speak, true);
});

test("consecutive identical connection errors create only one docent message", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const turns = [];
  context.document.createElement = () => ({
    children: [],
    dataset: {},
    append(...children) { this.children.push(...children); },
    querySelector(selector) {
      return selector === "[data-assistant-transcript]" ? this.children[1] : null;
    },
  });
  assistant.targets = {
    childElementCount: 0,
    hidden: true,
    replaceChildren() {},
    append() {},
  };
  assistant.transcriptLog = {
    scrollHeight: 200,
    scrollTop: 0,
    querySelector(selector) {
      if (selector === "[data-assistant-initial]") return null;
      return selector === ".voice-assistant__turn:last-of-type" ? turns.at(-1) : null;
    },
    insertBefore(turn) { turns.push(turn); },
  };

  assistant.showAnswer("안내", "같은 연결 안내");
  assistant.showAnswer("안내", "같은 연결 안내");
  assert.equal(turns.length, 1);
});

test("conversation reset clears every turn, related link, and transport state", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const removed = [];
  const inserted = [];
  const made = [];
  context.document.createElement = () => {
    const node = {
      children: [],
      dataset: {},
      append(...children) { this.children.push(...children); },
    };
    made.push(node);
    return node;
  };
  assistant.stopVoice = ({ quiet }) => {
    assert.equal(quiet, true);
    removed.push("transport");
  };
  assistant.transcriptLog = {
    querySelectorAll: () => [
      { remove: () => removed.push("turn-1") },
      { remove: () => removed.push("turn-2") },
    ],
    insertBefore: (node) => inserted.push(node),
  };
  assistant.targets = {
    hidden: false,
    replaceChildren: () => removed.push("links"),
  };
  assistant.input = { value: "지울 질문", focus: () => removed.push("focus") };
  assistant.resetButton = { disabled: false };
  assistant.setState = (state, message) => removed.push(`${state}:${message}`);

  assistant.resetConversation();
  assert.deepEqual(removed, [
    "transport",
    "turn-1",
    "turn-2",
    "links",
    "idle:대화를 지웠어요",
    "focus",
  ]);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].dataset.assistantRole, "assistant");
  assert.equal(made[1].textContent, "도슨트");
  assert.equal(made[2].textContent, "궁금한 질문을 고르거나 직접 적어 주세요.");
  assert.equal(assistant.input.value, "");
  assert.equal(assistant.targets.hidden, true);
  assert.equal(assistant.resetButton.disabled, true);
  assert.equal(assistant.dialogueHistory.length, 0);
});

test("series questions carry every allowed public entry and the docent answer contract", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  assistant.dataset.contentId = "aigc";
  assistant.context = {
    series: { title: "공개 시리즈", synopsis: "공개 시리즈 설명" },
    allowedTargets: [
      { contentType: "post", contentId: "post-1" },
      { contentType: "source", contentId: "research" },
    ],
    entries: [
      {
        type: "post",
        contentId: "post-1",
        title: "첫 번째 글",
        synopsis: "첫 글 설명",
        keyInsights: [{ text: "첫 글 핵심", provenance: [{ sourceId: "private" }] }],
        outline: [{ sectionId: "one", title: "첫 대목", summary: "첫 대목 설명" }],
      },
      {
        type: "source",
        contentId: "research",
        title: "연구 노트",
        synopsis: "연구 설명",
        keyInsights: [{ text: "연구 핵심" }],
        outline: [],
      },
      {
        type: "source",
        contentId: "hidden",
        title: "비공개 자료",
        synopsis: "포함되면 안 됨",
      },
    ],
  };

  const grounded = assistant.groundedInput("무엇부터 읽을까요?");
  assert.match(grounded, /공개 시리즈/);
  assert.match(grounded, /첫 번째 글/);
  assert.match(grounded, /연구 노트/);
  assert.match(grounded, /\[글\]/);
  assert.match(grounded, /\[연구 노트\]/);
  assert.match(grounded, /네 문장 이내/);
  assert.match(grounded, /사용자의 의도를 먼저 확인/);
  assert.match(grounded, /무엇부터 읽을까요\?/);
  assert.doesNotMatch(grounded, /비공개 자료|포함되면 안 됨|private/);
  assert.ok(grounded.length <= 11_500);
});

test("follow-up questions carry recent dialogue without storing it outside the session", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  assistant.context = { series: { title: "공개 시리즈" }, allowedTargets: [], entries: [] };
  assistant.dialogueHistory = [
    { role: "사용자", text: "첫 글은 무엇을 다루나요?" },
    { role: "도슨트", text: "실력과 노력의 가치를 다룹니다." },
  ];

  const grounded = assistant.groundedInput("그건 왜 중요한가요?");
  assert.match(grounded, /이전 대화/);
  assert.match(grounded, /첫 글은 무엇을 다루나요/);
  assert.match(grounded, /실력과 노력의 가치/);
  assert.match(grounded, /그건 왜 중요한가요/);
});

test("content questions send only the current allowed entry", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "content";
  assistant.dataset.contentId = "post-1";
  assistant.context = {
    series: { title: "공개 시리즈", synopsis: "시리즈 설명" },
    allowedTargets: [
      { contentType: "post", contentId: "post-1" },
      { contentType: "post", contentId: "post-2" },
    ],
    entries: [
      { type: "post", contentId: "post-1", title: "현재 글", synopsis: "현재 글 설명", outline: [] },
      { type: "post", contentId: "post-2", title: "다른 글", synopsis: "다른 글 설명", outline: [] },
    ],
  };

  const grounded = assistant.groundedInput("이 글의 요지는?");
  assert.match(grounded, /현재 글/);
  assert.match(grounded, /현재 글 설명/);
  assert.doesNotMatch(grounded, /다른 글|다른 글 설명/);
});

test("live series answers suggest only allowed public content", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  assistant.dataset.scope = "series";
  assistant.context = {
    series: { id: "aigc", title: "공개 시리즈" },
    allowedTargets: [
      { contentType: "post", contentId: "post-1", url: "series/aigc/posts/post-1/" },
      { contentType: "source", contentId: "research", url: "series/aigc/sources/research/" },
    ],
    entries: [
      { type: "post", contentId: "post-1", title: "노력과 진정성", url: "series/aigc/posts/post-1/" },
      { type: "source", contentId: "research", title: "연구 노트", url: "series/aigc/sources/research/" },
      { type: "source", contentId: "hidden", title: "숨긴 자료", url: "series/aigc/sources/hidden/" },
    ],
  };
  assistant.groundedInput = (question) => question;
  assistant.transport = { ask: async () => "노력과 진정성을 다룬 첫 글부터 보세요." };
  assistant.showAnswer = (speaker, text, targets = []) => answers.push({ speaker, text, targets });
  assistant.setState = () => {};

  await assistant.askQuestion("노력과 진정성은 어디에서 읽나요?", { speak: false });
  assert.match(answers.at(-1).targets[0].url, /post-1/);
  assert.ok(answers.at(-1).targets.length <= 3);
  assert.doesNotMatch(JSON.stringify(answers.at(-1).targets), /hidden|숨긴/);
});

test("live content answers link the current section, related content, and series home", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  assistant.dataset.scope = "content";
  assistant.dataset.contentId = "post-1";
  assistant.context = {
    series: { id: "aigc", title: "공개 시리즈" },
    allowedTargets: [
      { contentType: "series", contentId: "aigc", url: "series/aigc/" },
      { contentType: "post", contentId: "post-1", url: "series/aigc/posts/post-1/" },
      { contentType: "post", contentId: "post-2", url: "series/aigc/posts/post-2/" },
    ],
    entries: [
      {
        type: "post",
        contentId: "post-1",
        title: "현재 글",
        url: "series/aigc/posts/post-1/",
        outline: [{ sectionId: "section-a", title: "현재 절", summary: "현재 절 설명" }],
        relations: [{ targetContentId: "post-2" }],
      },
      { type: "post", contentId: "post-2", title: "다음 글", url: "series/aigc/posts/post-2/" },
    ],
  };
  const heading = { id: "section-a", matches: () => true };
  context.document.querySelector = (selector) => selector.includes("aria-current")
    ? { hash: "#section-a" }
    : null;
  context.document.getElementById = (id) => id === "section-a" ? heading : null;
  assistant.groundedInput = (question) => question;
  assistant.transport = { ask: async () => "현재 절은 선택의 기준을 설명합니다." };
  assistant.showAnswer = (speaker, text, targets = []) => answers.push({ speaker, text, targets });
  assistant.setState = () => {};

  await assistant.askQuestion("이 부분을 더 설명해 주세요", { speak: false });
  const targets = answers.at(-1).targets;
  assert.equal(targets.length, 3);
  assert.match(targets[0].url, /post-1\/#section-a$/);
  assert.match(targets[1].url, /post-2\/$/);
  assert.match(targets[2].url, /series\/aigc\/$/);
});

test("voice guide intents play approved prepared guidance without calling the bridge", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  const spoken = [];
  assistant.dataset.scope = "content";
  assistant.prompts = [{
    id: "current-section-section-a",
    label: "이 대목 짚어 듣기",
    answer: "검증된 현재 대목 안내입니다.",
    targets: [{ label: "이 대목 보기", url: "series/aigc/posts/post-1/#section-a" }],
  }];
  assistant.transport = { ask: async () => assert.fail("prepared guidance must not call the bridge") };
  assistant.showAnswer = (speaker, text, targets = []) => answers.push({ speaker, text, targets });
  assistant.speak = (text) => spoken.push(text);
  assistant.setState = () => {};

  await assistant.askQuestion("이 대목을 설명해줘", { speak: true });
  assert.equal(answers.at(-1).text, "검증된 현재 대목 안내입니다.");
  assert.equal(answers.at(-1).targets.length, 1);
  assert.deepEqual(spoken, ["검증된 현재 대목 안내입니다."]);
});

test("stop and destroy release every owned resource", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const released = [];
  assistant.voiceButton = { setAttribute() {}, textContent: "" };
  assistant.requestController = { abort: () => released.push("request") };
  assistant.recognition = { abort: () => released.push("recognition") };
  assistant.mediaStream = { getTracks: () => [{ stop: () => released.push("track") }] };
  assistant.utterance = {};
  context.speechSynthesis.cancel = () => released.push("speech");
  assistant.transport = {
    reset: () => released.push("reset"),
    destroy: () => released.push("transport"),
  };

  assistant.destroy();
  assert.deepEqual(released, [
    "request",
    "recognition",
    "track",
    "speech",
    "reset",
    "transport",
  ]);
});

test("multiple assistants have independent transports and accessible ids", async () => {
  const { Assistant, getTransportInstances } = await loadAssistant();
  const first = new Assistant();
  const second = new Assistant();
  assert.notEqual(first.transport, second.transport);
  assert.notEqual(first.instanceId, second.instanceId);
  assert.equal(getTransportInstances(), 2);
  assert.match(first.seriesMarkup(), new RegExp(`${first.instanceId}-title`));
  assert.match(second.contentMarkup(), new RegExp(`${second.instanceId}-dialog-title`));
});

test("narrow series rail starts collapsed and exposes one accessible toggle", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  const attributes = {};
  const button = {
    textContent: "열기",
    setAttribute(name, value) { attributes[name] = value; },
  };

  assistant.dataset.seriesExpanded = "false";
  assistant.toggleSeries(button);
  assert.equal(assistant.dataset.seriesExpanded, "true");
  assert.equal(attributes["aria-expanded"], "true");
  assert.equal(button.textContent, "닫기");
  assistant.toggleSeries(button);
  assert.equal(assistant.dataset.seriesExpanded, "false");
  assert.equal(attributes["aria-expanded"], "false");
  assert.equal(button.textContent, "열기");
  assert.match(assistant.seriesMarkup(), /data-assistant-series-toggle/);
  assert.match(assistant.seriesMarkup(), /aria-controls="[^"]+-series-body"/);
});

test("series rail keeps navigation compact and moves conversation into a dedicated dialog", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  const markup = assistant.seriesMarkup();
  const rail = markup.slice(0, markup.indexOf('<div class="voice-assistant__overlay"'));

  assert.match(rail, /data-assistant-prompts/);
  assert.match(rail, /data-assistant-open/);
  assert.match(rail, /도슨트와 대화하기/);
  assert.doesNotMatch(rail, /voice-assistant__transcript|data-assistant-form|voice-assistant__settings/);
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /<textarea\b[^>]*data-assistant-input/);
  assert.match(markup, /<details class="voice-assistant__settings" open>/);
  assert.doesNotMatch(markup, /<select\b/i);
});

test("series prepared prompts open the dialog and prefill without sending or playing audio", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.scope = "series";
  assistant.panel = { hidden: true };
  assistant.prompts = [{ id: "prepared", label: "준비된 질문", answer: "준비된 답", targets: [] }];
  const calls = [];
  assistant.openPanel = () => calls.push("open");
  assistant.input = {
    value: "",
    focus: () => calls.push("focus"),
    setSelectionRange: (start, end) => calls.push(`selection:${start}:${end}`),
  };
  assistant.setState = (state, message) => calls.push(`${state}:${message}`);
  assistant.showAnswer = () => assert.fail("choosing a prompt must not render an answer");
  assistant.speak = () => assert.fail("choosing a prompt must not play audio");
  const promptButton = { dataset: { assistantPrompt: "prepared" } };

  assistant.handleClick({
    target: {
      closest(selector) { return selector === "[data-assistant-prompt]" ? promptButton : null; },
    },
  });

  assert.equal(assistant.input.value, "준비된 질문");
  assert.deepEqual(calls, [
    "open",
    "focus",
    "selection:6:6",
    "idle:질문을 확인한 뒤 보내 주세요",
  ]);

  const sent = [];
  assistant.askQuestion = (question, options) => sent.push({ question, options });
  assistant.handleSubmit({
    target: { matches: (selector) => selector === "[data-assistant-form]" },
    preventDefault() {},
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].question, "준비된 질문");
  assert.equal(sent[0].options.speak, false);
  assert.equal(assistant.input.value, "");
});

test("each published series explains its own subject during the staged series 01 rollout", async () => {
  const seriesIds = ["aigc-creative-paradigm", "autonomous-worlds", "co-creation-culture"];
  const intros = await Promise.all(seriesIds.map(async (seriesId) => {
    const raw = await readFile(path.join(repoRoot, "series", seriesId, "assistant", "context.json"), "utf8");
    return JSON.parse(raw).docent.intro;
  }));

  assert.equal(new Set(intros).size, 3);
  assert.equal(intros[0], "글과 자료를 따라 둘러보세요.");
  assert.equal([...intros[0]].length <= 20, true);
  assert.match(intros[1], /발표 기록·원고·슬라이드/);
  assert.match(intros[2], /창의성·경계·기록/);
  for (const intro of intros.slice(1)) {
    assert.match(intro, /아래 질문을 누르면 대화창에 문장만 미리 담깁니다/);
    assert.match(intro, /자동으로 보내거나 소리를 재생하지 않/);
    assert.match(intro, /내용을 확인한 뒤 보내면 답변이 시작됩니다/);
    assert.match(intro, /‘도슨트와 대화하기’로 빈 대화창을 여세요/);
  }
});

test("conversation entry opens the dialog, focuses the composer, and returns focus on close", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const attributes = {};
  let inputFocus = 0;
  let triggerFocus = 0;
  const trigger = {
    setAttribute(name, value) { attributes[name] = value; },
    focus() { triggerFocus += 1; },
  };
  assistant.panel = { hidden: true };
  assistant.openButton = trigger;
  assistant.input = { focus() { inputFocus += 1; } };
  assistant.updateSectionLabel = () => {};
  assistant.stopVoice = () => {};

  assistant.openPanel(trigger);
  assert.equal(assistant.panel.hidden, false);
  assert.equal(attributes["aria-expanded"], "true");
  assert.equal(inputFocus, 1);
  assistant.closePanel();
  assert.equal(assistant.panel.hidden, true);
  assert.equal(attributes["aria-expanded"], "false");
  assert.equal(triggerFocus, 1);
});

test("composer Enter sends while Shift+Enter and IME composition keep editing", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  let submitted = 0;
  let prevented = 0;
  assistant.input = { form: { requestSubmit() { submitted += 1; } } };

  assistant.handleKeydown({
    key: "Enter",
    target: assistant.input,
    shiftKey: false,
    isComposing: false,
    preventDefault() { prevented += 1; },
  });
  assistant.handleKeydown({
    key: "Enter",
    target: assistant.input,
    shiftKey: true,
    isComposing: false,
    preventDefault() { prevented += 1; },
  });
  assistant.handleKeydown({
    key: "Enter",
    target: assistant.input,
    shiftKey: false,
    isComposing: true,
    preventDefault() { prevented += 1; },
  });

  assert.equal(submitted, 1);
  assert.equal(prevented, 1);
});

test("BFCache pagehide releases active media without disabling the restored assistant", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  let stopped = 0;
  let destroyed = 0;
  const states = [];
  assistant.stopVoice = ({ quiet }) => {
    assert.equal(quiet, true);
    stopped += 1;
  };
  assistant.destroy = () => { destroyed += 1; };
  assistant.setState = (state, message) => states.push({ state, message });

  assistant.handlePagehide({ persisted: true });
  assert.equal(stopped, 1);
  assert.equal(destroyed, 0);
  assert.deepEqual(states, [{ state: "idle", message: "안내 준비됨" }]);

  assistant.handlePagehide({ persisted: false });
  assert.equal(destroyed, 1);
});

test("content pages use their own prepared prompts instead of series prompts", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.contentId = "post-1";
  assistant.updateSectionPrompt = () => {};
  let rendered = [];
  assistant.renderPrompts = (prompts) => { rendered = prompts; };
  assistant.applyDocentContext({
    quickPrompts: [{ id: "series", label: "시리즈", answer: "시리즈 답" }],
    contentPrompts: {
      "post-1": [{ id: "page", label: "현재 글", answer: "현재 글 답" }],
    },
  });
  assert.deepEqual(rendered.map((prompt) => prompt.id), ["page"]);
});

test("current content section updates one prepared listening prompt only when the section changes", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  assistant.dataset.contentId = "post-1";
  assistant.context = {
    allowedTargets: [{ contentType: "post", contentId: "post-1" }],
    entries: [{
      type: "post",
      contentId: "post-1",
      synopsis: "페이지 전체 설명입니다.",
      outline: [
        { sectionId: "section-a", title: "첫 대목", summary: "첫 대목의 준비된 설명입니다." },
        { sectionId: "section-b", title: "둘째 대목", summary: "둘째 대목의 준비된 설명입니다." },
      ],
    }],
  };
  assistant.basePrompts = [{ id: "flow", label: "페이지 흐름", answer: "페이지 흐름 답", targets: [] }];
  const rendered = [];
  assistant.renderPrompts = (prompts) => rendered.push(prompts);

  assistant.updateSectionPrompt({ id: "section-a" });
  assistant.updateSectionPrompt({ id: "section-a" });
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0][0].label, "이 대목 짚어 듣기");
  assert.equal(rendered[0][0].answer, "첫 대목의 준비된 설명입니다.");

  assistant.updateSectionPrompt({ id: "missing" });
  assert.equal(rendered.at(-1)[0].label, "이 페이지 흐름 듣기");
  assert.match(rendered.at(-1)[0].answer, /페이지 전체 설명입니다/);
  assert.match(rendered.at(-1)[0].answer, /첫 대목 → 둘째 대목/);
});

test("research scroll spy supersedes a stale URL anchor", async () => {
  const { context, currentHeading } = await loadAssistant();
  const hashTarget = { id: "p1s1", matches: () => true };
  const currentTarget = { id: "p2s3", matches: () => true };
  context.location.hash = "#p1s1";
  context.document.querySelector = (selector) => selector.includes('aria-current')
    ? { hash: "#p2s3" }
    : null;
  context.document.getElementById = (id) => id === "p2s3" ? currentTarget : hashTarget;

  assert.equal(currentHeading(), currentTarget);
});

test("a nested h3 keeps the nearest preceding h2 outline guidance", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const outline = [
    { sectionId: "parent-a", summary: "앞선 상위 절 설명" },
    { sectionId: "parent-b", summary: "다음 상위 절 설명" },
  ];
  context.document.getElementById = (id) => ({
    getBoundingClientRect: () => ({ top: id === "parent-a" ? -100 : 500 }),
  });
  const section = assistant.resolveOutlineSection(outline, { id: "nested-h3" });
  assert.equal(section.sectionId, "parent-a");
});

test("voice preview speaks with the selected voice and speed and exposes stop control", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const spoken = [];
  class Utterance {
    constructor(text) { this.text = text; }
  }
  context.SpeechSynthesisUtterance = Utterance;
  context.speechSynthesis.getVoices = () => [{ voiceURI: "ko-1", name: "목소리", lang: "ko-KR" }];
  context.speechSynthesis.speak = (utterance) => spoken.push(utterance);
  assistant.selectedVoiceValue = () => "ko-1";
  assistant.selectedRateValue = () => "0.85";
  assistant.stopSpeakingButton = { hidden: true };
  assistant.claimAudio = () => {};
  assistant.setState = () => {};
  assistant.showAnswer = () => assert.fail("preview must not add a transcript turn");
  assistant.handleClick({
    target: {
      closest(selector) { return selector === "[data-assistant-preview]" ? this : null; },
    },
  });

  assert.equal(spoken[0].text, "이 목소리와 속도로 안내해 드릴게요.");
  assert.equal(spoken[0].voice.voiceURI, "ko-1");
  assert.equal(spoken[0].rate, 0.85);
  spoken[0].onstart();
  assert.equal(assistant.stopSpeakingButton.hidden, false);
  assistant.stopSpeech();
  assert.equal(assistant.stopSpeakingButton.hidden, true);
});

test("voice preview uses the selected voice and speed without adding a conversation turn", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const spoken = [];
  assistant.speak = (text) => spoken.push(text);
  assistant.showAnswer = () => assert.fail("preview must not add a transcript turn");

  assistant.handleClick({
    target: {
      closest(selector) { return selector === "[data-assistant-preview]" ? this : null; },
    },
  });

  assert.deepEqual(spoken, ["이 목소리와 속도로 안내해 드릴게요."]);
});

test("content dialog traps Tab, closes from its backdrop, and returns focus", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  let firstFocused = 0;
  let returned = 0;
  const first = { hidden: false, focus: () => { firstFocused += 1; } };
  const last = { hidden: false, focus() {} };
  assistant.panel = {
    hidden: false,
    querySelectorAll: () => [first, last],
  };
  assistant.openButton = { setAttribute() {} };
  assistant.returnFocus = { focus: () => { returned += 1; } };
  assistant.stopVoice = () => {};
  context.document.activeElement = last;
  let prevented = 0;
  assistant.handleKeydown({ key: "Tab", shiftKey: false, preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(firstFocused, 1);
  assistant.handleClick({ target: assistant.panel });
  assert.equal(assistant.panel.hidden, true);
  assert.equal(returned, 1);
});

test("docent copy contains no connection implementation jargon", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const copy = [
    assistant.seriesMarkup(),
    assistant.contentMarkup(),
    "이 기기에서 개인 연결을 켜고, 브라우저의 기기 연결 요청을 허용한 뒤 다시 시도해 주세요.",
  ].join("\n");
  assert.doesNotMatch(copy, /OAuth|API|WebSocket|로컬 브리지|provider|xAI|OpenAI/iu);
  assert.doesNotMatch(copy, /Mac|Windows|Android|iPhone/iu);
  assert.match(copy, /목소리·속도/);
  assert.match(copy, />연결</);
  assert.match(copy, />개인정보</);
  assert.match(copy, /마이크 허용과 기기 연결 허용은 서로 다른 설정/);
  assert.match(copy, /대화 지우기/);
  assert.match(copy, /선택한 목소리 미리 듣기/);
  assert.match(assistant.contentMarkup(), /aria-modal="true"/);
  assert.match(copy, /<fieldset/);
  assert.match(copy, /type="radio"/);
  assert.doesNotMatch(copy, /<select\b/i);
});

test("every published docent surface installs one assistant in the required reading order", async () => {
  const pageSpecs = [
    ["series", "series/aigc-creative-paradigm/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/01-skill-and-effort/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/02-workflow-design/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/index.html"],
    ["source", "series/aigc-creative-paradigm/sources/research/index.html"],
    ["source", "series/aigc-creative-paradigm/sources/slides/index.html"],
    ["series", "series/autonomous-worlds/index.html"],
    ["post", "series/autonomous-worlds/posts/01-engine-city-to-autonomous-world/index.html"],
    ["post", "series/autonomous-worlds/posts/02-more-than-a-mirror/index.html"],
    ["post", "series/autonomous-worlds/posts/03-what-we-want-to-create/index.html"],
    ["source", "series/autonomous-worlds/sources/talk/index.html"],
    ["source", "series/autonomous-worlds/sources/script/index.html"],
    ["source", "series/autonomous-worlds/sources/slides/index.html"],
    ["series", "series/co-creation-culture/index.html"],
    ["post", "series/co-creation-culture/posts/01-whose-creativity/index.html"],
    ["post", "series/co-creation-culture/posts/02-at-the-boundary/index.html"],
    ["post", "series/co-creation-culture/posts/03-when-records-become-stories/index.html"],
    ["source", "series/co-creation-culture/sources/slides-2023-06/index.html"],
    ["source", "series/co-creation-culture/sources/slides-2023-11/index.html"],
  ];
  const pages = await Promise.all(pageSpecs.map(async ([type, file]) => ({
    type,
    file,
    html: await readFile(path.join(repoRoot, file), "utf8"),
  })));

  for (const { type, file, html } of pages) {
    assert.equal((html.match(/<kiheon-voice-assistant\b/g) ?? []).length, 1);
    assert.match(html, /assets\/assistant\/voice-assistant(?:-v2)?\.js/);
    assert.match(html, /assets\/assistant\/voice-assistant(?:-v2)?\.css/);
    assert.doesNotMatch(html, /assets\/voice-agent\.js/);
    if (type === "series") {
      assert.ok(html.indexOf("<series-nav") < html.indexOf("<kiheon-voice-assistant"), file);
      assert.ok(html.indexOf("<kiheon-voice-assistant") < html.indexOf("<series-sources"), file);
    } else if (type === "post") {
      assert.ok(html.indexOf('<p class="lead">') < html.indexOf("<kiheon-voice-assistant"), file);
      assert.ok(html.indexOf("<kiheon-voice-assistant") < html.indexOf("<series-nav"), file);
    } else {
      assert.ok(html.indexOf("</header>") < html.indexOf("<kiheon-voice-assistant"), file);
      assert.ok(html.indexOf("<kiheon-voice-assistant") < html.indexOf('<div class="doc">'), file);
    }
  }

  const assistantCss = await readFile(
    path.join(repoRoot, "assets", "assistant", "voice-assistant.css"),
    "utf8",
  );
  assert.doesNotMatch(assistantCss, /kiheon-voice-assistant\[data-scope="content"\]\s*\{[^}]*position:\s*sticky/);
  assert.match(assistantCss, /data-series-expanded="false"[^}]*voice-assistant__series-body[\s\S]*display:\s*none/);
  assert.match(assistantCss, /background:\s*color-mix\(in srgb, var\(--ink/);
  assert.match(assistantCss, /@media\s*\(min-width:\s*64rem\)/);
  assert.match(assistantCss, /voice-assistant__radio-list[\s\S]*overflow-y:\s*auto/);
  assert.match(assistantCss, /voice-assistant__form[\s\S]*grid-template-columns:\s*auto minmax\(7rem, 1fr\) auto/);
  assert.match(assistantCss, /voice-assistant__turn\[data-assistant-role="user"\][\s\S]*align-self:\s*flex-end/);
  assert.match(assistantCss, /voice-assistant__disclosures[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(assistantCss, /voice-assistant__targets\[hidden\][\s\S]*display:\s*none/);
  assert.match(assistantCss, /--voice-assistant-action-min-width/);
  assert.match(assistantCss, /min-inline-size:\s*var\(--voice-assistant-action-min-width\)/);
  assert.match(assistantCss, /block-size:\s*var\(--voice-assistant-action-height\)/);
  assert.doesNotMatch(assistantCss, /setting-fields select/);
  assert.doesNotMatch(assistantCss, /@media\s*\(max-width:\s*34rem\)/);
});

test("Newtype and private Co-Creation sources remain outside the docent", async () => {
  const excluded = [
    "series/newtype-ip-dialogue/index.html",
    "series/newtype-ip-dialogue/posts/01-not-blocking-potential/index.html",
    "series/newtype-ip-dialogue/posts/02-engine-as-ip/index.html",
    "series/newtype-ip-dialogue/posts/03-already-have-the-eye/index.html",
    "series/co-creation-culture/sources/screening/index.html",
    "series/co-creation-culture/sources/dossier/index.html",
    "series/co-creation-culture/sources/codex/index.html",
    "series/co-creation-culture/sources/transcript/index.html",
    "series/co-creation-culture/sources/chronicle/index.html",
  ];
  for (const file of excluded) {
    const html = await readFile(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(html, /<kiheon-voice-assistant\b/, file);
    assert.doesNotMatch(html, /assets\/assistant\/voice-assistant\.(?:js|css)/, file);
  }
  const manifest = await readFile(path.join(repoRoot, "assets/content-manifest.js"), "utf8");
  const newtypeBlock = manifest.slice(
    manifest.indexOf('slug: "newtype-ip-dialogue"'),
    manifest.indexOf('slug: "autonomous-worlds"'),
  );
  assert.match(newtypeBlock, /status:\s*"planned"/);
  assert.match(newtypeBlock, /pilotSurfaceIds:\s*\[\]/);
});

test("every prepared explanation in the three ready series has inspectable source provenance", async () => {
  const seriesIds = ["aigc-creative-paradigm", "autonomous-worlds", "co-creation-culture"];
  const contexts = [];
  for (const seriesId of seriesIds) {
    const context = JSON.parse(await readFile(
      path.join(repoRoot, `series/${seriesId}/assistant/context.json`),
      "utf8",
    ));
    contexts.push(context);
    const entries = new Map(context.entries.map((entry) => [entry.contentId, entry]));
    assert.deepEqual(
      new Set(Object.keys(context.docent.contentPrompts)),
      new Set(entries.keys()),
      `${seriesId} must prepare prompts for every public content entry`,
    );
    for (const prompts of Object.values(context.docent.contentPrompts)) {
      assert.ok(prompts.length > 0, `${seriesId} contains an empty prepared prompt set`);
      for (const prompt of prompts) {
        assert.equal(prompt.kind, "source", `${prompt.id} must declare its source kind`);
        assert.ok(prompt.provenance.length > 0, `${prompt.id} must include provenance`);
        for (const source of prompt.provenance) {
          const entry = entries.get(source.sourceId);
          assert.ok(entry, `${prompt.id} cites unknown source ${source.sourceId}`);
          const html = await readFile(path.join(repoRoot, entry.url, "index.html"), "utf8");
          assert.ok(
            html.includes(`id="${source.anchor}"`) || html.includes(`id='${source.anchor}'`),
            `${prompt.id} cites unknown anchor ${source.sourceId}#${source.anchor}`,
          );
        }
      }
    }
  }

  const context = contexts[0];
  const researchFlow = context.docent.contentPrompts.research
    .find((prompt) => prompt.id === "research-flow");
  const researchAnchors = new Set(researchFlow.provenance.map((source) => source.anchor));
  for (const anchor of ["p1s1", "p1s2", "p2s1", "p2s2", "p2s3", "p2s4"]) {
    assert.ok(researchAnchors.has(anchor), `research-flow must cite ${anchor}`);
  }
});
