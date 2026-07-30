import {
  RealtimeVoiceTransport,
  browserVoiceRuntime,
} from "./realtime-transport.mjs";


export function statusForRealtimeEvent(event) {
  switch (event.type) {
    case "input_audio_buffer.speech_started":
      return "듣고 있습니다. 말씀을 이어가세요.";
    case "input_audio_buffer.speech_stopped":
    case "response.created":
      return "답변을 준비하고 있습니다.";
    case "response.output_audio.delta":
      return "가상의 신기헌이 답하고 있습니다.";
    case "response.done":
      return "다시 듣고 있습니다.";
    case "error":
      return "대화 중 오류가 생겼습니다. 잠시 후 다시 시도해 주세요.";
    default:
      return null;
  }
}


class RealtimeVoiceController {
  constructor(root, transport) {
    this.root = root;
    this.transport = transport;
    this.toggle = root.querySelector("[data-realtime-toggle]");
    this.status = root.querySelector("[data-realtime-status]");
    this.tokenEndpoint = root.dataset.tokenEndpoint;
    this.session = null;
  }

  mount() {
    if (!this.toggle || !this.status || !this.tokenEndpoint) {
      return;
    }
    this.toggle.addEventListener("change", () => {
      if (this.toggle.checked) {
        void this.start();
      } else {
        this.stop();
      }
    });
    window.addEventListener("pagehide", () => this.stop());
  }

  async start() {
    this.toggle.disabled = true;
    this.setStatus("마이크와 음성 대화를 연결하고 있습니다.", "connecting");
    try {
      this.session = await this.transport.connect(this.tokenEndpoint);
      this.session.onEvent((event) => {
        const message = statusForRealtimeEvent(event);
        if (message) {
          this.setStatus(
            message,
            event.type === "error" ? "error" : "active",
          );
        }
      });
      this.setStatus("연결되었습니다. 궁금한 것을 말해 보세요.", "active");
    } catch (error) {
      this.session = null;
      this.toggle.checked = false;
      const microphoneDenied = (
        error instanceof Error
        && error.name === "NotAllowedError"
      );
      this.setStatus(
        microphoneDenied
          ? "마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요."
          : "음성 대화를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        "error",
      );
    } finally {
      this.toggle.disabled = false;
    }
  }

  stop() {
    this.session?.close();
    this.session = null;
    if (this.toggle) {
      this.toggle.checked = false;
    }
    this.setStatus("실시간 대화가 꺼졌습니다.", "idle");
  }

  setStatus(message, state) {
    this.status.textContent = message;
    this.status.dataset.state = state;
  }
}


if (typeof document !== "undefined") {
  const root = document.querySelector("[data-realtime-voice]");
  if (root) {
    new RealtimeVoiceController(
      root,
      new RealtimeVoiceTransport(browserVoiceRuntime()),
    ).mount();
  }
}
