import { VoiceTransport, VOICE_OFFLINE_MESSAGE } from "./voice-transport.js?v=20260801b";
import { DocentAgent } from "./docent-agent.js?v=20260801a";

const DEFAULT_PROMPTS = {
  series: [
    {
      id: "route",
      label: "어디서부터 읽을까요?",
      answer: "빠르게 흐름을 잡으려면 세 편의 글 제목을 먼저 훑고, 문제의식이 가장 가까운 글부터 읽어 보세요. 바탕을 확인하고 싶을 때는 연구 노트와 발표 자료로 이어갈 수 있습니다.",
      targets: [],
    },
    {
      id: "relation",
      label: "세 편은 어떻게 이어지나요?",
      answer: "첫 글은 실력과 노력의 가치, 둘째 글은 작업 흐름의 설계, 셋째 글은 현실과 가상의 경계를 다룹니다. 질문에서 방법으로, 다시 새로운 창작 환경으로 시야가 넓어지는 순서입니다.",
      targets: [],
    },
    {
      id: "sources",
      label: "글과 바탕 자료는 어떤 관계인가요?",
      answer: "연구 노트와 발표 자료는 당시의 문제의식과 근거를 보존한 바탕 자료입니다. 세 편의 글은 그 기록을 나중의 시점에서 다시 해석한 글이라 서로 같은 층으로 섞지 않고 함께 볼 수 있습니다.",
      targets: [],
    },
  ],
  content: [
    {
      id: "flow",
      label: "이 페이지의 흐름을 알려주세요",
      answer: "현재 페이지의 소제목을 따라가면 전체 흐름을 빠르게 파악할 수 있습니다. 지금 읽는 대목을 기준으로 질문하면 그 부분부터 짚어 드립니다.",
      targets: [],
    },
    {
      id: "section",
      label: "지금 읽는 대목은 어디인가요?",
      answer: "현재 화면에서 가장 가까운 소제목을 기준으로 읽는 위치를 확인합니다. 아래에서 질문을 남기면 그 대목을 먼저 문맥으로 삼습니다.",
      targets: [],
    },
  ],
};

let instanceCount = 0;
let openPanelCount = 0;
const MAX_GROUNDED_INPUT_LENGTH = 11_500;

function speechRecognitionConstructor() {
  return globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
}

function rootUrl() {
  const marker = "/blog-post-assets/";
  const index = location.pathname.indexOf(marker);
  const path = index >= 0 ? location.pathname.slice(0, index + marker.length) : "/";
  return new URL(path, location.origin);
}

function publicTarget(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  let target;
  try {
    const value = rawUrl.trim();
    target = new URL(
      value.startsWith("/") || /^[a-z]+:/i.test(value)
        ? value
        : value.startsWith("series/")
          ? new URL(value, rootUrl())
          : value,
      document.baseURI,
    );
  } catch {
    return null;
  }

  const isCurrentOrigin = target.origin === location.origin;
  const isCanonical = target.origin === "https://kiheonshin.github.io" &&
    target.pathname.startsWith("/blog-post-assets/");
  return ["http:", "https:"].includes(target.protocol) && (isCurrentOrigin || isCanonical)
    ? target.href
    : null;
}

function normalisePrompt(prompt, index) {
  if (!prompt || typeof prompt !== "object") return null;
  const label = typeof prompt.label === "string" ? prompt.label.trim() : "";
  const answer = typeof prompt.answer === "string" ? prompt.answer.trim() : "";
  if (!label || !answer) return null;

  const sourceTargets = Array.isArray(prompt.targets)
    ? prompt.targets
    : Array.isArray(prompt.links)
      ? prompt.links
      : [];
  const targets = sourceTargets.flatMap((target) => {
    const url = publicTarget(target?.url);
    const targetLabel = typeof target?.label === "string" ? target.label.trim() : "";
    return url && targetLabel ? [{ label: targetLabel, url }] : [];
  });

  return {
    id: String(prompt.id ?? `prompt-${index + 1}`),
    label,
    answer,
    targets,
  };
}

function compactText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean).join(" · ");
  if (!value || typeof value !== "object") return "";
  const allowedKeys = [
    "title",
    "text",
    "label",
    "heading",
    "summary",
    "description",
    "sectionId",
    "anchor",
    "targetId",
    "contentId",
  ];
  return allowedKeys.map((key) => compactText(value[key])).filter(Boolean).join(" · ");
}

function entryGrounding(entry) {
  const fields = [
    ["제목", entry?.title],
    ["설명", entry?.synopsis],
    ["핵심", entry?.keyInsights],
    ["구성", entry?.outline],
    ["관계", entry?.relations],
  ];
  return fields
    .map(([label, value]) => {
      const text = compactText(value);
      return text ? `${label}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function entryKind(entry) {
  if (entry?.type === "post") return "글";
  if (entry?.contentId === "research") return "연구 노트";
  if (entry?.contentId === "slides") return "발표 자료";
  return "자료";
}

function currentHeading() {
  const tocCurrent = document.querySelector('.toc a[aria-current="true"][href^="#"]');
  const tocTarget = tocCurrent && document.getElementById(tocCurrent.hash.slice(1));
  if (tocTarget) return tocTarget;

  const hashTarget = location.hash && document.getElementById(location.hash.slice(1));
  if (hashTarget?.matches?.("h2[id],h3[id],section[id]")) return hashTarget;

  const focused = document.activeElement?.closest?.("h2[id],h3[id],section[id]");
  if (focused) return focused;

  const headings = [...document.querySelectorAll("main h2[id],main h3[id],main section[id]")]
    .filter((heading) => !heading.closest("kiheon-voice-assistant"));
  let nearest = null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= Math.max(160, innerHeight * 0.28)) {
      nearest = heading;
    }
  }
  return nearest;
}

function headingText(heading) {
  return String(heading?.innerText ?? heading?.textContent ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function intentText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("ko")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export class KiheonVoiceAssistant extends HTMLElement {
  constructor() {
    super();
    instanceCount += 1;
    this.instanceId = `kiheon-voice-assistant-${instanceCount}`;
    this.transport = new VoiceTransport();
    this.agent = this.createAgent();
    this.context = null;
    this.listening = false;
    this.destroyed = false;
    this.requestController = null;
    this.returnFocus = null;
    this.handleClick = this.handleClick.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handlePagehide = this.handlePagehide.bind(this);
    this.handleAudioClaim = this.handleAudioClaim.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleVoicesChanged = this.handleVoicesChanged.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  connectedCallback() {
    if (this.dataset.initialized === "true") return;
    this.dataset.initialized = "true";
    this.render();
    this.addEventListener("click", this.handleClick);
    this.addEventListener("change", this.handleChange);
    this.addEventListener("submit", this.handleSubmit);
    document.addEventListener("keydown", this.handleKeydown);
    document.addEventListener("kiheon-assistant-audio-claim", this.handleAudioClaim);
    window.addEventListener("pagehide", this.handlePagehide);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    globalThis.speechSynthesis?.addEventListener?.("voiceschanged", this.handleVoicesChanged);
    this.populateVoices();
    this.loadContext();
  }

  disconnectedCallback() {
    this.destroy();
  }

  get scope() {
    return this.dataset.scope === "series" ? "series" : "content";
  }

  get contentName() {
    return this.dataset.contentType === "source" ? "이 자료 안내" : "이 글 안내";
  }

  get dialogueHistory() {
    return this.agent?.memory?.turns ?? [];
  }

  set dialogueHistory(turns) {
    this.agent?.memory?.replaceTurns(turns);
  }

  createAgent() {
    return new DocentAgent({
      scope: this.scope,
      transport: {
        ask: (input, options) => this.transport.ask(input, options),
      },
      observe: () => ({
        scope: this.scope,
        contentId: this.dataset.contentId ?? "",
        currentSectionId: currentHeading()?.id ?? "",
        contextReady: Boolean(this.context),
        allowedEntryCount: this.allowedEntries().length,
      }),
      sanitizeTarget: (target) => {
        const url = publicTarget(target?.url);
        return url ? { label: target?.label, url } : null;
      },
      onEvent: (event) => this.handleAgentEvent(event),
      tools: [
        {
          name: "clarify_intent",
          description: "불완전한 발화를 확인하고 한 문장으로 의도를 되묻습니다.",
          execute: () => ({
            answer: this.scope === "series"
              ? "네, 듣고 있어요. 읽는 순서, 세 편의 관계, 바탕 자료 가운데 무엇이 궁금한지 조금만 더 말씀해 주세요."
              : "네, 듣고 있어요. 이 페이지의 흐름, 지금 읽는 대목, 핵심 질문 가운데 무엇이 궁금한지 조금만 더 말씀해 주세요.",
            targets: [],
          }),
        },
        {
          name: "prepared_guide",
          description: "승인된 준비 질문과 현재 대목 안내를 공개 문맥에서 찾습니다.",
          execute: ({ input }) => {
            const prepared = this.preparedPromptFor(input);
            return prepared
              ? { handled: true, answer: prepared.answer, targets: prepared.targets }
              : { handled: false };
          },
        },
        {
          name: "ground_public_context",
          description: "허용된 공개 콘텐츠와 최근 세션 대화만으로 질문 문맥을 만듭니다.",
          execute: ({ input }, { memory }) => ({
            prompt: this.groundedInput(input, memory.recent()),
          }),
        },
        {
          name: "suggest_content",
          description: "답변 뒤에 사용자가 직접 선택할 수 있는 공개 콘텐츠 링크를 제안합니다.",
          execute: ({ input }) => ({ targets: this.answerTargets(input) }),
        },
      ],
    });
  }

  handleAgentEvent(event) {
    if (event.type === "turn_started") {
      this.setState("thinking", "질문을 살펴보고 있어요");
    } else if (event.type === "tool_started" && event.tool === "ground_public_context") {
      this.setState("thinking", "공개 자료를 확인하고 있어요");
    } else if (event.type === "model_started") {
      this.setState("thinking", "도슨트가 답을 만들고 있어요");
    } else if (event.type === "verification_started") {
      this.setState("thinking", "답변을 확인하고 있어요");
    }
  }

  render() {
    this.classList.add("voice-assistant", `voice-assistant--${this.scope}`);
    this.dataset.state = "idle";
    if (this.scope === "series") this.dataset.seriesExpanded = "false";
    this.innerHTML = this.scope === "series" ? this.seriesMarkup() : this.contentMarkup();
    this.status = this.querySelector("[data-assistant-status]");
    this.statusCopy = this.querySelector("[data-assistant-status-copy]");
    this.transcriptLog = this.querySelector(".voice-assistant__transcript");
    this.transcript = this.querySelector("[data-assistant-transcript]");
    this.transcriptSpeaker = this.querySelector("[data-assistant-speaker]");
    this.targets = this.querySelector("[data-assistant-targets]");
    this.promptList = this.querySelector("[data-assistant-prompts]");
    this.voiceButton = this.querySelector("[data-assistant-voice]");
    this.input = this.querySelector("[data-assistant-input]");
    this.panel = this.querySelector("[data-assistant-panel]");
    this.openButton = this.querySelector("[data-assistant-open]");
    this.sectionLabel = this.querySelector("[data-assistant-section]");
    this.voiceOptions = this.querySelector("[data-assistant-voice-options]");
    this.rateOptions = this.querySelector("[data-assistant-rate-options]");
    this.settingsSummary = this.querySelector("[data-assistant-settings-summary]");
    this.stopSpeakingButton = this.querySelector("[data-assistant-stop-speaking]");
    this.resetButton = this.querySelector("[data-assistant-reset]");
    this.renderPrompts(DEFAULT_PROMPTS[this.scope]);
    this.updateSectionLabel();
  }

  seriesMarkup() {
    return `
      <section class="voice-assistant__rail" aria-labelledby="${this.instanceId}-title">
        <header class="voice-assistant__series-head">
          <div>
            <p class="voice-assistant__kicker">SERIES DOCENT</p>
            <h2 id="${this.instanceId}-title" class="voice-assistant__title">이 시리즈 둘러보기</h2>
            <p class="voice-assistant__intro" data-assistant-intro>어디서부터 읽을지, 글과 자료가 어떻게 이어지는지 안내합니다.</p>
          </div>
          <button type="button" class="voice-assistant__series-toggle" data-assistant-series-toggle aria-expanded="false" aria-controls="${this.instanceId}-series-body">열기</button>
        </header>
        <div id="${this.instanceId}-series-body" class="voice-assistant__series-body">
          <div class="voice-assistant__prompts" data-assistant-prompts></div>
        </div>
        <button type="button" class="voice-assistant__rail-cta" data-assistant-open aria-expanded="false" aria-controls="${this.instanceId}-dialog">도슨트와 대화하기</button>
      </section>
      ${this.dialogMarkup({
        kicker: "SERIES DOCENT",
        title: "시리즈 도슨트",
        closeLabel: "시리즈 도슨트 닫기",
        sectionMarkup: "",
      })}`;
  }

  contentMarkup() {
    const description = this.dataset.contentType === "source"
      ? "현재 자료의 흐름과 읽는 대목을 짚어 드립니다."
      : "현재 글의 흐름과 읽는 대목을 짚어 드립니다.";
    return `
      <div class="voice-assistant__entry">
        <span><strong>${this.contentName}</strong><span>${description}</span></span>
        <button type="button" data-assistant-open aria-expanded="false" aria-controls="${this.instanceId}-dialog">열기</button>
      </div>
      ${this.dialogMarkup({
        kicker: "PAGE DOCENT",
        title: this.contentName,
        closeLabel: `${this.contentName} 닫기`,
        sectionMarkup: '<p class="voice-assistant__section" data-assistant-section>현재 페이지의 흐름을 기준으로 안내합니다.</p>',
      })}`;
  }

  dialogMarkup({ kicker, title, closeLabel, sectionMarkup }) {
    return `
      <div class="voice-assistant__overlay" data-assistant-panel hidden>
        <section id="${this.instanceId}-dialog" class="voice-assistant__dialog" role="dialog" aria-modal="true" aria-labelledby="${this.instanceId}-dialog-title">
          <header class="voice-assistant__dialog-head">
            <div>
              <p class="voice-assistant__kicker">${kicker}</p>
              <h2 id="${this.instanceId}-dialog-title" class="voice-assistant__title">${title}</h2>
            </div>
            <button type="button" class="voice-assistant__close" data-assistant-close aria-label="${closeLabel}">닫기</button>
          </header>
          ${sectionMarkup}
          ${this.scope === "content" ? '<div class="voice-assistant__prompts" data-assistant-prompts></div>' : ""}
          ${this.conversationMarkup()}
        </section>
      </div>`;
  }

  conversationMarkup() {
    return `
      <div class="voice-assistant__conversation-head">
        <p class="voice-assistant__status" role="status" aria-live="polite" data-assistant-status>
          <span class="voice-assistant__activity" aria-hidden="true"><span></span><span></span><span></span></span>
          <span data-assistant-status-copy>안내 준비됨</span>
        </p>
        <button class="voice-assistant__reset" type="button" data-assistant-reset disabled>대화 지우기</button>
      </div>
      <div class="voice-assistant__transcript" role="log" aria-live="polite" aria-label="안내 대화 기록">
        <div class="voice-assistant__turn" data-assistant-role="assistant" data-assistant-initial>
          <p class="voice-assistant__speaker" data-assistant-speaker>도슨트</p>
          <p class="voice-assistant__copy" data-assistant-transcript>궁금한 질문을 고르거나 직접 적어 주세요.</p>
        </div>
        <nav class="voice-assistant__targets" aria-label="관련 페이지" data-assistant-targets hidden></nav>
      </div>
      <div class="voice-assistant__controls">
        <form class="voice-assistant__form" data-assistant-form>
          <button class="voice-assistant__voice" type="button" data-assistant-voice aria-pressed="false">말로 묻기</button>
          <label>
            <span>직접 질문하기</span>
            <textarea data-assistant-input autocomplete="off" maxlength="500" rows="1" placeholder="궁금한 점을 적어 주세요"></textarea>
          </label>
          <button type="submit">보내기</button>
        </form>
        <button class="voice-assistant__stop-speaking" type="button" data-assistant-stop-speaking hidden>읽기 중단</button>
        <details class="voice-assistant__settings" open>
          <summary>목소리·속도</summary>
          <p class="voice-assistant__settings-summary" data-assistant-settings-summary>현재 기본 목소리 · 보통 속도</p>
          <div class="voice-assistant__setting-fields">
            <fieldset class="voice-assistant__fieldset">
              <legend>목소리</legend>
              <div class="voice-assistant__radio-list" data-assistant-voice-options></div>
            </fieldset>
            <fieldset class="voice-assistant__fieldset">
              <legend>속도</legend>
              <div class="voice-assistant__segmented" data-assistant-rate-options>
                <label><input type="radio" name="${this.instanceId}-rate" value="0.85" data-assistant-rate-option>천천히</label>
                <label><input type="radio" name="${this.instanceId}-rate" value="1" data-assistant-rate-option checked>보통</label>
                <label><input type="radio" name="${this.instanceId}-rate" value="1.15" data-assistant-rate-option>빠르게</label>
              </div>
            </fieldset>
          </div>
          <button class="voice-assistant__preview" type="button" data-assistant-preview>선택한 목소리 미리 듣기</button>
        </details>
        <div class="voice-assistant__disclosures">
          <details class="voice-assistant__disclosure">
            <summary>
              <span class="voice-assistant__disclosure-title">연결</span>
              <span class="voice-assistant__disclosure-short">직접 질문에는 이 기기의 개인 연결이 필요합니다.</span>
              <span class="voice-assistant__info" aria-hidden="true">i</span>
            </summary>
            <p>마이크 허용과 기기 연결 허용은 서로 다른 설정입니다. 먼저 이 기기에서 개인 연결을 켠 다음, 브라우저가 기기 연결을 요청하면 허용해 주세요. 연결되지 않아도 준비된 안내는 들을 수 있습니다.</p>
          </details>
          <details class="voice-assistant__disclosure">
            <summary>
              <span class="voice-assistant__disclosure-title">개인정보</span>
              <span class="voice-assistant__disclosure-short">대화 내용은 이 화면을 닫으면 사라집니다.</span>
              <span class="voice-assistant__info" aria-hidden="true">i</span>
            </summary>
            <p>직접 질문과 답변은 현재 대화창에만 표시하고 브라우저에 저장하지 않습니다. 마이크는 ‘말로 묻기’를 누르고 허용했을 때만 사용하며, ‘대화 지우기’로 기록을 즉시 비울 수 있습니다.</p>
          </details>
        </div>
      </div>`;
  }

  async loadContext() {
    const source = this.dataset.context;
    if (!source) return;
    let url;
    try {
      url = new URL(source, document.baseURI);
      if (url.origin !== location.origin || !url.pathname.endsWith("/assistant/context.json")) return;
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) return;
      const context = await response.json();
      if (!context || typeof context !== "object" || Array.isArray(context)) return;
      this.context = context;
      this.applyDocentContext(context.docent);
    } catch {
      return;
    }
  }

  applyDocentContext(docent) {
    if (!docent || typeof docent !== "object") return;
    const intro = typeof docent.intro === "string" ? docent.intro.trim() : "";
    const introNode = this.querySelector("[data-assistant-intro]");
    if (intro && introNode) introNode.textContent = intro;
    const sourcePrompts = this.scope === "series"
      ? docent.quickPrompts
      : docent.contentPrompts?.[this.dataset.contentId];
    const prompts = Array.isArray(sourcePrompts)
      ? sourcePrompts.map(normalisePrompt).filter(Boolean)
      : [];
    if (prompts.length) this.renderPrompts(prompts);
    this.updateSectionPrompt(currentHeading());
  }

  handleVoicesChanged() {
    this.populateVoices();
  }

  populateVoices() {
    if (!this.voiceOptions) return;
    const previous = this.selectedVoiceValue();
    const voices = globalThis.speechSynthesis?.getVoices?.() ?? [];
    const koreanVoices = voices.filter((voice) => /^ko(?:-|$)/i.test(voice.lang));
    const availableVoices = koreanVoices.length ? koreanVoices : voices.slice(0, 12);
    const ordered = [...availableVoices].sort((left, right) => {
      const leftKorean = /^ko(?:-|$)/i.test(left.lang) ? 0 : 1;
      const rightKorean = /^ko(?:-|$)/i.test(right.lang) ? 0 : 1;
      return leftKorean - rightKorean || left.name.localeCompare(right.name, "ko");
    });
    this.voiceOptions.replaceChildren(this.voiceRadio("", "기본 목소리", previous === ""));
    for (const voice of ordered) {
      this.voiceOptions.append(this.voiceRadio(
        voice.voiceURI,
        `${voice.name} · ${voice.lang}`,
        voice.voiceURI === previous,
      ));
    }
    if (!this.voiceOptions.querySelector("[data-assistant-voice-option]:checked")) {
      const fallback = this.voiceOptions.querySelector("[data-assistant-voice-option]");
      if (fallback) fallback.checked = true;
    }
    this.updateSettingsSummary();
  }

  voiceRadio(value, label, checked) {
    const item = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `${this.instanceId}-voice`;
    input.value = value;
    input.checked = checked;
    input.dataset.assistantVoiceOption = "";
    item.append(input, label);
    return item;
  }

  selectedVoiceValue() {
    return this.querySelector("[data-assistant-voice-option]:checked")?.value ?? "";
  }

  selectedRateValue() {
    return this.querySelector("[data-assistant-rate-option]:checked")?.value ?? "1";
  }

  updateSettingsSummary() {
    if (!this.settingsSummary) return;
    const voiceLabel = this.querySelector("[data-assistant-voice-option]:checked")
      ?.closest("label")
      ?.textContent
      ?.trim() || "기본 목소리";
    const rate = this.selectedRateValue();
    const rateLabel = rate === "0.85" ? "천천히" : rate === "1.15" ? "빠르게" : "보통";
    this.settingsSummary.textContent = `현재 ${voiceLabel} · ${rateLabel} 속도`;
  }

  renderPrompts(prompts, { remember = true } = {}) {
    if (!this.promptList) return;
    if (remember) this.basePrompts = prompts;
    this.prompts = prompts;
    this.promptList.replaceChildren();
    for (const prompt of prompts) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.assistantPrompt = prompt.id;
      button.textContent = prompt.label;
      this.promptList.append(button);
    }
  }

  handleClick(event) {
    if (event.target === this.panel) return this.closePanel();
    const seriesToggle = event.target.closest("[data-assistant-series-toggle]");
    if (seriesToggle) return this.toggleSeries(seriesToggle);
    const open = event.target.closest("[data-assistant-open]");
    if (open) return this.openPanel(open);
    if (event.target.closest("[data-assistant-close]")) return this.closePanel();
    if (event.target.closest("[data-assistant-stop-speaking]")) {
      this.stopSpeech();
      return;
    }
    if (event.target.closest("[data-assistant-reset]")) {
      this.resetConversation();
      return;
    }
    if (event.target.closest("[data-assistant-preview]")) {
      this.speak("이 목소리와 속도로 안내해 드릴게요.");
      return;
    }

    const voice = event.target.closest("[data-assistant-voice]");
    if (voice) {
      if (this.listening || this.dataset.state === "connecting") this.stopVoice();
      else this.startVoice();
      return;
    }

    const promptButton = event.target.closest("[data-assistant-prompt]");
    if (!promptButton) return;
    const prompt = this.prompts.find((item) => item.id === promptButton.dataset.assistantPrompt);
    if (prompt) {
      if (this.scope === "series" && this.panel?.hidden) this.openPanel(promptButton);
      this.input.value = prompt.label;
      this.input.focus();
      this.input.setSelectionRange?.(prompt.label.length, prompt.label.length);
      this.setState("idle", "질문을 확인한 뒤 보내 주세요");
    }
  }

  handleSubmit(event) {
    if (!event.target.matches("[data-assistant-form]")) return;
    event.preventDefault();
    const question = this.input.value.trim();
    if (!question) {
      this.input.focus();
      return;
    }
    this.input.value = "";
    this.askQuestion(question, { speak: false });
  }

  handleChange(event) {
    if (event.target.matches("[data-assistant-voice-option],[data-assistant-rate-option]")) {
      this.updateSettingsSummary();
    }
  }

  handleKeydown(event) {
    if (event.key === "Enter" && event.target === this.input && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.input.form?.requestSubmit();
      return;
    }
    if (event.key === "Escape" && this.panel && !this.panel.hidden) {
      event.preventDefault();
      this.closePanel();
      return;
    }
    if (event.key !== "Tab" || !this.panel || this.panel.hidden) return;
    const focusable = [...this.panel.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  handlePagehide(event) {
    if (event?.persisted) {
      this.stopVoice({ quiet: true });
      this.setState("idle", "안내 준비됨");
      return;
    }
    this.destroy();
  }

  handleAudioClaim(event) {
    if (event.detail?.owner !== this && (this.listening || this.dataset.state === "speaking")) {
      this.stopVoice({ quiet: true });
    }
  }

  handleScroll() {
    if (this.scope === "content") this.updateSectionLabel();
  }

  toggleSeries(button) {
    const expanded = this.dataset.seriesExpanded !== "true";
    this.dataset.seriesExpanded = String(expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "닫기" : "열기";
  }

  openPanel(button) {
    this.returnFocus = button;
    if (this.panel.hidden) {
      this.panel.hidden = false;
      openPanelCount += 1;
      document.documentElement?.classList?.add("voice-assistant-scroll-lock");
    }
    this.openButton?.setAttribute("aria-expanded", "true");
    this.updateSectionLabel();
    this.input?.focus();
  }

  closePanel() {
    if (!this.panel || this.panel.hidden) return;
    this.stopVoice({ quiet: true });
    this.panel.hidden = true;
    openPanelCount = Math.max(0, openPanelCount - 1);
    if (!openPanelCount) document.documentElement?.classList?.remove("voice-assistant-scroll-lock");
    this.openButton?.setAttribute("aria-expanded", "false");
    this.returnFocus?.focus();
  }

  updateSectionLabel() {
    if (!this.sectionLabel) return;
    const heading = currentHeading();
    const label = heading
      ? `현재 읽는 곳 · ${headingText(heading)}`
      : "현재 페이지의 흐름을 기준으로 안내합니다.";
    if (this.sectionLabel.textContent !== label) this.sectionLabel.textContent = label;
    this.updateSectionPrompt(heading);
  }

  updateSectionPrompt(heading) {
    if (this.scope !== "content" || !this.context) return;
    const allowed = new Set((this.context.allowedTargets ?? []).map((target) =>
      `${target?.contentType}:${target?.contentId}`,
    ));
    const entry = (this.context.entries ?? []).find((item) =>
      item?.contentId === this.dataset.contentId && allowed.has(`${item.type}:${item.contentId}`),
    );
    if (!entry) return;
    const outline = Array.isArray(entry.outline) ? entry.outline : [];
    const section = this.resolveOutlineSection(outline, heading);
    const pageFlow = [
      compactText(entry.synopsis),
      outline.map((item) => compactText(item.title || item.summary)).filter(Boolean).join(" → "),
    ].filter(Boolean).join(" ");
    const prompt = section
      ? {
          id: `current-section-${section.sectionId}`,
          label: "이 대목 짚어 듣기",
          answer: compactText(section.summary),
          targets: [{
            label: "이 대목 보기",
            url: `${entry.url}#${encodeURIComponent(section.sectionId)}`,
          }],
        }
      : {
          id: "current-page-flow",
          label: "이 페이지 흐름 듣기",
          answer: pageFlow || "현재 페이지의 소제목을 따라가며 전체 흐름을 살펴보세요.",
          targets: [{ label: "이 페이지 처음부터 보기", url: entry.url }],
        };
    const promptKey = `${prompt.id}:${prompt.answer}`;
    if (this.sectionPromptKey === promptKey) return;
    this.sectionPromptKey = promptKey;
    const rest = (this.basePrompts ?? DEFAULT_PROMPTS.content)
      .filter((item) => !String(item.id).startsWith("current-section-") && item.id !== "current-page-flow");
    this.renderPrompts([prompt, ...rest], { remember: false });
  }

  resolveOutlineSection(outline, heading) {
    const exact = outline.find((item) => item.sectionId === heading?.id && item.summary);
    if (exact) return exact;
    let nearest = null;
    const threshold = Math.max(160, innerHeight * 0.28);
    for (const item of outline) {
      if (!item.summary) continue;
      const anchor = document.getElementById(item.sectionId);
      if (anchor?.getBoundingClientRect?.().top <= threshold) nearest = item;
    }
    return nearest;
  }

  allowedEntries() {
    const allowed = new Set((this.context?.allowedTargets ?? []).map((target) =>
      `${target?.contentType}:${target?.contentId}`,
    ));
    return (this.context?.entries ?? []).filter((entry) =>
      allowed.has(`${entry?.type}:${entry?.contentId}`) && publicTarget(entry?.url),
    );
  }

  preparedPromptFor(question) {
    if (this.scope === "content" && this.context) this.updateSectionPrompt(currentHeading());
    const prompts = this.prompts ?? [];
    const intent = intentText(question);
    if (!intent) return null;

    const exact = prompts.find((prompt) => {
      const label = intentText(prompt.label);
      return label && (intent === label || (intent.length >= 4 && label.includes(intent)));
    });
    if (exact) return exact;

    if (this.scope === "series") {
      if (/(연구|발표|바탕|근거|자료)/u.test(question) && /(관계|이어|연결)/u.test(question)) {
        return prompts.find((prompt) => prompt.id === "source-relationship") ?? null;
      }
      if (/(세\s*편|이어|연결|순서)/u.test(question)) {
        return prompts.find((prompt) => prompt.id === "three-posts") ?? null;
      }
      if (/(어디서|무엇부터|먼저|시작)/u.test(question)) {
        return prompts.find((prompt) => prompt.id === "where-to-start") ?? null;
      }
      return null;
    }

    if (/(이\s*대목|현재\s*(대목|부분)|읽는\s*곳|여기)/u.test(question)) {
      return prompts.find((prompt) => String(prompt.id).startsWith("current-section-"))
        ?? prompts.find((prompt) => prompt.id === "current-page-flow")
        ?? null;
    }
    if (/(흐름|어떻게\s*읽|처음부터)/u.test(question)) {
      return prompts.find((prompt) => String(prompt.id).endsWith("-flow"))
        ?? prompts.find((prompt) => prompt.id === "current-page-flow")
        ?? null;
    }
    if (/(핵심\s*질문|요지)/u.test(question)) {
      return prompts.find((prompt) => String(prompt.id).endsWith("-question")) ?? null;
    }
    if (/(세\s*편|글들)/u.test(question) && /(관계|이어|연결)/u.test(question)) {
      return prompts.find((prompt) => String(prompt.id).endsWith("-relation")) ?? null;
    }
    return null;
  }

  answerTargets(question) {
    if (!this.context) return [];
    const entries = this.allowedEntries();
    const result = [];
    const add = (label, rawUrl) => {
      const url = publicTarget(rawUrl);
      if (!url || result.some((target) => target.url === url)) return;
      result.push({ label, url });
    };

    if (this.scope === "series") {
      const intent = intentText(question);
      const navigationTerms = {
        "01-skill-and-effort": ["실력", "노력", "진정성", "가치"],
        "02-workflow-design": ["프롬프트", "워크플로", "작업", "평가", "공동창작"],
        "03-reality-virtual-boundary": ["현실", "가상", "기억", "월드", "경계"],
        research: ["연구", "조사", "근거", "정책", "리터러시"],
        slides: ["발표", "슬라이드", "장표", "영상"],
      };
      const ranked = entries.map((entry, index) => ({
        entry,
        index,
        score: (navigationTerms[entry.contentId] ?? [])
          .filter((term) => intent.includes(intentText(term))).length,
      })).sort((left, right) => right.score - left.score || left.index - right.index);
      const relevant = ranked.some(({ score }) => score > 0)
        ? ranked
        : ranked.sort((left, right) => {
            const leftPost = left.entry.type === "post" ? 0 : 1;
            const rightPost = right.entry.type === "post" ? 0 : 1;
            return leftPost - rightPost || left.index - right.index;
          });
      for (const { entry } of relevant) {
        add(`${entryKind(entry)} · ${entry.title}`, entry.url);
        if (result.length === 3) break;
      }
      return result;
    }

    const entry = entries.find((item) => item.contentId === this.dataset.contentId);
    const heading = currentHeading();
    const section = entry && this.resolveOutlineSection(entry.outline ?? [], heading);
    if (entry && section) {
      add(`현재 대목 · ${section.title}`, `${entry.url}#${encodeURIComponent(section.sectionId)}`);
    } else if (entry) {
      add(`이 ${entryKind(entry)} 처음부터 보기`, entry.url);
    }

    const relationIds = (entry?.relations ?? [])
      .map((relation) => relation?.targetContentId)
      .filter(Boolean);
    const related = relationIds
      .map((contentId) => entries.find((item) => item.contentId === contentId))
      .find(Boolean)
      ?? entries.find((item) => item.contentId !== entry?.contentId && item.type === "post");
    if (related) add(`함께 보기 · ${related.title}`, related.url);

    const seriesTarget = (this.context.allowedTargets ?? []).find((target) =>
      target?.contentType === "series" && target?.contentId === this.context.series?.id,
    );
    if (seriesTarget) add("시리즈 전체로 돌아가기", seriesTarget.url);
    return result.slice(0, 3);
  }

  setState(state, message) {
    this.dataset.state = state;
    const statusCopy = this.statusCopy ?? this.status;
    if (statusCopy) statusCopy.textContent = message;
    this.transcriptLog?.setAttribute?.("aria-busy", String(state === "thinking"));
  }

  showAnswer(speaker, text, targets = []) {
    this.transcriptLog.querySelector("[data-assistant-initial]")?.remove();
    const role = speaker === "질문" || speaker === "듣는 중" ? "user" : "assistant";
    const label = role === "user" ? (speaker === "듣는 중" ? "말하는 중" : "나") : "도슨트";
    const listeningTurn = this.transcriptLog.querySelector("[data-assistant-listening]");
    if (listeningTurn && role === "user") {
      listeningTurn.dataset.assistantRole = "user";
      const speakerNode = listeningTurn.querySelector?.(".voice-assistant__speaker");
      const copyNode = listeningTurn.querySelector?.("[data-assistant-transcript]");
      if (speakerNode) speakerNode.textContent = label;
      if (copyNode) copyNode.textContent = text;
      if (speaker !== "듣는 중") delete listeningTurn.dataset.assistantListening;
      this.transcriptSpeaker = speakerNode;
      this.transcript = copyNode;
      if (this.resetButton) this.resetButton.disabled = false;
      this.transcriptLog.scrollTop = this.transcriptLog.scrollHeight;
      return;
    }
    const lastTurn = this.transcriptLog.querySelector(".voice-assistant__turn:last-of-type");
    const lastText = lastTurn?.querySelector?.("[data-assistant-transcript]")?.textContent;
    if (lastTurn?.dataset?.assistantRole === role && lastText === text) return;
    const turn = document.createElement("div");
    turn.className = "voice-assistant__turn";
    turn.dataset.assistantRole = role;
    if (speaker === "듣는 중") turn.dataset.assistantListening = "";
    const speakerNode = document.createElement("p");
    speakerNode.className = "voice-assistant__speaker";
    speakerNode.textContent = label;
    const copyNode = document.createElement("p");
    copyNode.className = "voice-assistant__copy";
    copyNode.dataset.assistantTranscript = "";
    copyNode.textContent = text;
    turn.append(speakerNode, copyNode);
    this.transcriptLog.insertBefore(turn, this.targets);
    this.transcriptSpeaker = speakerNode;
    this.transcript = copyNode;
    this.targets.replaceChildren();
    for (const target of targets) {
      const url = publicTarget(target.url);
      if (!url) continue;
      const link = document.createElement("a");
      link.href = url;
      link.textContent = target.label;
      this.targets.append(link);
    }
    this.targets.hidden = !this.targets.childElementCount;
    if (this.resetButton) this.resetButton.disabled = false;
    this.transcriptLog.scrollTop = this.transcriptLog.scrollHeight;
  }

  resetConversation() {
    this.stopVoice({ quiet: true });
    for (const turn of this.transcriptLog.querySelectorAll(".voice-assistant__turn")) turn.remove();
    const initial = document.createElement("div");
    initial.className = "voice-assistant__turn";
    initial.dataset.assistantRole = "assistant";
    initial.dataset.assistantInitial = "";
    const speaker = document.createElement("p");
    speaker.className = "voice-assistant__speaker";
    speaker.textContent = "도슨트";
    const copy = document.createElement("p");
    copy.className = "voice-assistant__copy";
    copy.dataset.assistantTranscript = "";
    copy.textContent = "궁금한 질문을 고르거나 직접 적어 주세요.";
    initial.append(speaker, copy);
    this.transcriptLog.insertBefore(initial, this.targets);
    this.transcriptSpeaker = speaker;
    this.transcript = copy;
    this.targets.replaceChildren();
    this.targets.hidden = true;
    if (this.input) this.input.value = "";
    this.agent.reset();
    if (this.resetButton) this.resetButton.disabled = true;
    this.setState("idle", "대화를 지웠어요");
    this.input?.focus();
  }

  claimAudio() {
    document.dispatchEvent(new CustomEvent("kiheon-assistant-audio-claim", {
      detail: { owner: this },
    }));
    document.querySelectorAll("audio,video").forEach((media) => media.pause());
    document.querySelectorAll('iframe[src*="youtube"]').forEach((frame) => {
      frame.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', "*");
    });
  }

  async startVoice() {
    this.claimAudio();
    this.setState("connecting", "음성 안내를 준비하고 있어요");
    this.voiceButton.textContent = "중단";
    this.voiceButton.setAttribute("aria-pressed", "true");
    this.requestController?.abort();
    this.requestController = new AbortController();

    try {
      await this.transport.checkAvailability({ signal: this.requestController.signal });
      if (this.destroyed || this.requestController.signal.aborted) return;
      await this.startListening();
    } catch (error) {
      if (error?.code === "cancelled") return;
      this.transport.reset();
      this.releaseMicrophone();
      this.resetVoiceButton();
      if (error?.name === "NotAllowedError") {
        this.setState("error", "마이크 사용을 허용해 주세요");
        this.showAnswer("안내", "브라우저 설정에서 마이크 사용을 허용한 뒤 다시 눌러 주세요.");
      } else if (error?.code === "speech_unsupported") {
        this.setState("error", "글로 질문해 주세요");
        this.showAnswer("안내", "이 환경에서는 말로 묻기 어렵습니다. 아래 입력칸에 질문을 적어 주세요.");
      } else {
        this.setState("error", "개인 연결을 확인해 주세요");
        this.showAnswer("안내", VOICE_OFFLINE_MESSAGE);
      }
    }
  }

  async startListening() {
    const Recognition = speechRecognitionConstructor();
    if (!Recognition || !navigator.mediaDevices?.getUserMedia) {
      const error = new Error("speech_unsupported");
      error.code = "speech_unsupported";
      throw error;
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      this.listening = true;
      this.setState("listening", "말씀해 주세요");
    };
    recognition.onresult = (event) => this.handleRecognitionResult(event);
    recognition.onerror = (event) => this.handleRecognitionError(event);
    recognition.onend = () => {
      this.releaseMicrophone();
      if (this.listening) {
        this.listening = false;
        this.resetVoiceButton();
        this.setState("idle", "안내 준비됨");
      }
    };
    this.recognition = recognition;
    recognition.start();
  }

  handleRecognitionResult(event) {
    let text = "";
    let complete = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      text += event.results[index][0]?.transcript ?? "";
      complete ||= event.results[index].isFinal;
    }
    text = text.trim();
    if (!text) return;
    this.showAnswer(complete ? "질문" : "듣는 중", text);
    if (!complete) return;
    this.listening = false;
    this.recognition = null;
    this.releaseMicrophone();
    this.resetVoiceButton();
    this.askQuestion(text, { speak: true });
  }

  handleRecognitionError(event) {
    this.listening = false;
    this.releaseMicrophone();
    this.resetVoiceButton();
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      this.setState("error", "마이크 사용을 허용해 주세요");
      this.showAnswer("안내", "브라우저 설정에서 마이크 사용을 허용한 뒤 다시 눌러 주세요.");
      return;
    }
    this.setState("idle", "다시 말씀해 주세요");
  }

  groundedInput(question, dialogueHistory = this.dialogueHistory) {
    if (!this.context) return question;
    const allowed = new Set((this.context.allowedTargets ?? []).map((target) =>
      `${target?.contentType}:${target?.contentId}`,
    ));
    const publicEntries = (this.context.entries ?? []).filter((item) =>
      allowed.has(`${item?.type}:${item?.contentId}`),
    );
    const entry = publicEntries.find((item) => item.contentId === this.dataset.contentId);
    const heading = currentHeading();
    const outline = entry && this.resolveOutlineSection(entry.outline ?? [], heading);
    const entries = this.scope === "series" ? publicEntries : entry ? [entry] : [];
    const mode = this.scope === "series"
      ? "현재 화면: 시리즈 메인. 전체 구성과 콘텐츠 사이의 관계를 개론적으로 설명하고 다음 읽을 곳을 안내합니다."
      : "현재 화면: 세부 콘텐츠. 이 페이지의 흐름과 현재 읽는 대목을 중심으로 설명합니다.";
    const publicContext = [
      "역할: 이 공개 시리즈를 함께 살펴보는 차분하고 정확한 도슨트입니다.",
      "대화 원칙: 사용자의 의도를 먼저 확인합니다. 인사·감탄·머뭇거림·불완전한 발화라면 내용을 지어 답하지 말고, 들은 뜻을 짧게 확인한 뒤 무엇이 궁금한지 한 문장으로 되묻습니다.",
      "답변 방식: 의도가 분명하면 요지를 먼저 말하고, 공개 근거와 맥락을 덧붙인 뒤 필요할 때만 다음 읽을 곳을 제안합니다. 질문보다 넓게 강의하지 말고 한국어 네 문장 이내로 답합니다.",
      "근거 경계: 아래 공개 문맥만 사용합니다. 문맥에 없는 사실은 추측하지 말고 모른다고 말합니다.",
      mode,
      this.context.series?.title && `시리즈: ${compactText(this.context.series.title)}`,
      this.context.series?.synopsis && `시리즈 설명: ${compactText(this.context.series.synopsis)}`,
      ...entries.map((item) => `[${entryKind(item)}]\n${entryGrounding(item)}`),
      headingText(heading) && `현재 읽는 곳: ${headingText(heading)}`,
      outline?.summary && `현재 대목 설명: ${compactText(outline.summary)}`,
      dialogueHistory.length && `이전 대화:\n${dialogueHistory
        .slice(-6)
        .map((turn) => `${turn.role}: ${turn.text}`)
        .join("\n")}`,
    ].filter(Boolean);
    if (!publicContext.length) return question;
    const suffix = `\n\n질문\n${question}`;
    const availableContextLength = Math.max(0, MAX_GROUNDED_INPUT_LENGTH - suffix.length);
    return `${publicContext.join("\n\n").slice(0, availableContextLength)}${suffix}`;
  }

  async askQuestion(question, { speak }) {
    this.requestController?.abort();
    this.showAnswer("질문", question);
    this.requestController = new AbortController();
    this.agent.scope = this.scope;
    try {
      const result = await this.agent.runTurn(question, {
        signal: this.requestController.signal,
      });
      this.showAnswer("안내", result.answer, result.targets);
      if (speak) this.speak(result.answer);
      else this.setState("idle", result.source === "tool" ? "질문을 조금 더 들려주세요" : "안내 준비됨");
    } catch (error) {
      if (error?.code === "cancelled") return;
      if (error?.code === "context_unavailable") {
        this.setState("error", "공개 안내 문맥을 확인해 주세요");
        this.showAnswer("안내", "이 페이지의 공개 안내 문맥을 불러오지 못했어요. 준비된 질문을 이용하거나 잠시 뒤 다시 시도해 주세요.");
        return;
      }
      this.transport.reset();
      this.setState("error", "개인 연결을 확인해 주세요");
      this.showAnswer("안내", VOICE_OFFLINE_MESSAGE);
    } finally {
      this.requestController = null;
    }
  }

  speak(text) {
    if (!globalThis.speechSynthesis || !globalThis.SpeechSynthesisUtterance) {
      this.setState("idle", "안내 준비됨");
      return;
    }
    this.claimAudio();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    const selectedVoice = speechSynthesis.getVoices?.().find((voice) =>
      voice.voiceURI === this.selectedVoiceValue(),
    );
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = Number.parseFloat(this.selectedRateValue()) || 1;
    const finish = () => {
      if (this.utterance !== utterance) return;
      this.utterance = null;
      if (this.stopSpeakingButton) this.stopSpeakingButton.hidden = true;
      this.setState("idle", "안내 준비됨");
    };
    utterance.onstart = () => {
      if (this.stopSpeakingButton) this.stopSpeakingButton.hidden = false;
      this.setState("speaking", "안내를 읽고 있어요");
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    this.utterance = utterance;
    speechSynthesis.speak(utterance);
  }

  stopSpeech({ quiet = false } = {}) {
    if (this.utterance && globalThis.speechSynthesis) speechSynthesis.cancel();
    this.utterance = null;
    if (this.stopSpeakingButton) this.stopSpeakingButton.hidden = true;
    if (!quiet) this.setState("idle", "안내 준비됨");
  }

  releaseMicrophone() {
    for (const track of this.mediaStream?.getTracks?.() ?? []) track.stop();
    this.mediaStream = null;
  }

  resetVoiceButton() {
    if (!this.voiceButton) return;
    this.voiceButton.textContent = "말로 묻기";
    this.voiceButton.setAttribute("aria-pressed", "false");
  }

  stopVoice({ quiet = false } = {}) {
    this.requestController?.abort();
    this.requestController = null;
    this.listening = false;
    try {
      this.recognition?.abort();
    } catch {}
    this.recognition = null;
    this.releaseMicrophone();
    this.stopSpeech({ quiet: true });
    this.transport.reset();
    this.resetVoiceButton();
    if (!quiet) this.setState("idle", "안내 준비됨");
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopVoice({ quiet: true });
    if (this.panel && !this.panel.hidden) {
      this.panel.hidden = true;
      openPanelCount = Math.max(0, openPanelCount - 1);
      if (!openPanelCount) document.documentElement?.classList?.remove("voice-assistant-scroll-lock");
    }
    this.transport.destroy();
    this.agent.reset();
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("change", this.handleChange);
    this.removeEventListener("submit", this.handleSubmit);
    document.removeEventListener("keydown", this.handleKeydown);
    document.removeEventListener("kiheon-assistant-audio-claim", this.handleAudioClaim);
    window.removeEventListener("pagehide", this.handlePagehide);
    window.removeEventListener("scroll", this.handleScroll);
    globalThis.speechSynthesis?.removeEventListener?.("voiceschanged", this.handleVoicesChanged);
  }
}

if (!customElements.get("kiheon-voice-assistant")) {
  customElements.define("kiheon-voice-assistant", KiheonVoiceAssistant);
}
