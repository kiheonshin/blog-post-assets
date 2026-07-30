import assert from "node:assert/strict";
import test from "node:test";

import {
  LocalOAuthVoiceTransport,
  finalTranscript,
  readBridgeText,
} from "../oauth-voice-transport.mjs";


test("finalTranscript keeps only completed speech recognition results", () => {
  const event = {
    results: [
      Object.assign([{ transcript: "아직 말하는 중" }], { isFinal: false }),
      Object.assign([{ transcript: "이 시리즈의 핵심은?" }], { isFinal: true }),
    ],
  };

  assert.equal(finalTranscript(event), "이 시리즈의 핵심은?");
});


test("transport sends recognized text to the loopback OAuth bridge", async () => {
  const calls = [];
  const runtime = {
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({ output_text: "판단이 창작의 중심이 됩니다." }),
      };
    },
  };
  const transport = new LocalOAuthVoiceTransport(runtime);

  const answer = await transport.ask(
    "http://127.0.0.1:8787/v1/responses",
    "AIGC에서 인간의 역할은?",
  );

  assert.equal(answer, "판단이 창작의 중심이 됩니다.");
  assert.equal(calls[0].url, "http://127.0.0.1:8787/v1/responses");
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    input: "AIGC에서 인간의 역할은?",
    model: "chatgpt/gpt-5.4",
  });
});


test("readBridgeText rejects a response without output text", () => {
  assert.throws(
    () => readBridgeText({ output: [] }),
    /OAuth bridge response/i,
  );
});
