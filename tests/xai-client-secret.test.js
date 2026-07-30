"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const handler = require("../api/xai-client-secret");
const { rateLimitWindows } = handler._internals;

function request({
  method = "POST",
  origin = "https://kiheonshin.github.io",
  address = "203.0.113.10",
} = {}) {
  return {
    method,
    headers: {
      origin,
      "x-forwarded-for": address,
    },
    socket: {},
  };
}

function response() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

test.beforeEach(() => {
  rateLimitWindows.clear();
  process.env.XAI_API_KEY = "test-key";
  process.env.VERCEL_ENV = "production";
});

test.afterEach(() => {
  delete process.env.XAI_API_KEY;
  delete process.env.VERCEL_ENV;
  delete global.fetch;
});

test("rejects requests outside the public site origins", async () => {
  const res = response();
  await handler(request({ origin: "https://example.com" }), res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { code: "origin_not_allowed" });
  assert.equal(res.headers.has("access-control-allow-origin"), false);
});

test("answers an allowed preflight without minting a token", async () => {
  global.fetch = () => {
    throw new Error("fetch should not run");
  };
  const res = response();
  await handler(request({ method: "OPTIONS" }), res);

  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(
    res.headers.get("access-control-allow-origin"),
    "https://kiheonshin.github.io",
  );
});

test("returns only the ephemeral value and expiry", async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.x.ai/v1/realtime/client_secrets");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    return {
      ok: true,
      async json() {
        return {
          value: "xai-realtime-client-secret-test",
          expires_at: 1_800_000_000,
          ignored: "not-public",
        };
      },
    };
  };

  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    value: "xai-realtime-client-secret-test",
    expires_at: 1_800_000_000,
  });
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
});

test("hides upstream billing and authentication details", async () => {
  global.fetch = async () => ({
    ok: false,
    status: 403,
    async json() {
      return { error: "private upstream detail" };
    },
  });

  const res = response();
  await handler(request(), res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { code: "voice_unavailable" });
});

test("limits token minting per client window", async () => {
  global.fetch = async () => ({
    ok: true,
    async json() {
      return { value: "ephemeral", expires_at: 1_800_000_000 };
    },
  });

  for (let index = 0; index < 4; index += 1) {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 200);
  }

  const limited = response();
  await handler(request(), limited);
  assert.equal(limited.statusCode, 429);
  assert.deepEqual(limited.body, { code: "rate_limited" });
  assert.equal(limited.headers.has("retry-after"), true);
});
