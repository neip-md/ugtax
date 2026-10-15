/**
 * One prompt in, one string of text out, for each supported provider.
 *
 * The route previously constructed an Anthropic client inline, so the provider
 * was welded to the endpoint. Everything downstream of this file is already
 * provider-agnostic: every provider returns JSON, so parseLlmResponse in
 * lib/llm.ts is unchanged.
 *
 * Anthropic goes through the official SDK, which is already a dependency.
 * OpenAI, Google and OpenRouter go through their REST endpoints directly
 * rather than adding three more SDKs for one request shape each: each is a
 * single POST with a documented JSON body, and fewer dependencies is fewer
 * things to audit in a tool that handles bank data.
 *
 * OpenRouter is the open-weight route: one key reaches models such as
 * DeepSeek, Mistral and gpt-oss, served by whichever inference provider
 * OpenRouter picks.
 *
 * Endpoints are fixed constants. A caller-supplied base URL would let anyone
 * point the hosted deployment's server-side fetch at an arbitrary host, so
 * local and self-hosted OpenAI-compatible endpoints are deliberately absent.
 *
 * Endpoints and response shapes verified against each provider's own API
 * reference on 2026-10-15.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ProviderId } from "./models";

/** A provider failure with an HTTP status the route can map to its own. */
export class LlmError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Below the route's own ceiling, so a slow provider surfaces as a timeout we
 * worded rather than as the platform killing the function mid-request. The
 * headroom matters more now that the default models think before answering:
 * the old 25s was shorter than a reasoning model needs on a full batch.
 */
const TIMEOUT_MS = 55_000;

export type LlmCall = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens: number;
};

export type LlmReply = {
  text: string;
  /**
   * The provider stopped at the token ceiling rather than finishing.
   *
   * Worth reporting separately because the symptom is indistinguishable from
   * a model that simply had nothing to suggest: a half-written JSON array
   * parses to zero suggestions either way. Every current frontier model
   * reasons before answering and those tokens come out of the same budget,
   * so this is the likely failure once someone picks one of the big models.
   */
  truncated: boolean;
};

export async function callLlm(call: LlmCall): Promise<LlmReply> {
  switch (call.provider) {
    case "anthropic":
      return callAnthropic(call);
    case "openai":
      return callOpenAi(call);
    case "google":
      return callGoogle(call);
    case "openrouter":
      return callOpenRouter(call);
  }
}

/**
 * Models that accept a server-side fallback on a policy decline.
 *
 * With `fallbacks: "default"` the API re-runs a declined request on the model
 * Anthropic recommends for that refusal category, inside the same call. Haiku
 * 5.5 has no fallback, and an id typed into the custom field may predate the
 * parameter, so it is only sent for the catalogued models that use it.
 */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"]);

/** Worded for the user, since a refusal otherwise looks like zero suggestions. */
const REFUSAL_MESSAGE =
  "Das Modell hat die Anfrage abgelehnt. Bitte ein anderes Modell wählen oder manuell klassifizieren.";

/**
 * No thinking configuration on purpose.
 *
 * Every current Claude model thinks by default, and Opus 5.5 and Fable 5.1
 * cannot turn it off at all. Every knob for tuning it is model-specific and
 * would 400 on the models that lack it, including any id typed into the
 * custom field, so the budget below carries the load instead.
 */
async function callAnthropic({ apiKey, model, prompt, maxTokens }: LlmCall): Promise<LlmReply> {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  try {
    const request = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const message = FALLBACK_MODELS.has(model)
      ? await client.beta.messages.create({
          ...request,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        })
      : await client.messages.create(request);
    // A decline is an HTTP 200, so it has to be caught before the content is
    // read: it carries no text, and would surface as an empty result.
    if (message.stop_reason === "refusal") throw new LlmError(422, REFUSAL_MESSAGE);
    // Join every text block rather than reading content[0]: thinking models
    // put a thinking block first, and reading index 0 returned nothing.
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("");
    return { text, truncated: message.stop_reason === "max_tokens" };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      throw new LlmError(typeof err.status === "number" ? err.status : 502, err.message);
    }
    throw err;
  }
}

/**
 * The Responses API, not chat completions.
 *
 * OpenAI's current models are documented as requiring /v1/responses; the
 * older endpoint is described as legacy and rejects some parameter
 * combinations on them outright. Responses also accepts the previous
 * generation, so this is one path for every id a user can type.
 */
async function callOpenAi({ apiKey, model, prompt, maxTokens }: LlmCall): Promise<LlmReply> {
  const data = await postJson("https://api.openai.com/v1/responses", {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: { model, input: prompt, max_output_tokens: maxTokens },
  });

  // output[] interleaves reasoning items with the message; the answer is the
  // output_text content inside the message items.
  const output = pick(data, "output");
  const text = !Array.isArray(output)
    ? ""
    : output
        .filter((item) => pick(item, "type") === "message")
        .flatMap((item) => {
          const content = pick(item, "content");
          return Array.isArray(content) ? content : [];
        })
        .filter((block) => pick(block, "type") === "output_text")
        .map((block) => pick(block, "text"))
        .filter((value): value is string => typeof value === "string")
        .join("");

  return { text, truncated: pick(data, "status") === "incomplete" };
}

async function callGoogle({ apiKey, model, prompt, maxTokens }: LlmCall): Promise<LlmReply> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;
  const data = await postJson(url, {
    headers: { "x-goog-api-key": apiKey },
    body: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    },
  });

  const parts = pick(data, "candidates", 0, "content", "parts");
  const text = !Array.isArray(parts)
    ? ""
    : parts
        // Thought summaries arrive as parts flagged `thought: true`; only the
        // answer parts hold the JSON.
        .filter((part) => pick(part, "thought") !== true)
        .map((part) => pick(part, "text"))
        .filter((value): value is string => typeof value === "string")
        .join("");

  return { text, truncated: pick(data, "candidates", 0, "finishReason") === "MAX_TOKENS" };
}

/**
 * OpenRouter's OpenAI-compatible chat completions endpoint.
 *
 * `zdr: true` routes only to endpoints with a zero-data-retention policy, and
 * `data_collection: "deny"` excludes providers that store or train on
 * prompts. Bank transactions should not go anywhere else, and OpenRouter's
 * default allows both. If no endpoint for the chosen model qualifies, the
 * request fails (a 404 naming the model) instead of being sent elsewhere.
 *
 * Reasoning models put their thinking in `message.reasoning`, so `content`
 * holds only the answer. The two attribution headers are optional and only
 * name the app on OpenRouter's side.
 */
async function callOpenRouter({ apiKey, model, prompt, maxTokens }: LlmCall): Promise<LlmReply> {
  const data = await postJson("https://openrouter.ai/api/v1/chat/completions", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://ugtax.de",
      "X-OpenRouter-Title": "UGtax",
    },
    body: {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      provider: { zdr: true, data_collection: "deny" },
    },
  });

  // A 200 can still carry an error instead of choices, for example when the
  // upstream provider failed mid-request.
  const error = pick(data, "error", "message");
  if (typeof error === "string") throw new LlmError(502, error);

  const content = pick(data, "choices", 0, "message", "content");
  return {
    text: typeof content === "string" ? content : "",
    truncated: pick(data, "choices", 0, "finish_reason") === "length",
  };
}

/** Walk a path into an unknown JSON value without asserting a shape onto it. */
function pick(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

async function postJson(
  url: string,
  init: { headers: Record<string, string>; body: unknown },
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LlmError(504, "Der Anbieter hat nicht rechtzeitig geantwortet.");
    }
    throw new LlmError(502, "Der Anbieter ist nicht erreichbar.");
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Left null; a non-JSON body from a provider is only useful as a status.
  }

  if (!res.ok) {
    // OpenAI, Google and OpenRouter all report failures as {"error": {"message": ...}},
    // and that message is the only thing that says *why* (unknown model,
    // billing, region). Passing it through is the difference between a
    // fixable error and a shrug.
    const message = pick(data, "error", "message");
    throw new LlmError(res.status, typeof message === "string" ? message : `HTTP ${res.status}`);
  }

  return data;
}
