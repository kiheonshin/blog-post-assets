import {
  LocalOAuthVoiceTransport,
  browserBridgeRuntime,
  finalTranscript,
} from "./oauth-voice-transport.mjs";


const LISTENING = "듣고 있습니다. 질문을 말씀해 주세요.";
const BRIDGE_ERROR =
  "로컬 OAuth 브리지를 먼저 실행해 주세요. 터미널 안내도 확인할 수 있습니다.";


export function buildVoicePrompt(question, pageContext) {
  return [
    "당신은 신기헌의 개인 블로그를 함께 읽는 한국어 음성 안내자입니다.",
    "아래 페이지 맥락에 근거해 질문에 자연스러운 한국어 4문장 이내로 답하세요.",
    "페이지 맥락에 없는 사실은 추측하지 말고 그 한계를 짧게 밝히세요.",
    "",
    `[페이지 맥락]\n${pageContext}`,
    "",
    `[질문]\n${question}`,
  ].join("\n");
}


function browserVoiceRuntime() {
  const Recognition = (
    window.SpeechRecognition
    || window.webkitSpeechRecognition
  );
  return {
    createRecognition: () => {
      if (!Recognition) {
        return null;
      }
      const recognition = new Recognition();
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = true;
      return recognition;
    },
    pageContext: () => (
      document.querySelector(".about")?.textContent?.trim() ?? ""
    ),
    speak: (text, onEnd) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = 1;
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    cancelSpeech: () => window.speechSynthesis.cancel(),
  };
}


export class OAuthVoiceController {
  constructor(root, transport, runtime) {
    this.root = root;
    this.transport = transport;
    this.runtime = runtime;
    this.toggle = root.querySelector("[data-oauth-voice-toggle]");
    this.status = root.querySelector("[data-oauth-voice-status]");
    this.endpoint = root.dataset.bridgeEndpoint;
    this.recognition = null;
    this.enabled = false;
    this.busy = false;
  }

  mount() {
    if (!this.toggle || !this.status || !this.endpoint) {
      return;
    }
    this.toggle.addEventListener("change", () => {
      if (this.toggle.checked) {
        this.start();
      } else {
        this.stop();
      }
    });
    window.addEventListener("pagehide", () => this.stop());
  }

  start() {
    const recognition = this.runtime.createRecognition();
    if (!recognition) {
      this.toggle.checked = false;
      this.setStatus(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome에서 열어 주세요.",
        "error",
      );
      return;
    }

    this.enabled = true;
    this.recognition = recognition;
    recognition.onstart = () => this.setStatus(LISTENING, "active");
    recognition.onresult = (event) => {
      const question = finalTranscript(event);
      if (question) {
        void this.answer(question);
      } else {
        this.setStatus("말씀을 듣고 있습니다…", "active");
      }
    };
    recognition.onerror = (event) => this.handleRecognitionError(event);
    recognition.onend = () => {
      if (this.enabled && !this.busy) {
        this.listen();
      }
    };
    this.listen();
  }

  listen() {
    try {
      this.recognition?.start();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "InvalidStateError")) {
        throw error;
      }
    }
  }

  async answer(question) {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.recognition?.stop();
    this.setStatus(`“${question}”에 답을 준비하고 있습니다.`, "connecting");

    const prompt = buildVoicePrompt(
      question,
      this.runtime.pageContext(),
    );
    try {
      const answer = await this.transport.ask(this.endpoint, prompt);
      this.setStatus(answer, "active");
      this.runtime.speak(answer, () => {
        this.busy = false;
        if (this.enabled) {
          this.listen();
        }
      });
    } catch {
      this.busy = false;
      this.enabled = false;
      this.toggle.checked = false;
      this.setStatus(BRIDGE_ERROR, "error");
    }
  }

  handleRecognitionError(event) {
    if (!this.enabled || event.error === "aborted") {
      return;
    }
    this.busy = false;
    this.enabled = false;
    this.toggle.checked = false;
    this.setStatus(
      event.error === "not-allowed"
        ? "마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요."
        : "음성을 인식하지 못했습니다. 다시 켜서 말씀해 주세요.",
      "error",
    );
  }

  stop() {
    this.enabled = false;
    this.busy = false;
    this.recognition?.abort();
    this.recognition = null;
    this.runtime.cancelSpeech();
    if (this.toggle) {
      this.toggle.checked = false;
    }
    this.setStatus("로컬 음성 대화가 꺼졌습니다.", "idle");
  }

  setStatus(message, state) {
    this.status.textContent = message;
    this.status.dataset.state = state;
  }
}


if (typeof document !== "undefined") {
  const root = document.querySelector("[data-oauth-voice]");
  if (root) {
    new OAuthVoiceController(
      root,
      new LocalOAuthVoiceTransport(browserBridgeRuntime()),
      browserVoiceRuntime(),
    ).mount();
  }
}
