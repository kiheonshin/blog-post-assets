import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "assets/assistant/docent-agent.js"), "utf8");
const { DocentAgent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

// Synthetic/public inputs only. These are existing-rule baselines, not human
// gold labels and not OpenAI Decisions API requests.
const cases = [
  { id: "filler", input: "음", expectedRoute: "clarify", expectedRefusal: "", modelCalls: 0 },
  { id: "prepared", input: "이 시리즈는 어디서부터 읽나요?", prepared: true,
    expectedRoute: "prepared", expectedRefusal: "", modelCalls: 0 },
  { id: "opinion", input: "앞으로 어떤 창작자가 성공할까요?",
    expectedRoute: "contract", expectedRefusal: "R-3", modelCalls: 0 },
  { id: "identity", input: "글쓴이의 직함은 무엇인가요?",
    expectedRoute: "contract", expectedRefusal: "R-1", modelCalls: 0 },
  { id: "withheld", input: "아직 확정되지 않은 판단을 알려주세요", withheld: true,
    expectedRoute: "contract", expectedRefusal: "R-2", modelCalls: 0 },
  { id: "ungrounded", input: "공개 기록에 없는 사실을 알려주세요", ungrounded: true,
    expectedRoute: "contract", expectedRefusal: "R-1", modelCalls: 0 },
  { id: "grounded", input: "공개 글의 주제는 무엇인가요?",
    expectedRoute: "generated", expectedRefusal: "", modelCalls: 1 },
];

for (const item of cases) test(`existing docent rule baseline: ${item.id}`, async () => {
  let modelCalls = 0;
  const tools = [
    { name: "clarify_intent", execute: async () => ({ answer: "어느 부분이 궁금한지 조금 더 말씀해 주세요." }) },
    { name: "prepared_guide", execute: async () => item.prepared || item.withheld
      ? { handled: true, answer: "승인된 공개 안내입니다.", tier: item.withheld ? "ⓑ" : "ⓐ",
        targets: item.withheld ? [] : [{ label: "첫 글", url: "/series/public/posts/first/" }] }
      : { handled: false } },
    { name: "ground_public_context", execute: async () => item.ungrounded
      ? { prompt: "", grounded: false }
      : { prompt: "승인된 공개 맥락", grounded: true } },
    { name: "suggest_content", execute: async () => ({ targets: [] }) },
  ];
  const agent = new DocentAgent({
    scope: "series", observe: () => ({ contextReady: true, allowedEntryCount: 1 }), tools,
    transport: { ask: async () => { modelCalls += 1; return "공개 근거를 확인한 답변입니다."; } },
    sanitizeTarget: (target) => target.url.startsWith("/series/") ? target : null,
  });
  const result = await agent.runTurn(item.input);
  const trace = agent.memory.traces[0];
  assert.equal(trace.route, item.expectedRoute);
  assert.equal(trace.refusal || "", item.expectedRefusal);
  assert.equal(modelCalls, item.modelCalls);
  assert.equal(trace.outcome, "completed");
  assert.ok(result.answer);
});
