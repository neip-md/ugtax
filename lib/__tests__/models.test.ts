/**
 * The model catalogue.
 *
 * The label test is the one that earns its place: a model added to MODELS
 * without its translation renders the raw i18n key in the picker, in both
 * locales, and nothing else would catch it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import {
  canonicalModelId,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  findModel,
  isProviderId,
  KEY_PLACEHOLDER,
  MODELS,
  modelsByProvider,
  PROVIDER_NAME,
  PROVIDERS,
  providerForModel,
} from "../models";

const MESSAGES_DIR = path.resolve(__dirname, "../../messages");

describe("model catalogue", () => {
  it("has no duplicate model ids", () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only names known providers", () => {
    for (const model of MODELS) {
      expect(isProviderId(model.provider), model.id).toBe(true);
    }
  });

  it("offers at least one model per provider", () => {
    for (const provider of PROVIDERS) {
      expect(MODELS.filter((m) => m.provider === provider).length, provider).toBeGreaterThan(0);
    }
  });

  it("has a display name and key placeholder for every provider", () => {
    for (const provider of PROVIDERS) {
      expect(PROVIDER_NAME[provider]).toBeTruthy();
      expect(KEY_PLACEHOLDER[provider]).toBeTruthy();
    }
  });

  it("defaults to a catalogued model belonging to the default provider", () => {
    const model = findModel(DEFAULT_MODEL);
    expect(model).toBeDefined();
    expect(model?.provider).toBe(DEFAULT_PROVIDER);
  });

  it("groups every model exactly once", () => {
    const grouped = modelsByProvider().flatMap((g) => g.models);
    expect(grouped).toHaveLength(MODELS.length);
  });

  it("resolves a renamed id to its current one", () => {
    // The id persisted by sessions created before multi-provider support.
    expect(canonicalModelId("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5");
    expect(providerForModel("claude-haiku-4-5-20251001")).toBe("anthropic");
  });

  it("leaves an unknown id alone and claims no provider for it", () => {
    expect(canonicalModelId("some-future-model")).toBe("some-future-model");
    expect(providerForModel("some-future-model")).toBeUndefined();
  });

  it("rejects non-providers", () => {
    expect(isProviderId("openai")).toBe(true);
    expect(isProviderId("ollama")).toBe(false);
    expect(isProviderId(undefined)).toBe(false);
  });

  it.each(readdirSync(MESSAGES_DIR).filter((f) => f.endsWith(".json")))(
    "%s translates every model label",
    (file) => {
      const messages = JSON.parse(readFileSync(path.join(MESSAGES_DIR, file), "utf8")) as {
        upload: Record<string, string>;
      };
      for (const model of MODELS) {
        expect(messages.upload[model.labelKey], `${file}: upload.${model.labelKey}`).toBeTruthy();
      }
    },
  );
});
