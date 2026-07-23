# Kiheon Series Archive 디자인 시스템

## 1. 분위기와 정체성

오래된 종이 위에 현재의 링크와 기록을 정확히 얹은 편집 아카이브다. 화면은 조용하지만 구조는 명확해야 한다. 대표적인 시각 장치는 한 장의 파노라마 위에 개별 글의 좌표를 겹쳐 놓는 `Series Navigator`이며, 장식보다 제목·순서·현재 위치를 읽는 일이 먼저다.

## 2. 색상

| 역할 | 토큰 | 값 | 사용 |
|---|---|---:|---|
| 캔버스 | `--canvas` | `#F3F3EF` | 전체 배경 |
| 표면 | `--surface` | `#FBFBF8` | 카드와 포커스 표면 |
| 반투명 표면 | `--surface-overlay` | `rgba(243,243,239,.94)` | 이미지 위 내비게이션 |
| 본문 | `--ink` | `#17181A` | 제목·본문 |
| 보조 본문 | `--ink-muted` | `#5E6065` | 설명·날짜 |
| 약한 본문 | `--ink-faint` | `#686A6F` | 비활성·메타 |
| 구분선 | `--rule` | `#CFCFC8` | 기본 선 |
| 강한 구분선 | `--rule-strong` | `#17181A` | 현재 위치·강조 |
| 링크 | `--accent` | `#2457D6` | 이동 가능한 요소 |
| 링크 호버 | `--accent-hover` | `#163DA7` | 호버·활성 |
| 역상 표면 | `--inverse` | `#17181A` | 사이트 푸터 |
| 역상 본문 | `--inverse-ink` | `#F7F7F2` | 사이트 푸터 본문 |

색상은 정보 역할을 가진다. 파랑은 링크와 포커스에만 사용하고 장식에는 사용하지 않는다.

## 3. 타이포그래피

| 수준 | 크기 | 굵기 | 행간 | 사용 |
|---|---:|---:|---:|---|
| Display | `clamp(2.1rem,3.6vw,3.3rem)` | 400 | 1.15 | 페이지 제목 |
| H2 | `clamp(1.45rem,2vw,1.85rem)` | 400 | 1.3 | 본문 절 제목 |
| Body large | `clamp(1.06rem,1.5vw,1.22rem)` | 400 | 1.62 | 리드 |
| Body | `1.0625rem` | 400 | 1.78 | 본문 |
| Card title | `.9375rem` | 600 | 1.3 | 포스트·자료 카드 |
| Small | `.875rem` | 400 | 1.6 | 설명·캡션 |
| Meta | `.75rem` | 500 | 1.4 | 날짜·헤더 |
| Micro | `.6875rem` | 600 | 1.3 | 순번·오버라인 |

- Display: `"Iowan Old Style", "Noto Serif CJK KR", "AppleMyungjo", "Nanum Myeongjo", serif`
- Body: `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`
- Mono: `"SFMono-Regular", "Roboto Mono", "Noto Sans Mono CJK KR", monospace`
- 한국어는 `word-break: keep-all`, 제목은 `text-wrap: balance`, 본문은 `text-wrap: pretty`를 기본으로 한다.

## 4. 간격과 레이아웃

기본 단위는 4px이다.

| 토큰 | 값 | 사용 |
|---|---:|---|
| `--space-1` | `.25rem` | 미세 간격 |
| `--space-2` | `.5rem` | 인라인·조밀한 목록 |
| `--space-3` | `.75rem` | 메타 행 |
| `--space-4` | `1rem` | 모바일 거터·카드 패딩 |
| `--space-6` | `1.5rem` | 카드 그룹 |
| `--space-8` | `2rem` | 태블릿 거터 |
| `--space-10` | `2.5rem` | 주요 블록 |
| `--space-12` | `3rem` | 데스크톱 거터 |
| `--space-16` | `4rem` | 페이지 구획 |
| `--space-20` | `5rem` | 푸터 전 간격 |

- 읽기 폭: `46rem`
- 시리즈·라이브러리 폭: `66rem`
- 전체 헤더 폭: `90rem`
- 브레이크포인트: 48rem, 70rem, 80rem
- URL 계층: `/`(라이브러리) → `/series/{series-slug}/`(시리즈) → `/series/{series-slug}/posts/{post-slug}/`(포스트)
- 각 시리즈의 이미지·원자료는 해당 시리즈 디렉터리 아래에 둔다.

## 5. 컴포넌트

### Site Header

- **구조**: `header > .site-header__in > brand + context`
- **상태**: 기본, 호버, 키보드 포커스
- **접근성**: 첫 링크 앞에 본문 건너뛰기 링크를 둔다.
- **레이아웃**: 양끝 Cluster

### Series Library

- **구조**: `series-library > ol > li > article > image + copy`
- **변형**: 공개 시리즈 하나 또는 복수
- **상태**: 기본, 호버, 포커스
- **접근성**: 카드 전체가 하나의 명확한 링크이며 제목과 글 개수를 텍스트로 제공한다.
- **레이아웃**: 자동 맞춤 Grid

### Series Navigator

- **구조**: `series-nav > figure.banner > image + ol.banner__cards`
- **변형**: 시리즈 홈, 현재 글, 4편 이상
- **상태**: 이동 가능, 현재 글(`aria-current="page"`), 호버, 포커스
- **간격**: `--space-2`, `--space-3`, `--space-4`
- **높이 규칙**: 같은 행의 모든 카드는 가장 긴 카드 높이에 맞춘다. 제목 영역은 최소 두 줄 높이를 확보한다.
- **확장 규칙**: 3편 이하는 파노라마 위에 겹치고, 4편 이상은 이미지 아래 자동 맞춤 그리드로 내려온다.
- **접근성**: `nav`와 순서 목록을 사용하고 현재 글은 링크가 아닌 상태 카드로 표시한다.
- **모션**: 150ms 색상·테두리 변화만 허용한다.

### Source Card

- **구조**: 자료 종류 + 제목 + 날짜·설명
- **상태**: 기본, 호버, 포커스
- **레이아웃**: 두 칸 Grid, 모바일 한 칸

### Series Post Links

- **구조**: `series-post-links > nav.serieslinks > link | current`
- **변형**: 포스트의 현재 글 표시, 원자료의 전체 글 링크
- **데이터**: `content-manifest.js`의 포스트 순서·제목·주소를 그대로 사용한다.
- **접근성**: 현재 글은 링크가 아닌 `aria-current="page"` 상태로 표시한다.

### Legacy Redirect

- **구조**: canonical + 즉시 이동 + 수동 링크
- **접근성**: 자바스크립트가 꺼져도 새 주소로 이동할 수 있는 링크를 제공한다.

## 6. 모션과 상호작용

| 유형 | 시간 | 이징 | 사용 |
|---|---:|---|---|
| Micro | 150ms | ease-out | 링크·카드 테두리와 색상 |

- 이동·크기 애니메이션은 사용하지 않는다.
- `prefers-reduced-motion: reduce`에서는 전환을 제거한다.
- 호버는 링크에만 적용하며 현재 글 카드에는 적용하지 않는다.

## 7. 깊이와 표면

전략은 `borders-only`다. 그림자와 블러를 사용하지 않는다. 종이색 표면, 1px 선, 이미지와의 겹침만으로 층위를 만든다.

## 8. 접근성 제약과 허용된 부채

### 제약

- 목표: WCAG 2.2 AA
- 본문 대비 4.5:1 이상, 큰 글자와 UI 경계 3:1 이상
- 모든 링크에 가시적 포커스 표시
- 375px에서 가로 스크롤 없이 한 열로 전환
- 의미 있는 이미지는 대체 텍스트와 고정 크기를 갖는다.
- 시리즈 카드 제목은 한국어 어절 중간에서 끊지 않는다.

### 허용된 부채

| 항목 | 위치 | 이유 | 종료 조건 |
|---|---|---|---|
| 장문 페이지의 인라인 CSS | 기존 포스트·원자료 HTML | 이번 변경은 URL 계층과 공통 시리즈 내비게이션에 한정한다. | 다음 콘텐츠 템플릿화 단계에서 공통 CSS로 이동 |
| 기존 GA4 헤드 스크립트 | 공개 페이지 전체 | 기존 측정 체계를 유지한다. | 개인정보·쿠키 정책을 별도로 정리할 때 재검토 |
