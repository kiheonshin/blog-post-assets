# Kiheon Life Universe Brand System v1.1

이 문서는 kiheon.com 의 공개 면이 같은 브랜드로 보이게 하는 기준이다. 제품 이름, 정체성, 시각 체계, 문장 규칙, 자산을 한 층위에서 관리한다.

v1.1 (2026-10-20) 은 본인 결정 셋을 반영했다 : 정문 이름 두 층 · 제목도 산세리프 · 긴 줄표를 쓰지 않음. 앞 판 v1 은 2026-08-31 이다.

## 1. 이름 두 층

| 층 | 이름 | 쓰는 자리 |
|---|---|---|
| 정문 (누구의 사이트인가) | 신기헌 · Kiheon Shin | kiheon.com 왼쪽 위 이름 · 문서 제목 꼬리 · 글의 저자 |
| 체계 (무엇이 이 사이트를 굴리는가) | Kiheon Life Universe | 공개 관측소(`/universe/`) · 소개 문장 · 바닥 서명 · 이 문서 |

- 두 이름을 한 자리에서 다투게 하지 않는다. 정문 자리에 체계 이름을 올리지 않고, 체계를 설명하는 자리에서 사람 이름을 제품명처럼 쓰지 않는다.
- 문서 제목은 「… · Kiheon Shin」 으로 끝난다. 공유 제목(og:title · twitter:title)도 같다.
- 바닥 서명은 공개 면마다 한 줄이다 : 「Kiheon Life Universe · 신기헌의 디지털 트윈 프로젝트」. 체계 이름은 공개 글 귀속 「신기헌의 디지털 트윈 프로젝트」 와 함께 쓴다.
- 체계 이름은 웹에 보이는 글에서 약어로 줄이지 않는다.
- kiheon.app 은 본인 전용 면이라 공개 짝이 없다.

## 2. 제품 이름과 자리

| 제품 | 하는 일 | 자리 | 상태 |
|---|---|---|---|
| Blog | 시리즈와 글을 읽는 정문 | `/` | 공개 |
| Public Archive | 공개 가능한 바탕 자료의 색인 | `/archive/` | 공개 · 검색 제외 |
| Universe | 전체 구조와 현재 상태를 관측하는 면 | `/universe/` (지도 보기 `/universe/map/`) | 공개 관측소 |
| Outside | 기록을 펼쳐 읽는 면 | `/archive/world-atlas/` | 공개 · 검색 제외 |
| Inside | 기록 안으로 들어가 경험하는 면 | kiheon.app 보호면 | 공개 전 |
| Slides | 발표 서사와 화면 | kiheon.app 보호면 | 공개 전 |

- 첫 화면은 Inside 와 Slides 를 「링크 없음 · 아직 공개되지 않음」 으로 적고 이동 기능 없이 보여 준다. 공개 전 면을 링크처럼 보이게 하지 않는다.
- 관측소의 정문은 `/universe/` 다. v1 에 적었던 `/map` 은 kiheon.com 의 경로가 아니다(2026-10-20 실측 : `/map` 404, `/universe/` 와 `/universe/map/` 200).
- `World Atlas` 와 `Inner World` 는 화면에 노출되는 제품명으로 쓰지 않는다. 기존 URL 이나 파일명은 호환을 위해 남을 수 있지만, 사용자에게 보이는 명칭은 `Outside` 와 `Inside` 를 쓴다.
- `Archive` 는 두 뜻을 구분한다. 로컬 보존 공간은 `Local Vault`, 웹 공개면은 `Public Archive` 다.

## 3. Identity

존재 이유 : 흩어진 삶의 기록을 불변 원본으로 지키고, 출처와 경계를 검증한 만큼만 사람이 읽고 탐색하고 경험할 수 있게 한다.

약속 :

1. 기록보다 앞서 의미를 만들지 않는다.
2. 공개할 수 있는 만큼만 보여 주고 닫힌 것은 번들에도 넣지 않는다.
3. 과거 기록, 현재 상태, 해석 후보, 생성 경험을 구분한다.
4. 조용하지만 빈약하지 않고, 정밀하지만 차갑게 닫히지 않는다.
5. 제품이 달라도 같은 기록의 계보와 승인을 다시 찾을 수 있다.

성격 : `quiet · exact · editorial · inhabitable · reversible`

금지한다.

- 장식용 그라디언트
- 의미 없는 원형 장식
- 문장과 큰 제목의 대문자
- 공개되지 않은 표면을 링크처럼 보이게 하는 처리
- 내부 파일 경로, 원본 본문, 비공개 관계의 공개 표면 노출

## 4. Visual System

| 축 | 기준 |
|---|---|
| Canvas | 차가운 종이 `#f3f3ef` 를 기본으로 둔다. |
| Surface | 카드와 패널은 `#fbfbf8` 을 쓰고, 1px 선으로 구분한다. |
| Ink | 본문은 `#17181a`, 보조 정보는 회색, 동작 가능성은 코발트로만 표시한다. |
| Accent | 기능적 코발트 `#2457d6`, hover `#163da7`. |
| Type | 제목과 본문 모두 산세리프 한 벌이다 : 영문 · 숫자 Life Universe Sans(Geist 바탕) + 한글 Life Universe Hangul(Pretendard 바탕). 고정폭 Life Universe Mono(Geist Mono 바탕)는 근거 · 상태 · 이름표에만 쓴다. |
| Depth | 그림자 없이 1px 선 · 면 · 겹침 · 밀도로 나눈다. |
| Radius | 기본은 각진 모서리. 제품 카드와 도식 패널은 0-6px 안에서 제한한다. |
| Theme | 라이트 단일. 반전면은 경계와 장면에만 쓴다. |
| Motion | 상태 변화와 hover 는 150-200ms 범위의 짧은 반응만 쓰고, reduced-motion 대체를 둔다. |
| Diagram | 글자를 그림으로 굳히지 않은 SVG. 같은 입력이면 같은 그림이 나오고, 근거가 있는 것만 그린다. |

파란색은 장식색이 아니라 이동 가능성, 선택 상태, 검증 막, 공개 표면 상태를 표시하는 기능색이다.

## 5. 문장 규칙

- 기능을 과장하거나 다음 단계를 이미 구현된 것처럼 말하지 않는다.
- 관찰 사실과 해석 후보를 다른 이름표와 문장으로 쓴다.
- 내부 상태 코드보다 사람이 이해하는 역할을 먼저 쓴다.
- 숫자는 데이터에서 파생하고 문장에 영구 고정하지 않는다.
- 선언보다 사용자가 실제로 할 수 있는 일을 말한다.
- 긴 줄표(U+2014)를 쓰지 않는다. 가운뎃점 · 쌍점 · 괄호 · 줄바꿈으로 쓴다. 제목 · 머리글 · 바닥 · 설명 · 캡션 · 공유 제목 모두 같다. 원자료 본문을 글자 그대로 옮긴 인용만 예외다.
- 쌍점은 앞뒤를 띄운다(「A : B」). 문장이 끝난 뒤에 덧붙이는 말은 마침표로 끊는다.
- 대문자는 고정폭 이름표에만 쓴다. 머리 · 바닥의 이름표(`KIHEON SHIN` · `KIHEON LIFE UNIVERSE` · `PUBLIC ARCHIVE` 꼴)는 허용하고, 문장과 큰 제목은 대문자로 쓰지 않는다.

## 6. Product Direction

`Outside` 는 바깥에서 펼쳐 보는 면이다. 시리즈 배너, 반복 사물, 색과 표면, 관계 후보를 비교한다. 핵심은 이미지와 관찰 사실을 잘라 보이지 않게 넓게 보여 주고, 해석은 후보로 분리하는 것이다.

`Inside` 는 안으로 들어가는 면이다. 같은 기록을 공간, 이동, 시간, 감각, 대화의 경험으로 다룬다. kiheon.app 보호면에서 다루고, 공개 전에는 kiheon.com 에서 링크를 열지 않는다.

`Slides` 는 검증된 원문을 발표 구조와 배포 가능한 장표로 옮기는 면이다. kiheon.app 보호면에 있고 아직 공개하지 않았다.

`Universe` 는 다른 면보다 상위다. 전체 구조, 공개 가능 수량, 게이트 상태, 제품 라인업을 관측한다.

## 7. Domain And Gate

`kiheon.com` 은 공개 정문이다. 검색 가능하거나 공개 공유 가능한 제품은 이 도메인을 최종 canonical 로 삼는다.

`kiheon.app` 은 로그인, 본인 전용, 실험적 인터랙션, 개인화 경험의 집이다. Inside, Slides, 본인 검토, 보호된 실행 환경은 이쪽에 둔다.

게이트는 네 단계로 둔다.

| Gate | Meaning | Link behavior |
|---|---|---|
| Open | 공개 열람 가능 | normal link |
| Quiet public | URL 접근 가능, 검색 제한 | link only in approved contexts |
| Gated | 로그인 또는 권한 필요 | show status, route through app gate |
| Owner only | 본인 전용 | no public link |

## 8. Asset Registry

| Asset | Current source |
|---|---|
| Core tokens | `assets/site.css`, `assets/tokens.css` |
| Fonts | `assets/fonts/` (Life Universe Sans · Hangul · Mono, OFL 고지 포함) |
| Public surface map | `assets/diagrams/klu-system-map.svg` |
| Blog series covers | `series/*/assets/series-banner.jpg` |
| Outside source images | `archive/world-atlas/assets/*.jpg` |
| Public archive styles | `assets/archive.css` |
| Outside styles | `archive/world-atlas/world-atlas.css` |

제품별 새 구현은 이 자산의 이름과 역할을 먼저 정하고, 같은 토큰 위에서 구현한다. 디자인 시스템은 별도 장식층이 아니라 제품 구조, 브랜드 언어, 공개 게이트와 함께 움직이는 운영 자산이다.
