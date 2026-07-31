const LOOPBACK_ORIGIN = "http://127.0.0.1:8787";
const HEALTH_URL = `${LOOPBACK_ORIGIN}/health`;
const RESPONSE_URL = `${LOOPBACK_ORIGIN}/v1/responses`;
const REQUEST_TIMEOUT_MS = 45_000;

export const VOICE_OFFLINE_MESSAGE =
  "이 Mac에서 음성 안내를 먼저 켠 뒤 다시 눌러 주세요.";

function requestError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw requestError("invalid_response");
  }
}

export class VoiceTransport {
  constructor({ fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch?.bind(globalThis);
    this.timeoutMs = timeoutMs;
    this.available = false;
    this.pending = new Set();
  }

  async request(url, options = {}) {
    if (typeof this.fetchImpl !== "function") {
      throw requestError("unavailable");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const upstreamSignal = options.signal;
    const abortFromUpstream = () => controller.abort();
    upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
    this.pending.add(controller);

    try {
      return await this.fetchImpl(url, {
        ...options,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch (error) {
      throw requestError(error?.name === "AbortError" ? "cancelled" : "unavailable", error);
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
      this.pending.delete(controller);
    }
  }

  async checkAvailability({ signal } = {}) {
    this.available = false;
    const response = await this.request(HEALTH_URL, {
      method: "GET",
      signal,
    });
    const payload = await readJson(response);

    if (!response.ok || payload?.ok !== true) {
      throw requestError("unavailable");
    }

    this.available = true;
    return true;
  }

  async ask(input, { signal } = {}) {
    const question = String(input ?? "").trim();
    if (!question) throw requestError("empty_input");

    if (!this.available) await this.checkAvailability({ signal });

    const response = await this.request(RESPONSE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: question }),
      signal,
    });
    const payload = await readJson(response);
    const output = typeof payload?.output_text === "string"
      ? payload.output_text.trim()
      : "";

    if (!response.ok || !output) {
      throw requestError("invalid_response");
    }

    return output;
  }

  reset() {
    this.available = false;
  }

  destroy() {
    this.reset();
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
  }
}

export const voiceTransportEndpoints = Object.freeze({
  health: HEALTH_URL,
  responses: RESPONSE_URL,
});
