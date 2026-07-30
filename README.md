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

## AIGC 시리즈 음성 대화

`series/aigc-creative-paradigm/`의 음성 대화는 다음 경계를 따른다.

```text
GitHub Pages
  → blog-post-assets.vercel.app/api/xai-client-secret
  → 수명이 짧은 xAI 클라이언트 토큰
  → 브라우저와 xAI Realtime의 직접 음성 연결
```

- 장기 API 키는 Vercel의 서버 전용 `XAI_API_KEY` 환경 변수에만 둔다.
- 브라우저에는 120초짜리 임시 토큰만 전달한다.
- 토큰 API는 허용한 사이트 origin만 응답한다.
- 함수 인스턴스 안에서는 IP별 분당 4회의 보조 제한을 적용한다. 공개 활성화 전에는 Vercel Firewall에도 같은 경로의 지속적인 rate-limit 규칙을 둔다.
- 음성과 대화 내용은 이 저장소의 코드나 Vercel 함수에 저장하지 않는다.

Vercel 프로젝트를 연결한 뒤 키를 서버 환경 변수로 등록한다.

```sh
vercel link --yes --project blog-post-assets
vercel env add XAI_API_KEY production
vercel env add XAI_API_KEY preview
vercel dev
```

로컬 함수와 정적 페이지는 `http://127.0.0.1:3000/series/aigc-creative-paradigm/`에서 함께 확인한다.

토큰 함수의 경계 테스트는 별도 패키지 설치 없이 실행한다.

```sh
node --test tests/xai-client-secret.test.js
```
