import { describe, test, expect, vi, afterEach } from "vitest";

// Mock the Anthropic SDK - factory is hoisted, so everything must be inline
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "APIError";
    }
  }

  const MockAnthropic = vi.fn(() => ({
    messages: { create: vi.fn() },
  }));
  (MockAnthropic as unknown as { APIError: typeof APIError }).APIError = APIError;

  return { default: MockAnthropic };
});

import { POST } from "../route";
import Anthropic from "@anthropic-ai/sdk";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/classify-llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleTx = {
  date: "2025-01-01",
  amount: "100",
  direction: "debit" as const,
  counterparty: "Test GmbH",
  reference: "Invoice 123",
};

describe("/api/classify-llm", () => {
  test("returns 400 when apiKey is missing", async () => {
    const req = makeRequest({ transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  test("returns 400 when transactions is empty", async () => {
    const req = makeRequest({ apiKey: "sk-test", transactions: [] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  test("returns 401 for invalid API key", async () => {
    const APIError = (Anthropic as unknown as { APIError: new (status: number, message: string) => Error & { status: number } }).APIError;
    const err = new APIError(401, "invalid api key");
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return { messages: { create: vi.fn().mockRejectedValue(err) } };
    });

    const req = makeRequest({ apiKey: "sk-bad", transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Ungültiger API-Key.");
  });

  test("returns 429 for rate limit", async () => {
    const APIError = (Anthropic as unknown as { APIError: new (status: number, message: string) => Error & { status: number } }).APIError;
    const err = new APIError(429, "rate limit exceeded");
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return { messages: { create: vi.fn().mockRejectedValue(err) } };
    });

    const req = makeRequest({ apiKey: "sk-ok", transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("Zu viele Anfragen");
  });

  test("returns suggestions on success", async () => {
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: '[{"index":0,"account":"6300","description":"Aufwand","confidence":"high"}]' }],
          }),
        },
      };
    });

    const req = makeRequest({ apiKey: "sk-good", transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0].account).toBe("6300");
  });

  test("returns empty suggestions for garbage LLM output", async () => {
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: "I cannot help with that" }],
          }),
        },
      };
    });

    const req = makeRequest({ apiKey: "sk-good", transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
  });
});

/**
 * The non-Anthropic providers.
 *
 * These go over plain fetch rather than an SDK, so the request shape is this
 * project's responsibility and worth pinning: the wrong header name or a
 * `max_tokens` where the provider now wants `max_completion_tokens` fails at
 * the provider, in production, with the user's own key.
 */
const SUGGESTION_JSON = '[{"index":0,"account":"6300","description":"Aufwand","confidence":"high"}]';

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("/api/classify-llm across providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends an OpenAI model to the Responses endpoint, not chat completions", async () => {
    // The current GPT-5.6 family is documented as requiring /v1/responses;
    // chat completions is the legacy path and rejects them in places.
    const fetchMock = stubFetch(200, {
      status: "completed",
      output: [
        { type: "reasoning", summary: [] },
        { type: "message", content: [{ type: "output_text", text: SUGGESTION_JSON }] },
      ],
    });

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5.6-sol",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions[0].account).toBe("6300");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-openai");
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe("gpt-5.6-sol");
    expect(sent.input).toContain("SKR04");
    expect(sent.max_output_tokens).toBeGreaterThan(0);
  });

  test("skips OpenAI reasoning items when reading the answer", async () => {
    // A reasoning model puts a reasoning item first; taking output[0] blindly
    // would return nothing at all.
    stubFetch(200, {
      status: "completed",
      output: [
        { type: "reasoning", summary: [{ type: "summary_text", text: "thinking out loud" }] },
        { type: "message", content: [{ type: "output_text", text: SUGGESTION_JSON }] },
      ],
    });

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5.6-luna",
      transactions: [sampleTx],
    });
    const data = await (await POST(req as unknown as Parameters<typeof POST>[0])).json();
    expect(data.suggestions).toHaveLength(1);
  });

  test("sends a Gemini model to the Google generateContent endpoint", async () => {
    const fetchMock = stubFetch(200, {
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: SUGGESTION_JSON }] } },
      ],
    });

    const req = makeRequest({
      apiKey: "AIza-test",
      provider: "google",
      model: "gemini-3.7-flash",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.suggestions).toHaveLength(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent",
    );
    // The key goes in a header, never the query string, so it stays out of
    // access logs and referrers.
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("AIza-test");
    expect(url).not.toContain("AIza-test");
  });

  test("forwards a custom model id verbatim", async () => {
    const fetchMock = stubFetch(200, {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "[]" }] }],
    });

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "some-model-released-tomorrow",
      transactions: [sampleTx],
    });
    await POST(req as unknown as Parameters<typeof POST>[0]);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).model).toBe("some-model-released-tomorrow");
  });

  test("says so when a reasoning model burns the whole token budget", async () => {
    // The failure mode that matters now that every frontier model thinks
    // first: an empty array and a truncated array both parse to zero
    // suggestions, so without this the user just sees nothing happen.
    stubFetch(200, { status: "incomplete", output: [] });

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5.6-sol",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("abgeschnitten");
  });

  test("reports Gemini hitting MAX_TOKENS the same way", async () => {
    stubFetch(200, {
      candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '[{"index' }] } }],
    });

    const req = makeRequest({
      apiKey: "AIza-test",
      provider: "google",
      model: "gemini-3.1-pro-preview",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(502);
  });

  test("does not cry truncation when the model simply had no suggestions", async () => {
    stubFetch(200, {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "[]" }] }],
    });

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5.6-luna",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toEqual([]);
  });

  test("rejects an unknown provider", async () => {
    const req = makeRequest({
      apiKey: "sk-test",
      provider: "definitely-not-a-provider",
      model: "x",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  test("requires an explicit model when the provider is not the default", async () => {
    // Otherwise the blank-model default (a Claude id) would be posted to OpenAI.
    const req = makeRequest({ apiKey: "sk-openai", provider: "openai", transactions: [sampleTx] });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  test("maps a provider 401 to the invalid-key message", async () => {
    stubFetch(401, { error: { message: "Incorrect API key provided" } });
    const req = makeRequest({
      apiKey: "sk-bad",
      provider: "openai",
      model: "gpt-5",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Ungültiger API-Key.");
  });

  test("passes a provider's own error message through", async () => {
    // A stale or mistyped model id is the likeliest failure with a free-text
    // model field, and only the provider can say so.
    stubFetch(404, { error: { message: "The model `gpt-9` does not exist" } });
    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-9",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("does not exist");
  });

  test("reports a timeout as a timeout rather than a stack trace", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(504);
    expect((await res.json()).error).toContain("nicht rechtzeitig");
  });

  test("reports an unreachable provider as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("nicht erreichbar");
  });

  test("skips an Anthropic thinking block when reading the answer", async () => {
    // Sonnet 5 and Opus 5 think by default and Fable 5 always does, so the
    // first content block is not the answer.
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            stop_reason: "end_turn",
            content: [
              { type: "thinking", thinking: "weighing 6300 against 6800" },
              { type: "text", text: SUGGESTION_JSON },
            ],
          }),
        },
      };
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      provider: "anthropic",
      model: "claude-fable-5",
      transactions: [sampleTx],
    });
    const data = await (await POST(req as unknown as Parameters<typeof POST>[0])).json();
    expect(data.suggestions[0].account).toBe("6300");
  });

  test("reports an Anthropic max_tokens stop as truncation", async () => {
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            stop_reason: "max_tokens",
            content: [{ type: "text", text: '[{"index": 0, "acc' }],
          }),
        },
      };
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      provider: "anthropic",
      model: "claude-fable-5",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("abgeschnitten");
  });

  test("survives a provider response in an unexpected shape", async () => {
    stubFetch(200, { choices: [] });
    const req = makeRequest({
      apiKey: "sk-openai",
      provider: "openai",
      model: "gpt-5",
      transactions: [sampleTx],
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    expect((await res.json()).suggestions).toEqual([]);
  });
});
