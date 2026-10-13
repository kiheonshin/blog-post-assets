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
const PROTECTED_MATERIAL = /비공개|미공개|(?:비밀|기밀|내부)\s*(?:파일|문서|자료|기록|보관|원본)|공개되지\s*않은|봉인된|보호된|보호면|닫힌\s*(?:등급|자료|기록|문서|파일|보관)|로컬\s*(?:볼트|보관)|local\s*vault|private\s*vault|sealed/iu;
const MATERIAL_NOUN = /보관\s*공간|원본|파일|문서|자료|기록|내용/u;
const PROTECTED_PUBLIC_ONLY = /비공개(?:가|는|를)?\s*아닌\s*공개|(?:비공개|미공개|봉인된|보호된|닫힌\s*(?:자료|기록|문서|파일))[^.!?\n]{0,30}(?:말고|제외하고|아니라)\s*(?:공개|열린)/giu;
const MATERIAL_ACCESS_DIRECTIVE = /(?:열어|열람해|보여|읽어|꺼내|가져|찾아|검색해|설명해|알려|요약해|공유해|보내|참고해|사용해|확인해)\s*(?:줘요?|주세|주세요|주시겠(?:어요|습니까)|줄래요?|줄\s*수\s*있|주실\s*수\s*있)/u;
const MATERIAL_ACCESS_QUESTION = /볼\s*수\s*있|열\s*수\s*있|읽을\s*수\s*있|접근할\s*수\s*있|열람\s*가능/u;
const PROTECTED_POLICY_QUESTION = /(?:왜|이유|정책|규칙|기준)/u;
const PROTECTED_NEGATED_ACCESS = /보여주지|열\s*수\s*없|볼\s*수\s*없|읽을\s*수\s*없|접근할\s*수\s*없|열리지\s*않/u;
const MISSING_EVIDENCE = /(?:근거|출처)(?:가)?\s*(?:없|없이)|(?:자료|문서|기록|발표|글)(?:에|에는|에서)\s*(?:없|빠진)|(?:없는|확인되지\s*않은|가짜|허위)\s*(?:사실|내용|정보|사건|기록|이력|연도|수치|학력|전공|경력|근거|출처)/u;
const FACT_MAKING_VERB = /만들|지어내|꾸며|날조|상상/u;
const FACT_CLAIM_NOUN = /사실|정보|이력|연도|수치|학력|전공|경력/u;
const FACT_RECORD_NOUN = /기록|내용|사건/u;
const FACT_FALSIFY_VERB = /지어내|꾸며|날조|상상/u;
const DIRECT_FACT_MAKE = /(?:사실|정보|이력|연도|수치|학력|전공|경력)(?:을|를|도)?\s*(?:하나|한\s*개|새로)?\s*만들/u;
const FACT_REQUEST_DIRECTIVE = /줘요?|주세|주세요|주시겠(?:어요|습니까)|줄래요?|주실\s*수|답해|알려|설명해|말해|써\s*줘/u;
const FACT_META_QUESTION = /만들면|지어내면|꾸미면|만들어서는|지어내서는|꾸며서는|만들지\s*말/u;
const FICTION_EXAMPLE_TARGET = /(?:가상(?:의)?|허구(?:의)?|소설|픽션)[^.!?\n]{0,20}(?:예시|이야기|장면)[^.!?\n]{0,20}(?:만들|써)/u;
const FACT_DISGUISED_AS_FICTION = /(?:사실|정보|기록|이력|연도)(?:을|를)[^.!?\n]{0,20}(?:가상|허구|예시)/u;

// Narrow request patterns stop explicit closed-material and fabrication asks
// before tool or model work. Ambiguous mentions take a local clarification
// route, never the model. These rules are not a general semantic classifier.
export function mentionsProtectedMaterial(value) {
  const text = cleanText(value);
  return PROTECTED_MATERIAL.test(text) && MATERIAL_NOUN.test(text);
}

function protectedMaterialRequest(text) {
  if (!mentionsProtectedMaterial(text)) return false;
  const effective = text.replace(PROTECTED_PUBLIC_ONLY, "공개");
  if (!mentionsProtectedMaterial(effective)) return false;
  let protectedSeen = false;
  for (const clause of effective.split(/[.!?\n]+/u)) {
    if (mentionsProtectedMaterial(clause)) protectedSeen = true;
    if (!protectedSeen || !MATERIAL_NOUN.test(clause)) continue;
    if (PROTECTED_POLICY_QUESTION.test(clause) && PROTECTED_NEGATED_ACCESS.test(clause)) continue;
    if (/(?:공개|열린)\s*(?:파일|문서|자료|기록)/u.test(clause) &&
        !/(?:그|해당)\s*(?:파일|문서|자료|기록)/u.test(clause) &&
        !mentionsProtectedMaterial(clause)) continue;
    if (MATERIAL_ACCESS_DIRECTIVE.test(clause) || MATERIAL_ACCESS_QUESTION.test(clause)) return true;
  }
  return false;
}

export function mentionsFactFabrication(value) {
  const text = cleanText(value);
  return (MISSING_EVIDENCE.test(text) && FACT_MAKING_VERB.test(text)) ||
    (FACT_CLAIM_NOUN.test(text) && FACT_FALSIFY_VERB.test(text)) ||
    (FACT_RECORD_NOUN.test(text) && FACT_FALSIFY_VERB.test(text)) ||
    DIRECT_FACT_MAKE.test(text) || FACT_DISGUISED_AS_FICTION.test(text);
}

function fabricatedFactRequest(text) {
  if (!mentionsFactFabrication(text)) return false;
  if (FICTION_EXAMPLE_TARGET.test(text) && !MISSING_EVIDENCE.test(text) &&
      !FACT_DISGUISED_AS_FICTION.test(text)) return false;
  if (FACT_META_QUESTION.test(text)) return false;
  return FACT_REQUEST_DIRECTIVE.test(text);
}

export function needsSourceChoiceClarification(value) {
  const question = cleanText(value);
  return /(연구\s*노트|연구\s*자료|조사\s*자료)/u.test(question) &&
    /(발표\s*자료|발표\s*슬라이드|장표)/u.test(question) &&
    !/(정했|결정했|골랐|선택했)/u.test(question) &&
    (!/(차이|다른가|비교|목차)/u.test(question) || /(모르겠|고민)/u.test(question)) &&
    /(뭐\s*부터|무엇\s*부터|뭘\s*먼저|무엇(?:을)?\s*먼저|어느\s*(?:쪽|걸|것|자료)[^.!?\n]{0,15}먼저|모르겠|고민)/u.test(question);
}

/** 질의 분류 — 도구 호출 전에 판정한다. 통과면 빈 문자열. */
function contractRequestVerdict(text) {
  const question = cleanText(text);
  if (!question) return "";
  if (protectedMaterialRequest(question)) return "R-2";
  if (fabricatedFactRequest(question)) return "R-3";
  if (OPINION_REQUEST.test(question)) return "R-3";
  if (FUTURE_REQUEST.test(question)) return "R-3";
  if (THIRD_PARTY_REQUEST.test(question)) return "R-3";
  if (IDENTITY_REQUEST.test(question)) return "R-1";
  if (SELF_INTRO_REQUEST.test(question)) return "R-1";
  return "";
}

/**
 * 모델 앞 판정 하나 - 글 질문과 음성 질문이 같은 함수를 지난다(E7).
 * route : empty(들은 말 없음) · clarify(되묻기) · contract(고정 거절) · open(근거 문맥으로 답할 질문).
 */
export function preflightRoute(value) {
  const question = cleanText(value);
  if (!question) return Object.freeze({ route: "empty" });
  if (lowSignalUtterance(question)) return Object.freeze({ route: "clarify" });
  const refusal = contractRequestVerdict(question);
  if (refusal) return Object.freeze({ route: "contract", refusal });
  if (mentionsProtectedMaterial(question) || mentionsFactFabrication(question) ||
      needsSourceChoiceClarification(question)) return Object.freeze({ route: "clarify" });
  return Object.freeze({ route: "open" });
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
        // 음성 질문도 preflight() 로 같은 판정을 지난다(E7).
        const gate = preflightRoute(question);
        refusal = gate.refusal ?? "";
        if (gate.route === "clarify") {
          trace.route = "clarify";
          result = await this.useTool("clarify_intent", { input: question }, trace, context);
        } else if (!refusal) {
          const prepared = await this.useTool("prepared_guide", { input: question }, trace, context);
          if (prepared?.handled) {
            trace.route = "prepared";
            result = { ...prepared, source: "prepared" };
          } else {
            trace.route = "generated";
            const grounding = await this.useTool("ground_public_context", { input: question }, trace, context);
            const prompt = cleanText(grounding?.prompt);
            // 문맥 도구가 `grounded: false` 를 선언하면 **모델을 부르지 않는다.** 관문 2 가
            // 이 결과를 R-1 로 바꾼다. 답을 짓게 한 뒤 버리는 것이 아니라 짓지 않는 것이다.
            if (grounding?.grounded === false) {
              result = { answer: "", targets: [], source: "model", grounded: false };
            } else {
              // 선언이 없는데 prompt 도 비었으면 도구가 제 일을 못 한 것이다 - 닫고 멈춘다.
              if (!prompt) throw agentError("context_unavailable");
              this.emit("model_started", { traceId: trace.id });
              const answer = await this.transport.ask(prompt, { signal });
              this.emit("model_completed", { traceId: trace.id });
              const suggested = await this.useTool("suggest_content", { input: question, answer }, trace, context);
              result = {
                answer,
                targets: suggested?.targets,
                source: "model",
                grounded: true,
              };
            }
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

  // 음성 질문의 관문(E7). 도구와 모델을 부르지 않고 판정만 돌려준다. 거절이면 고정 문장을 함께 준다.
  // grounded 가 false 면 열린 질문도 R-1 이다 - 글 질문의 관문 2(근거 없는 답)와 같은 자리다.
  preflight(input, { grounded = true } = {}) {
    const gate = preflightRoute(input);
    const refusal = gate.route === "open" && grounded === false ? "R-1" : gate.refusal;
    if (!refusal) return gate;
    this.emit("contract_refused", { traceId: 0, refusal, channel: "voice" });
    return Object.freeze({ route: "contract", refusal, answer: SPEECH_CONTRACT_REFUSALS[refusal] });
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

export const docentAgentVersion = "1.2.0";
