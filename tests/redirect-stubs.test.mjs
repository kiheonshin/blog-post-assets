import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// 왜 있나 : df6c611 이 시리즈 08 폴더를 handed-down → where-worlds-meet 로 개명하면서
// 옛 주소에 되돌림을 안 남겼고, **어떤 검사도 그걸 못 잡았다.** 200 이던 두 주소가
// 조용히 404 가 될 참이었다(2026-09-05 실측). 다음 개명이 같은 식으로 끊지 않게,
// 되돌림 껍데기가 실제로 **풀리는지**를 여기서 본다.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 이 사이트는 두 표면에서 동시에 서빙된다. 루트 도메인과, 서브패스에 얹힌 미러다.
// 루트절대(`/series/…`)나 전체 URL을 쓰면 **미러에서 샌다** — 미러 방문자가 다른
// 호스트로 끌려가거나 없는 경로를 받는다. 그래서 되돌림은 상대 경로여야 한다.
const SURFACES = [
  "https://kiheon.com",
  "https://kiheonshin.github.io/blog-post-assets",
];

// 개명이 지운 자리. 이 둘이 사라지면 옛 링크가 죽는다 — 이름으로 못 박는다.
const REQUIRED = [
  "series/handed-down/index.html",
  "series/handed-down/posts/02-child-pokemon-and-me/index.html",
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // 점 디렉터리는 빌드 산출물·메타다(.vercel 의 output/static 은 소스의 복사본이라
    // 넣으면 같은 껍데기를 두 번 세고, 빌드가 만든 다른 형식까지 계약으로 잡는다).
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(target));
    else if (entry.name.endsWith(".html")) out.push(target);
  }
  return out;
}

async function stubs() {
  const found = [];
  for (const file of (await walk(repoRoot)).sort()) {
    const html = await readFile(file, "utf8");
    if (!/<meta http-equiv="refresh"/.test(html)) continue;
    found.push({ file, relative: path.relative(repoRoot, file), html });
  }
  return found;
}

// 껍데기가 서빙되는 주소. `…/index.html` 은 그 디렉터리로, 루트의 낱장은 그 파일로.
const servedAt = (relative) =>
  "/" + (relative.endsWith("index.html") ? relative.slice(0, -"index.html".length) : relative);

test("개명이 지운 두 주소에 되돌림이 서 있다", async () => {
  for (const relative of REQUIRED) {
    assert.ok(existsSync(path.join(repoRoot, relative)), `${relative} 가 없다`);
  }
});

test("되돌림의 네 겹이 같은 곳을 가리키고, 그 곳이 실재한다", async () => {
  const found = await stubs();
  assert.ok(found.length > 0);
  for (const { relative, html } of found) {
    const refresh = html.match(/http-equiv="refresh" content="0;\s*url=([^"]+)"/)?.[1];
    const script = html.match(/location\.replace\("([^"]+)"/)?.[1];
    const body = html.match(/<body>[\s\S]*?<a href="([^"]+)"/)?.[1];

    // 눈에 보이는 링크가 없으면 스크립트가 막힌 환경에서 막다른 길이 된다.
    assert.ok(refresh, `${relative} — refresh 없음`);
    assert.ok(script, `${relative} — script 없음`);
    assert.ok(body, `${relative} — 가시 링크 없음`);
    assert.equal(script, refresh, relative);
    assert.equal(body, refresh, relative);

    // 상대 경로여야 한다. 루트절대·전체 URL 은 미러에서 깨진다.
    assert.doesNotMatch(refresh, /^https?:\/\//, `${relative} — 전체 URL`);
    assert.doesNotMatch(refresh, /^\//, `${relative} — 루트절대`);

    // 두 표면 모두에서 풀어 보고, 루트 도메인 기준 경로가 디스크에 있는지 본다.
    const here = servedAt(relative);
    const resolved = SURFACES.map((base) => new URL(refresh, base + here));
    for (const url of resolved) {
      assert.ok(url.pathname.startsWith(new URL(SURFACES[1]).pathname) || url.origin.includes("kiheon.com"),
        `${relative} — ${url.href} 가 표면 밖으로 샌다`);
    }
    const onDisk = resolved[0].pathname.replace(/^\//, "") + (resolved[0].pathname.endsWith("/") ? "index.html" : "");
    assert.ok(existsSync(path.join(repoRoot, onDisk)), `${relative} → ${onDisk} 가 없다`);
  }
});

test("미발행 면으로 넘기는 되돌림은 그 상태를 물려받는다", async () => {
  // 시리즈 08 은 noindex 다. 껍데기가 색인되면 미발행 면이 색인 대상이 된다.
  for (const relative of REQUIRED) {
    const html = await readFile(path.join(repoRoot, relative), "utf8");
    assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/, relative);
    // noindex 대상에 canonical 을 걸면 신호가 부딪힌다 (series08-contract 와 같은 규칙).
    assert.doesNotMatch(html, /rel="canonical"/, relative);
  }
});
