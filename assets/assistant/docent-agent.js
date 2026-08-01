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

      if (observation.lowSignal) {
        trace.route = "clarify";
        result = await this.useTool("clarify_intent", { input: question }, trace, context);
      } else {
        const prepared = await this.useTool("prepared_guide", { input: question }, trace, context);
        if (prepared?.handled) {
          trace.route = "prepared";
          result = { ...prepared, source: "prepared" };
        } else {
          trace.route = "generated";
          const grounding = await this.useTool("ground_public_context", { input: question }, trace, context);
          const prompt = cleanText(grounding?.prompt);
          if (!prompt) throw agentError("context_unavailable");
          this.memory.remember("사용자", question);
          this.emit("model_started", { traceId: trace.id });
          const answer = await this.transport.ask(prompt, { signal });
          this.emit("model_completed", { traceId: trace.id });
          const suggested = await this.useTool("suggest_content", { input: question, answer }, trace, context);
          result = { answer, targets: suggested?.targets, source: "model" };
        }
      }

      this.emit("verification_started", { traceId: trace.id });
      const verified = this.verifiedResult(result);
      this.memory.remember("사용자", question);
      this.memory.remember("도슨트", verified.answer);
      trace.outcome = "completed";
      this.memory.recordTrace({
        id: trace.id,
        route: trace.route,
        tools: [...trace.tools],
        outcome: trace.outcome,
        targetCount: verified.targets.length,
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

export const docentAgentVersion = "1.0.0";
