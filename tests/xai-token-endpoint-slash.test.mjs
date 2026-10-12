// 토큰 주소 끝 빗금 (2026-10-13 · 아틀라스)
// vercel.json 이 trailingSlash 를 켜면 빗금 없는 /api/xai-client-secret 은 308 로 돌려보내진다.
// 브라우저는 교차 출처 사전 요청에서 돌려보내기를 따라가지 않으므로, 전송 모듈이 부르는 토큰 주소는
// 모두 끝 빗금을 가져야 한다. 2026-08-19 설정 이후 공개 도슨트가 시작하지 못한 결함을 다시 막는다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("trailingSlash 가 켜져 있으면 전송 모듈의 토큰 주소는 모두 끝 빗금을 가진다", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const transport = await read("assets/assistant/xai-voice-transport.js");
  const endpoints = [...transport.matchAll(/\/api\/xai-client-secret(\/?)/g)];
  assert.equal(endpoints.length, 3, "운영 · 미리보기 · 로컬 주소 셋");
  if (config.trailingSlash === true) {
    for (const [whole, slash] of endpoints) assert.equal(slash, "/", `${whole} 는 끝 빗금이 있어야 한다`);
  }
});
