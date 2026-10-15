/**
 * The LLM catalogue shown in the picker.
 *
 * Two things live here because both the client picker and the API route need
 * them: which models are offered, and which provider each one belongs to.
 *
 * A hardcoded list goes stale every time a provider ships a model, which is
 * exactly how the picker ended up offering only three Anthropic models. The
 * "custom" escape hatch in the UI is the durable half of the fix: a model
 * released tomorrow is usable without a deploy, because the id is just a
 * string the route forwards. This list is the convenience layer on top.
 */

export const PROVIDERS = ["anthropic", "openai", "google", "openrouter"] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export type ModelOption = {
  /** The id sent to the provider verbatim. */
  id: string;
  provider: ProviderId;
  /** i18n key under the "upload" namespace. */
  labelKey: string;
};

/**
 * Verified against each provider's own model documentation on 2026-10-15.
 * Cheapest first within a provider, since that is the sane default for
 * classifying a few dozen bank rows.
 *
 * The OpenRouter group is the open-weight option: every model in it is
 * published under an open licence (Apache-2.0 or MIT), so the same weights can
 * also be run on your own hardware. OpenRouter is just the hosted route that
 * works from ugtax.de with one key.
 */
export const MODELS: ModelOption[] = [
  { id: "claude-haiku-5-5", provider: "anthropic", labelKey: "llmHaiku" },
  { id: "claude-sonnet-5-5", provider: "anthropic", labelKey: "llmSonnet" },
  { id: "claude-opus-5-5", provider: "anthropic", labelKey: "llmOpus" },
  { id: "claude-fable-5-1", provider: "anthropic", labelKey: "llmFable" },
  { id: "gpt-6-luna", provider: "openai", labelKey: "llmGptLuna" },
  { id: "gpt-6.1-sol", provider: "openai", labelKey: "llmGptSol" },
  { id: "gpt-6-astra", provider: "openai", labelKey: "llmGptAstra" },
  { id: "gemini-3.5-flash-lite", provider: "google", labelKey: "llmGeminiFlashLite" },
  { id: "gemini-3.8-flash", provider: "google", labelKey: "llmGeminiFlash" },
  { id: "gemini-4-argon", provider: "google", labelKey: "llmGeminiArgon" },
  { id: "openai/gpt-oss-120b", provider: "openrouter", labelKey: "llmGptOss" },
  { id: "mistralai/mistral-small-2603", provider: "openrouter", labelKey: "llmMistralSmall" },
  { id: "deepseek/deepseek-v4.1-flash", provider: "openrouter", labelKey: "llmDeepSeekFlash" },
  { id: "deepseek/deepseek-v4-pro-0813", provider: "openrouter", labelKey: "llmDeepSeekPro" },
];

export const DEFAULT_PROVIDER: ProviderId = "anthropic";
export const DEFAULT_MODEL = "claude-haiku-5-5";

/** Provider display names. Proper nouns, so not translated. */
export const PROVIDER_NAME: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  openrouter: "OpenRouter",
};

/** Shape hint for the key field, so a key pasted into the wrong provider is obvious. */
export const KEY_PLACEHOLDER: Record<ProviderId, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  google: "AIza...",
  openrouter: "sk-or-v1-...",
};

/**
 * Ids that changed shape but still address the same model.
 *
 * A session persisted before multi-provider support holds the dated Haiku id.
 * It still resolves at Anthropic, and canonicalising it keeps it consistent
 * with the undated form. Superseded models are deliberately not mapped to
 * their successors: that would silently swap a model the user chose.
 */
const RENAMED: Record<string, string> = {
  "claude-haiku-4-5-20251001": "claude-haiku-4-5",
};

export function canonicalModelId(id: string): string {
  return RENAMED[id] ?? id;
}

export function findModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === canonicalModelId(id));
}

/** The provider a catalogued model belongs to, or undefined for a custom id. */
export function providerForModel(id: string): ProviderId | undefined {
  return findModel(id)?.provider;
}

/** Catalogue grouped for <optgroup>, in PROVIDERS order. */
export function modelsByProvider(): { provider: ProviderId; models: ModelOption[] }[] {
  return PROVIDERS.map((provider) => ({
    provider,
    models: MODELS.filter((m) => m.provider === provider),
  })).filter((g) => g.models.length > 0);
}
