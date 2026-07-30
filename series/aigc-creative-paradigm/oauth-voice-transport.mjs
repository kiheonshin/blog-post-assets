const DEFAULT_MODEL = "chatgpt/gpt-5.4";


export class OAuthBridgeError extends Error {
  constructor(message) {
    super(message);
    this.name = "OAuthBridgeError";
  }
}


export function finalTranscript(event) {
  return Array.from(event.results ?? [])
    .filter((result) => result.isFinal)
    .map((result) => result[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}


export function readBridgeText(document) {
  if (
    document === null
    || typeof document !== "object"
    || typeof document.output_text !== "string"
    || document.output_text.length === 0
  ) {
    throw new OAuthBridgeError("Invalid OAuth bridge response");
  }
  return document.output_text;
}


export class LocalOAuthVoiceTransport {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async ask(endpoint, input) {
    let response;
    try {
      response = await this.runtime.fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input,
          model: DEFAULT_MODEL,
        }),
      });
    } catch {
      throw new OAuthBridgeError("Local OAuth bridge is unavailable");
    }

    if (!response.ok) {
      throw new OAuthBridgeError("Local OAuth bridge rejected the request");
    }
    return readBridgeText(await response.json());
  }
}


export function browserBridgeRuntime() {
  return {
    fetch: (url, options) => fetch(url, options),
  };
}
