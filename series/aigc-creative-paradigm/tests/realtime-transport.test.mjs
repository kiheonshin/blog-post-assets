import assert from "node:assert/strict";
import test from "node:test";

import {
  RealtimeVoiceTransport,
  readClientSecret,
} from "../realtime-transport.mjs";
import { statusForRealtimeEvent } from "../realtime-voice.mjs";


class FakePeerConnection {
  constructor() {
    this.closed = false;
    this.dataChannel = new EventTarget();
    this.dataChannel.close = () => {};
    this.remoteDescription = null;
  }

  addEventListener() {}

  addTrack(track) {
    this.track = track;
  }

  createDataChannel(label) {
    this.dataChannel.label = label;
    return this.dataChannel;
  }

  async createOffer() {
    return { type: "offer", sdp: "local-offer" };
  }

  async setLocalDescription(description) {
    this.localDescription = description;
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }

  close() {
    this.closed = true;
  }
}


test("connect uses a short-lived token when creating the WebRTC call", async () => {
  const calls = [];
  const audioTrack = { stop() {} };
  const stream = { getTracks: () => [audioTrack] };
  const peer = new FakePeerConnection();
  const runtime = {
    createPeerConnection: () => peer,
    createAudioElement: () => ({ autoplay: false, srcObject: null }),
    getUserMedia: async () => stream,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === "https://auth.example/api/realtime-token") {
        return {
          ok: true,
          json: async () => ({ value: "ek_test", expires_at: 1893456000 }),
        };
      }
      return { ok: true, text: async () => "remote-answer" };
    },
  };

  const session = await new RealtimeVoiceTransport(runtime).connect(
    "https://auth.example/api/realtime-token",
  );

  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].url, "https://api.openai.com/v1/realtime/calls");
  assert.equal(calls[1].options.headers.Authorization, "Bearer ek_test");
  assert.equal(calls[1].options.headers["Content-Type"], "application/sdp");
  assert.deepEqual(peer.remoteDescription, {
    type: "answer",
    sdp: "remote-answer",
  });
  assert.equal(peer.dataChannel.label, "oai-events");

  session.close();
  assert.equal(peer.closed, true);
});


test("readClientSecret rejects an untrusted response without a token", () => {
  assert.throws(
    () => readClientSecret({ value: 42, expires_at: "later" }),
    /client secret/i,
  );
});


test("voice status follows the observable Realtime turn lifecycle", () => {
  assert.equal(
    statusForRealtimeEvent({ type: "input_audio_buffer.speech_started" }),
    "듣고 있습니다. 말씀을 이어가세요.",
  );
  assert.equal(
    statusForRealtimeEvent({ type: "response.output_audio.delta" }),
    "가상의 신기헌이 답하고 있습니다.",
  );
  assert.equal(
    statusForRealtimeEvent({ type: "response.done" }),
    "다시 듣고 있습니다.",
  );
});
