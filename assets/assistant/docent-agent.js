const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MAX_TRACES = 12;
const FILLER_TOKENS = /^(?:아+|어+|으+|음+|흠+|네+|예+|응+|저기|잠깐|잠시|뭐지|그러니까)$/u;

function cleanText(value) {
  return String(value ?? "").trim();
}

function lowSignalUtterance(value) {
  const tokens = cleanText(value)
    .toLocaleLowerCase("ko")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return tokens.length > 0 && tokens.length <= 3 && tokens.every((token) => FILLER_TOKENS.test(token));
}

function agentError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

// ★ 발화 계약 v1 — 문면 정본은 `_T3-발화계약-v1-초안-20260720.md` §2.5.2.
// **고정 문자열이다. 자구를 바꾸지 않는다.** 거절이 매번 달라지면 듣는 사람은 그것이
// 규칙인지 그때의 사정인지 알 수 없다. 문면을 고칠 일이 생기면 정본부터 고쳐 모든
// 표면에 같은 자구로 내린다.
export const SPEECH_CONTRACT_VERSION = "v1";
export const SPEECH_CONTRACT_REFUSALS = Object.freeze({
  "R-1": "그 부분은 제가 확인해서 남겨둔 기록 안에 없어서, 지금은 말씀드릴 수 없어요.",
  "R-2": "그건 아직 제가 확정해두지 않은 부분이라, 답을 남겨두지 않았어요.",
  "R-3": "그건 제가 말한 적이 없는 것이라, 대신 만들어 드리지 않아요.",
});

// ⓒ 만들지 않는 것 — 신규 의견·미래 판단·타인 평가.
// 근거 탐색을 **시도조차 하지 않는다.** 찾다가 그럴듯하게 지어내는 경로 자체를 막는 것이
// 목적이라 도구 호출보다 앞에 건다(명세 §3-2).
const OPINION_REQUEST =
  /어떻게\s*생각|생각(은|이)\s*(어때|어떠)|어떻게\s*보(세요|시나요|십니까)|의견\s*(좀|을|이|은|도)|어떤\s*것\s*같|어떻게\s*느끼|평가(해|를)/u;
const FUTURE_REQUEST = /앞으로|향후|미래에|전망|예측|언제쯤|될\s*것\s*같/u;
const THIRD_PARTY_REQUEST = /어떤\s*사람(인가|이에|입니|일까|이라고)|그\s*사람\s*(어때|어떤)|누가\s*(더|제일|가장)/u;
// ⓐ 원천에 직함·소속 문자열이 없다. 실측된 날조 유형이라 따로 건다(명세 §3-4).
const IDENTITY_REQUEST = /직함|직책|직위|소속|직업|어느\s*회사|무슨\s*회사/u;
// 자기소개 요청도 같은 유형이다 — RUN17 의 "VC라는 직"이 여기서 나왔다.
// 사람을 가리키는 말이 함께 있을 때만 건다("이 시리즈 소개해 주세요"는 정상 질의다).
const SELF_INTRO_REQUEST =
  /(본인|자기|신기헌|글쓴이|작가|저자|필자)\s*(에\s*대해|를|을|은|는)?\s*소개|누구(세요|신가요|십니까|인가요)|어떤\s*분(이세요|인가요|입니까)/u;

/** 질의 분류 — 도구 호출 전에 판정한다. 통과면 빈 문자열. */
function contractRequestVerdict(text) {
  const question = cleanText(text);
  if (!question) return "";
  if (OPINION_REQUEST.test(question)) return "R-3";
  if (FUTURE_REQUEST.test(question)) return "R-3";
  if (THIRD_PARTY_REQUEST.test(question)) return "R-3";
  if (IDENTITY_REQUEST.test(question)) return "R-1";
  if (SELF_INTRO_REQUEST.test(question)) return "R-1";
  return "";
}

/** 발화 직전 판정 — 모델이 잘 답했는지와 무관하게 계약이 최종 결정권을 갖는다. */
function contractResultVerdict(result) {
  if (result?.withheld || result?.tier === "ⓑ") return "R-2";
  // 공개 문맥을 못 붙였는데 모델이 답을 냈다면 ⓐ 원천 밖에서 나온 말이다.
  if (result?.source === "model" && result?.grounded === false) return "R-1";
  return "";
}

export class DocentSessionMemory {
  constructor({ maxTurns = DEFAULT_MAX_TURNS, maxTraces = DEFAULT_MAX_TRACES } = {}) {
    this.maxTurns = maxTurns;
    this.maxTraces = maxTraces;
    this.turns = [];
    this.traces = [];
  }

  remember(role, text) {
    const value = cleanText(text);
    if (!value) return;
    const last = this.turns.at(-1);
    if (last?.role === role && last.text === value) return;
    this.turns.push({ role, text: value });
    if (this.turns.length > this.maxTurns) this.turns.splice(0, this.turns.length - this.maxTurns);
  }

  replaceTurns(turns) {
    this.turns = [];
    for (const turn of Array.isArray(turns) ? turns : []) {
      this.remember(cleanText(turn?.role), turn?.text);
    }
  }

  recent(limit = 6) {
    return this.turns.slice(-limit).map((turn) => ({ ...turn }));
  }

  recordTrace(trace) {
    this.traces.push(Object.freeze({ ...trace }));
    if (this.traces.length > this.maxTraces) this.traces.splice(0, this.traces.length - this.maxTraces);
  }

  clear() {
    this.turns = [];
    this.traces = [];
  }

  snapshot() {
    return {
      turns: this.turns.map((turn) => ({ ...turn })),
      traces: this.traces.map((trace) => ({ ...trace, tools: [...trace.tools] })),
    };
  }
}

export class DocentToolRegistry {
  constructor(tools = []) {
    this.tools = new Map();
    for (const tool of tools) this.register(tool);
  }

  register(tool) {
    const name = cleanText(tool?.name);
    if (!name || typeof tool?.execute !== "function") throw agentError("invalid_tool");
    if (this.tools.has(name)) throw agentError("duplicate_tool");
    this.tools.set(name, Object.freeze({
      name,
      description: cleanText(tool.description),
      requiresConfirmation: tool.requiresConfirmation === true,
      execute: tool.execute,
    }));
  }

  manifest() {
    return [...this.tools.values()].map(({ name, description, requiresConfirmation }) => ({
      name,
      description,
      requiresConfirmation,
    }));
  }

  async execute(name, input, context) {
    const tool = this.tools.get(name);
    if (!tool) throw agentError("unknown_tool");
    return tool.execute(input, context);
  }
}

export class DocentAgent {
  constructor({
    scope = "content",
    transport,
    observe = () => ({}),
    tools = [],
    memory = new DocentSessionMemory(),
    sanitizeTarget = (target) => target,
    onEvent = () => {},
  } = {}) {
    if (typeof transport?.ask !== "function") throw agentError("invalid_transport");
    this.scope = scope;
    this.transport = transport;
    this.observe = observe;
    this.registry = new DocentToolRegistry(tools);
    this.memory = memory;
    this.sanitizeTarget = sanitizeTarget;
    this.onEvent = onEvent;
    this.turnCount = 0;
  }

  emit(type, detail = {}) {
    this.onEvent(Object.freeze({ type, ...detail }));
  }

  async useTool(name, input, trace, context) {
    trace.tools.push(name);
    this.emit("tool_started", { traceId: trace.id, tool: name });
    const output = await this.registry.execute(name, input, context);
    this.emit("tool_completed", { traceId: trace.id, tool: name });
    return output;
  }

  verifiedResult(result) {
    const answer = cleanText(result?.answer);
    if (!answer) throw agentError("invalid_agent_answer");
    const targets = [];
    for (const target of Array.isArray(result?.targets) ? result.targets : []) {
      const sanitized = this.sanitizeTarget(target);
      if (!sanitized || !cleanText(sanitized.label) || !cleanText(sanitized.url)) continue;
      if (targets.some((item) => item.url === sanitized.url)) continue;
      targets.push({ label: cleanText(sanitized.label), url: cleanText(sanitized.url) });
      if (targets.length === 3) break;
    }
    return {
      answer,
      targets,
      source: cleanText(result?.source) || "tool",
      verification: Object.freeze({
        answerPresent: true,
        targetsSanitized: true,
        publicContextOnly: true,
      }),
    };
  }

  async runTurn(input, { signal } = {}) {
    const question = cleanText(input);
    if (!question) throw agentError("empty_input");
    const trace = { id: ++this.turnCount, route: "", tools: [], outcome: "running" };
    this.emit("turn_started", { traceId: trace.id });

    try {
      const observation = Object.freeze({
        ...(await this.observe({ input: question, scope: this.scope, memory: this.memory.recent() })),
        lowSignal: lowSignalUtterance(question),
      });
      this.emit("observed", { traceId: trace.id, observation });
      const context = Object.freeze({ observation, memory: this.memory, signal });
      let result;
      let refusal = "";

      if (observation.lowSignal) {
        trace.route = "clarify";
        result = await this.useTool("clarify_intent", { input: question }, trace, context);
      } else {
        // ★ 관문 1 — 도구를 부르기 전에 판정한다. ⓒ 는 근거 탐색 흔적조차 남기지 않는다.
        refusal = contractRequestVerdict(question);
        if (!refusal) {
          const prepared = await this.useTool("prepared_guide", { input: question }, trace, context);
          if (prepared?.handled) {
            trace.route = "prepared";
            result = { ...prepared, source: "prepared" };
          } else {
            trace.route = "generated";
            const grounding = await this.useTool("ground_public_context", { input: question }, trace, context);
            const prompt = cleanText(grounding?.prompt);
            if (!prompt) throw agentError("context_unavailable");
            this.emit("model_started", { traceId: trace.id });
            const answer = await this.transport.ask(prompt, { signal });
            this.emit("model_completed", { traceId: trace.id });
            const suggested = await this.useTool("suggest_content", { input: question, answer }, trace, context);
            result = {
              answer,
              targets: suggested?.targets,
              source: "model",
              // 문맥 도구가 `grounded: false` 를 선언하면 관문 2 가 R-1 로 바꾼다.
              // ⚠ 현재 웹 런타임의 `ground_public_context` 는 이 값을 내보내지 않는다 —
              //   공개 문맥이 없어도 질문만 모델에 넘어가고 그 답이 그대로 나간다.
              //   그 구멍은 배포 산출물(voice-assistant-v2.js) 수정이 필요해 별도 회차다.
              grounded: grounding?.grounded !== false,
            };
          }
          // ★ 관문 2 — 발화 직전. 판정이 ⓑ/ⓒ면 생성된 답을 버린다.
          refusal = contractResultVerdict(result);
        }
      }

      if (refusal) {
        trace.route = "contract";
        result = { answer: SPEECH_CONTRACT_REFUSALS[refusal], targets: [], source: "contract" };
        this.emit("contract_refused", { traceId: trace.id, refusal });
      }

      this.emit("verification_started", { traceId: trace.id });
      const checked = this.verifiedResult(result);
      const verified = refusal
        ? Object.freeze({
            ...checked,
            refusal,
            verification: Object.freeze({
              ...checked.verification,
              contract: SPEECH_CONTRACT_VERSION,
              refusal,
            }),
          })
        : checked;
      this.memory.remember("사용자", question);
      this.memory.remember("도슨트", verified.answer);
      trace.outcome = "completed";
      this.memory.recordTrace({
        id: trace.id,
        route: trace.route,
        tools: [...trace.tools],
        outcome: trace.outcome,
        targetCount: verified.targets.length,
        ...(refusal ? { refusal } : {}),
      });
      this.emit("turn_completed", { traceId: trace.id, route: trace.route });
      return verified;
    } catch (error) {
      trace.outcome = error?.code === "cancelled" ? "cancelled" : "failed";
      this.memory.recordTrace({
        id: trace.id,
        route: trace.route || "unresolved",
        tools: [...trace.tools],
        outcome: trace.outcome,
        errorCode: cleanText(error?.code) || "agent_failed",
        targetCount: 0,
      });
      this.emit("turn_failed", {
        traceId: trace.id,
        errorCode: cleanText(error?.code) || "agent_failed",
      });
      throw error;
    }
  }

  reset() {
    this.memory.clear();
    this.emit("memory_cleared");
  }

  snapshot() {
    return {
      scope: this.scope,
      tools: this.registry.manifest(),
      memory: this.memory.snapshot(),
    };
  }
}

export const docentAgentVersion = "1.1.0";
