# Kiheon Life Universe Brand System v1

이 문서는 Kiheon Life Universe의 공개 제품 표면, 브랜드 정체성, 브랜드 자산, 디자인 시스템을 한 층위에서 관리하기 위한 기준이다.

## 1. Naming

공개 표면의 제품명은 아래 여섯 가지를 기준으로 한다.

| Product | Role | Public route |
|---|---|---|
| Blog | 글과 시리즈를 읽는 정문 | `/` |
| Public Archive | 공개 가능한 원자료와 근거의 색인 | `/archive/` |
| Universe | 전체 구조와 현재 상태를 관측하는 표면 | `/universe/`, `/map` |
| Outside | 공개 시리즈를 바깥에서 펼쳐 읽는 참고면 | `/archive/world-atlas/` |
| Inside | 기록 안으로 들어가는 경험 표면 | gated app route |
| Slides | 발표 서사와 시간 압축 표면 | planned |

`World Atlas`와 `Inner World`는 화면에 노출되는 제품명으로 쓰지 않는다. 기존 URL이나 파일명은 호환을 위해 남을 수 있지만, 사용자에게 보이는 명칭은 `Outside`와 `Inside`를 쓴다.

`Archive`는 두 의미를 구분한다. 로컬 보존 공간은 `Local Vault`, 웹 공개면은 `Public Archive`다.

## 2. Identity

Kiheon Life Universe는 한 사람의 기록을 무리하게 하나의 서사로 엮는 브랜드가 아니다. 원본을 닫고, 공개 가능한 표면만 열고, 각 표면이 자기 기능을 또렷하게 맡는 체계다.

브랜드 톤은 차가운 종이, 정밀한 잉크, 기능적 코발트, 세리프 제목, 모노 라벨, 얇은 계측선으로 정한다.

금지한다.

- 장식용 그라디언트
- 의미 없는 원형 장식
- 과도한 대문자 타이틀
- 공개되지 않은 표면을 링크처럼 보이게 하는 처리
- 내부 파일 경로, 원본 본문, 비공개 관계의 공개 표면 노출

## 3. Visual System

| Layer | Rule |
|---|---|
| Canvas | `#f3f3ef` 계열의 종이색을 기본으로 둔다. |
| Surface | 카드와 패널은 `#fbfbf8`을 쓰고, 1px 선으로 구분한다. |
| Ink | 본문은 짙은 잉크, 보조 정보는 회색, 동작 가능성은 코발트로만 표시한다. |
| Type | 큰 제목은 세리프, 본문은 한국어 산세리프, 수치와 상태는 모노를 쓴다. |
| Radius | 제품 카드와 도식 패널은 0-6px 안에서 제한한다. |
| Motion | 상태 변화와 hover는 150-200ms 범위의 짧은 반응만 쓴다. |

파란색은 장식색이 아니라 이동 가능성, 선택 상태, 검증 막, 공개 표면 상태를 표시하는 기능색이다.

## 4. Product Direction

`Outside`는 바깥에서 펼쳐 보는 면이다. 시리즈 배너, 반복 사물, 색과 표면, 관계 후보를 비교한다. 핵심은 이미지와 관찰 사실을 잘라 보이지 않게 넓게 보여 주고, 해석은 후보로 분리하는 것이다.

`Inside`는 안으로 들어가는 면이다. 같은 기록을 공간, 이동, 시간, 감각, 대화의 경험으로 다룬다. 공개 전에는 링크를 열지 않고, 게이트 정책이 정리된 뒤 `kiheon.app` 쪽에서 다룬다.

`Universe`는 두 표면보다 상위다. 전체 구조, 공개 가능 수량, 게이트 상태, 제품 라인업을 관측한다.

## 5. Domain And Gate

`kiheon.com`은 공개 정문이다. 검색 가능하거나 공개 공유 가능한 제품은 이 도메인을 최종 canonical로 삼는다.

`kiheon.app`은 로그인, 소유자 전용, 실험적 인터랙션, 개인화 경험의 집이다. Inside, Twin, Chorus, owner review, protected runtime은 이쪽에 둔다.

게이트는 네 단계로 둔다.

| Gate | Meaning | Link behavior |
|---|---|---|
| Open | 공개 열람 가능 | normal link |
| Quiet public | URL 접근 가능, 검색 제한 | link only in approved contexts |
| Gated | 로그인 또는 권한 필요 | show status, route through app gate |
| Owner only | 소유자 전용 | no public link |

## 6. Asset Registry

| Asset | Current source |
|---|---|
| Core tokens | `assets/site.css`, `assets/tokens.css` |
| Public surface map | `assets/diagrams/klu-system-map.svg` |
| Blog series covers | `series/*/assets/series-banner.jpg` |
| Outside source images | `archive/world-atlas/assets/*.jpg` |
| Public archive styles | `assets/archive.css` |
| Outside styles | `archive/world-atlas/world-atlas.css` |

제품별 새 구현은 이 자산의 이름과 역할을 먼저 정하고, 같은 토큰 위에서 구현한다. 디자인 시스템은 별도 장식층이 아니라 제품 구조, 브랜드 언어, 공개 게이트와 함께 움직이는 운영 자산이다.
