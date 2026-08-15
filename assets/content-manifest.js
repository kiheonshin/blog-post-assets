export const contentLibrary = {
  series: [
    // 00 은 연대기의 일부가 아니라 그 연대기를 만든 장치에 대한 글이라 맨 앞에
    // 선다(구조제안 §2-2). 카드를 특별 대우하지 않는다 — 차이는 description
    // 한 줄로 충분하고, 카드를 꾸미면 그 자체가 제품 소개문의 신호가 된다.
    {
      slug: "life-universe",
      label: "00 · Life Universe · Making of",
      // title 확정 2026-08-09 [본인]. 「Making of」 앞에 프로젝트명을 붙였다 —
      // 대타였을 때 카드가 「00 · Making of / Making of」로 같은 말을 두 번 했다.
      // 관측소 브랜드와 시리즈 slug(`life-universe`)에 이어지는 이름을 골랐다.
      title: "Life Universe · Making of",
      description:
        "앞선 다섯 시리즈 열다섯 편 말미에 붙은 한 줄이 실제로 무엇이었는지, 처음 50일 동안 무엇을 했는지의 중간 보고 세 편.",
      period: "2026",
      sourceYears: [2026],
      // 구조제안 §2-1 은 「기존 topic 어휘와 겹치는 것만」을 규칙으로 걸고서
      // 「기록과 아카이브」·「에이전트」를 예시로 들었는데, 그 둘은 이 매니페스트의
      // 8개 어휘에 없다. 규칙이 이긴다 — 겹치는 것으로 갈아 넣었다.
      topics: ["AI와 창작", "창작 도구", "기록과 서사"],
      keywords: ["AI 에이전트", "디지털 트윈", "문체", "파인튜닝", "프롬프트"],
      href: "series/life-universe/",
      // 커버 세트 설치 [2026-08-09]. 은유는 「이 글을 닫는 한 줄이 세 조각으로
      // 갈리고 각 조각을 한 편씩 맡는다」. 액센트 청록은 앞선 다섯이 쓴
      // 주황·남색·보라와 색상환에서 떨어져 있어 목록에서 이 시리즈만 갈린다.
      cover: "series/life-universe/assets/series-banner.jpg?v=20260810a",
      coverAlt:
        "다섯 시리즈의 색을 섞은 그레이디언트 띠가 바닥을 가로지르다 두 조각으로 갈리고 세 번째 조각이 그 줄 밖에 따로 놓인 Life Universe 파노라마",
      published: "2026-08-08",
      // 컨텍스트 팩은 인벤토리(entries·allowedTargets)만 실었다[2026-08-13] —
      // 원자료를 llms.txt 에 싣는 유일한 경로가 allowedTargets 라서다.
      // 도슨트 발화(quickPrompts)는 음성 레인 검수 후 붙인다. status 는 그때 올린다.
      // ★ 파일이 존재하면 검증기는 status 와 무관하게 전량 검사를 돈다(실측).
      assistantContext: {
        path: "series/life-universe/assistant/context.json",
        status: "planned",
        pilotSurfaceIds: [],
      },
      // 세 편이 다 섰다(2026-08-09). 각 편의 텍스트 풀버전은 숨김 표면이라
      // 여기 넣지 않는다 — 넣으면 표면 수 계약이 깨지고 도슨트가 안내 대상으로 삼는다.
      posts: [
        {
          id: "01-result",
          label: "PART 1",
          title: "앞선 다섯 시리즈에 나는 같은 한 줄을 붙였다",
          description:
            "같은 도구를 쓰고도 무엇이 완성도를 갈랐는가. 끝내 오지 않은 말투 하나와, 자료로는 채워지지 않던 칸.",
          published: "2026-08-08",
          sourceYears: [2026],
          topics: ["AI와 창작", "창작 도구"],
          keywords: ["AI 에이전트", "디지털 트윈", "문체", "파인튜닝"],
          href: "series/life-universe/posts/01-result/",
        },
        {
          id: "02-structure",
          label: "PART 2",
          title: "디지털 트윈은 프롬프트가 아니라 구조다",
          description:
            "자료를 전부 읽히는 일이 아니었다. 읽히기 전에 세고, 원본만 잠그고, 연결 수를 버린 자리까지.",
          published: "2026-08-09",
          sourceYears: [2026],
          topics: ["AI와 창작", "창작 도구"],
          keywords: ["AI 에이전트", "디지털 트윈", "기록", "온톨로지"],
          href: "series/life-universe/posts/02-structure/",
        },
        {
          id: "03-boundary",
          label: "PART 3",
          title: "먼저 다 닫아두고, 지킨 만큼만 한 칸씩 열었다",
          description:
            "접근 범위는 설정 화면에서 정해지지 않았다. 경계가 새던 자리와, 끝까지 열지 않은 자리.",
          published: "2026-08-09",
          sourceYears: [2026],
          topics: ["AI와 창작", "창작 도구"],
          keywords: ["AI 에이전트", "디지털 트윈", "경계", "발화 계약"],
          href: "series/life-universe/posts/03-boundary/",
        },
      ],
      // 1차 원자료 표면은 없다(구조제안 §2-1 — 그 판정은 유지된다). 아래 한 건은
      // 1차 자료가 아니라 **층 ④ 합성 파생물**이다 : 세 편이 다룬 실험의 산출물
      // (본인을 학습한 에이전트가 다시 만든 소개 덱)이 본인 승인[2026-08-13]을
      // 거쳐 그 실험의 원자료로 돌아온 첫 사례. 본인 저작으로 귀속하지 않는다.
      sources: [
        {
          id: "universe-intro",
          label: "SOURCE · 소개 덱",
          title: "KIHEON LIFE UNIVERSE 소개",
          description:
            "27장. 신기헌 본인이 아니라, 본인을 학습한 에이전트가 본인의 발표 자료와 "
            + "아카이브를 재료로 다시 만들었다. 본인이 읽고 승인한 뒤 공개됐다.",
          published: "2026-08-13",
          sourceYears: [2026],
          topics: ["AI와 창작", "창작 도구"],
          keywords: ["AI 에이전트", "디지털 트윈", "발표 자료"],
          href: "series/life-universe/sources/universe-intro/",
        },
      ],
    },
    {
      slug: "aigc-creative-paradigm",
      label: "01 · AIGC Notes",
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
      label: "02 · Newtype Summit",
      title: "AI를 열어둘수록 선명해지는 창작자의 자리",
      description:
        "AI의 잠재력과 엔진 IP, 창작자의 판단 능력으로 이어지는 뉴타입 엔터 서밋 공개 대담 세 편.",
      period: "2026",
      sourceYears: [2026],
      topics: ["AI와 창작", "IP와 정체성", "공동 창작"],
      keywords: ["AI 협업", "엔진 IP", "취향", "창작자"],
      href: "series/newtype-ip-dialogue/",
      cover: "series/newtype-ip-dialogue/assets/series-banner.jpg",
      coverAlt:
        "열린 문과 기억의 프레임, 작은 에이전트들이 녹색 경로로 이어진 뉴타입 시리즈 파노라마",
      assistantContext: {
        path: "series/newtype-ip-dialogue/assistant/context.json",
        status: "ready",
        pilotSurfaceIds: [
          "newtype-ip-dialogue:series:newtype-ip-dialogue",
          "newtype-ip-dialogue:post:01-not-blocking-potential",
          "newtype-ip-dialogue:post:02-engine-as-ip",
          "newtype-ip-dialogue:post:03-already-have-the-eye",
        ],
      },
      posts: [
        {
          id: "01-not-blocking-potential",
          label: "포스팅 1",
          title: "잠재력을 믿는 데서 협업이 시작된다",
          published: "2026-07-25",
          sourceYears: [2026],
          topics: ["AI와 창작", "공동 창작"],
          keywords: ["AI 협업", "잠재력", "공동 창작"],
          href: "series/newtype-ip-dialogue/posts/01-not-blocking-potential/",
        },
        {
          id: "02-engine-as-ip",
          label: "포스팅 2",
          title: "남는 IP는 취향을 재현하는 엔진이다",
          published: "2026-07-25",
          sourceYears: [2026],
          topics: ["IP와 정체성", "AI와 창작"],
          keywords: ["엔진 IP", "취향", "재현", "IP"],
          href: "series/newtype-ip-dialogue/posts/02-engine-as-ip/",
        },
        {
          id: "03-already-have-the-eye",
          label: "포스팅 3",
          title: "다르게 보는 눈은 창작자가 가진 능력이다",
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
      label: "03 · Autonomous Worlds",
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
      label: "04 · Co-Creation Culture",
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
        /* 연표·발화 기록·개념 사전·상영 목록은 2026-08-05 에 이 시리즈를 떠나
           `/archive/<슬러그>/` 로 옮겼다. 연표가 2017–2024 를 다루면서 2023년
           시리즈 밑에 놓여 있던 것이 어긋난 구조였고, 넷은 서로 대등하다.
           자료 묶음(dossier)은 다른 셋과 겹쳐 그때 없앴다 — 재료 명세는
           아카이브 홈으로 옮겼다.

           그러므로 여기에 되살릴 항목은 없다. 아카이브를 공개 목록에 올릴지는
           `/archive/` 쪽에서 정한다. 지금은 noindex 이고 어디서도 링크하지 않는다.
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
      /* `sourceModuleLinks` 는 여기 있었다. 네 원자료 페이지가 서로 오가는
         길이었고 공개 목록에는 넣지 않았다. 2026-08-05 에 넷을 `/archive/` 로
         옮기면서 상단 고정 메뉴가 그 일을 대신하게 돼 데이터가 죽었다.
         `<source-module-links>` 를 쓰는 페이지도 남아 있지 않다.
         (엘리먼트 정의는 series-nav.js 에 그대로 둔다 — 다른 시리즈가 같은
          구조를 쓸 수 있다. 되살리려면 이 자리에 배열을 다시 놓으면 된다.) */
    },
    {
      slug: "onchain-storytelling",
      label: "05 · On-chain Storytelling",
      title: "온체인 스토리텔링",
      description:
        "2023년에 진행하던 웹3 기반 코크리에이션 프로젝트의 세계관·방법론·산출물을 3년 뒤에 세 편으로 정리했다.",
      period: "2023–2026",
      sourceYears: [2023],
      topics: ["기록과 서사", "IP와 정체성", "현실과 가상"],
      keywords: ["온체인 스토리텔링", "TBA", "캐릭터 설계", "코-크리에이션"],
      href: "series/onchain-storytelling/",
      cover: "series/onchain-storytelling/assets/series-banner.jpg?v=20260809a",
      coverAlt:
        "밝은 보라색 면이 종이 기록 지형과 생활 공간을 지나 거대한 레코드로 이어지는 온체인 스토리텔링 파노라마",
      published: "2026-08-06",
      // 도슨트 미장착 — 음성 레인이 결속하면 status 를 올린다.
      assistantContext: {
        path: "series/onchain-storytelling/assistant/context.json",
        status: "planned",
        pilotSurfaceIds: [],
      },
      posts: [
        {
          id: "01-worldview",
          label: "PART 1",
          title: "이야기를 담으려면 세계부터 지어야 했다",
          description: "온체인 스토리텔링의 정의, 타운과 포탈, 문서가 아니라 장부가 정본이 되는 세계.",
          published: "2026-08-06",
          sourceYears: [2023],
          topics: ["기록과 서사", "현실과 가상"],
          keywords: ["온체인 스토리텔링", "TBA", "포탈", "세계관"],
          href: "series/onchain-storytelling/posts/01-worldview/",
        },
        {
          id: "02-methodology",
          label: "PART 2",
          title: "캐릭터는 정의되기 전에 먼저 살았다",
          description: "정의보다 생활을 먼저 내보내는 순서, 인벤토리로 성격을 만드는 설계, 빈 자리를 상품으로 세우는 방법.",
          published: "2026-08-06",
          sourceYears: [2023],
          topics: ["IP와 정체성", "공동 창작"],
          keywords: ["캐릭터 설계", "키이라", "에바", "빈 자리"],
          href: "series/onchain-storytelling/posts/02-methodology/",
        },
        {
          id: "03-expansion",
          label: "PART 3",
          title: "세계는 옷과 공간과 음악으로 새어 나갔다",
          description: "영상 연작과 패션 캠페인, 호텔 형태의 공간 기획, 캐릭터 명의의 음원까지. 확장의 갈래들.",
          published: "2026-08-06",
          sourceYears: [2023, 2024],
          topics: ["공동 창작", "현실과 가상"],
          keywords: ["트랜스미디어", "AI 에이전트", "확장"],
          href: "series/onchain-storytelling/posts/03-expansion/",
        },
      ],
      sources: [
        {
          id: "proposal-strategy-diagrams",
          label: "SOURCE · 전략 기획",
          title: "MIXtown 전략 기획 도식집",
          description: "2023.12.08 · 장표 16장. 다섯 단계 컨버전스 모델과 TBA 구조, 온체인 히스토리",
          published: "2023-12-08",
          sourceYears: [2023],
          topics: ["기록과 서사", "공동 창작"],
          keywords: ["컨버전스", "TBA", "스타일 학습", "도식"],
          href: "series/onchain-storytelling/sources/proposal-strategy-diagrams/",
        },
        {
          id: "proposal-mxtwn-x",
          label: "SOURCE · 제안 기획",
          title: "MXTWN X 아이디어 기획안",
          description: "2023.12.08 · 장표 19장 · 영상 2편. 캐릭터를 화자로 세운 의류 프로젝트의 제안 전문",
          published: "2023-12-08",
          sourceYears: [2023],
          topics: ["공동 창작", "IP와 정체성"],
          keywords: ["MXTWN X", "패션", "TBA", "재단 도면"],
          href: "series/onchain-storytelling/sources/proposal-mxtwn-x/",
        },
        {
          id: "proposal-sapienz-town",
          label: "SOURCE · 제안 기획",
          title: "SAPIENZ Town 아이디어 기획안",
          description: "2024.01.02 · 장표 15장. 80명의 운영자가 굴리는 호텔, 다섯 축의 전체 구조도",
          published: "2024-01-02",
          sourceYears: [2024],
          topics: ["가상 세계", "공동 창작"],
          keywords: ["SAPIENZ Town", "호텔", "AI 에이전트", "구조도"],
          href: "series/onchain-storytelling/sources/proposal-sapienz-town/",
        },
        {
          id: "proposal-idea-notes",
          label: "SOURCE · 기획 노트",
          title: "MIXtown 확장 아이디어 노트",
          description: "2023.12.08 · 장표 2장. 음악 유통 구조와 포탈 세계관을 세운 미술 기획",
          published: "2023-12-08",
          sourceYears: [2023],
          topics: ["공동 창작", "IP와 정체성"],
          keywords: ["음악 NFT", "큐레이션", "포탈", "아트 컬렉터블"],
          href: "series/onchain-storytelling/sources/proposal-idea-notes/",
        },
      ],
    },
    {
      slug: "metaverse-era",
      label: "06 · Metaverse Era",
      title: "메타버스 시대 — 한 파일로 2년을 말했다",
      description:
        "2020년 겨울부터 2021년 말까지 강연으로 한 말을, 그 말을 담고 다닌 파일 한 벌과 나란히 놓고 다시 읽은 세 편.",
      period: "2020–2026",
      sourceYears: [2020, 2021],
      topics: ["현실과 가상", "가상 세계", "기록과 서사"],
      keywords: ["메타버스", "가상 경제", "발표 자료", "판본"],
      href: "series/metaverse-era/",
      // 커버 세트는 본인 승인 대기다. cover·coverAlt 를 **일부러 비워 둔다** —
      // series-nav.js 의 SeriesNav 와 SeriesLibrary 는 series.cover 를 무조건
      // <img src> 로 만들기 때문에(325·443행) 없는 경로를 적으면 발행면에 깨진
      // 이미지가 남는다. 이 시리즈는 목록에서 일곱 번째라 홈 카드 미리보기(앞 여섯)
      // 밖이고, 나머지 목록은 글자 링크만 그리므로 지금은 cover 를 읽는 자리가 없다.
      // 승인 뒤 같은 회차에 : cover·coverAlt 추가 + 랜딩면의 series-post-links 를
      // series-nav 로 교체 + 포스트 세 편에 hero figure 삽입.
      published: "2026-08-15",
      // 도슨트 미장착 — 음성 레인이 결속하면 path 를 실제 파일로 채우고 status 를 올린다.
      // **키 자체는 비워 둘 수 없다.** assistantSurfaceInventory 가 series.assistantContext.path
      // 를 가드 없이 읽어서, 이 키가 없으면 매니페스트가 import 시점에 TypeError 로 죽고
      // 그 페이지의 커스텀 엘리먼트가 전멸한다(실측 — 처음 등재판이 정확히 그랬다).
      assistantContext: {
        path: "series/metaverse-era/assistant/context.json",
        status: "planned",
        pilotSurfaceIds: [],
      },
      posts: [
        {
          id: "01-no-money-talk",
          label: "PART 1",
          title: "현실과 가상 사이에서 돈 이야기를 하지 않던 해",
          description: "2020년 11월의 두 발표 244장. 값을 다루는 자리는 일곱 장이고, 값이 어떻게 매겨지는지 묻는 장은 하나도 없다.",
          published: "2026-08-15",
          sourceYears: [2020],
          topics: ["현실과 가상", "가상 세계"],
          keywords: ["메타버스", "경험지도", "매직서클", "이음매"],
          href: "series/metaverse-era/posts/01-no-money-talk/",
        },
        {
          id: "02-size-and-price",
          label: "PART 2",
          title: "세계의 크기를 재고, 무대에서 지갑을 열었다",
          description: "2021년 3월과 4월과 12월의 발표 351장. 지구의 치수를 자로 들이대던 파일이 여덟 달 만에 무대에서 지갑을 여는 데까지 간다.",
          published: "2026-08-15",
          sourceYears: [2021],
          topics: ["가상 세계", "현실과 가상"],
          keywords: ["가상 경제", "디센트럴랜드", "스토리리빙", "라이브 데모"],
          href: "series/metaverse-era/posts/02-size-and-price/",
        },
        {
          id: "03-clocking-in",
          label: "PART 3",
          title: "오늘도 나는 메타버스로 출근합니다, 라고 말한 뒤에",
          description: "2021년 여름과 가을의 발표 255장. 같은 파일을 넉 달 사이에 세 번 다시 조립하며 손댄 자리를 장 단위로 짚었다.",
          published: "2026-08-15",
          sourceYears: [2021],
          topics: ["가상 세계", "기록과 서사"],
          keywords: ["Play to Earn", "발표자 노트", "판본", "재조립"],
          href: "series/metaverse-era/posts/03-clocking-in/",
        },
      ],
      // sources 는 **일부러 비워 둔다** — 원자료 모듈 비공개 정책(브리지 §8) :
      // 매니페스트 미등록 + noindex. 아홉 모듈은 지어 두고 목록에는 걸지 않는다.
      sources: [],
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
