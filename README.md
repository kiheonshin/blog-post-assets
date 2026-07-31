# Kiheon Blog

신기헌의 생각과 경험에서 출발한 글과 원자료를 주제별 시리즈로 묶어 공개하는 개인 블로그다. GitHub Pages에서 별도 빌드 없이 배포한다.

## 정보 구조

```text
/
└── series/
    └── {series-slug}/
        ├── index.html
        ├── assets/
        ├── posts/
        │   └── {post-slug}/index.html
        └── sources/
            └── {source-slug}/index.html
```

- `/`: 여러 시리즈를 묶는 최상위 라이브러리
- `/series/{series-slug}/`: 한 시리즈의 소개, 글, 원자료를 묶는 허브
- `/series/{series-slug}/posts/{post-slug}/`: 개별 포스트
- `/series/{series-slug}/sources/{source-slug}/`: 연구 노트와 발표 자료 같은 원자료

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
- `DESIGN.md`: 시각 언어, 컴포넌트, 접근성 규칙

## 로컬 확인

프로젝트의 상위 디렉터리에서 정적 서버를 실행하면 GitHub Pages의 프로젝트 경로와 같은 조건으로 확인할 수 있다.

```sh
python3 -m http.server 4173 --directory ..
```

그다음 `http://127.0.0.1:4173/blog-post-assets/`를 연다.

## AIGC 시리즈 음성 도슨트

`series/aigc-creative-paradigm/`의 현재 도슨트는 이 블로그를 보는 소유자의 Mac에서만 실시간 질문을 처리한다.

```text
GitHub Pages 또는 로컬 정적 페이지
  → 사용자가 질문이나 음성 버튼을 직접 누름
  → http://127.0.0.1:8787의 Tamaverse ChatGPT OAuth bridge
  → 답변 텍스트만 브라우저로 반환
  → 브라우저 Web Speech로 선택 재생
```

- bridge는 `127.0.0.1`에만 bind하며 외부 네트워크에 서버를 열지 않는다.
- 허용 origin은 `http://127.0.0.1:4173`, `http://localhost:4173`, `https://kiheonshin.github.io` 세 개다.
- 페이지 진입이나 스크롤만으로 bridge, 마이크, 음성 재생을 시작하지 않는다.
- OAuth token과 인증 파일은 브라우저로 전달하지 않는다.
- bridge가 없는 기기에서는 준비된 안내만 사용할 수 있고, 직접 질문이나 마이크를 누르면 이 기기에서 음성 안내를 먼저 켜라는 복구 안내가 나온다.
- 현재 모델은 `chatgpt/gpt-5.4`, reasoning effort는 `low`다.

도슨트와 공개 컨텍스트의 경계 테스트는 별도 패키지 설치 없이 실행한다.

```sh
node --test tests/assistant-voice.test.mjs
```

기존 xAI Realtime 함수와 `assets/voice-agent.js`는 과거 구현을 보존하기 위해 남아 있지만 현재 도슨트 페이지에서는 import하지 않는다. API credit과 별도 공개 승인 없이 다시 활성화하지 않는다.
