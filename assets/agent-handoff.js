/* agent-handoff — 읽던 글을 에이전트에게 넘기는 버튼.
 *
 * 복사되는 것은 글 본문이 아니라 **이 아카이브를 읽는 법을 설치하는 지시문**이다.
 * 에이전트가 규범 없이 읽으면 가려 둔 이름을 되살리거나 하지 않은 말을 만든다.
 * 그래서 스킬 문서와 인용 계약을 먼저 쥐게 하고, 그다음에 이 글을 가리킨다.
 *
 * 포스팅 페이지에만 붙는다. 마크다운 미러(content.md)가 있는 표면이 포스팅뿐이다.
 * 마크업을 페이지마다 두지 않고 여기서 만들어 넣는다 — 글이 늘어도 손댈 곳이 없다.
 *
 * ── 자리 [2026-08-09 본인 지시] ────────────────────────────────────
 *
 * 이 단추는 **포스팅 안이 아니라 그 아래 템플릿 층**에 선다. 글은 편 목록과
 * 귀속 표기에서 끝나고, 그 뒤부터는 이 사이트의 기본 인터페이스다.
 *
 * `.post-tools` 는 페이지에 정적으로 놓여 있고 「시리즈 홈으로」를 이미 담고 있다
 * (스크립트가 없어도 이동은 산다). 이 파일은 그 줄 **맨 앞에 단추만 끼운다.**
 *
 * 설명문과 눌렀을 때의 표시는 **가로 배치를 밀어내지 않는다.**
 *   · 설명 → 툴팁(absolute, 흐름 밖). 손대면 뜨고 초점을 받아도 뜬다.
 *   · 결과 → 단추 글자를 잠깐 바꾼다. 줄이 늘어나지 않는다.
 * 클립보드가 막힌 환경에서만 아래로 펼친다 — 그때는 레이아웃보다 복사가 급하다.
 */
const SITE = new URL("../", import.meta.url).href;
const SKILL_URL = `${SITE}kiheon-blog.SKILL.md`;
const MAP_URL = `${SITE}llms.txt`;
const CONTRACT_URL = `${SITE}agent/citation-contract.json`;
const STATUS_RESET_MS = 4000;

const STYLE = `
.agent-handoff{position:relative;display:flex}
.agent-handoff__btn{inline-size:100%;font:inherit;font-size:var(--meta,.75rem);letter-spacing:.02em;
  padding:.5rem .85rem;border:1px solid currentColor;border-radius:0;
  background:transparent;color:var(--accent,#2457d6);cursor:pointer;
  white-space:nowrap}
.agent-handoff__btn:hover{background:var(--accent,#2457d6);color:var(--canvas,#f3f3ef)}
.agent-handoff__btn:focus-visible{outline:2px solid var(--accent,#2457d6);outline-offset:2px}
/* 툴팁은 흐름 밖에 뜬다 — 두 단추의 가로 배치를 밀지 않는다 */
/* 아래로 연다 — 위로 열면 방금 읽은 귀속 표기를 덮는다 */
.agent-handoff__tip{position:absolute;left:0;top:calc(100% + .5rem);z-index:5;
  inline-size:min(22rem,72vw);margin:0;padding:.6rem .7rem;
  background:var(--canvas,#f3f3ef);border:1px solid var(--rule,rgba(0,0,0,.14));
  font-size:var(--micro,.6875rem);color:var(--ink-muted,#5e6065);line-height:1.6;
  opacity:0;visibility:hidden;transition:opacity .12s ease-out}
.agent-handoff:hover .agent-handoff__tip,
.agent-handoff:focus-within .agent-handoff__tip{opacity:1;visibility:visible}
@media (hover:none){.agent-handoff__tip{display:none}}
.agent-handoff__sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap}
/* 클립보드가 막힌 환경 전용. 그때만 줄이 늘어난다 */
.agent-handoff__fallback{position:absolute;left:0;top:calc(100% + .5rem);z-index:5;
  inline-size:min(34rem,86vw);min-block-size:7rem;
  font-family:var(--font-mono,monospace);font-size:var(--micro,.6875rem);
  padding:.5rem;border:1px solid rgba(0,0,0,.2);border-radius:0;
  background:var(--canvas,#f3f3ef)}
.agent-handoff__fallback[hidden]{display:none}
@media (prefers-color-scheme:dark){
  .agent-handoff__tip,.agent-handoff__fallback{border-color:rgba(255,255,255,.24)}
}`;

function pageUrl() {
  const url = new URL(location.href);
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

function handoffText() {
  const here = pageUrl();
  return [
    "신기헌 발행 아카이브를 읽으려면 먼저 이 스킬을 설치해줘.",
    "",
    "  mkdir -p ~/.claude/skills/kiheon-blog && \\",
    `    curl -fsSL ${SKILL_URL} \\`,
    "    -o ~/.claude/skills/kiheon-blog/SKILL.md",
    "",
    "Codex 라면 ~/.codex/skills/kiheon-blog/SKILL.md 로 받으면 돼.",
    "",
    `설치한 뒤 ${MAP_URL} 부터 읽어줘. 공개 표면 지도야.`,
    `인용하기 전에 ${CONTRACT_URL} 도 확인해줘.`,
    "",
    `지금 보고 있는 글 : ${here}`,
    `이 글의 마크다운 : ${here}content.md`,
  ].join("\n");
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const LABEL = "에이전트용으로 복사";

function render(row) {
  const style = document.createElement("style");
  style.textContent = STYLE;

  const box = document.createElement("div");
  box.className = "agent-handoff";
  box.innerHTML = `
  <button type="button" class="agent-handoff__btn"
    aria-describedby="agent-handoff-tip">${LABEL}</button>
  <p class="agent-handoff__tip" id="agent-handoff-tip" role="tooltip">이 글을
    에이전트에게 넘길 때 쓴다. 본문이 아니라 <a href="${SKILL_URL}">읽는 법</a>과
    <a href="${CONTRACT_URL}">인용 계약</a>을 설치하는 지시문이 복사된다.</p>
  <span class="agent-handoff__sr" role="status" aria-live="polite"></span>
  <textarea class="agent-handoff__fallback" readonly hidden
    aria-label="복사할 지시문"></textarea>`;

  const button = box.querySelector(".agent-handoff__btn");
  const status = box.querySelector(".agent-handoff__sr");
  const fallback = box.querySelector(".agent-handoff__fallback");
  let timer = 0;

  button.addEventListener("click", async () => {
    const text = handoffText();
    clearTimeout(timer);
    if (await copy(text)) {
      // 줄을 늘리지 않는다 — 단추 자신이 결과를 말한다
      button.textContent = "복사했어요";
      status.textContent = "복사했어요. 에이전트에게 붙여 넣으세요.";
      fallback.hidden = true;
      timer = setTimeout(() => {
        button.textContent = LABEL;
        status.textContent = "";
      }, STATUS_RESET_MS);
      return;
    }
    // 클립보드 권한이 없는 환경도 있다. 그때는 직접 고를 수 있게 펼쳐 준다.
    button.textContent = "직접 복사해 주세요";
    status.textContent = "직접 복사해 주세요.";
    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
  });

  row.prepend(box);
  row.append(style);
}

function mount() {
  if (!location.pathname.includes("/posts/")) return;
  // 텍스트 풀버전은 숨김 표면이라 마크다운 미러가 없다. 여기서 단추를 세우면
  // 없는 주소(`…/full/content.md`)를 가리키는 지시문이 복사된다.
  if (/\/full\/?$/.test(location.pathname)) return;
  // 템플릿 층의 도구 줄. 「시리즈 홈으로」가 이미 정적으로 들어 있다.
  const row = document.querySelector(".post-tools");
  if (!row || row.dataset.agentHandoff === "true") return;
  row.dataset.agentHandoff = "true";
  render(row);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
