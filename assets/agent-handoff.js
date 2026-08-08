/* agent-handoff — 읽던 글을 에이전트에게 넘기는 버튼.
 *
 * 복사되는 것은 글 본문이 아니라 **이 아카이브를 읽는 법을 설치하는 지시문**이다.
 * 에이전트가 규범 없이 읽으면 가려 둔 이름을 되살리거나 하지 않은 말을 만든다.
 * 그래서 스킬 문서와 인용 계약을 먼저 쥐게 하고, 그다음에 이 글을 가리킨다.
 *
 * 포스팅 페이지에만 붙는다. 마크다운 미러(content.md)가 있는 표면이 포스팅뿐이다.
 * 마크업을 페이지마다 두지 않고 여기서 만들어 넣는다 — 글이 늘어도 손댈 곳이 없다.
 */
const SITE = new URL("../", import.meta.url).href;
const SKILL_URL = `${SITE}kiheon-blog.SKILL.md`;
const MAP_URL = `${SITE}llms.txt`;
const CONTRACT_URL = `${SITE}agent/citation-contract.json`;
const STATUS_RESET_MS = 4000;

const STYLE = `
.agent-handoff{margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid var(--rule,rgba(0,0,0,.1))}
/* 지정된 슬롯에 설 때는 자기 선을 긋지 않는다. 여백은 슬롯이 준다 */
.agent-handoff--tight{margin-top:0;padding-top:0;border-top:0}
.agent-handoff__row{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem}
.agent-handoff__btn{font:inherit;font-size:var(--meta,.75rem);letter-spacing:.02em;
  padding:.5rem .85rem;border:1px solid currentColor;border-radius:2px;
  background:transparent;color:var(--accent,#2457d6);cursor:pointer}
.agent-handoff__btn:hover{background:var(--accent,#2457d6);color:var(--canvas,#f3f3ef)}
.agent-handoff__btn:focus-visible{outline:2px solid var(--accent,#2457d6);outline-offset:2px}
.agent-handoff__status{font-size:var(--micro,.6875rem);color:var(--ink-muted,#5e6065)}
.agent-handoff__note{margin:.6rem 0 0;font-size:var(--micro,.6875rem);
  color:var(--ink-faint,#686a6f);line-height:1.6}
.agent-handoff__fallback{display:block;width:100%;margin-top:.6rem;min-height:7rem;
  font-family:var(--font-mono,monospace);font-size:var(--micro,.6875rem);
  padding:.5rem;border:1px solid rgba(0,0,0,.2);border-radius:2px}
.agent-handoff__fallback[hidden]{display:none}
@media (prefers-color-scheme:dark){
  .agent-handoff{border-top-color:var(--rule,rgba(255,255,255,.14))}
  .agent-handoff__fallback{border-color:rgba(255,255,255,.24)}
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

function render(mount, tight) {
  const style = document.createElement("style");
  style.textContent = STYLE;

  const box = document.createElement("div");
  box.className = tight ? "agent-handoff agent-handoff--tight" : "agent-handoff";
  box.innerHTML = `
  <div class="agent-handoff__row">
    <button type="button" class="agent-handoff__btn">에이전트용으로 복사</button>
    <span class="agent-handoff__status" role="status" aria-live="polite"></span>
  </div>
  <p class="agent-handoff__note">이 글을 에이전트에게 넘길 때 쓴다. 본문이 아니라
    <a href="${SKILL_URL}">읽는 법</a>과 <a href="${CONTRACT_URL}">인용 계약</a>을
    설치하는 지시문이 복사된다.</p>
  <textarea class="agent-handoff__fallback" readonly hidden
    aria-label="복사할 지시문"></textarea>`;

  const button = box.querySelector(".agent-handoff__btn");
  const status = box.querySelector(".agent-handoff__status");
  const fallback = box.querySelector(".agent-handoff__fallback");
  let timer = 0;

  button.addEventListener("click", async () => {
    const text = handoffText();
    clearTimeout(timer);
    if (await copy(text)) {
      status.textContent = "복사했어요. 에이전트에게 붙여 넣으세요.";
      fallback.hidden = true;
      timer = setTimeout(() => { status.textContent = ""; }, STATUS_RESET_MS);
      return;
    }
    // 클립보드 권한이 없는 환경도 있다. 그때는 직접 고를 수 있게 펼쳐 준다.
    status.textContent = "직접 복사해 주세요.";
    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
  });

  mount.append(style, box);
}

function mount() {
  if (!location.pathname.includes("/posts/")) return;
  const foot = document.querySelector("footer.foot");
  if (!foot || foot.dataset.agentHandoff === "true") return;
  foot.dataset.agentHandoff = "true";
  // 자리가 지정된 면에서는 **본문 끝 슬롯**에 선다(2026-08-09 본인 지시).
  // 읽기를 막 끝낸 자리이고, 바로 아래 말미의 가로선이 구분선 노릇을 하므로
  // 이 단추는 자기 선을 긋지 않는다. 슬롯이 없는 옛 면에서는 말미 끝에 붙는다.
  const slot = document.querySelector(".handoff-slot");
  render(slot || foot, Boolean(slot));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
