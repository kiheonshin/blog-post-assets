"use strict";

const XAI_CLIENT_SECRET_URL =
  "https://api.x.ai/v1/realtime/client_secrets";
const TOKEN_LIFETIME_SECONDS = 120;
const XAI_REALTIME_MODEL = "grok-voice-think-fast-1.0";
const BUILT_IN_VOICES = Object.freeze(["ara", "eve", "rex", "sal", "leo"]);
const DEFAULT_BUILT_IN_VOICE = "ara";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 4;

const ALLOWED_ORIGINS = new Set([
  "https://kiheonshin.github.io",
  "https://blog-post-assets.vercel.app",
  "https://blog-post-assets-kiheonshins-projects.vercel.app",
]);

const VERCEL_PREVIEW_ORIGIN =
  /^https:\/\/blog-post-assets-[a-z0-9-]+-kiheonshins-projects\.vercel\.app$/;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

const rateLimitWindows =
  globalThis.__kiheonVoiceRateLimitWindows ??
  (globalThis.__kiheonVoiceRateLimitWindows = new Map());

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin)) {
    return true;
  }

  return process.env.VERCEL_ENV !== "production" && LOCAL_ORIGIN.test(origin);
}

function setResponseHeaders(response, origin) {
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Vary", "Origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function getClientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",", 1)[0].trim();
  }
  return request.socket?.remoteAddress ?? "unknown";
}

function checkRateLimit(request, now = Date.now()) {
  const address = getClientAddress(request);
  const current = rateLimitWindows.get(address);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitWindows.set(address, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.startedAt)) / 1000),
    );
    return { allowed: false, retryAfter };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function sendJson(response, status, body) {
  return response.status(status).json(body);
}

async function handler(request, response) {
  const origin = request.headers.origin;

  if (typeof origin !== "string" || !isAllowedOrigin(origin)) {
    return sendJson(response, 403, { code: "origin_not_allowed" });
  }

  setResponseHeaders(response, origin);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    return sendJson(response, 405, { code: "method_not_allowed" });
  }

  const limit = checkRateLimit(request);
  if (!limit.allowed) {
    response.setHeader("Retry-After", String(limit.retryAfter));
    return sendJson(response, 429, { code: "rate_limited" });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, { code: "voice_not_configured" });
  }

  const voiceId = (process.env.XAI_VOICE_ID ?? DEFAULT_BUILT_IN_VOICE).toLowerCase();
  if (!BUILT_IN_VOICES.includes(voiceId)) {
    return sendJson(response, 503, { code: "voice_not_configured" });
  }

  let upstream;
  try {
    upstream = await fetch(XAI_CLIENT_SECRET_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: TOKEN_LIFETIME_SECONDS },
      }),
    });
  } catch {
    return sendJson(response, 502, { code: "voice_upstream_unreachable" });
  }

  if (!upstream.ok) {
    return sendJson(response, 503, { code: "voice_unavailable" });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return sendJson(response, 502, { code: "voice_upstream_invalid" });
  }

  if (
    typeof payload.value !== "string" ||
    payload.value.length === 0 ||
    typeof payload.expires_at !== "number"
  ) {
    return sendJson(response, 502, { code: "voice_upstream_invalid" });
  }

  return sendJson(response, 200, {
    value: payload.value,
    expires_at: payload.expires_at,
    default_voice: voiceId,
    voices: BUILT_IN_VOICES,
    model: XAI_REALTIME_MODEL,
  });
}

module.exports = handler;
module.exports._internals = {
  checkRateLimit,
  BUILT_IN_VOICES,
  DEFAULT_BUILT_IN_VOICE,
  isAllowedOrigin,
  rateLimitWindows,
};
