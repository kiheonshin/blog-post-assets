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
