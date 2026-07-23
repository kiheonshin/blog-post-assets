# Kiheon Series Archive

신기헌의 글과 원자료를 시리즈 단위로 묶어 공개하는 정적 아카이브다. GitHub Pages에서 별도 빌드 없이 배포한다.

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
