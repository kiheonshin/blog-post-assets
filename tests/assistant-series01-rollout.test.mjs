import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(repoRoot, file), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const seriesSurfaces = {
  "aigc-creative-paradigm": [
    "series/aigc-creative-paradigm/index.html",
    "series/aigc-creative-paradigm/posts/01-skill-and-effort/index.html",
    "series/aigc-creative-paradigm/posts/02-workflow-design/index.html",
    "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/index.html",
    "series/aigc-creative-paradigm/sources/research/index.html",
    "series/aigc-creative-paradigm/sources/slides/index.html",
  ],
  "newtype-ip-dialogue": [
    "series/newtype-ip-dialogue/index.html",
    "series/newtype-ip-dialogue/posts/01-not-blocking-potential/index.html",
    "series/newtype-ip-dialogue/posts/02-engine-as-ip/index.html",
    "series/newtype-ip-dialogue/posts/03-already-have-the-eye/index.html",
  ],
  "autonomous-worlds": [
    "series/autonomous-worlds/index.html",
    "series/autonomous-worlds/posts/01-engine-city-to-autonomous-world/index.html",
    "series/autonomous-worlds/posts/02-more-than-a-mirror/index.html",
    "series/autonomous-worlds/posts/03-what-we-want-to-create/index.html",
    "series/autonomous-worlds/sources/talk/index.html",
    "series/autonomous-worlds/sources/slides/index.html",
  ],
  "co-creation-culture": [
    "series/co-creation-culture/index.html",
    "series/co-creation-culture/posts/01-whose-creativity/index.html",
    "series/co-creation-culture/posts/02-at-the-boundary/index.html",
    "series/co-creation-culture/posts/03-when-records-become-stories/index.html",
    "series/co-creation-culture/sources/slides-2023-06/index.html",
  ],
  // 2026-10-13 본인 결정(4-나 ① · 6-나 ①) : 2023-11 덱은 08-31 부터 onchain 시리즈 원자료다.
  // 도슨트를 옛 주소 면에서 이 정본 덱 면 하나로 옮겼다(도슨트 실린 면 합 22 그대로).
  // 이 시리즈는 홈에 도슨트를 싣지 않는다 : 홈 단언과 안내 질문 셋 단언은 홈이 실린 시리즈에만 건다.
  "onchain-storytelling": [
    "series/onchain-storytelling/sources/slides-2023-11/index.html",
  ],
};

const homeMounted = (seriesId) =>
  seriesSurfaces[seriesId].includes(`series/${seriesId}/index.html`);

test("every docent surface uses the same xAI Realtime v2 interface", async () => {
  for (const file of Object.values(seriesSurfaces).flat()) {
    const html = await read(file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.css\?v=20261020font1/, file);
    assert.match(html, /assets\/assistant\/voice-assistant-v2\.js\?v=20261013gate1/, file);
    assert.doesNotMatch(html, /assets\/assistant\/voice-assistant\.(?:css|js)/, file);
  }
});

test("all docent series homes keep the wide desktop rail shell", async () => {
  for (const seriesId of Object.keys(seriesSurfaces).filter(homeMounted)) {
    const html = await read(`series/${seriesId}/index.html`);
    assert.match(
      html,
      /<main id="main" class="idx-wide">/,
      `${seriesId}: the series home must reserve the shared docent rail width`,
    );
  }
});

test("the Newtype home keeps every article section in the desktop content column", async () => {
  const html = await read("series/newtype-ip-dialogue/index.html");

  assert.doesNotMatch(
    html,
    /\.idx-grid\{grid-template-columns:minmax\(0,1fr\)\}/,
    "Newtype must not collapse the shared two-column docent grid",
  );
  // 2026-08-25: READING MAP·CONTINUE READING 두 절을 걷었다(본인 확정). 지키려는 것은
  // 그 두 절이 아니라 **글 섹션이 데스크톱 본문 열에 남는다**는 사실이므로, 남은
  // 글 섹션(.about)으로 단언을 옮긴다. 걷어낸 절이 되살아나면 아래 doesNotMatch 가 잡는다.
  assert.match(html, /\.idx-grid > \.about\{grid-column:1;grid-row:2\}/);
  assert.doesNotMatch(html, /class="reading-guide"|class="related"/);
  // 도슨트 조작대는 공유 CSS 가 3행을 가로지른다. 본문 열이 2행이 된 이 시리즈에서만
  // 2행으로 줄여 빈 행이 남지 않게 한다 — 줄이지 않으면 공개문 구분선 위에 행 간격이 뜬다.
  assert.match(
    html,
    /\.idx \.idx-grid > kiheon-voice-assistant\[data-scope="series"\]\{grid-row:1 \/ span 2\}/,
    "Newtype must shrink the shared docent rail to the two rows its content column now has",
  );
});

test("every docent series shares the verified Grok built-in voice runtime", async () => {
  const script = await read("assets/assistant/voice-assistant-v2.js");
  const styles = await read("assets/assistant/voice-assistant-v2.css");
  // 2026-09-01 정본 주소 전환(github.io → kiheon.com)으로 갱신. 바뀐 것은
    // isCanonical 판정의 origin 한 줄뿐이고, 도슨트가 「여기가 정본인가」를 묻는
    // 자리라 정본이 옮겨가면 함께 옮겨야 한다. 나머지 단언이 내용 불변을 지킨다.
    // 2026-09-06 C31(미접지 구멍) 배선으로 갱신. groundedEntries() 를 갈라내고,
    // 근거가 없으면 groundedInput 이 빈 문자열을 돌려주며, 문맥 도구가 grounded 를
    // 신고한다. 아래 단언과 assistant-voice.test.mjs 의 C31 검사가 내용을 지킨다.
    // 2026-10-13 토큰 주소 끝 빗금 고침으로 갱신. 바뀐 것은 전송 모듈의 캐시 판 한 줄뿐이다
    // (주소는 xai-voice-transport.js 에서 고치고 xai-token-endpoint-slash.test.mjs 가 지킨다).
    // 같은 날 2b01e7d(08-05 음성 인식 다듬기) 옮겨 심기로 다시 갱신 : keyterm 묶음 · 현재 위치 오염 막기 ·
    // 상태 문구 · 전송 모듈 캐시 판. assistant-voice.test.mjs 의 두 시험이 내용을 지킨다.
    // 같은 날 독립 검수 반영으로 다시 갱신 : 한 발화의 최종 말풍선을 기억(뒤늦은 최종은 글자만 고침 · 정지 뒤 최종이
    // 없으면 들은 글자를 질문으로 남김) · 연결 중 · 듣는 중 문구. voice-utterance-bubbles.test.mjs 가 지킨다.
    // 2026-10-13 E7 · D108 로 다시 갱신 : 음성 질문이 글 질문과 같은 관문을 지난다(최종 전사를 DocentAgent.preflight 에
    // 걸어 거절 · 되묻기 · 라벨이 맞는 준비된 답은 force_message 로 그대로 읽고, 서버 자동 응답은 그 문장이 끊는다) ·
    // 콘텐츠 면 근거에 시리즈 구성(허가 항목의 제목 · 편 번호 · 한 줄 설명과 시리즈 첫 화면 안내)을 더함 · 전송 · 판정 모듈 캐시 판.
    // voice-question-gate.test.mjs · docent-agent.test.mjs · assistant-voice.test.mjs 의 D108 두 시험이 내용을 지킨다.
    assert.equal(sha256(script), "e73ef1aa8b908ac6db83ee6ba4d7c03d8fe645a39bb2a745ef5059e327e56a72");
  // 2026-10-20 글꼴 한 벌(본인 10-18)로 갱신 : var() 기본값의 옛 꼴(Iowan · SFMono · -apple-system)을 Life Universe Sans · Mono 로.
  // 바뀐 것은 기본값 셋뿐이고 tests/fonts.test.mjs 가 옛 꼴 0 을 지킨다.
  assert.equal(sha256(styles), "db44da1089190bc31ac2eee73acfa2b311635c9b86a5aa00c9f4e16801b689d5");
  assert.match(script, /data-assistant-open-voice/);
  assert.match(script, /voiceSessionActive/);
  assert.match(script, /data-assistant-transcript-details/);
  assert.match(script, /xai-voice-transport\.js\?v=20261013gate1/);
  assert.match(script, /GROK_BUILT_IN_VOICES/);
  // 2026-08-25 본인 확정 명칭 — 「도슨트 에이전트」. 원자료면도 같은 라벨을 쓰고
  // 대상 구분은 부제가 한다. 이 단언은 배포되는 v2 위에 걸린다.
  assert.match(script, /return "도슨트 에이전트";/);
  assert.doesNotMatch(script, /이 글 안내|이 자료 안내/);
  assert.match(script, /목소리로 대답하는 에이전트입니다\. 글의 흐름과 지금 읽는 대목을 짚어 드립니다\./);
  assert.match(script, /목소리로 대답하는 에이전트입니다\. 이 자료의 흐름과 지금 읽는 대목을 짚어 드립니다\./);
  assert.match(script, />말 걸기<\/button>/);
  assert.match(script, /\["Ara", "따뜻하고 자연스러운 대화"\]/);
  assert.doesNotMatch(script, /신기헌 보이스|kiheon-custom/);
  assert.match(script, /신기헌 본인이 아닙니다/);
  assert.doesNotMatch(script, /speechSynthesis|SpeechRecognition|webkitSpeechRecognition/);
  assert.doesNotMatch(script, /data-assistant-reset/);
  assert.match(styles, /voice-assistant__voice-stage/);
  assert.match(styles, /voice-assistant__voice-session/);
  assert.equal((script.match(/class="voice-assistant__voice-ring"/g) ?? []).length, 1);
  assert.match(script, /event\.type === "input_level"/);
  assert.match(script, /--voice-ring-scale/);
  assert.doesNotMatch(styles, /voice-assistant__voice-ring:nth-child/);
  assert.match(styles, /voice-assistant-ring-turn/);
  assert.match(styles, /voice-assistant-ring-speak/);
});

test("every docent context stays bound to its exact public surfaces", async () => {
  for (const seriesId of Object.keys(seriesSurfaces)) {
    const context = JSON.parse(await read(`series/${seriesId}/assistant/context.json`));
    if (homeMounted(seriesId)) assert.equal(context.docent.quickPrompts.length, 3, seriesId);
    for (const entry of context.entries) {
      const html = await read(`${entry.url}/index.html`);
      assert.equal(entry.contentHash, `sha256:${sha256(html)}`, entry.contentId);
    }
  }
});

// 22 = 이 파일이 세는 도슨트 시리즈의 표면 수(2026-10-13 부터 다섯 시리즈 · 2023-11 덱 면이
// co-creation 에서 onchain 으로 옮겨 가 합은 그대로다). 자율 세계의 「발표 원고」는 발표 자료와
// 내용이 겹쳐 2026-08-07 에 내렸다(본인 지시) — 그때 매니페스트·도슨트 팩·표면 상수는
// 고쳤는데 이 파일을 빠뜨려 네 건이 계속 붉었다.
test("the manifest publishes every docent context and their 22 surfaces", async () => {
  const manifest = await read("assets/content-manifest.js");
  for (const [seriesId, surfaces] of Object.entries(seriesSurfaces)) {
    const start = manifest.indexOf(`slug: "${seriesId}"`);
    const nextStart = manifest.indexOf("\n    {", start + 1);
    const block = manifest.slice(start, nextStart === -1 ? undefined : nextStart);
    assert.match(block, /status:\s*"ready"/, seriesId);
    assert.equal((block.match(new RegExp(`${seriesId}:(?:series|post|source):`, "g")) ?? []).length, surfaces.length, seriesId);
  }
});

// 색인에 아직 안 실린 채 준비만 되어 있는 도슨트 팩. `seriesSurfaces` 와 달리
// **해시 대조만 하고 색인 탑재는 요구하지 않는다**(아틀라스 판정 2026-09-06 · C27).
//
// 왜 갈라 두나 : `series/life-universe/assistant/context.json` 은 08-13 에 만들어져 09-01
// 까지 갱신됐는데 그 시리즈 색인은 `voice-assistant-v2` 를 한 번도 싣지 않았다. 위의 해시
// 계약은 `seriesSurfaces` 넷만 돌아 이 파일이 검사 밖에 있었고, 페이지가 바뀌어도 아무
// 데서도 붉어지지 않았다. 지우지 않고 계약 안에 넣어 조용히 썩는 것을 막는다.
// 켜는 것(색인에 도슨트 탑재)은 공개면 변화라 본인 게이트다.
const preparedPacks = {
  "life-universe": [
    "series/life-universe/posts/01-result",
    "series/life-universe/posts/02-structure",
    "series/life-universe/posts/03-boundary",
    "series/life-universe/sources/universe-intro",
  ],
};

test("prepared docent packs keep their page hashes current", async () => {
  for (const [seriesId, surfaces] of Object.entries(preparedPacks)) {
    const context = JSON.parse(await read(`series/${seriesId}/assistant/context.json`));
    assert.deepEqual(context.entries.map((entry) => entry.url.replace(/\/$/, "")), surfaces, seriesId);
    for (const entry of context.entries) {
      const html = await read(`${entry.url}/index.html`);
      assert.equal(entry.contentHash, `sha256:${sha256(html)}`, entry.contentId);
    }
  }
});

// 도슨트 컨텍스트는 둘 중 하나여야 한다 — 살아 있는 팩(`seriesSurfaces`)이거나 준비된
// 팩(`preparedPacks`)이거나. 어느 목록에도 없는 컨텍스트는 아무도 안 보는 파일이 된다.
test("every docent context is either live or a declared prepared pack", async () => {
  const declared = new Set([...Object.keys(seriesSurfaces), ...Object.keys(preparedPacks)]);
  const undeclared = [];
  for (const entry of await readdir(path.join(repoRoot, "series"), { withFileTypes: true })) {
    if (!entry.isDirectory() || declared.has(entry.name)) continue;
    try {
      await read(`series/${entry.name}/assistant/context.json`);
    } catch {
      continue;                       // 컨텍스트가 없으면 선언할 것도 없다
    }
    undeclared.push(entry.name);
  }
  assert.deepEqual(undeclared, []);
});
