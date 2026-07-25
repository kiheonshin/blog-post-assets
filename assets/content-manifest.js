export const contentLibrary = {
  series: [
    {
      slug: "aigc-creative-paradigm",
      label: "AIGC Notes",
      title: "AI 시대, 창작의 정의를 다시 묻다",
      description:
        "2025년 11월 발표와 연구 노트, 그리고 몇 달 지나 다시 쓴 포스팅 세 개.",
      period: "2025–2026",
      href: "series/aigc-creative-paradigm/",
      cover: "series/aigc-creative-paradigm/assets/series-banner.jpg",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      posts: [
        {
          id: "01-skill-and-effort",
          label: "포스팅 1",
          title: "실력과 노력의 가치는 어디로 가는가",
          href: "series/aigc-creative-paradigm/posts/01-skill-and-effort/",
        },
        {
          id: "02-workflow-design",
          label: "포스팅 2",
          title: "프롬프트를 넘어, 작업의 흐름을 설계하는 일",
          href: "series/aigc-creative-paradigm/posts/02-workflow-design/",
        },
        {
          id: "03-reality-virtual-boundary",
          label: "포스팅 3",
          title: "현실과 가상의 경계면에서",
          href: "series/aigc-creative-paradigm/posts/03-reality-virtual-boundary/",
        },
      ],
      sources: [
        {
          id: "research",
          label: "SOURCE · 연구 노트",
          title: "AI 시대의 예술, 인간 고유의 창의성이란 무엇인가",
          description: "2025.09.09 · 발표의 바탕이 된 사전 조사 전문",
          href: "series/aigc-creative-paradigm/sources/research/",
        },
        {
          id: "slides",
          label: "SOURCE · 발표 자료",
          title: "AIGC 시장 트렌드 및 창작자 패러다임의 변화",
          description: "2025.11.21 · 슬라이드 162장과 발표 중 재생한 영상 59개",
          href: "series/aigc-creative-paradigm/sources/slides/",
        },
      ],
    },
    {
      slug: "newtype-ip-dialogue",
      label: "Newtype Dialogue",
      title: "AI를 가로막지 않을수록 선명해지는 창작자의 자리",
      description:
        "2026년 6월 뉴타입 엔터 서밋 대담을 1인칭으로 다시 정리한 포스팅 세 개.",
      period: "2026",
      href: "series/newtype-ip-dialogue/",
      cover: "series/newtype-ip-dialogue/assets/series-banner.jpg",
      coverAlt: "세 포스팅의 키 비주얼이 하나로 이어진 파노라마",
      posts: [
        {
          id: "01-not-blocking-potential",
          label: "포스팅 1",
          title: "AI가 가진 잠재력을 가로막지 않을 때 협업이 시작된다",
          href: "series/newtype-ip-dialogue/posts/01-not-blocking-potential/",
        },
        {
          id: "02-engine-as-ip",
          label: "포스팅 2",
          title:
            "한 번 쓰고 버리는 시대에 남는 IP는 결과물이 아니라 취향을 재현하는 엔진이다",
          href: "series/newtype-ip-dialogue/posts/02-engine-as-ip/",
        },
        {
          id: "03-already-have-the-eye",
          label: "포스팅 3",
          title: "AI를 다르게 보는 눈은 새 기술이 아니라 창작자가 원래 가진 능력이다",
          href: "series/newtype-ip-dialogue/posts/03-already-have-the-eye/",
        },
      ],
      // 대담 원문 스크립트는 공개하지 않는다 — 이 시리즈에 바탕 자료 페이지는 없다
      sources: [],
    },
  ],
};

export function getSeries(slug) {
  return contentLibrary.series.find((series) => series.slug === slug);
}
