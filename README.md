# Kiheon Blog

신기헌의 생각과 경험에서 출발한 글과 원자료를 시리즈, World Atlas, 아카이브의 세 가지 방식으로 읽는 개인 블로그다. GitHub Pages에서 별도 빌드 없이 배포한다.

## 정보 구조

```text
/
├── series/
│   └── {series-slug}/
│       ├── index.html
│       ├── assets/
│       ├── posts/
│       │   └── {post-slug}/index.html
│       └── sources/
│           └── {source-slug}/index.html
└── archive/
    ├── index.html
    ├── world-atlas/
    ├── chronicle/
    ├── transcript/
    ├── codex/
    └── screening/
```

- `/`: 여러 시리즈를 묶는 최상위 라이브러리
- `/series/{series-slug}/`: 한 시리즈의 소개, 글, 원자료를 묶는 허브
- `/series/{series-slug}/posts/{post-slug}/`: 개별 포스트
- `/series/{series-slug}/sources/{source-slug}/`: 연구 노트와 발표 자료 같은 원자료
- `/archive/`: 원자료 네 모듈, 공개 시리즈 해석층, 아직 이어지지 않은 이너월드 진입점을 구분해 여는 아카이브
- `/archive/world-atlas/`: 다섯 공개 시리즈의 구역·사물·색·관계 제안을 비교하는 공개 참고면

기존의 `import-post1.html`, `source-research.html` 같은 주소는 새 주소로 이동시키는 호환 페이지로 남겨 둔다.

## 시리즈 추가 방법

1. `series/{series-slug}/` 아래에 시리즈 허브, 포스트, 원자료, 에셋을 추가한다.
2. `assets/content-manifest.js`에 시리즈, 포스트, 원자료 정보를 한 번만 등록한다.
3. 시리즈 허브와 각 포스트에 `<series-nav>`를 배치한다.
4. 새 페이지의 canonical URL과 소셜 공유 이미지를 실제 공개 주소로 설정한다.
5. 375px, 768px, 1280px에서 레이아웃과 링크를 확인한다.

`Series Navigator`는 3편까지 파노라마 위에 겹치고, 4편 이상부터 이미지 아래의 자동 맞춤 그리드로 전환한다. 같은 행의 카드 높이는 항상 동일하다.

## 공통 파일

- `assets/content-manifest.js`: 시리즈·포스트·원자료의 단일 데이터 원본
- `assets/series-nav.js`: 최상위 라이브러리, 시리즈 내비게이션, 하단 글 링크 컴포넌트
- `assets/site.css`: 공통 토큰, 라이브러리, 시리즈 내비게이션 스타일
- `assets/world-atlas-entry.css`: 홈페이지와 아카이브의 World Atlas 진입면 스타일
- `archive/world-atlas/world-atlas-context.json`: 공개 참고면의 공개 안전 단일 문맥
- `archive/world-atlas/world-atlas.js`: 구역·관계 선택과 읽기 어댑터
- `DESIGN.md`: 시각 언어, 컴포넌트, 접근성 규칙

## 로컬 확인

프로젝트의 상위 디렉터리에서 정적 서버를 실행하면 GitHub Pages의 프로젝트 경로와 같은 조건으로 확인할 수 있다.

```sh
python3 -m http.server 4173 --directory ..
```

그다음 `http://127.0.0.1:4173/blog-post-assets/`를 연다.

## 음성 도슨트

### xAI Realtime v2

네 개의 공개 시리즈와 그 포스팅·공개 원자료는 모두 같은 v2 도슨트를 사용한다.

```text
GitHub Pages의 정적 페이지
  → 사용자가 대화 또는 음성 버튼을 직접 누름
  → Vercel의 /api/xai-client-secret에서 120초짜리 client secret 발급
  → 브라우저가 wss://api.x.ai/v1/realtime에 직접 연결
  → xAI Realtime이 한국어 전사·답변·음성을 처리
```

- 장기 `XAI_API_KEY`는 Vercel 환경 변수에만 두고 브라우저에는 전달하지 않는다.
- token endpoint는 허용된 origin만 받고, IP당 1분에 4회로 제한하며, 응답을 저장하지 않는다.
- 현재 모델은 `grok-voice-think-fast-1.0`, 입력 전사는 `grok-transcribe`, 턴 감지는 `server_vad`다.
- 음성은 xAI 기본 음성 `Ara`, `Eve`, `Rex`, `Sal`, `Leo`만 제공하며 기본값은 `Ara`다.
- 페이지 진입이나 스크롤만으로 연결·마이크·음성 재생을 시작하지 않는다.
- 대화 기록은 현재 브라우저 세션 안에서만 사용하며 블로그나 token endpoint에 저장하는 로직은 두지 않는다.

GitHub Pages는 정적 페이지와 공개 컨텍스트를 배포하고, Vercel은 `api/xai-client-secret.js`만 서버 함수로 배포한다. v2의 진입점은 `assets/assistant/voice-assistant-v2.js`, 전송 계층은 `assets/assistant/xai-voice-transport.js`다.

`assets/assistant/voice-assistant.js`와 `voice-assistant.css`는 이전 구현 기록으로만 남아 있으며, 공개 시리즈 표면에서는 불러오지 않는다. 링크가 숨겨진 Co-Creation 원자료 모듈 다섯 개는 현재 공개 정책에 따라 도슨트 대상에서 제외한다.

도슨트, 공개 컨텍스트, xAI 전송 계층과 token endpoint의 경계 테스트는 별도 패키지 설치 없이 실행한다.

```sh
node --test tests/*.test.mjs tests/*.test.js
```
