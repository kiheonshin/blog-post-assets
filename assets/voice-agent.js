const AGENT_ID = "agent_oVWGWKWwmPvYiazl";
const XAI_REALTIME_URL = `wss://api.x.ai/v1/realtime?agent_id=${encodeURIComponent(AGENT_ID)}`;
const PRODUCTION_TOKEN_ENDPOINT =
  "https://blog-post-assets.vercel.app/api/xai-client-secret";
const MAX_EARLY_AUDIO_FRAMES = 10;

function tokenEndpoint() {
  if (location.hostname.endsWith(".vercel.app")) {
    return `${location.origin}/api/xai-client-secret`;
  }
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:3000/api/xai-client-secret";
  }
  return PRODUCTION_TOKEN_ENDPOINT;
}

function friendlyError(error) {
  if (error?.name === "NotAllowedError") {
    return "브라우저 설정에서 마이크 권한을 허용해 주세요.";
  }
  if (error?.name === "NotFoundError") {
    return "사용할 수 있는 마이크를 찾지 못했습니다.";
  }

  switch (error?.code) {
    case "voice_unavailable":
      return "현재 음성 대화 사용 한도가 닫혀 있습니다. 잠시 후 다시 시도해 주세요.";
    case "rate_limited":
      return "요청이 잠시 많았습니다. 1분 뒤 다시 시도해 주세요.";
    case "voice_not_configured":
      return "음성 대화 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.";
    case "unsupported_browser":
      return "이 브라우저는 실시간 음성 대화를 지원하지 않습니다.";
    default:
      return "음성 대화를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

class VoiceAgent {
  constructor(root) {
    this.root = root;
    this.action = root.querySelector("[data-voice-action]");
    this.status = root.querySelector("[data-voice-status]");
    this.transcript = root.querySelector("[data-voice-transcript]");
    this.meter = root.querySelector("[data-voice-meter]");

    this.active = false;
    this.starting = false;
    this.sessionReady = false;
    this.userStopping = false;
    this.earlyAudioFrames = [];
    this.playingSources = new Set();
    this.playbackCursor = 0;
    this.assistantTranscript = "";

    this.action.addEventListener("click", () => {
      if (this.active || this.starting) {
        this.stop();
      } else {
        this.start();
      }
    });

    window.addEventListener("pagehide", () => this.stop({ quiet: true }));
  }

  setUiState(state, message) {
    this.root.dataset.state = state;
    this.status.textContent = message;
  }

  setAction(active) {
    this.action.textContent = active ? "대화 종료" : "대화 시작";
    this.action.setAttribute("aria-pressed", String(active));
  }

  setTranscript(text) {
    this.transcript.textContent = text;
  }

  async requestClientSecret() {
    const response = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok || typeof payload.value !== "string") {
      const error = new Error("client_secret_failed");
      error.code = payload.code;
      throw error;
    }

    return payload.value;
  }

  async prepareAudio() {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.AudioContext ||
      !window.AudioWorkletNode
    ) {
      const error = new Error("unsupported_browser");
      error.code = "unsupported_browser";
      throw error;
    }

    const context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 24_000,
    });
    let stream;
    try {
      [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
        context.audioWorklet.addModule(
          new URL("./pcm-capture-worklet.js", import.meta.url),
        ),
        context.resume(),
      ]);
    } catch (error) {
      await context.close();
      throw error;
    }

    if (this.userStopping) {
      for (const track of stream.getTracks()) track.stop();
      await context.close();
      throw new Error("start_cancelled");
    }

    const source = context.createMediaStreamSource(stream);
    const capture = new AudioWorkletNode(context, "pcm-capture");
    const silentOutput = context.createGain();
    silentOutput.gain.value = 0;

    capture.port.onmessage = ({ data }) => {
      this.meter.style.setProperty(
        "--voice-level",
        String(Math.min(1, data.level * 7)),
      );
      this.sendAudio(data.pcm);
    };

    source.connect(capture);
    capture.connect(silentOutput);
    silentOutput.connect(context.destination);

    this.audioContext = context;
    this.mediaStream = stream;
    this.mediaSource = source;
    this.captureNode = capture;
    this.silentOutput = silentOutput;

    return context.sampleRate;
  }

  async openSocket(clientSecret, sampleRate) {
    const socket = new WebSocket(XAI_REALTIME_URL, [
      `xai-client-secret.${clientSecret}`,
    ]);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    await new Promise((resolve, reject) => {
      const removeListeners = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };
      const onOpen = () => {
        removeListeners();
        resolve();
      };
      const onError = () => {
        removeListeners();
        reject(new Error("websocket_open_failed"));
      };
      const onClose = () => {
        removeListeners();
        reject(new Error("websocket_closed"));
      };
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
      socket.addEventListener("close", onClose, { once: true });
    });

    socket.addEventListener("message", (event) => this.handleSocketMessage(event));
    socket.addEventListener("close", () => {
      if (this.active && !this.userStopping) {
        this.fail(new Error("websocket_closed"));
      }
    });

    socket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          turn_detection: {
            type: "server_vad",
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
          },
          audio: {
            input: {
              format: { type: "audio/pcm", rate: sampleRate },
              transport: "binary",
              transcription: {
                language_hint: "ko",
                keyterms: ["AIGC", "신기헌", "프롬프트", "창작자"],
              },
            },
            output: {
              format: { type: "audio/pcm", rate: sampleRate },
              transport: "binary",
            },
          },
        },
      }),
    );

    this.sessionReady = true;
    for (const frame of this.earlyAudioFrames) socket.send(frame);
    this.earlyAudioFrames.length = 0;
  }

  sendAudio(frame) {
    if (!this.active && !this.starting) return;

    if (
      this.sessionReady &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      this.socket.send(frame);
      return;
    }

    this.earlyAudioFrames.push(frame);
    if (this.earlyAudioFrames.length > MAX_EARLY_AUDIO_FRAMES) {
      this.earlyAudioFrames.shift();
    }
  }

  handleSocketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      this.playAudio(event.data);
      return;
    }

    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (message.type) {
      case "input_audio_buffer.speech_started":
        this.stopPlayback();
        this.setUiState("listening", "듣고 있어요");
        break;
      case "input_audio_buffer.speech_stopped":
        this.setUiState("thinking", "답을 생각하고 있어요");
        break;
      case "response.created":
        this.assistantTranscript = "";
        this.setUiState("thinking", "답을 생각하고 있어요");
        break;
      case "response.output_audio_transcript.delta":
        this.assistantTranscript += message.delta ?? "";
        if (this.assistantTranscript.trim()) {
          this.setTranscript(this.assistantTranscript.trim());
        }
        break;
      case "response.output_audio_transcript.done":
        if (typeof message.transcript === "string" && message.transcript.trim()) {
          this.assistantTranscript = message.transcript;
          this.setTranscript(message.transcript.trim());
        }
        break;
      case "response.done":
        if (this.playingSources.size === 0) {
          this.setUiState("ready", "말씀해 주세요");
        }
        break;
      case "error":
        this.fail(new Error("xai_realtime_error"));
        break;
      default:
        break;
    }
  }

  playAudio(arrayBuffer) {
    if (!this.audioContext || !this.active) return;

    const pcm = new Int16Array(arrayBuffer);
    const audioBuffer = this.audioContext.createBuffer(
      1,
      pcm.length,
      this.audioContext.sampleRate,
    );
    const channel = audioBuffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = pcm[index] / 0x8000;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    this.playingSources.add(source);

    const startAt = Math.max(
      this.audioContext.currentTime + 0.015,
      this.playbackCursor,
    );
    source.start(startAt);
    this.playbackCursor = startAt + audioBuffer.duration;
    this.setUiState("speaking", "답하고 있어요");

    source.addEventListener("ended", () => {
      this.playingSources.delete(source);
      if (this.active && this.playingSources.size === 0) {
        this.playbackCursor = this.audioContext.currentTime;
        this.setUiState("ready", "말씀해 주세요");
      }
    });
  }

  stopPlayback() {
    for (const source of this.playingSources) {
      try {
        source.stop();
      } catch {}
    }
    this.playingSources.clear();
    if (this.audioContext) this.playbackCursor = this.audioContext.currentTime;
  }

  async start() {
    this.starting = true;
    this.userStopping = false;
    this.setAction(true);
    this.setUiState("connecting", "마이크와 음성 에이전트를 연결하고 있어요");
    this.setTranscript("연결되면 바로 말씀하실 수 있습니다.");

    try {
      const clientSecret = await this.requestClientSecret();
      if (this.userStopping) return;
      const sampleRate = await this.prepareAudio();

      if (this.userStopping) {
        this.cleanup();
        return;
      }
      await this.openSocket(clientSecret, sampleRate);
      if (this.userStopping) {
        this.cleanup();
        return;
      }

      this.active = true;
      this.starting = false;
      this.setUiState("ready", "말씀해 주세요");
      this.setTranscript("궁금한 것을 말로 물어보세요.");
    } catch (error) {
      if (this.userStopping) return;
      this.fail(error);
    }
  }

  fail(error) {
    this.userStopping = true;
    this.cleanup();
    this.setAction(false);
    this.setUiState("error", "연결하지 못했어요");
    this.setTranscript(friendlyError(error));
  }

  stop({ quiet = false } = {}) {
    this.userStopping = true;
    this.cleanup();
    if (!quiet) {
      this.setAction(false);
      this.setUiState("idle", "대화 준비됨");
      this.setTranscript("버튼을 누르면 마이크 연결을 시작합니다.");
    }
  }

  cleanup() {
    this.active = false;
    this.starting = false;
    this.sessionReady = false;
    this.earlyAudioFrames.length = 0;
    this.meter.style.setProperty("--voice-level", "0");
    this.stopPlayback();

    if (this.socket) {
      this.socket.close(1000, "client_closed");
      this.socket = undefined;
    }

    this.captureNode?.disconnect();
    this.mediaSource?.disconnect();
    this.silentOutput?.disconnect();
    this.captureNode = undefined;
    this.mediaSource = undefined;
    this.silentOutput = undefined;

    for (const track of this.mediaStream?.getTracks() ?? []) track.stop();
    this.mediaStream = undefined;

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
    this.audioContext = undefined;
  }
}

const root = document.querySelector("[data-voice-agent]");
if (root) new VoiceAgent(root);
