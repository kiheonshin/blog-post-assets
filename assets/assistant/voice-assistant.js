import { VoiceTransport, VOICE_OFFLINE_MESSAGE } from "./voice-transport.js?v=20260731h";

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
  }

  connectedCallback() {
    if (this.dataset.initialized === "true") return;
    this.dataset.initialized = "true";
    this.render();
    this.addEventListener("click", this.handleClick);
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

  render() {
    this.classList.add("voice-assistant", `voice-assistant--${this.scope}`);
    this.dataset.state = "idle";
    if (this.scope === "series") this.dataset.seriesExpanded = "false";
    this.innerHTML = this.scope === "series" ? this.seriesMarkup() : this.contentMarkup();
    this.status = this.querySelector("[data-assistant-status]");
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
    this.voiceSelect = this.querySelector("[data-assistant-voice-select]");
    this.rateSelect = this.querySelector("[data-assistant-rate]");
    this.stopSpeakingButton = this.querySelector("[data-assistant-stop-speaking]");
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
          ${this.conversationMarkup()}
        </div>
      </section>`;
  }

  contentMarkup() {
    const description = this.dataset.contentType === "source"
      ? "현재 자료의 흐름과 읽는 대목을 짚어 드립니다."
      : "현재 글의 흐름과 읽는 대목을 짚어 드립니다.";
    return `
      <div class="voice-assistant__entry">
        <span><strong>${this.contentName}</strong><span>${description}</span></span>
        <button type="button" data-assistant-open aria-expanded="false">열기</button>
      </div>
      <div class="voice-assistant__overlay" data-assistant-panel hidden>
        <section class="voice-assistant__dialog" role="dialog" aria-modal="true" aria-labelledby="${this.instanceId}-dialog-title">
          <header class="voice-assistant__dialog-head">
            <div>
              <p class="voice-assistant__kicker">PAGE DOCENT</p>
              <h2 id="${this.instanceId}-dialog-title" class="voice-assistant__title">${this.contentName}</h2>
            </div>
            <button type="button" class="voice-assistant__close" data-assistant-close aria-label="${this.contentName} 닫기">닫기</button>
          </header>
          <p class="voice-assistant__section" data-assistant-section>현재 페이지의 흐름을 기준으로 안내합니다.</p>
          <div class="voice-assistant__prompts" data-assistant-prompts></div>
          ${this.conversationMarkup()}
        </section>
      </div>`;
  }

  conversationMarkup() {
    return `
      <p class="voice-assistant__status" role="status" aria-live="polite" data-assistant-status>안내 준비됨</p>
      <div class="voice-assistant__transcript" role="log" aria-live="polite" aria-label="안내 대화 기록">
        <div class="voice-assistant__turn" data-assistant-initial>
          <p class="voice-assistant__speaker" data-assistant-speaker>안내</p>
          <p class="voice-assistant__copy" data-assistant-transcript>궁금한 질문을 고르거나 직접 적어 주세요.</p>
        </div>
        <nav class="voice-assistant__targets" aria-label="관련 페이지" data-assistant-targets hidden></nav>
      </div>
      <form class="voice-assistant__form" data-assistant-form>
        <label>
          <span>직접 질문하기</span>
          <input type="text" data-assistant-input autocomplete="off" maxlength="500" placeholder="궁금한 점을 적어 주세요">
        </label>
        <button type="submit">보내기</button>
      </form>
      <button class="voice-assistant__voice" type="button" data-assistant-voice aria-pressed="false">말로 질문하기</button>
      <button class="voice-assistant__stop-speaking" type="button" data-assistant-stop-speaking hidden>읽기 중단</button>
      <details class="voice-assistant__settings">
        <summary>목소리·속도</summary>
        <div class="voice-assistant__setting-fields">
          <label><span>목소리</span><select data-assistant-voice-select><option value="">기본 목소리</option></select></label>
          <label><span>속도</span><select data-assistant-rate><option value="0.85">천천히</option><option value="1" selected>보통</option><option value="1.15">빠르게</option></select></label>
        </div>
      </details>
      <details class="voice-assistant__privacy">
        <summary>연결과 개인정보</summary>
        <p>준비된 안내는 이 페이지에서 바로 들을 수 있습니다. 직접 질문을 처음 보낼 때 브라우저가 ‘이 기기 연결’을 요청할 수 있습니다. 허용하면 이 Mac의 개인 안내로 질문을 보내며, 말로 질문하기를 누른 뒤 허용한 경우에만 마이크를 엽니다. 질문 기록과 음성은 이 페이지에 저장하지 않습니다.</p>
      </details>`;
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
    if (!this.voiceSelect || !globalThis.speechSynthesis?.getVoices) return;
    const previous = this.voiceSelect.value;
    const voices = speechSynthesis.getVoices();
    const koreanVoices = voices.filter((voice) => /^ko(?:-|$)/i.test(voice.lang));
    const availableVoices = koreanVoices.length ? koreanVoices : voices.slice(0, 12);
    const ordered = [...availableVoices].sort((left, right) => {
      const leftKorean = /^ko(?:-|$)/i.test(left.lang) ? 0 : 1;
      const rightKorean = /^ko(?:-|$)/i.test(right.lang) ? 0 : 1;
      return leftKorean - rightKorean || left.name.localeCompare(right.name, "ko");
    });
    const fallback = document.createElement("option");
    fallback.value = "";
    fallback.textContent = "기본 목소리";
    this.voiceSelect.replaceChildren(fallback);
    for (const voice of ordered) {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} · ${voice.lang}`;
      this.voiceSelect.append(option);
    }
    if ([...this.voiceSelect.options].some((option) => option.value === previous)) {
      this.voiceSelect.value = previous;
    }
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
      this.showAnswer("안내", prompt.answer, prompt.targets);
      this.speak(prompt.answer);
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

  handleKeydown(event) {
    if (event.key === "Escape" && this.panel && !this.panel.hidden) {
      event.preventDefault();
      this.closePanel();
      return;
    }
    if (event.key !== "Tab" || !this.panel || this.panel.hidden) return;
    const focusable = [...this.panel.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])',
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
    this.panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    this.updateSectionLabel();
    this.querySelector("[data-assistant-close]")?.focus();
  }

  closePanel() {
    if (!this.panel || this.panel.hidden) return;
    this.stopVoice({ quiet: true });
    this.panel.hidden = true;
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
    if (this.status) this.status.textContent = message;
  }

  showAnswer(speaker, text, targets = []) {
    this.transcriptLog.querySelector("[data-assistant-initial]")?.remove();
    const turn = document.createElement("div");
    turn.className = "voice-assistant__turn";
    const speakerNode = document.createElement("p");
    speakerNode.className = "voice-assistant__speaker";
    speakerNode.textContent = speaker;
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
    this.transcriptLog.scrollTop = this.transcriptLog.scrollHeight;
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
        this.setState("error", "음성 안내를 시작하지 못했어요");
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

  groundedInput(question) {
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
      "역할: 이 공개 시리즈의 도슨트입니다. 아래 공개 문맥만 사용해 한국어로 네 문장 이내로 답하세요. 문맥에 없는 사실은 추측하지 말고 모른다고 말하세요.",
      mode,
      this.context.series?.title && `시리즈: ${compactText(this.context.series.title)}`,
      this.context.series?.synopsis && `시리즈 설명: ${compactText(this.context.series.synopsis)}`,
      ...entries.map((item) => `[${entryKind(item)}]\n${entryGrounding(item)}`),
      headingText(heading) && `현재 읽는 곳: ${headingText(heading)}`,
      outline?.summary && `현재 대목 설명: ${compactText(outline.summary)}`,
    ].filter(Boolean);
    if (!publicContext.length) return question;
    const suffix = `\n\n질문\n${question}`;
    const availableContextLength = Math.max(0, MAX_GROUNDED_INPUT_LENGTH - suffix.length);
    return `${publicContext.join("\n\n").slice(0, availableContextLength)}${suffix}`;
  }

  async askQuestion(question, { speak }) {
    this.requestController?.abort();
    this.requestController = null;
    this.showAnswer("질문", question);
    const prepared = this.preparedPromptFor(question);
    if (prepared) {
      this.showAnswer("안내", prepared.answer, prepared.targets);
      if (speak) this.speak(prepared.answer);
      else this.setState("idle", "안내 준비됨");
      return;
    }

    this.requestController = new AbortController();
    this.setState("thinking", "답을 준비하고 있어요");
    try {
      const answer = await this.transport.ask(this.groundedInput(question), {
        signal: this.requestController.signal,
      });
      this.showAnswer("안내", answer, this.answerTargets(question));
      if (speak) this.speak(answer);
      else this.setState("idle", "안내 준비됨");
    } catch (error) {
      if (error?.code === "cancelled") return;
      this.transport.reset();
      this.setState("error", "지금은 글로 준비된 안내를 이용해 주세요");
      this.showAnswer("안내", VOICE_OFFLINE_MESSAGE);
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
      voice.voiceURI === this.voiceSelect?.value,
    );
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = Number.parseFloat(this.rateSelect?.value ?? "1") || 1;
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
    this.voiceButton.textContent = "말로 질문하기";
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
    this.transport.destroy();
    this.removeEventListener("click", this.handleClick);
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
