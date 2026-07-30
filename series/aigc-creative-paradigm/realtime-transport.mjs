const OPENAI_REALTIME_CALLS_URL =
  "https://api.openai.com/v1/realtime/calls";


export class RealtimeTransportError extends Error {
  constructor(message) {
    super(message);
    this.name = "RealtimeTransportError";
  }
}


export function readClientSecret(document) {
  if (
    document === null
    || typeof document !== "object"
    || typeof document.value !== "string"
    || document.value.length === 0
    || typeof document.expires_at !== "number"
  ) {
    throw new RealtimeTransportError("Invalid Realtime client secret");
  }
  return document.value;
}


function releaseMedia(peerConnection, dataChannel, mediaStream, audioElement) {
  dataChannel?.close();
  mediaStream?.getTracks().forEach((track) => track.stop());
  peerConnection?.close();
  if (audioElement) {
    audioElement.pause?.();
    audioElement.srcObject = null;
  }
}


export class RealtimeVoiceSession {
  constructor(peerConnection, dataChannel, mediaStream, audioElement) {
    this.peerConnection = peerConnection;
    this.dataChannel = dataChannel;
    this.mediaStream = mediaStream;
    this.audioElement = audioElement;
  }

  onEvent(listener) {
    this.dataChannel.addEventListener("message", (message) => {
      try {
        listener(JSON.parse(message.data));
      } catch (error) {
        if (!(error instanceof SyntaxError)) {
          throw error;
        }
      }
    });
  }

  close() {
    releaseMedia(
      this.peerConnection,
      this.dataChannel,
      this.mediaStream,
      this.audioElement,
    );
  }
}


export class RealtimeVoiceTransport {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async connect(tokenEndpoint) {
    let peerConnection = null;
    let dataChannel = null;
    let mediaStream = null;
    let audioElement = null;

    try {
      const tokenResponse = await this.runtime.fetch(tokenEndpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!tokenResponse.ok) {
        throw new RealtimeTransportError(
          "Could not start the Realtime session",
        );
      }
      const ephemeralKey = readClientSecret(await tokenResponse.json());

      peerConnection = this.runtime.createPeerConnection();
      audioElement = this.runtime.createAudioElement();
      audioElement.autoplay = true;
      peerConnection.addEventListener("track", (event) => {
        [audioElement.srcObject] = event.streams;
      });

      mediaStream = await this.runtime.getUserMedia({ audio: true });
      const [audioTrack] = mediaStream.getTracks();
      if (!audioTrack) {
        throw new RealtimeTransportError("No microphone track is available");
      }
      peerConnection.addTrack(audioTrack, mediaStream);

      dataChannel = peerConnection.createDataChannel("oai-events");
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await this.runtime.fetch(
        OPENAI_REALTIME_CALLS_URL,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!sdpResponse.ok) {
        throw new RealtimeTransportError(
          "OpenAI rejected the Realtime connection",
        );
      }
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });

      return new RealtimeVoiceSession(
        peerConnection,
        dataChannel,
        mediaStream,
        audioElement,
      );
    } catch (error) {
      releaseMedia(
        peerConnection,
        dataChannel,
        mediaStream,
        audioElement,
      );
      if (error instanceof Error) {
        throw error;
      }
      throw new RealtimeTransportError("Realtime connection failed");
    }
  }
}


export function browserVoiceRuntime() {
  return {
    createPeerConnection: () => new RTCPeerConnection(),
    createAudioElement: () => document.createElement("audio"),
    getUserMedia: (constraints) => (
      navigator.mediaDevices.getUserMedia(constraints)
    ),
    fetch: (url, options) => fetch(url, options),
  };
}
