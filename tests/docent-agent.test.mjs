import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentPath = path.join(repoRoot, "assets", "assistant", "docent-agent.js");

async function loadAgentModule() {
  const source = await readFile(agentPath, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function standardTools(overrides = {}) {
  const implementations = {
    clarify_intent: async () => ({ answer: "네, 듣고 있어요. 무엇이 궁금한지 조금만 더 말씀해 주세요." }),
    prepared_guide: async () => ({ handled: false }),
    ground_public_context: async ({ input }) => ({ prompt: `공개문맥:${input}` }),
    suggest_content: async () => ({ targets: [] }),
    ...overrides,
  };
  return Object.entries(implementations).map(([name, execute]) => ({ name, execute }));
}

test("low-signal turns use a clarification tool without calling the model", async () => {
  const { DocentAgent } = await loadAgentModule();
  const events = [];
  let modelCalls = 0;
  const agent = new DocentAgent({
    scope: "series",
    transport: { ask: async () => { modelCalls += 1; } },
    tools: standardTools(),
    onEvent: (event) => events.push(event.type),
  });

  const result = await agent.runTurn("아아");
  assert.equal(modelCalls, 0);
  assert.equal(result.source, "tool");
  assert.match(result.answer, /무엇이 궁금한지/);
  assert.deepEqual(agent.memory.turns.map(({ role }) => role), ["사용자", "도슨트"]);
  assert.deepEqual(agent.memory.traces[0], {
    id: 1,
    route: "clarify",
    tools: ["clarify_intent"],
    outcome: "completed",
    targetCount: 0,
  });
  assert.deepEqual(events, [
    "turn_started",
    "observed",
    "tool_started",
    "tool_completed",
    "verification_started",
    "turn_completed",
  ]);
});

test("approved prepared guidance completes inside the tool loop", async () => {
  const { DocentAgent } = await loadAgentModule();
  let modelCalls = 0;
  const agent = new DocentAgent({
    transport: { ask: async () => { modelCalls += 1; } },
    tools: standardTools({
      prepared_guide: async () => ({
        handled: true,
        answer: "세 편은 가치, 작업 방식, 세계의 경계 순서로 이어집니다.",
        targets: [{ label: "첫 글", url: "/series/first/" }],
      }),
    }),
    sanitizeTarget: (target) => target.url.startsWith("/series/") ? target : null,
  });

  const result = await agent.runTurn("세 편은 어떻게 이어지나요?");
  assert.equal(modelCalls, 0);
  assert.equal(result.source, "prepared");
  assert.deepEqual(result.targets, [{ label: "첫 글", url: "/series/first/" }]);
  assert.deepEqual(agent.memory.traces[0].tools, ["prepared_guide"]);
});

test("generated turns observe, ground, call the model, suggest, and verify in order", async () => {
  const { DocentAgent } = await loadAgentModule();
  const events = [];
  const prompts = [];
  const agent = new DocentAgent({
    scope: "series",
    observe: () => ({ contextReady: true, allowedEntryCount: 5 }),
    transport: {
      ask: async (prompt) => {
        prompts.push(prompt);
        return "첫 글에서 가치의 질문을 확인한 뒤 두 번째 글의 작업 방식으로 넘어가세요.";
      },
    },
    tools: standardTools({
      suggest_content: async () => ({
        targets: [
          { label: "첫 글", url: "/series/first/" },
          { label: "중복", url: "/series/first/" },
          { label: "외부", url: "https://example.com/private" },
        ],
      }),
    }),
    sanitizeTarget: (target) => target.url.startsWith("/series/") ? target : null,
    onEvent: (event) => events.push(`${event.type}:${event.tool ?? ""}`),
  });

  const result = await agent.runTurn("어떤 순서로 읽는 게 좋아요?");
  assert.deepEqual(prompts, ["공개문맥:어떤 순서로 읽는 게 좋아요?"]);
  assert.equal(result.source, "model");
  assert.deepEqual(result.targets, [{ label: "첫 글", url: "/series/first/" }]);
  assert.deepEqual(agent.memory.traces[0].tools, [
    "prepared_guide",
    "ground_public_context",
    "suggest_content",
  ]);
  assert.deepEqual(events, [
    "turn_started:",
    "observed:",
    "tool_started:prepared_guide",
    "tool_completed:prepared_guide",
    "tool_started:ground_public_context",
    "tool_completed:ground_public_context",
    "model_started:",
    "model_completed:",
    "tool_started:suggest_content",
    "tool_completed:suggest_content",
    "verification_started:",
    "turn_completed:",
  ]);
});

test("missing public context fails closed before the model", async () => {
  const { DocentAgent } = await loadAgentModule();
  let modelCalls = 0;
  const agent = new DocentAgent({
    transport: { ask: async () => { modelCalls += 1; } },
    tools: standardTools({
      ground_public_context: async () => ({ prompt: "" }),
    }),
  });

  await assert.rejects(
    agent.runTurn("이 글을 설명해 주세요"),
    (error) => error.code === "context_unavailable",
  );
  assert.equal(modelCalls, 0);
  assert.equal(agent.memory.turns.length, 0);
  assert.equal(agent.memory.traces[0].outcome, "failed");
  assert.equal(Object.hasOwn(agent.memory.traces[0], "input"), false);
});

// ── 발화 계약 v1 통과 판정 (명세 §4) ──────────────────────────────────────
// 고정 문자열은 `_T3-발화계약-v1-초안-20260720.md` §2.5.2 정본과 자구가 같아야 한다.
// 테스트가 문자열을 다시 적지 않고 모듈이 내보내는 상수를 쓴다 — 손으로 옮기면 드리프트한다.

test("T-01a 직함 질의는 R-1 고정 문자열을 자구 그대로 낸다", async () => {
  const { DocentAgent, SPEECH_CONTRACT_REFUSALS } = await loadAgentModule();
  let modelCalls = 0;
  const agent = new DocentAgent({
    transport: { ask: async () => { modelCalls += 1; return "VC라는 직을 맡고 있습니다."; } },
    tools: standardTools(),
  });

  const result = await agent.runTurn("직함이 어떻게 되세요?");
  assert.equal(result.answer, SPEECH_CONTRACT_REFUSALS["R-1"]);
  assert.equal(result.refusal, "R-1");
  assert.equal(modelCalls, 0);
  assert.deepEqual(result.targets, []);
  // 거절 안에 사실 요소를 넣지 않는다 — 변명하려고 이력을 삽입하는 것이 실측된 누출이다
  assert.doesNotMatch(result.answer, /직함|직책|소속|VC|대표|디렉터/);
  assert.equal(agent.memory.traces[0].refusal, "R-1");
});

test("T-01b 자기소개 요청은 ⓐ 원천 밖 신규 문자열을 만들지 않는다", async () => {
  const { DocentAgent, SPEECH_CONTRACT_REFUSALS } = await loadAgentModule();
  const agent = new DocentAgent({
    transport: { ask: async () => "저는 블록체인 업계에서 일해 온 크리에이티브 디렉터입니다." },
    tools: standardTools(),
  });

  // 자기소개 요청은 관문 1 에서 막는다 — ⓐ 원천에 직함·소속 문자열이 없기 때문이고,
  // RUN17 의 "VC라는 직" 날조가 바로 이 질의에서 나왔다.
  const result = await agent.runTurn("본인 소개를 해 주세요");
  assert.equal(result.answer, SPEECH_CONTRACT_REFUSALS["R-1"]);
  assert.equal(result.refusal, "R-1");
  assert.deepEqual(agent.memory.traces[0].tools, []);
  // 모델이 지어낸 문장은 한 조각도 나가지 않는다
  assert.doesNotMatch(result.answer, /블록체인|디렉터|업계/);
  assert.equal(agent.memory.turns.at(-1).text, SPEECH_CONTRACT_REFUSALS["R-1"]);
});

test("시리즈 소개 요청은 자기소개 규칙에 걸리지 않는다", async () => {
  const { DocentAgent } = await loadAgentModule();
  const agent = new DocentAgent({
    transport: { ask: async () => "세 편이 가치, 방식, 경계 순서로 이어집니다." },
    tools: standardTools(),
  });

  const result = await agent.runTurn("이 시리즈를 소개해 주세요");
  assert.equal(result.source, "model");
  assert.equal(result.refusal, undefined);
});

test("T-02 의견·미래·타인 평가 질의는 R-3 이고 근거 탐색 흔적이 없다", async () => {
  const { DocentAgent, SPEECH_CONTRACT_REFUSALS } = await loadAgentModule();
  for (const question of [
    "이 흐름을 어떻게 생각하세요?",
    "앞으로 이 분야는 어떻게 될까요?",
    "그 사람 어떤가요?",
  ]) {
    let modelCalls = 0;
    const agent = new DocentAgent({
      transport: { ask: async () => { modelCalls += 1; return "제 생각에는요,"; } },
      tools: standardTools(),
    });

    const result = await agent.runTurn(question);
    assert.equal(result.answer, SPEECH_CONTRACT_REFUSALS["R-3"], question);
    assert.equal(result.refusal, "R-3", question);
    assert.equal(modelCalls, 0, question);
    // 근거 탐색 흔적조차 없어야 한다 — 찾다가 지어내는 경로를 막는 것이 목적이다
    assert.deepEqual(agent.memory.traces[0].tools, [], question);
    assert.equal(agent.memory.traces[0].route, "contract", question);
  }
});

test("계약 거절은 침묵하지 않고 판정을 검증 결과에 남긴다", async () => {
  const { DocentAgent, SPEECH_CONTRACT_REFUSALS } = await loadAgentModule();
  const events = [];
  const agent = new DocentAgent({
    transport: { ask: async () => "사용되지 않음" },
    tools: standardTools(),
    onEvent: (event) => events.push(event.type),
  });

  const result = await agent.runTurn("어떻게 생각하세요?");
  assert.equal(result.answer, SPEECH_CONTRACT_REFUSALS["R-3"]);
  assert.equal(result.verification.contract, "v1");
  assert.equal(result.verification.refusal, "R-3");
  assert.ok(events.includes("contract_refused"));
  // 무응답도 위반이다 — 거절은 반드시 발화로 나간다
  assert.deepEqual(agent.memory.turns.map(({ role }) => role), ["사용자", "도슨트"]);
});

test("근거가 붙은 일반 질의는 계약이 가로막지 않는다", async () => {
  const { DocentAgent } = await loadAgentModule();
  const agent = new DocentAgent({
    transport: { ask: async () => "첫 글에서 가치의 질문을 먼저 확인하세요." },
    tools: standardTools(),
  });

  const result = await agent.runTurn("어떤 순서로 읽는 게 좋아요?");
  assert.equal(result.source, "model");
  assert.equal(result.refusal, undefined);
  assert.match(result.answer, /가치의 질문/);
});

test("reset removes conversational and procedural session memory", async () => {
  const { DocentAgent } = await loadAgentModule();
  const agent = new DocentAgent({
    transport: { ask: async () => "사용되지 않음" },
    tools: standardTools(),
  });

  await agent.runTurn("음");
  assert.equal(agent.snapshot().memory.turns.length, 2);
  assert.equal(agent.snapshot().memory.traces.length, 1);
  agent.reset();
  assert.deepEqual(agent.snapshot().memory, { turns: [], traces: [] });
});
