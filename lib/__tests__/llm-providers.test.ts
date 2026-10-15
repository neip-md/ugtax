/**
 * The request each provider receives and how its reply is read.
 *
 * fetch is stubbed at the wire, so the Anthropic SDK is exercised for real and
 * the assertions are on the exact URL, headers and body that would leave the
 * server. No request reaches a provider.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLlm, LlmError, type LlmCall } from "../llm-providers";

type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

let captured: Captured[] = [];

function respondWith(status: number, payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      captured.push({
        url,
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

const base: Omit<LlmCall, "provider" | "model"> = {
  apiKey: "test-key",
  prompt: "classify these",
  maxTokens: 8192,
};

beforeEach(() => {
  captured = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openrouter", () => {
  const call: LlmCall = { ...base, provider: "openrouter", model: "deepseek/deepseek-v4.1-flash" };

  it("posts an OpenAI-compatible request restricted to zero-retention endpoints", async () => {
    respondWith(200, { choices: [{ message: { content: "[]" }, finish_reason: "stop" }] });
    await callLlm(call);

    const [req] = captured;
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.headers.get("authorization")).toBe("Bearer test-key");
    expect(req.body).toMatchObject({
      model: "deepseek/deepseek-v4.1-flash",
      messages: [{ role: "user", content: "classify these" }],
      max_tokens: 8192,
      provider: { zdr: true, data_collection: "deny" },
    });
  });

  it("reads the answer from content and ignores the reasoning field", async () => {
    respondWith(200, {
      choices: [
        {
          message: { content: '[{"index":0}]', reasoning: "thinking about it" },
          finish_reason: "stop",
        },
      ],
    });
    await expect(callLlm(call)).resolves.toEqual({ text: '[{"index":0}]', truncated: false });
  });

  it("reports a reply cut off at the token ceiling", async () => {
    respondWith(200, { choices: [{ message: { content: "" }, finish_reason: "length" }] });
    await expect(callLlm(call)).resolves.toEqual({ text: "", truncated: true });
  });

  it("surfaces an error delivered inside a 200", async () => {
    respondWith(200, { error: { code: 502, message: "Upstream provider failed" } });
    await expect(callLlm(call)).rejects.toMatchObject({
      status: 502,
      message: "Upstream provider failed",
    });
  });

  it("keeps OpenRouter's own wording when no compliant endpoint exists", async () => {
    respondWith(404, { error: { code: 404, message: "No endpoints found matching your data policy" } });
    const err = await callLlm(call).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).toMatchObject({ status: 404, message: "No endpoints found matching your data policy" });
  });
});

describe("google", () => {
  it("skips thought parts and joins the answer", async () => {
    respondWith(200, {
      candidates: [
        {
          content: { parts: [{ text: "summary of thinking", thought: true }, { text: "[]" }] },
          finishReason: "STOP",
        },
      ],
    });
    const reply = await callLlm({ ...base, provider: "google", model: "gemini-3.8-flash" });
    expect(reply).toEqual({ text: "[]", truncated: false });
    expect(captured[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
  });
});

describe("anthropic", () => {
  const message = (overrides: Record<string, unknown> = {}) => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: "[]" },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  });

  it("sends the default model without the fallback beta", async () => {
    respondWith(200, message());
    const reply = await callLlm({ ...base, provider: "anthropic", model: "claude-haiku-5-5" });

    expect(reply).toEqual({ text: "[]", truncated: false });
    expect(captured[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect(captured[0].body).not.toHaveProperty("fallbacks");
  });

  it("opts the larger models into the server-side fallback", async () => {
    respondWith(200, message({ model: "claude-opus-5-5" }));
    await callLlm({ ...base, provider: "anthropic", model: "claude-opus-5-5" });

    expect(captured[0].url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(captured[0].headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(captured[0].body.fallbacks).toBe("default");
  });

  it("turns a refusal into an error instead of an empty result", async () => {
    respondWith(200, message({ content: [], stop_reason: "refusal" }));
    await expect(
      callLlm({ ...base, provider: "anthropic", model: "claude-haiku-5-5" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("reports a reply cut off at the token ceiling", async () => {
    respondWith(200, message({ stop_reason: "max_tokens" }));
    const reply = await callLlm({ ...base, provider: "anthropic", model: "claude-haiku-5-5" });
    expect(reply.truncated).toBe(true);
  });
});
