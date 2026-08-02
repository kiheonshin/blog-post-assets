const PRODUCTION_TOKEN_ENDPOINT =
  "https://blog-post-assets.vercel.app/api/xai-client-secret";
const XAI_REALTIME_ORIGIN = "wss://api.x.ai/v1/realtime";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_EARLY_AUDIO_FRAMES = 10;

export const GROK_BUILT_IN_VOICES = Object.freeze(["ara", "eve", "rex", "sal", "leo"]);

function isBuiltInVoice(voiceId) {
  return GROK_BUILT_IN_VOICES.includes(String(voiceId ?? "").toLowerCase());
}

function sessionVoice(token, requestedVoice) {
  const allowed = new Set(token.voices);
  const requested = String(requestedVoice ?? "").toLowerCase();
  return allowed.has(requested) ? requested : token.default_voice;
}

export const VOICE_OFFLINE_MESSAGE =
  "현재 음성 도슨트를 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";

function requestError(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function tokenEndpoint() {
  const currentLocation = globalThis.location;
  const hostname = currentLocation?.hostname ?? "";
  if (hostname.endsWith(".vercel.app")) {
    return `${currentLocation.origin}/api/xai-client-secret`;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://127.0.0.1:3000/api/xai-client-secret";
  }
  return PRODUCTION_TOKEN_ENDPOINT;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normaliseSpeed(value) {
  const speed = Number.parseFloat(value);
  if (!Number.isFinite(speed)) return 1;
  return Math.max(0.7, Math.min(1.5, speed));
}

function transcriptValue(event) {
  return String(event?.transcript ?? event?.text ?? "").trim();
}

function socketOpen(socket) {
  return socket?.readyState === 1;
}

export class VoiceTransport {
  constructor({
    fetchImpl,
    WebSocketImpl,
    AudioContextImpl,
    AudioWorkletNodeImpl,
    mediaDevices,
    timeoutMs = REQUEST_TIMEOUT_MS,
    endpoint,
  } = {}) {
    this.fetchImpl = fetchImpl ?? globalThis.fetch?.bind(globalThis);
    this.WebSocketImpl = WebSocketImpl ?? globalThis.WebSocket;
    this.AudioContextImpl = AudioContextImpl ?? globalThis.AudioContext;
    this.AudioWorkletNodeImpl = AudioWorkletNodeImpl ?? globalThis.AudioWorkletNode;
    this.mediaDevices = mediaDevices ?? globalThis.navigator?.mediaDevices;
    this.timeoutMs = timeoutMs;
    this.endpoint = endpoint ?? tokenEndpoint();
    this.pending = new Set();
    this.earlyAudioFrames = [];
    this.playingSources = new Set();
    this.playbackCursor = 0;
    this.sessionReady = false;
    this.active = false;
    this.starting = false;
    this.assistantTranscript = "";
    this.onEvent = () => {};
    this.completion = null;
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }

  async requestToken({ signal } = {}) {
    if (typeof this.fetchImpl !== "function") throw requestError("unsupported_browser");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const abortFromUpstream = () => controller.abort();
    signal?.addEventListener("abort", abortFromUpstream, { once: true });
    this.pending.add(controller);

    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (!response.ok) throw requestError(payload?.code ?? "unavailable");
      if (
        typeof payload?.value !== "string" || !payload.value ||
        typeof payload?.expires_at !== "number" ||
        !Array.isArray(payload?.voices) || !payload.voices.length ||
        !payload.voices.every(isBuiltInVoice) ||
        new Set(payload.voices).size !== payload.voices.length ||
        !isBuiltInVoice(payload?.default_voice) ||
        !payload.voices.includes(payload.default_voice) ||
        typeof payload?.model !== "string" || !payload.model
      ) {
        throw requestError("invalid_response");
      }
      return payload;
    } catch (error) {
      if (error?.code) throw error;
      throw requestError(error?.name === "AbortError" ? "cancelled" : "unavailable", error);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromUpstream);
      this.pending.delete(controller);
    }
  }

  ensureRealtimeSupport({ microphone = false, playback = false } = {}) {
    if (typeof this.WebSocketImpl !== "function") throw requestError("unsupported_browser");
    if (playback && typeof this.AudioContextImpl !== "function") {
      throw requestError("unsupported_browser");
    }
    if (microphone && (
      typeof this.AudioContextImpl !== "function" ||
      typeof this.AudioWorkletNodeImpl !== "function" ||
      typeof this.mediaDevices?.getUserMedia !== "function"
    )) {
      throw requestError("unsupported_browser");
    }
  }

  async prepareAudio({ microphone }) {
    const context = new this.AudioContextImpl({
      latencyHint: "interactive",
      sampleRate: 24_000,
    });
    await context.resume?.();
    this.audioContext = context;
    if (!microphone) return context.sampleRate ?? 24_000;

    let stream;
    try {
      [stream] = await Promise.all([
        this.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
        context.audioWorklet.addModule(new URL("../pcm-capture-worklet.js", import.meta.url)),
      ]);
    } catch (error) {
      await context.close?.();
      this.audioContext = null;
      throw error;
    }

    const source = context.createMediaStreamSource(stream);
    const capture = new this.AudioWorkletNodeImpl(context, "pcm-capture");
    const silentOutput = context.createGain();
    silentOutput.gain.value = 0;
    capture.port.onmessage = ({ data }) => {
      this.emit("input_level", { level: Math.min(1, (data?.level ?? 0) * 7) });
      this.sendAudio(data?.pcm);
    };
    source.connect(capture);
    capture.connect(silentOutput);
    silentOutput.connect(context.destination);
    this.mediaStream = stream;
    this.mediaSource = source;
    this.captureNode = capture;
    this.silentOutput = silentOutput;
    return context.sampleRate ?? 24_000;
  }

  realtimeUrl(model) {
    const url = new URL(XAI_REALTIME_ORIGIN);
    url.searchParams.set("model", model);
    return url.href;
  }

  async openSocket({ token, model, signal, onMessage, onClose }) {
    const socket = new this.WebSocketImpl(this.realtimeUrl(model), [
      `xai-client-secret.${token}`,
    ]);
    socket.binaryType = "arraybuffer";
    if (onMessage) socket.addEventListener("message", onMessage);
    if (onClose) socket.addEventListener("close", onClose);
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        socket.removeEventListener("close", handleClose);
        signal?.removeEventListener("abort", handleAbort);
      };
      const handleOpen = () => { cleanup(); resolve(); };
      const handleError = () => { cleanup(); reject(requestError("socket_open_failed")); };
      const handleClose = () => { cleanup(); reject(requestError("socket_closed")); };
      const handleAbort = () => {
        cleanup();
        socket.close(1000, "cancelled");
        reject(requestError("cancelled"));
      };
      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
      socket.addEventListener("close", handleClose, { once: true });
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
    return socket;
  }

  sessionConfiguration({ voiceId, instructions, sampleRate, speed, microphone, keyterms = [] }) {
    const input = {
      format: { type: "audio/pcm", rate: sampleRate },
      transport: "binary",
    };
    if (microphone) {
      input.transcription = {
        model: "grok-transcribe",
        language_hint: "ko",
        keyterms: keyterms.slice(0, 100),
      };
    }
    return {
      type: "session.update",
      session: {
        voice: voiceId,
        instructions,
        reasoning: { effort: "none" },
        turn_detection: microphone
          ? {
              type: "server_vad",
              threshold: 0.75,
              prefix_padding_ms: 333,
              silence_duration_ms: 800,
            }
          : null,
        audio: {
          input,
          output: {
            format: { type: "audio/pcm", rate: sampleRate },
            transport: "binary",
            speed: normaliseSpeed(speed),
          },
        },
      },
    };
  }

  async startVoiceSession({ voiceId, instructions, speed = 1, keyterms = [], signal, onEvent } = {}) {
    if (this.active || this.starting) return;
    this.ensureRealtimeSupport({ microphone: true, playback: true });
    this.onEvent = typeof onEvent === "function" ? onEvent : () => {};
    this.emit("connecting");
    const token = await this.requestToken({ signal });
    this.active = true;
    this.starting = true;
    this.sessionReady = false;

    try {
      const [sampleRate, socket] = await Promise.all([
        this.prepareAudio({ microphone: true }),
        this.openSocket({
          token: token.value,
          model: token.model,
          signal,
          onMessage: (event) => this.handleSocketMessage(event),
          onClose: () => {
            if (this.active) this.emit("error", { code: "socket_closed" });
          },
        }),
      ]);
      if (!this.active) throw requestError("cancelled");
      this.socket = socket;
      const selectedVoice = sessionVoice(token, voiceId);
      socket.send(JSON.stringify(this.sessionConfiguration({
        voiceId: selectedVoice,
        instructions,
        sampleRate,
        speed,
        microphone: true,
        keyterms,
      })));
      await this.waitForSessionReady({ socket, signal });
      this.starting = false;
      this.emit("session_started", { voiceId: selectedVoice, model: token.model });
    } catch (error) {
      this.stopVoiceSession({ quiet: true });
      throw error;
    }
  }

  async preview(text, {
    voiceId,
    instructions = "한국어 문장을 자연스럽게 읽습니다.",
    speed = 1,
    signal,
    onEvent,
  } = {}) {
    this.ensureRealtimeSupport({ playback: true });
    this.stopVoiceSession({ quiet: true });
    this.onEvent = typeof onEvent === "function" ? onEvent : () => {};
    this.emit("connecting");
    const token = await this.requestToken({ signal });
    this.active = true;
    this.starting = true;
    this.sessionReady = false;

    try {
      const sampleRate = await this.prepareAudio({ microphone: false });
      const socket = await this.openSocket({
        token: token.value,
        model: token.model,
        signal,
        onMessage: (event) => this.handleSocketMessage(event),
        onClose: () => {
          if (this.active) this.rejectCompletion("socket_closed");
        },
      });
      this.socket = socket;
      socket.send(JSON.stringify(this.sessionConfiguration({
        voiceId: sessionVoice(token, voiceId),
        instructions,
        sampleRate,
        speed,
        microphone: false,
      })));
      await this.waitForSessionReady({ socket, signal });
      this.starting = false;
      const completed = this.createCompletion({ signal });
      socket.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "force_message",
          role: "assistant",
          interruptible: true,
          content: [{ type: "output_text", text: String(text ?? "") }],
        },
      }));
      await completed;
    } finally {
      this.stopVoiceSession({ quiet: true });
    }
  }

  async ask(input, { signal } = {}) {
    const question = String(input ?? "").trim();
    if (!question) throw requestError("empty_input");
    this.ensureRealtimeSupport();
    const token = await this.requestToken({ signal });
    const socket = await this.openSocket({
      token: token.value,
      model: token.model,
      signal,
    });
    socket.send(JSON.stringify(this.sessionConfiguration({
      voiceId: token.default_voice,
      instructions: "공개 블로그 문맥에 근거해 한국어로 간결하고 정확하게 답합니다.",
      sampleRate: 24_000,
      speed: 1,
      microphone: false,
    })));
    await this.waitForSessionReady({ socket, signal });

    return new Promise((resolve, reject) => {
      let transcript = "";
      let settled = false;
      const timeout = setTimeout(() => finish(reject, requestError("timeout")), this.timeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", handleAbort);
        socket.removeEventListener("message", handleMessage);
        socket.removeEventListener("close", handleClose);
        try { socket.close(1000, "text_turn_complete"); } catch {}
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const handleAbort = () => finish(reject, requestError("cancelled"));
      const handleClose = () => finish(reject, requestError("socket_closed"));
      const handleMessage = (event) => {
        if (typeof event.data !== "string") return;
        let payload;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (payload.type === "response.output_audio_transcript.delta") {
          transcript += payload.delta ?? "";
        } else if (payload.type === "response.output_audio_transcript.done") {
          transcript = transcriptValue(payload) || transcript;
        } else if (payload.type === "response.done") {
          const answer = transcript.trim();
          finish(answer ? resolve : reject, answer || requestError("invalid_response"));
        } else if (payload.type === "error") {
          finish(reject, requestError("upstream_error"));
        }
      };
      signal?.addEventListener("abort", handleAbort, { once: true });
      socket.addEventListener("message", handleMessage);
      socket.addEventListener("close", handleClose, { once: true });
      socket.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: question }],
        },
      }));
      socket.send(JSON.stringify({ type: "response.create" }));
    });
  }

  waitForSessionReady({ socket, signal } = {}) {
    if (socket === this.socket && this.sessionReady) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(reject, requestError("timeout")), this.timeoutMs);
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        socket?.removeEventListener("message", handleMessage);
        socket?.removeEventListener("close", handleClose);
        signal?.removeEventListener("abort", handleAbort);
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const handleMessage = (event) => {
        if (typeof event.data !== "string") return;
        try {
          if (JSON.parse(event.data).type !== "session.updated") return;
        } catch { return; }
        finish(resolve);
      };
      const handleClose = () => finish(reject, requestError("socket_closed"));
      const handleAbort = () => finish(reject, requestError("cancelled"));
      socket?.addEventListener("message", handleMessage);
      socket?.addEventListener("close", handleClose, { once: true });
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }

  sendAudio(frame) {
    if (!frame || !this.active) return;
    if (this.sessionReady && socketOpen(this.socket)) {
      this.socket.send(frame);
      return;
    }
    this.earlyAudioFrames.push(frame);
    if (this.earlyAudioFrames.length > MAX_EARLY_AUDIO_FRAMES) this.earlyAudioFrames.shift();
  }

  handleSocketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      this.playAudio(event.data);
      return;
    }
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    switch (message.type) {
      case "session.updated":
        this.sessionReady = true;
        for (const frame of this.earlyAudioFrames) this.socket?.send(frame);
        this.earlyAudioFrames.length = 0;
        this.emit("ready");
        break;
      case "input_audio_buffer.speech_started":
        this.stopPlayback();
        this.emit("speech_started");
        break;
      case "input_audio_buffer.speech_stopped":
        this.emit("speech_stopped");
        break;
      case "conversation.item.input_audio_transcription.updated":
        this.emit("user_transcript", { transcript: transcriptValue(message), final: false });
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.emit("user_transcript", { transcript: transcriptValue(message), final: true });
        break;
      case "response.created":
        this.assistantTranscript = "";
        this.emit("response_started");
        break;
      case "response.output_audio_transcript.delta":
        this.assistantTranscript += message.delta ?? "";
        this.emit("assistant_transcript", {
          transcript: this.assistantTranscript.trim(),
          final: false,
        });
        break;
      case "response.output_audio_transcript.done":
        this.assistantTranscript = transcriptValue(message) || this.assistantTranscript;
        this.emit("assistant_transcript", {
          transcript: this.assistantTranscript.trim(),
          final: true,
        });
        break;
      case "response.done":
        if (this.completion) this.completion.responseDone = true;
        this.emit("response_done");
        this.maybeResolveCompletion();
        break;
      case "error":
        this.emit("error", { code: message?.error?.code ?? "upstream_error" });
        this.rejectCompletion(message?.error?.code ?? "upstream_error");
        break;
      default:
        break;
    }
  }

  playAudio(arrayBuffer) {
    if (!this.audioContext || !this.active) return;
    const pcm = new Int16Array(arrayBuffer);
    const audioBuffer = this.audioContext.createBuffer(1, pcm.length, this.audioContext.sampleRate);
    const channel = audioBuffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 0x8000;
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    const playbackWasIdle = this.playingSources.size === 0;
    this.playingSources.add(source);
    const startAt = Math.max(this.audioContext.currentTime + 0.015, this.playbackCursor);
    source.start(startAt);
    this.playbackCursor = startAt + audioBuffer.duration;
    if (playbackWasIdle) this.emit("assistant_audio_started");
    source.addEventListener("ended", () => {
      this.playingSources.delete(source);
      if (this.active && this.playingSources.size === 0) {
        this.playbackCursor = this.audioContext.currentTime;
        this.emit("assistant_audio_ended");
        this.maybeResolveCompletion();
      }
    });
  }

  createCompletion({ signal } = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.rejectCompletion("timeout"), this.timeoutMs);
      const handleAbort = () => this.rejectCompletion("cancelled");
      signal?.addEventListener("abort", handleAbort, { once: true });
      this.completion = {
        responseDone: false,
        resolve: () => {
          clearTimeout(timeout);
          signal?.removeEventListener("abort", handleAbort);
          this.completion = null;
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          signal?.removeEventListener("abort", handleAbort);
          this.completion = null;
          reject(error);
        },
      };
    });
  }

  maybeResolveCompletion() {
    if (this.completion?.responseDone && this.playingSources.size === 0) {
      this.completion.resolve();
    }
  }

  rejectCompletion(code) {
    this.completion?.reject(requestError(code));
  }

  updateSpeed(speed) {
    if (!this.sessionReady || !socketOpen(this.socket)) return;
    this.socket.send(JSON.stringify({
      type: "session.update",
      session: { audio: { output: { speed: normaliseSpeed(speed) } } },
    }));
  }

  interrupt() {
    if (socketOpen(this.socket)) {
      this.socket.send(JSON.stringify({ type: "response.cancel" }));
    }
    this.stopPlayback();
    this.emit("ready");
  }

  stopPlayback() {
    for (const source of this.playingSources) {
      try { source.stop(); } catch {}
    }
    this.playingSources.clear();
    if (this.audioContext) this.playbackCursor = this.audioContext.currentTime;
    this.maybeResolveCompletion();
  }

  stopVoiceSession({ quiet = false } = {}) {
    this.active = false;
    this.starting = false;
    this.sessionReady = false;
    this.earlyAudioFrames.length = 0;
    this.rejectCompletion("cancelled");
    this.stopPlayback();
    if (this.socket) {
      try { this.socket.close(1000, "client_closed"); } catch {}
      this.socket = null;
    }
    this.captureNode?.disconnect?.();
    this.mediaSource?.disconnect?.();
    this.silentOutput?.disconnect?.();
    this.captureNode = null;
    this.mediaSource = null;
    this.silentOutput = null;
    for (const track of this.mediaStream?.getTracks?.() ?? []) track.stop();
    this.mediaStream = null;
    if (this.audioContext?.state !== "closed") this.audioContext?.close?.();
    this.audioContext = null;
    this.assistantTranscript = "";
    if (!quiet) this.emit("stopped");
  }

  reset() {
    this.stopVoiceSession({ quiet: true });
  }

  destroy() {
    this.stopVoiceSession({ quiet: true });
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
    this.onEvent = () => {};
  }
}

export const voiceTransportEndpoints = Object.freeze({
  token: PRODUCTION_TOKEN_ENDPOINT,
  realtime: XAI_REALTIME_ORIGIN,
});
