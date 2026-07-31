export const contentLibrary = {
  series: [
    {
      slug: "aigc-creative-paradigm",
      label: "AIGC Notes",
      title: "AI 시대, 창작의 정의를 다시 묻다",
      description:
        "2025년 11월 발표와 연구 노트, 그리고 몇 달 지나 다시 쓴 포스팅 세 개.",
      period: "2025–2026",
      sourceYears: [2025],
      topics: ["AI와 창작", "창작 도구", "가상 세계"],
      keywords: ["AIGC", "생성 AI", "워크플로", "월드 모델", "월드 스킨"],
      href: "series/aigc-creative-paradigm/",
      cover: "series/aigc-creative-paradigm/assets/series-banner.jpg",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      assistantContext: {
        path: "series/aigc-creative-paradigm/assistant/context.json",
        status: "ready",
        pilotSurfaceIds: [
          "aigc-creative-paradigm:series:aigc-creative-paradigm",
          "aigc-creative-paradigm:post:01-skill-and-effort",
          "aigc-creative-paradigm:post:02-workflow-design",
          "aigc-creative-paradigm:post:03-reality-virtual-boundary",
          "aigc-creative-paradigm:source:research",
          "aigc-creative-paradigm:source:slides",
        ],
      },
      posts: [
        {
          id: "01-skill-and-effort",
          label: "포스팅 1",
          title: "실력과 노력의 가치는 어디로 가는가",
          published: "2026-07-22",
          sourceYears: [2025],
          topics: ["AI와 창작", "창작 문화"],
          keywords: ["생성 AI", "실력", "노력", "진정성"],
          href: "series/aigc-creative-paradigm/posts/01-skill-and-effort/",
        },
        {
          id: "02-workflow-design",
          label: "포스팅 2",
          title: "프롬프트를 넘어, 작업의 흐름을 설계하는 일",
          published: "2026-07-22",
          sourceYears: [2025],
          topics: ["AI와 창작", "창작 도구"],
          keywords: ["워크플로", "프롬프트", "멀티모달", "디렉션"],
          href: "series/aigc-creative-paradigm/posts/02-workflow-design/",
        },
        {
          id: "03-reality-virtual-boundary",
          label: "포스팅 3",
          title: "현실과 가상의 경계면에서",
          published: "2026-07-22",
          sourceYears: [2025],
          topics: ["가상 세계", "AI와 창작"],
          keywords: ["월드 모델", "월드 스킨", "현실과 가상", "월드 엔진"],
          href: "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/",
        },
      ],
      sources: [
        {
          id: "research",
          label: "SOURCE · 연구 노트",
          title: "AI 시대의 예술, 인간 고유의 창의성이란 무엇인가",
          description: "2025.09.09 · 발표의 바탕이 된 사전 조사 전문",
          published: "2025-09-09",
          sourceYears: [2025],
          topics: ["AI와 창작", "창작 문화"],
          keywords: ["창의성", "예술", "연구", "생성 AI"],
          href: "series/aigc-creative-paradigm/sources/research/",
        },
        {
          id: "slides",
          label: "SOURCE · 발표 자료",
          title: "AIGC 시장 트렌드 및 창작자 패러다임의 변화",
          description: "2025.11.21 · 슬라이드 162장과 발표 중 재생한 영상 59개",
          published: "2025-11-21",
          sourceYears: [2025],
          topics: ["AI와 창작", "창작 도구", "가상 세계"],
          keywords: ["AIGC", "생성 AI", "월드 모델", "워크플로"],
          href: "series/aigc-creative-paradigm/sources/slides/",
        },
      ],
    },
    {
      slug: "newtype-ip-dialogue",
      label: "Newtype Summit",
      title: "AI를 가로막지 않을수록 선명해지는 창작자의 자리",
      description:
        "2026년 6월 뉴타입 엔터 서밋 대담을 1인칭으로 다시 정리한 포스팅 세 개.",
      period: "2026",
      sourceYears: [2026],
      topics: ["AI와 창작", "IP와 정체성", "공동 창작"],
      keywords: ["AI 협업", "엔진 IP", "취향", "창작자"],
      href: "series/newtype-ip-dialogue/",
      cover: "series/newtype-ip-dialogue/assets/series-banner.jpg",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      assistantContext: {
        path: "series/newtype-ip-dialogue/assistant/context.json",
        status: "planned",
        pilotSurfaceIds: [],
      },
      posts: [
        {
          id: "01-not-blocking-potential",
          label: "포스팅 1",
          title: "AI가 가진 잠재력을 가로막지 않을 때 협업이 시작된다",
          published: "2026-07-25",
          sourceYears: [2026],
          topics: ["AI와 창작", "공동 창작"],
          keywords: ["AI 협업", "잠재력", "공동 창작"],
          href: "series/newtype-ip-dialogue/posts/01-not-blocking-potential/",
        },
        {
          id: "02-engine-as-ip",
          label: "포스팅 2",
          title:
            "한 번 쓰고 버리는 시대에 남는 IP는 결과물이 아니라 취향을 재현하는 엔진이다",
          published: "2026-07-25",
          sourceYears: [2026],
          topics: ["IP와 정체성", "AI와 창작"],
          keywords: ["엔진 IP", "취향", "재현", "IP"],
          href: "series/newtype-ip-dialogue/posts/02-engine-as-ip/",
        },
        {
          id: "03-already-have-the-eye",
          label: "포스팅 3",
          title: "AI를 다르게 보는 눈은 새 기술이 아니라 창작자가 원래 가진 능력이다",
          published: "2026-07-25",
          sourceYears: [2026],
          topics: ["AI와 창작", "창작 문화"],
          keywords: ["안목", "창작자", "판단", "기술"],
          href: "series/newtype-ip-dialogue/posts/03-already-have-the-eye/",
        },
      ],
      // 대담 원문 스크립트는 공개하지 않는다 — 이 시리즈에 바탕 자료 페이지는 없다
      sources: [],
    },
    {
      slug: "autonomous-worlds",
      label: "Autonomous Worlds",
      title: "자율 세계, 스스로 규칙을 만드는 세계의 등장",
      description:
        "2024년 여름 부천 발표와 그 바탕 자료, 그리고 2년 지나 다시 쓴 포스팅 세 개.",
      period: "2024–2026",
      sourceYears: [2024],
      topics: ["가상 세계", "AI와 창작", "창작 문화"],
      keywords: ["자율 세계", "게임 엔진", "AI 에이전트", "블록체인"],
      href: "series/autonomous-worlds/",
      cover: "series/autonomous-worlds/assets/series-banner.jpg",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      assistantContext: {
        path: "series/autonomous-worlds/assistant/context.json",
        status: "ready",
        pilotSurfaceIds: [
          "autonomous-worlds:series:autonomous-worlds",
          "autonomous-worlds:post:01-engine-city-to-autonomous-world",
          "autonomous-worlds:post:02-more-than-a-mirror",
          "autonomous-worlds:post:03-what-we-want-to-create",
          "autonomous-worlds:source:talk",
          "autonomous-worlds:source:script",
          "autonomous-worlds:source:slides",
        ],
      },
      posts: [
        {
          id: "01-engine-city-to-autonomous-world",
          label: "포스팅 1",
          title: "게임 엔진의 도시에서 자율 세계까지",
          published: "2026-07-26",
          sourceYears: [2024],
          topics: ["가상 세계", "AI와 창작"],
          keywords: ["게임 엔진", "자율 세계", "AI 에이전트"],
          href: "series/autonomous-worlds/posts/01-engine-city-to-autonomous-world/",
        },
        {
          id: "02-more-than-a-mirror",
          label: "포스팅 2",
          title: "가상 세계는 더 이상 현실의 보조 수단이 아니다",
          published: "2026-07-26",
          sourceYears: [2024],
          topics: ["가상 세계", "IP와 정체성"],
          keywords: ["현실과 가상", "디지털 트윈", "가상 경제"],
          href: "series/autonomous-worlds/posts/02-more-than-a-mirror/",
        },
        {
          id: "03-what-we-want-to-create",
          label: "포스팅 3",
          title: "무엇을 창조하는 존재이고 싶은가",
          published: "2026-07-26",
          sourceYears: [2024],
          topics: ["창작 문화", "가상 세계"],
          keywords: ["창작자", "월드 모델", "기억", "창조"],
          href: "series/autonomous-worlds/posts/03-what-we-want-to-create/",
        },
      ],
      sources: [
        {
          id: "talk",
          label: "SOURCE · 2024년 기록",
          title: "자율 세계의 등장과 새로운 창작 환경",
          description: "2024.07.07 · 발표 직후 정리해 발행한 원문 그대로의 1차 기록",
          published: "2024-07-07",
          sourceYears: [2024],
          topics: ["가상 세계", "창작 문화"],
          keywords: ["자율 세계", "발표 기록", "게임 엔진"],
          href: "series/autonomous-worlds/sources/talk/",
        },
        {
          id: "script",
          label: "SOURCE · 발표 원고",
          title: "자율 세계의 등장과 새로운 창작 환경",
          description: "2024.07.07 · 무대에 서기 전에 써둔 원고. 발행본과 어디가 다른지 절마다 표시",
          published: "2024-07-07",
          sourceYears: [2024],
          topics: ["가상 세계", "기록과 서사"],
          keywords: ["자율 세계", "발표 원고", "변경 기록"],
          href: "series/autonomous-worlds/sources/script/",
        },
        {
          id: "slides",
          label: "SOURCE · 발표 자료",
          title: "자율 세계의 등장과 새로운 창작 환경",
          description: "2024.07.07 · 슬라이드 130장과 발표 중 재생한 영상 36편",
          published: "2024-07-07",
          sourceYears: [2024],
          topics: ["가상 세계", "AI와 창작"],
          keywords: ["자율 세계", "슬라이드", "AI 에이전트", "게임 엔진"],
          href: "series/autonomous-worlds/sources/slides/",
        },
      ],
    },
    {
      slug: "co-creation-culture",
      label: "Co-Creation Culture",
      title: "코-크리에이션 문화",
      description:
        "2023년 두 차례의 발표를 3년 뒤에 다시 쓴 포스팅 세 개. 창작의 주체가 어디로 옮겨가는가.",
      period: "2023–2026",
      sourceYears: [2023],
      topics: ["공동 창작", "현실과 가상", "기록과 서사"],
      keywords: ["코-크리에이션", "온체인 아이덴티티", "디지털 소유", "스토리텔링"],
      href: "series/co-creation-culture/",
      cover: "series/co-creation-culture/assets/series-banner.jpg?v=20260731b",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      assistantContext: {
        path: "series/co-creation-culture/assistant/context.json",
        status: "ready",
        pilotSurfaceIds: [
          "co-creation-culture:series:co-creation-culture",
          "co-creation-culture:post:01-whose-creativity",
          "co-creation-culture:post:02-at-the-boundary",
          "co-creation-culture:post:03-when-records-become-stories",
          "co-creation-culture:source:slides-2023-06",
          "co-creation-culture:source:slides-2023-11",
        ],
      },
      posts: [
        {
          id: "01-whose-creativity",
          label: "포스팅 1",
          title: "창의성은 누구의 것인가",
          published: "2026-07-28",
          sourceYears: [2023],
          topics: ["공동 창작", "창작 문화"],
          keywords: ["코-크리에이션", "창의성", "개방성", "온체인 아이덴티티"],
          href: "series/co-creation-culture/posts/01-whose-creativity/",
        },
        {
          id: "02-at-the-boundary",
          label: "포스팅 2",
          title: "경계면에서",
          published: "2026-07-28",
          sourceYears: [2023],
          topics: ["현실과 가상", "IP와 정체성"],
          keywords: ["경계면", "디지털 소유", "매직서클", "블록체인"],
          href: "series/co-creation-culture/posts/02-at-the-boundary/",
        },
        {
          id: "03-when-records-become-stories",
          label: "포스팅 3",
          title: "기록이 이야기가 될 때",
          published: "2026-07-28",
          sourceYears: [2023],
          topics: ["기록과 서사", "공동 창작"],
          keywords: ["기록", "스토리텔링", "기억", "온체인"],
          href: "series/co-creation-culture/posts/03-when-records-become-stories/",
        },
      ],
      sources: [
        /* 상영 목록(screening) — 2026-07-29 목록에서 뺐다(원자료 모듈 비공개 정책).
           { id: "screening", label: "SOURCE · 상영 목록", title: "상영 목록 · 2023",
             description: "무대 화면에 재생한 영상 19편을 튼 순서대로, 튼 맥락과 함께.",
             href: "series/co-creation-culture/sources/screening/" } */
        /* 자료 묶음(dossier) — 2026-07-29 목록에서 뺐다(원자료 모듈 비공개 정책).
           { id: "dossier", label: "SOURCE · 자료 묶음", title: "자료 묶음 · 2023",
             description: "이 시리즈가 무엇으로 만들어졌는지를 한 장에 모은 카탈로그.",
             href: "series/co-creation-culture/sources/dossier/" } */
        /* 개념 사전(codex) — 2026-07-29 목록에서 뺐다(원자료 모듈 비공개 정책).
           페이지는 배포돼 있고 URL 로는 열린다. 완성도를 더 높인 뒤 되살릴지 정한다.
           { id: "codex", label: "SOURCE · 개념 사전",
             title: "개념 사전 · 2023",
             description: "두 발표에서 정의한 개념 18개를 순서 대신 개념 단위로 묶었다.",
             href: "series/co-creation-culture/sources/codex/" }
           ※ 링크 제거는 접근 차단이 아니다. 실제 차단은 로그인 기능이 생긴 뒤에. */
        /* 발화 기록(transcript) — 2026-07-29 목록에서 뺐다(원자료 모듈 비공개 정책).
           페이지는 배포돼 있고 URL 로는 열린다. 완성도를 더 높인 뒤 되살릴지 정한다.
           { id: "transcript", label: "SOURCE · 발화 기록",
             title: "발화 기록 · 2023",
             description: "2023년의 두 발표에서 본인이 실제로 무대에서 한 말을 정리했다.",
             href: "series/co-creation-culture/sources/transcript/" }
           ※ 링크 제거는 접근 차단이 아니다. 실제 차단은 로그인 기능이 생긴 뒤에. */
        /* 연표(chronicle) — 2026-07-29 목록에서 뺐다.
           페이지는 그대로 배포돼 있고 URL 로는 열린다. 완성도를 더 높인 뒤 링크를
           되살릴지 정한다. 되살릴 때는 이 주석을 지우고 아래 항목을 복구하면 된다.
           { id: "chronicle", label: "SOURCE · 연표",
             title: "발표 연표 · 2017–2024",
             description: "여러 자리에서 한 발표 스무 건. 관심이 어디로 옮겨갔는지 한 화면에",
             href: "series/co-creation-culture/sources/chronicle/" }
           ※ 링크 제거는 접근 차단이 아니다. 실제 차단은 로그인 기능이 생긴 뒤에. */
        {
          id: "slides-2023-06",
          label: "SOURCE · 발표 자료",
          title: "웹3의 다음 흐름을 주도할 코-크리에이션 문화",
          description: "2023.06.30 · 슬라이드 96장을 그날의 순서대로",
          published: "2023-06-30",
          sourceYears: [2023],
          topics: ["공동 창작", "창작 문화"],
          keywords: ["코-크리에이션", "웹3", "슬라이드", "온체인 아이덴티티"],
          href: "series/co-creation-culture/sources/slides-2023-06/",
        },
        {
          id: "slides-2023-11",
          label: "SOURCE · 발표 자료",
          title: "현실과 가상을 연결하는 블록체인 기반의 스토리텔링",
          description: "2023.11.09 · 슬라이드 71장을 그날의 순서대로",
          published: "2023-11-09",
          sourceYears: [2023],
          topics: ["현실과 가상", "기록과 서사"],
          keywords: ["블록체인", "스토리텔링", "매직서클", "디지털 소유"],
          href: "series/co-creation-culture/sources/slides-2023-11/",
        },
      ],
      // 공개 목록에는 넣지 않는다. 아래 네 원자료 페이지 안에서만 서로 이동한다.
      sourceModuleLinks: [
        {
          id: "screening",
          label: "SOURCE · 상영 목록",
          title: "상영 목록 · 2023",
          description: "두 발표에서 재생한 영상 19편의 순서·장표 위치·맥락",
          sourceYears: [2023],
          topics: ["공동 창작", "현실과 가상"],
          keywords: ["상영 목록", "영상", "슬라이드", "발표"],
          href: "series/co-creation-culture/sources/screening/",
        },
        {
          id: "dossier",
          label: "SOURCE · 자료 묶음",
          title: "자료 묶음 · 2023",
          description: "발표 자료·녹음·계보·관련 페이지를 묶은 출처 카탈로그",
          sourceYears: [2023],
          topics: ["기록과 서사", "공동 창작"],
          keywords: ["출처", "발표 자료", "녹음", "계보"],
          href: "series/co-creation-culture/sources/dossier/",
        },
        {
          id: "codex",
          label: "SOURCE · 개념 사전",
          title: "개념 사전 · 2023",
          description: "두 발표의 핵심 개념 18개를 개념 단위로 재구성",
          sourceYears: [2023],
          topics: ["공동 창작", "IP와 정체성", "현실과 가상"],
          keywords: ["개념 사전", "코-크리에이션", "디지털 소유", "스토리텔링"],
          href: "series/co-creation-culture/sources/codex/",
        },
        {
          id: "transcript",
          label: "SOURCE · 발화 기록",
          title: "발화 기록 · 2023",
          description: "두 발표에서 실제로 한 말을 정리한 전사 기록",
          sourceYears: [2023],
          topics: ["기록과 서사", "공동 창작", "현실과 가상"],
          keywords: ["발화 기록", "전사", "발표", "정정 근거"],
          href: "series/co-creation-culture/sources/transcript/",
        },
      ],
    },
  ],
};

export function getSeries(slug) {
  return contentLibrary.series.find((series) => series.slug === slug);
}

export const assistantNavigationActions = Object.freeze([
  "suggest_content",
  "focus_section",
  "play_guide",
]);

export const assistantSurfaceInventory = Object.freeze(
  contentLibrary.series.flatMap((series) => {
    const contextPath = series.assistantContext.path;
    const status = series.assistantContext.status;
    const pilotSurfaceIds = new Set(series.assistantContext.pilotSurfaceIds);
    const surface = (contentType, contentId, href) => {
      const surfaceId = `${series.slug}:${contentType}:${contentId}`;
      return Object.freeze({
        surfaceId,
        series: series.slug,
        contentType,
        contentId,
        href,
        contextPath,
        status,
        pilot: pilotSurfaceIds.has(surfaceId),
      });
    };

    return [
      surface("series", series.slug, series.href),
      ...series.posts.map((post) => surface("post", post.id, post.href)),
      ...series.sources.map((source) =>
        surface("source", source.id, source.href),
      ),
    ];
  }),
);

export function getAssistantSurface(series, contentType, contentId) {
  return assistantSurfaceInventory.find(
    (surface) =>
      surface.series === series &&
      surface.contentType === contentType &&
      surface.contentId === contentId,
  );
}
