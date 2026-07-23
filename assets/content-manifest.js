export const contentLibrary = {
  series: [
    {
      slug: "aigc-creative-paradigm",
      label: "AIGC Notes",
      title: "AI 시대, 창작의 정의를 다시 묻다",
      description:
        "2025년 11월 발표와 연구 노트, 그리고 몇 달 지나 다시 쓴 세 편의 글.",
      period: "2025–2026",
      href: "series/aigc-creative-paradigm/",
      cover: "series/aigc-creative-paradigm/assets/series-banner.jpg",
      coverAlt: "세 편의 키 비주얼이 하나로 이어진 파노라마",
      posts: [
        {
          id: "01-skill-and-effort",
          label: "1편",
          title: "실력과 노력의 가치는 어디로 가는가",
          href: "series/aigc-creative-paradigm/posts/01-skill-and-effort/",
        },
        {
          id: "02-workflow-design",
          label: "2편",
          title: "프롬프트를 넘어, 작업의 흐름을 설계하는 일",
          href: "series/aigc-creative-paradigm/posts/02-workflow-design/",
        },
        {
          id: "03-reality-virtual-boundary",
          label: "3편",
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
          description: "2025.11.21 · 슬라이드 162장과 발표 중 재생한 영상 59편",
          href: "series/aigc-creative-paradigm/sources/slides/",
        },
      ],
    },
  ],
};

export function getSeries(slug) {
  return contentLibrary.series.find((series) => series.slug === slug);
}
