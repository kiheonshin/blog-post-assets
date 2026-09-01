import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transportPath = path.join(repoRoot, "assets", "assistant", "voice-transport.js");
const agentPath = path.join(repoRoot, "assets", "assistant", "docent-agent.js");
const assistantPath = path.join(repoRoot, "assets", "assistant", "voice-assistant-v2.js");

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
    interrupt() {}
    updateSpeed() {}
    async ask() { return { answer: "", targets: [] }; }
    async preview() {}
    async startVoiceSession() {}
    stopVoiceSession() {}
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
    baseURI: "https://kiheon.com/series/aigc-creative-paradigm/",
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
    GROK_BUILT_IN_VOICES: Object.freeze(["ara", "eve", "rex", "sal", "leo"]),
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
      hostname: "kiheon.com",
      origin: "https://kiheon.com",
      pathname: "/blog-post-assets/series/aigc-creative-paradigm/",
    },
    navigator: {},
    setTimeout,
    speechSynthesis: { cancel() {}, speak() {} },
    window: windowStub,
  });
  context.globalThis = context;
  let source = await readFile(assistantPath, "utf8");
  // 이름 붙은 import 를 전역 스텁으로 잇는다. 특정 모듈 경로에 묶지 않는 이유는
  // 픽스처가 구판에서 v2 로 옮겨오며 import 가 바뀌자 32개가 한꺼번에 깨졌기 때문이다.
  source = source
    .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";/g, (_, names) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => `const ${name} = globalThis.${name};`)
        .join(" "))
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

test("voice activation claims audio before opening the microphone session", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const order = [];
  assistant.context = { series: {}, entries: [], allowedTargets: [] };
  assistant.voiceButton = { dataset: {}, setAttribute() {}, textContent: "" };
  assistant.selectedVoiceValue = () => "ara";
  assistant.selectedRateValue = () => "1";
  assistant.claimAudio = () => order.push("claim");
  assistant.setState = () => {};
  assistant.showAnswer = () => {};
  assistant.transport = {
    startVoiceSession: async () => order.push("session"),
    stopVoiceSession() {},
    reset() {},
  };

  await assistant.startVoice();
  assert.deepEqual(order, ["claim", "session"]);
});

test("voice activation without context never opens a microphone session, and an offline session recovers", async () => {
  const { Assistant, context } = await loadAssistant();
  const assistant = new Assistant();
  const answers = [];
  let sessionCalls = 0;
  assistant.voiceButton = { dataset: {}, setAttribute() {}, textContent: "" };
  assistant.selectedVoiceValue = () => "ara";
  assistant.selectedRateValue = () => "1";
  assistant.claimAudio = () => {};
  assistant.setState = () => {};
  assistant.showAnswer = (speaker, text) => answers.push({ speaker, text });
  assistant.transport = {
    startVoiceSession: async () => { sessionCalls += 1; throw new Error("offline"); },
    stopVoiceSession() {},
    reset() {},
  };

  // 문맥이 없으면 마이크 세션 자체를 열지 않는다.
  assistant.context = null;
  await assistant.startVoice();
  assert.equal(sessionCalls, 0);
  assert.match(answers.at(-1).text, /공개 안내 문맥/);

  // 세션이 열리다 끊기면 복구 안내를 준다 — 기기 이름은 말하지 않는다.
  assistant.context = { series: {}, entries: [], allowedTargets: [] };
  assistant.voiceSessionActive = false;
  await assistant.startVoice();
  assert.equal(sessionCalls, 1);
  assert.equal(answers.at(-1).text, context.VOICE_OFFLINE_MESSAGE);
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
  let bridgeCalls = 0;
  assistant.dataset.scope = "series";
  assistant.showAnswer = (speaker, text) => answers.push({ speaker, text });
  assistant.setState = () => {};
  assistant.transport = { ask: async () => { bridgeCalls += 1; } };

  await assistant.askQuestion("아아");
  assert.equal(bridgeCalls, 0);
  assert.match(answers.at(-1).text, /듣고 있어요/);
  assert.match(answers.at(-1).text, /무엇이 궁금한지/);
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

test("voice transcript revisions keep one listening turn and the final text becomes the question", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const shown = [];
  let discarded = 0;
  assistant.voiceSessionActive = true;
  assistant.setState = () => {};
  assistant.showAnswer = (speaker, text) => shown.push({ speaker, text });
  assistant.discardListeningTurn = () => { discarded += 1; };

  // 발화가 시작되면 듣는 중 거품을 하나만 세운다.
  assistant.handleRealtimeEvent({ type: "speech_started" });
  assert.equal(discarded, 1);

  // 고쳐 들은 조각은 같은 거품을 갱신하고, 마지막 판이 제출되는 질문이 된다.
  assistant.handleRealtimeEvent({ type: "user_transcript", transcript: "자율", final: false });
  assistant.handleRealtimeEvent({ type: "user_transcript", transcript: "자율 세계가", final: false });
  assistant.handleRealtimeEvent({ type: "user_transcript", transcript: "자율 세계가 뭐죠", final: true });

  assert.deepEqual(shown.map((turn) => turn.speaker), ["듣는 중", "듣는 중", "듣는 중", "질문"]);
  assert.equal(shown.at(-1).text, "자율 세계가 뭐죠");
  assert.equal(assistant.latestVoiceQuestion, "자율 세계가 뭐죠");
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
  assert.match(grounded, /두세 문장/);
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
  assistant.dataset.scope = "content";
  assistant.prompts = [{
    id: "current-section-section-a",
    label: "이 대목 짚어 듣기",
    answer: "검증된 현재 대목 안내입니다.",
    targets: [{ label: "이 대목 보기", url: "series/aigc/posts/post-1/#section-a" }],
  }];
  assistant.transport = { ask: async () => assert.fail("prepared guidance must not call the bridge") };
  assistant.showAnswer = (speaker, text, targets = []) => answers.push({ speaker, text, targets });
  assistant.setState = () => {};

  await assistant.askQuestion("이 대목을 설명해줘");
  assert.equal(answers.at(-1).text, "검증된 현재 대목 안내입니다.");
  assert.equal(answers.at(-1).targets.length, 1);
});

test("stop and destroy release every owned resource", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const released = [];
  assistant.panel = { hidden: true };
  assistant.stopVoice = ({ quiet } = {}) => {
    assert.equal(quiet, true);
    released.push("voice");
  };
  assistant.transport = {
    destroy: () => released.push("transport"),
    stopVoiceSession() {},
    reset() {},
  };
  assistant.agent = { reset: () => released.push("agent") };

  assistant.destroy();
  assert.deepEqual(released, ["voice", "transport", "agent"]);

  // 두 번 불러도 한 번만 푼다.
  assistant.destroy();
  assert.deepEqual(released, ["voice", "transport", "agent"]);
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

test("each published series explains its own subject in xAI Realtime v2", async () => {
  const seriesIds = [
    "aigc-creative-paradigm",
    "newtype-ip-dialogue",
    "autonomous-worlds",
    "co-creation-culture",
  ];
  const intros = await Promise.all(seriesIds.map(async (seriesId) => {
    const raw = await readFile(path.join(repoRoot, "series", seriesId, "assistant", "context.json"), "utf8");
    return JSON.parse(raw).docent.intro;
  }));

  assert.equal(new Set(intros).size, 4);
  assert.equal(intros[0], "글과 자료를 따라 둘러보세요.");
  assert.equal([...intros[0]].length <= 20, true);
  assert.match(intros[1], /세 글의 흐름/);
  assert.match(intros[2], /발표 기록·원고·슬라이드/);
  assert.match(intros[3], /창의성·경계·기록/);
  for (const intro of intros.slice(2)) {
    assert.match(intro, /아래 질문을 누르면 대화창에 문장만 미리 담깁니다/);
    assert.match(intro, /자동으로 보내거나 소리를 재생하지 않/);
    assert.match(intro, /내용을 확인한 뒤 보내면 답변이 시작됩니다/);
    assert.match(intro, /‘도슨트와 대화하기’로 빈 대화창을 여세요/);
  }
});

test("conversation entry opens the dialog, focuses the requested control, and returns focus on close", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const attributes = {};
  let voiceFocus = 0;
  let inputFocus = 0;
  let triggerFocus = 0;
  const trigger = {
    setAttribute(name, value) { attributes[name] = value; },
    focus() { triggerFocus += 1; },
  };
  assistant.panel = { hidden: true };
  assistant.setOpenButtonsExpanded = (expanded) => {
    attributes["aria-expanded"] = String(expanded);
  };
  assistant.voiceButton = { focus() { voiceFocus += 1; } };
  assistant.input = { focus() { inputFocus += 1; } };
  assistant.updateSectionLabel = () => {};
  assistant.stopVoice = () => {};

  // 기본 초점은 음성 버튼이다 — 이 화면의 주된 행동이 말 걸기이기 때문이다.
  assistant.openPanel(trigger);
  assert.equal(assistant.panel.hidden, false);
  assert.equal(attributes["aria-expanded"], "true");
  assert.equal(voiceFocus, 1);
  assert.equal(inputFocus, 0);

  assistant.closePanel();
  assert.equal(assistant.panel.hidden, true);
  assert.equal(attributes["aria-expanded"], "false");
  assert.equal(triggerFocus, 1);

  // 적어서 묻겠다고 하면 입력칸으로 간다.
  assistant.openPanel(trigger, { focusTarget: "input" });
  assert.equal(inputFocus, 1);
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

test("voice preview exposes a stop control that ends the preview", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const stopped = [];
  let previewState = null;
  assistant.previewActive = true;
  assistant.setPreviewButtonState = (active) => { previewState = active; };
  assistant.setState = () => {};
  assistant.showAnswer = () => assert.fail("preview must not add a transcript turn");
  assistant.transport = {
    preview: async () => assert.fail("stopping must not start another preview"),
    stopVoiceSession: (options) => stopped.push(options),
    reset() {},
  };

  assistant.handleClick({
    target: {
      closest(selector) { return selector === "[data-assistant-preview]" ? this : null; },
    },
  });

  assert.equal(stopped.length, 1);
  assert.equal(assistant.previewActive, false);
  assert.equal(previewState, false);
});

test("voice preview uses the selected voice and speed without adding a conversation turn", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const previews = [];
  assistant.selectedVoiceValue = () => "ara";
  assistant.selectedRateValue = () => "0.85";
  assistant.claimAudio = () => {};
  assistant.setState = () => {};
  assistant.setPreviewButtonState = () => {};
  assistant.showAnswer = () => assert.fail("preview must not add a transcript turn");
  assistant.transport = {
    preview: async (text, options) => previews.push({ text, options }),
    stopVoiceSession() {},
    reset() {},
  };

  assistant.handleClick({
    target: {
      closest(selector) { return selector === "[data-assistant-preview]" ? this : null; },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(previews.length, 1);
  assert.equal(previews[0].text, "이 목소리와 속도로 안내해 드릴게요.");
  assert.equal(previews[0].options.voiceId, "ara");
  assert.equal(previews[0].options.speed, "0.85");
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

test("docent copy keeps implementation jargon out of every surface except the privacy disclosure", async () => {
  const { Assistant } = await loadAssistant();
  const assistant = new Assistant();
  const markup = [assistant.seriesMarkup(), assistant.contentMarkup()].join("\n");

  // 개인정보 고지는 처리 주체를 밝혀야 한다 — 숨기는 것이 정직이 아니다.
  // 그래서 고지 블록만 떼어내고, 그 **밖에서** 구현 용어가 0건인지 본다.
  const disclosures = markup.match(/<details class="voice-assistant__disclosure">[\s\S]*?<\/details>/g) ?? [];
  assert.ok(disclosures.length >= 1, "고지 블록이 있어야 예외 범위가 성립한다");
  const outside = [
    disclosures.reduce((rest, block) => rest.replace(block, ""), markup),
    "이 기기에서 개인 연결을 켜고, 브라우저의 기기 연결 요청을 허용한 뒤 다시 시도해 주세요.",
  ].join("\n");
  assert.doesNotMatch(outside, /OAuth|API|WebSocket|로컬 브리지|provider|xAI|OpenAI/iu);
  assert.doesNotMatch(outside, /Mac|Windows|Android|iPhone/iu);

  // 고지 안에서는 처리 주체를 반드시 밝힌다.
  const privacy = disclosures.find((block) => block.includes(">개인정보<"));
  assert.ok(privacy, "개인정보 고지 블록이 있어야 한다");
  assert.match(privacy, /xAI/);

  assert.match(markup, /목소리·속도/);
  assert.match(markup, />연결</);
  assert.match(markup, />개인정보</);
  assert.match(markup, /마이크 권한을 요청하고/);
  assert.match(markup, /현재 설정 미리 듣기/);
  assert.match(assistant.contentMarkup(), /aria-modal="true"/);
  assert.match(markup, /<fieldset/);
  assert.match(markup, /type="radio"/);
  assert.doesNotMatch(markup, /<select\b/i);
});

test("every published docent surface installs one assistant in the required reading order", async () => {
  const pageSpecs = [
    ["series", "series/aigc-creative-paradigm/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/01-skill-and-effort/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/02-workflow-design/index.html"],
    ["post", "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/index.html"],
    ["source", "series/aigc-creative-paradigm/sources/research/index.html"],
    ["source", "series/aigc-creative-paradigm/sources/slides/index.html"],
    ["series", "series/newtype-ip-dialogue/index.html"],
    ["post", "series/newtype-ip-dialogue/posts/01-not-blocking-potential/index.html"],
    ["post", "series/newtype-ip-dialogue/posts/02-engine-as-ip/index.html"],
    ["post", "series/newtype-ip-dialogue/posts/03-already-have-the-eye/index.html"],
    ["series", "series/autonomous-worlds/index.html"],
    ["post", "series/autonomous-worlds/posts/01-engine-city-to-autonomous-world/index.html"],
    ["post", "series/autonomous-worlds/posts/02-more-than-a-mirror/index.html"],
    ["post", "series/autonomous-worlds/posts/03-what-we-want-to-create/index.html"],
    ["source", "series/autonomous-worlds/sources/talk/index.html"],
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
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.js\?v=20260825docent1/);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.css\?v=20260803simple1/);
    assert.doesNotMatch(html, /assets\/assistant\/voice-assistant\.(?:js|css)/);
    assert.doesNotMatch(html, /assets\/voice-agent\.js/);
    if (type === "series") {
      assert.ok(html.indexOf("<series-nav") < html.indexOf("<kiheon-voice-assistant"), file);
      // 도슨트 뒤에는 다음 읽을거리가 온다. 어느 요소가 그 자리를 맡는지는 시리즈마다
      // 다르므로(뉴타입은 READING MAP 을 걷어내 .about 이 그 자리다) 후보를 순서대로
      // 찾는다. -1 을 그대로 비교하면 "아무것도 없음"이 조용히 통과하므로 존재를 먼저 단언한다.
      const nextReadingSurface = ["<series-sources", '<section class="reading-guide"', '<section class="about"']
        .map((marker) => html.indexOf(marker))
        .find((index) => index !== -1);
      assert.ok(
        nextReadingSurface !== undefined,
        `${file}: the series home must keep a reading surface after the docent`,
      );
      assert.ok(html.indexOf("<kiheon-voice-assistant") < nextReadingSurface, file);
    } else if (type === "post") {
      assert.ok(html.indexOf('<p class="lead">') < html.indexOf("<kiheon-voice-assistant"), file);
      // 2026-08-25 본인 확정 : 포스팅 내비게이션(이미지·버튼)이 도슨트보다 먼저 온다.
      // 이전 계약은 반대였다 — 뒤집힌 것이지 느슨해진 것이 아니므로 부등호만 돌린다.
      assert.ok(html.indexOf("<series-nav") < html.indexOf("<kiheon-voice-assistant"), file);
    } else {
      assert.ok(html.indexOf("</header>") < html.indexOf("<kiheon-voice-assistant"), file);
      assert.ok(html.indexOf("<kiheon-voice-assistant") < html.indexOf('<div class="doc">'), file);
    }
  }

  const assistantCss = await readFile(
    path.join(repoRoot, "assets", "assistant", "voice-assistant-v2.css"),
    "utf8",
  );
  assert.doesNotMatch(assistantCss, /kiheon-voice-assistant\[data-scope="content"\]\s*\{[^}]*position:\s*sticky/);
  assert.match(assistantCss, /background:\s*color-mix\(in srgb, var\(--ink/);
  assert.match(assistantCss, /@media\s*\(min-width:\s*64rem\)/);
  assert.match(assistantCss, /voice-assistant__radio-list[\s\S]*overflow-y:\s*auto/);
  assert.match(assistantCss, /voice-assistant__form[\s\S]*grid-template-columns:\s*minmax\(7rem, 1fr\) auto/);
  assert.match(assistantCss, /voice-assistant__turn\[data-assistant-role="user"\][\s\S]*align-self:\s*flex-end/);
  assert.match(assistantCss, /voice-assistant__disclosures[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(assistantCss, /voice-assistant__targets\[hidden\][\s\S]*display:\s*none/);
  assert.match(assistantCss, /--voice-assistant-action-min-width/);
  assert.match(assistantCss, /min-inline-size:\s*var\(--voice-assistant-action-min-width\)/);
  assert.match(assistantCss, /block-size:\s*var\(--voice-assistant-action-height\)/);
  assert.doesNotMatch(assistantCss, /setting-fields select/);
  assert.doesNotMatch(assistantCss, /@media\s*\(max-width:\s*34rem\)/);
});

// 2026-08-05: 네 모듈이 series/co-creation-culture/sources/ 에서 /archive/ 로
// 옮겼다(자료 묶음은 그때 없앴다). 지키려는 것은 경로가 아니라 **비공개 원자료에
// 도슨트가 붙지 않는다**는 사실이므로, 목록만 새 자리로 옮긴다.
test("private archive sources remain outside the docent", async () => {
  const excluded = [
    "archive/index.html",
    "archive/chronicle/index.html",
    "archive/transcript/index.html",
    "archive/codex/index.html",
    "archive/screening/index.html",
  ];
  for (const file of excluded) {
    const html = await readFile(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(html, /<kiheon-voice-assistant\b/, file);
    assert.doesNotMatch(html, /assets\/assistant\/voice-assistant\.(?:js|css)/, file);
    // 옛 자리에 새 페이지가 다시 생기면 이 테스트가 그걸 못 본 채 통과한다.
    assert.match(html, /name="robots" content="noindex/, file);
  }
});

test("every prepared explanation in the four ready series has inspectable source provenance", async () => {
  const seriesIds = [
    "aigc-creative-paradigm",
    "newtype-ip-dialogue",
    "autonomous-worlds",
    "co-creation-culture",
  ];
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
