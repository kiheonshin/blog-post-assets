# Kiheon Life Universe Public Surface Roadmap - 2026-08-31 (v1.1, 2026-10-20)

This roadmap lines up the public product surfaces and the order of the next work. v1.1 updates the surface table and the domain notes to what the live site answers on 2026-10-20, and points naming and writing rules to the brand system v1.1 (`docs/brand/kiheon-life-universe-brand-system-v1.md`).

## 1. Current Public Products

| Product | Current URL | State (measured 2026-10-20) | Next work |
|---|---|---|---|
| Blog | `https://kiheon.com/` | open | Series and Explore remain the entry flow. Product lineup sits below Explore. |
| Public Archive | `https://kiheon.com/archive/` | open, noindex | Keep labels current and source availability explicit. |
| Outside | `https://kiheon.com/archive/world-atlas/` | open, noindex | Visual comparison surface: images first, then metadata and reading proposals. |
| Universe | `https://kiheon.com/universe/` (map view `/universe/map/`) | open public projection | Refresh copy and product map without exposing private bodies or real relations. |
| Inside | `kiheon.app` (protected) | not public: the home page lists it as "no link · not public yet" | Rebuild as gated spatial experience. No public link until the gate is defined. |
| Slides | `kiheon.app` (protected) | not public: the home page lists it as "no link · not public yet" | Public route only after source packaging and brand asset rules are stable. |

`/map` is not a kiheon.com route (404). The observatory answers at `/universe/` and `/universe/map/` (200).

## 2. Implementation Order

1. Stabilize naming on currently public pages. 2026-10-20: two-layer names (the person at the front door, Kiheon Life Universe as the system), every public title ends with "· Kiheon Shin", and every public page carries one footer signature line.
2. Publish the brand system and product surface roadmap as sanitized repo docs. v1.1 on 2026-10-20.
3. Update Blog home and Public Archive labels.
4. Rebuild Outside around wide images, source crops, observation facts, and interpretation candidates.
5. Rebuild Inside around spatial navigation, mode, time state, and gated entry.
6. Update Universe map to reflect the latest product lineup and domain policy.
7. Decide `kiheon.com` and `kiheon.app` canonical route migration.

## 3. Domain Direction

`kiheon.com` is the public canonical domain for open products: Blog, Public Archive, Universe, Outside, and approved Slides.

`kiheon.app` is the gated domain for private or interactive products: Inside, Slides before approval, owner review, and protected runtime.

The GitHub Pages mirror still answers (200 on 2026-10-20). Existing GitHub Pages URLs should not be broken until canonical redirects and live QA pass.

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
- prepared hooks for the voice docent and future 3D experience

## 6. Release Harness

Every public release must pass:

- static syntax and link checks
- local render check
- browser QA at desktop and mobile sizes
- leak scan for local paths, private bodies, and internal-only labels
- brand checks: title tail, one footer signature per page, no em dash (U+2014) in authored text
- exact commit SHA recorded before push
- live URL readback after deploy

Do not promote Inside, Slides, or domain migration by copy change alone. Gate behavior and routing must be verified as product behavior.
