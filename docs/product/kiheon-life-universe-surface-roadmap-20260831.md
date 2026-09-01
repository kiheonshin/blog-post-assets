# Kiheon Life Universe Public Surface Roadmap - 2026-08-31

이 문서는 현재 공개 제품 표면을 정렬하고, 다음 구현 순서를 정하기 위한 작업 로드맵이다.

## 1. Current Public Products

| Product | Current URL | State | Next work |
|---|---|---|---|
| Blog | `https://kiheon.com/` | open | Series and Explore remain the entry flow. Product lineup sits below Explore. |
| Public Archive | `https://kiheon.com/archive/` | open, noindex | Refresh labels and keep source availability explicit. |
| Outside | `https://kiheon.com/archive/world-atlas/` | open | Rebuild as a visual comparison surface, not a generic atlas. |
| Universe | `https://kiheon-life-universe-observatory.vercel.app/map` | open public projection | Refresh copy and product map without exposing private bodies or real relations. |
| Inside | Vercel preview only | candidate | Rebuild as gated spatial experience. Do not make a public homepage link until gate is defined. |
| Slides | planned | no public route | Define after source packaging and brand asset rules are stable. |

## 2. Immediate Implementation Order

1. Stabilize naming on currently public pages.
2. Publish the brand system and product surface roadmap as sanitized repo docs.
3. Update Blog home and Public Archive labels.
4. Rebuild Outside around wide images, source crops, observation facts, and interpretation candidates.
5. Rebuild Inside around spatial navigation, mode, time state, and gated entry.
6. Update Universe map to reflect the latest product lineup and domain policy.
7. Decide `kiheon.com` and `kiheon.app` canonical route migration.

## 3. Domain Direction

`kiheon.com` should become the public canonical domain for open products: Blog, Public Archive, Universe, Outside, and approved Slides.

`kiheon.app` should become the gated domain for private or interactive products: Inside, owner review, Twin, Chorus, and protected runtime.

GitHub Pages remains a public hosting surface during migration. Existing GitHub Pages URLs should not be broken until canonical redirects and live QA pass.

## 4. Outside Rebuild Criteria

Outside is complete when a reader can compare public series through images first, then inspect metadata and reading proposals without losing the visual source.

Required interface traits:

- wide image viewer that does not get cut by sidebars
- synchronized selection and detail state in one screen
- observation facts separated from interpretation candidates
- scalable beyond the first five series
- source-safe image use and no private raw paths

## 5. Inside Rebuild Criteria

Inside is complete when it feels like entering the same record system from the opposite side, not reading another archive page.

Required interface traits:

- gated entry state
- spatial zones and movement model
- time state and mode state
- no public body leakage
- no public link until the gate is real
- prepared hooks for docent, Twin, Chorus, and future 3D/living experience

## 6. Release Harness

Every public release must pass:

- static syntax and link checks
- local render check
- browser QA at desktop and mobile sizes
- leak scan for local paths, private bodies, and internal-only labels
- exact commit SHA recorded before push
- live URL readback after deploy

Do not promote Inside or domain migration by copy change alone. Gate behavior and routing must be verified as product behavior.
