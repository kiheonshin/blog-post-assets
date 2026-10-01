const SCHEMA = "klu-docent-inspector-v1";
const OWNER_ORIGIN = "https://kiheon.app";
const AGENT_EVENTS = new Set([
  "turn_started", "observed", "tool_started", "tool_completed",
  "model_started", "model_completed", "contract_refused",
  "verification_started", "turn_completed", "turn_failed", "memory_cleared",
]);
const VOICE_EVENTS = new Set([
  "ready", "session_started", "speech_started", "speech_stopped",
  "user_transcript", "response_started", "assistant_transcript",
  "assistant_audio_started", "assistant_audio_ended", "response_done", "error",
]);
const TOOLS = new Set([
  "clarify_intent", "prepared_guide", "ground_public_context", "suggest_content",
]);
const ROUTES = new Set(["clarify", "prepared", "generated", "contract", "unresolved"]);
const REFUSALS = new Set(["R-1", "R-2", "R-3"]);
let port = null;
let nonce = "";

function safeId(value) {
  return typeof value === "string" && /^[a-z0-9-]{1,80}$/i.test(value) ? value : "";
}

export function inspectorParentAllowed(origin, childHostname) {
  if (origin === OWNER_ORIGIN) return true;
  return childHostname === "127.0.0.1" && /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
}

// Only known structure fields cross to the owner test frame. Question, answer,
// prompt, transcript, tokens and error objects are never copied or serialized.
export function sanitizeInspectorEvent(event, metadata = {}) {
  const type = String(event?.type ?? "");
  if (!AGENT_EVENTS.has(type) && !VOICE_EVENTS.has(type)) return null;
  const output = {
    type,
    channel: VOICE_EVENTS.has(type) ? "voice" : "text",
    scope: metadata.scope === "series" ? "series" : "content",
  };
  const instanceId = safeId(metadata.instanceId);
  const contentId = safeId(metadata.contentId);
  if (instanceId) output.instanceId = instanceId;
  if (contentId) output.contentId = contentId;
  if (Number.isSafeInteger(event?.traceId) && event.traceId > 0) output.traceId = event.traceId;
  if (TOOLS.has(event?.tool)) output.tool = event.tool;
  if (ROUTES.has(event?.route)) output.route = event.route;
  if (REFUSALS.has(event?.refusal)) output.refusal = event.refusal;
  if (type === "observed") {
    output.contextReady = event?.observation?.contextReady === true;
    output.lowSignal = event?.observation?.lowSignal === true;
    const count = event?.observation?.allowedEntryCount;
    output.allowedEntryCount = Number.isSafeInteger(count) && count >= 0 ? Math.min(count, 999) : 0;
  }
  if (type === "user_transcript" || type === "assistant_transcript") {
    output.final = event?.final === true;
    output.characterCount = typeof event?.transcript === "string"
      ? Math.min(event.transcript.length, 9999) : 0;
  }
  if (type === "turn_failed" || type === "error") output.failed = true;
  return output;
}

if (typeof window !== "undefined" && window.parent !== window &&
    new URLSearchParams(window.location.search).get("inspector") === "1") {
  window.addEventListener("message", (message) => {
    const data = message.data;
    if (message.source !== window.parent ||
        !inspectorParentAllowed(message.origin, window.location.hostname) ||
        data?.schema !== SCHEMA || data?.kind !== "connect" || data?.version !== 1 ||
        typeof data?.nonce !== "string" || !/^[a-f0-9-]{16,80}$/i.test(data.nonce) ||
        typeof message.ports?.[0]?.postMessage !== "function") return;
    port?.close?.();
    port = message.ports[0];
    nonce = data.nonce;
    port.postMessage({ schema: SCHEMA, kind: "ready", nonce, mode: "owner-test" });
  });
}

export function emitInspectorEvent(event, metadata = {}) {
  if (!port) return;
  const safe = sanitizeInspectorEvent(event, metadata);
  if (!safe) return;
  try {
    port.postMessage({ schema: SCHEMA, kind: "event", nonce, at: Date.now(), event: safe });
  } catch {
    port = null;
    nonce = "";
  }
}
