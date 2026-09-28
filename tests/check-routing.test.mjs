import assert from "node:assert/strict";
import test from "node:test";
import { HIDDEN_PATHS, runRoutingChecks } from "./check-routing.mjs";

const BASE = "https://routing-fixture.invalid";
const PRIVATE_PATHS = new Set([
  "/universe/identity-dashboard/", "/universe/status-projection.json",
  "/universe/observatory-data.json", "/universe/build_observatory.py",
]);
const SENTINEL = "SYNTHETIC_PRIVATE_BODY_TOKEN";
const response = (url, status = 200, { location, body = "", forbidBody = false } = {}) => ({
  url, status, ok: status >= 200 && status < 300,
  headers: new Headers(location === undefined ? {} : { location }),
  async text() {
    assert.equal(forbidBody, false, "closed or redirect response body must never be read");
    return body;
  },
  get body() { throw new Error("response.body must never be accessed"); },
});

// Every request is intercepted here. This fixture never calls global fetch or reads page files.
function fixture({ hidden, open, privateStatus = 404, assetStatus = 200, projection = "ONTOLOGY_PROJECTION" } = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input);
    calls.push({ path: url.pathname, redirect: options.redirect, url: url.href });
    if (options.redirect === "manual") {
      const custom = hidden?.(url, options);
      if (custom) return custom;
      return response(url.href, url.pathname === "/" ? 200 : 307,
        { location: url.pathname === "/" ? undefined : "/", forbidBody: true });
    }
    const custom = open?.(url, options);
    if (custom) return custom;
    if (PRIVATE_PATHS.has(url.pathname)) return response(url.href, privateStatus, { forbidBody: true });
    if (url.pathname.endsWith("nodes-data.js")) return response(url.href, 200, { body: projection });
    if (url.pathname.endsWith("local.css")) return response(url.href, assetStatus);
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return response(url.href, 200, { body: '<link href="local.css">' });
  };
  return { calls, fetchImpl };
}
async function run(options) {
  const f = fixture(options);
  return { ...await runRoutingChecks({ base: BASE, fetchImpl: f.fetchImpl }), calls: f.calls };
}
const hiddenFailures = (result) => result.failures.filter((message) => HIDDEN_PATHS.some((path) => message.startsWith(`${path} →`)));

test("hidden matrix includes raw roots, index files, encoded keys, separators and nested posts", async () => {
  assert.equal(HIDDEN_PATHS.length, 53);
  assert.equal(new Set(HIDDEN_PATHS).size, HIDDEN_PATHS.length);
  for (const slug of ["went-in-first", "where-worlds-meet", "handed-down"]) {
    const encoded = `%${slug.charCodeAt(0).toString(16)}${slug.slice(1)}`;
    for (const path of [`/series/${slug}/`, `/series/${encoded}/`, `/s%65ries/${slug}/`,
      `/series%2F${slug}/`, `/series%2f${slug}/`]) {
      assert.ok(HIDDEN_PATHS.includes(path), path);
      assert.ok(HIDDEN_PATHS.includes(`${path}index.html`), path);
    }
    assert.ok(HIDDEN_PATHS.includes(`/series/${slug}`));
  }
  for (const path of ["/previews/series-00-08/", "/%70reviews/series-00-08/", "/previews/s%65ries-00-08/",
    "/previews%2Fseries-00-08/", "/previews%2fseries-00-08/",
    "/series/went-in-first/posts/01-parent-enters-first/",
    "/series/%77ent-in-first/posts/01-parent-enters-first/",
    "/series/went-in-first/posts/%301-parent-enters-first/",
    "/series/went-in-first%2Fposts%2F01-parent-enters-first/"]) {
    assert.ok(HIDDEN_PATHS.includes(path), path);
    assert.ok(HIDDEN_PATHS.includes(`${path}index.html`), path);
  }
  const result = await run();
  assert.deepEqual(result.failures, []);
  for (const path of HIDDEN_PATHS) {
    assert.ok(result.calls.some((call) => call.path === path && call.redirect === "manual"), path);
  }
});

test("all-open hidden responses fail without reading or echoing their bodies", async () => {
  const result = await run({ hidden: (url) => response(url.href, 200, { forbidBody: true, body: SENTINEL }) });
  assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length);
  assert.doesNotMatch(result.failures.join("\n"), new RegExp(SENTINEL));
});

test("plain redirects do not mask encoded-only exposure", async () => {
  const result = await run({ hidden: (url) => /%[0-9a-f]{2}/i.test(url.pathname)
    ? response(url.href, 200, { forbidBody: true }) : undefined });
  const encoded = HIDDEN_PATHS.filter((path) => /%[0-9a-f]{2}/i.test(path));
  assert.equal(hiddenFailures(result).length, encoded.length);
  for (const path of encoded) assert.ok(result.failures.some((message) => message.startsWith(`${path} →`)), path);
});

test("each supported redirect reaches a same-origin root 200 without reading bodies", async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const result = await run({ hidden: (url) => url.pathname === "/" ? undefined
      : response(url.href, status, { location: `${BASE}/`, forbidBody: true }) });
    assert.deepEqual(result.failures, [], `HTTP ${status}`);
  }
});

test("404 and 410 are accepted closed outcomes without a body read", async () => {
  for (const status of [404, 410]) {
    const result = await run({ hidden: (url) => response(url.href, status, { forbidBody: true }) });
    assert.deepEqual(result.failures, [], `HTTP ${status}`);
  }
});

test("other success, authorization, rate-limit and server responses cannot prove a hidden route is closed", async () => {
  for (const status of [201, 204, 300, 304, 401, 403, 429, 500, 503]) {
    const result = await run({ hidden: (url) => response(url.href, status, { forbidBody: true }) });
    assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length, `HTTP ${status}`);
  }
});

test("normalization may redirect within the same hidden route before reaching root", async () => {
  const result = await run({ hidden: (url) => {
    if (url.pathname === "/series/went-in-first") {
      return response(url.href, 308, { location: "/series/went-in-first/", forbidBody: true });
    }
    if (url.pathname === "/series/%77ent-in-first/") {
      return response(url.href, 308, { location: "/series/went-in-first/", forbidBody: true });
    }
  } });
  assert.deepEqual(result.failures, []);
});

test("wrong-origin, credential, query, hash, malformed and missing redirects fail without disclosure", async () => {
  for (const location of [
    `https://elsewhere.invalid/?token=${SENTINEL}`, `https://user:${SENTINEL}@routing-fixture.invalid/`,
    `/?token=${SENTINEL}`, `/#${SENTINEL}`, `http://[${SENTINEL}`, undefined,
  ]) {
    const result = await run({ hidden: (url) => response(url.href, 307, { location, forbidBody: true }) });
    assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length);
    assert.doesNotMatch(result.failures.join("\n"), new RegExp(`${SENTINEL}|elsewhere|https?://|user:`));
    assert.ok(result.calls.every((call) => !call.url.includes(SENTINEL)));
  }
});

test("redirect to an unrelated path cannot pass even if that destination is 404", async () => {
  const result = await run({ hidden: (url) => response(url.href, url.pathname === "/missing/" ? 404 : 307,
    { location: "/missing/", forbidBody: true }) });
  assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length);
  assert.ok(!result.calls.some((call) => call.path === "/missing/"));
});

test("self-redirect loops and overly long normalization chains are bounded", async () => {
  const loop = await run({ hidden: (url) => response(url.href, 308, { location: url.pathname, forbidBody: true }) });
  assert.equal(hiddenFailures(loop).length, HIDDEN_PATHS.length);
  assert.equal(loop.calls.filter((call) => call.redirect === "manual").length, HIDDEN_PATHS.length);
  const long = await run({ hidden: (url) => response(url.href, 308, { location: `${url.pathname}/`, forbidBody: true }) });
  assert.equal(hiddenFailures(long).length, HIDDEN_PATHS.length);
  assert.ok(long.calls.filter((call) => call.redirect === "manual").length <= HIDDEN_PATHS.length * 6);
});

test("a redirect to bare base still requires root 200, not root 503", async () => {
  const result = await run({ hidden: (url) => response(url.href, url.pathname === "/" ? 503 : 307,
    { location: BASE, forbidBody: true }) });
  assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length);
  assert.ok(hiddenFailures(result).every((message) => message.includes("503")));
});

test("network failure messages never echo the raw error or request credentials", async () => {
  const result = await run({ hidden: () => { throw new Error(`https://user:${SENTINEL}@example.invalid/?token=${SENTINEL}`); } });
  assert.equal(hiddenFailures(result).length, HIDDEN_PATHS.length);
  assert.doesNotMatch(result.failures.join("\n"), new RegExp(`${SENTINEL}|example.invalid|https?://`));
});

test("original page, relative-asset, projection and private-route checks remain active", async () => {
  const good = await run();
  assert.deepEqual(good.counts, { pages: 6, universeViews: 4, closed: 4, hidden: 53 });
  // Original 24 requests plus one relative CSS request for each of the six pages.
  assert.equal(good.calls.filter((call) => call.redirect !== "manual").length, 30);
  for (const path of PRIVATE_PATHS) assert.ok(good.calls.some((call) => call.path === path));
  assert.ok((await run({ assetStatus: 404 })).failures.some((message) => message.includes("자산")));
  assert.ok((await run({ projection: "NOT_PROJECTION" })).failures.some((message) => message.includes("투영 데이터 내용이 아님")));
  assert.equal((await run({ privateStatus: 200 })).failures.filter((message) => message.includes("비공개 경로 열림")).length, 4);
  const unavailable = await run({ open: (url) => url.pathname === "/" ? response(url.href, 503) : undefined });
  assert.ok(unavailable.failures.some((message) => message === "/ → HTTP 503"));
  const unslashed = await run({ open: (url) => url.pathname === "/archive" ? response(url.href, 200) : undefined });
  assert.ok(unslashed.failures.some((message) => message.includes("슬래시로 정규화되지 않음")));
});

test("public relative-asset failures also redact query values from diagnostics", async () => {
  const result = await run({ assetStatus: 404, open: (url) => url.pathname === "/archive"
    ? response(`${BASE}/archive/`, 200, { body: `<link href="local.css?token=${SENTINEL}">` }) : undefined });
  assert.ok(result.failures.some((message) => message.includes("/archive/local.css HTTP 404")));
  assert.doesNotMatch(result.failures.join("\n"), new RegExp(SENTINEL));
});

test("invalid base URLs are rejected before any request with a safe error", async () => {
  for (const base of [`https://user:${SENTINEL}@routing-fixture.invalid/`, `${BASE}/?token=${SENTINEL}`,
    `${BASE}/nested/`, `http://[${SENTINEL}?token=${SENTINEL}`]) {
    let requests = 0;
    await assert.rejects(runRoutingChecks({ base, fetchImpl: () => { requests += 1; } }), (error) => {
      assert.doesNotMatch(error.message, new RegExp(SENTINEL));
      return true;
    });
    assert.equal(requests, 0);
  }
});
