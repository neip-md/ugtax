"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TransactionItem, ProcessResults } from "./store-types";
import {
  canonicalModelId,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  isProviderId,
  providerForModel,
  type ProviderId,
} from "./models";

type SessionState = {
  classified: TransactionItem[];
  setClassified: (items: TransactionItem[]) => void;
  unclassified: TransactionItem[];
  setUnclassified: (items: TransactionItem[]) => void;
  results: ProcessResults | null;
  setResults: (results: ProcessResults | null) => void;
  year: number;
  setYear: (year: number) => void;
  llmApiKey: string;
  setLlmApiKey: (key: string) => void;
  llmModel: string;
  setLlmModel: (model: string) => void;
  llmProvider: ProviderId;
  setLlmProvider: (provider: ProviderId) => void;
};

function safeSessionStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      // Test that storage actually works (private browsing may throw)
      window.sessionStorage.setItem("__test", "1");
      window.sessionStorage.removeItem("__test");
      return window.sessionStorage;
    }
  } catch {
    // Storage unavailable - persist middleware will skip
  }
  return undefined;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      classified: [],
      setClassified: (items) => set({ classified: items }),
      unclassified: [],
      setUnclassified: (items) => set({ unclassified: items }),
      results: null,
      setResults: (results) => set({ results }),
      year: 2025,
      setYear: (year) => set({ year }),
      llmApiKey: "",
      setLlmApiKey: (key) => set({ llmApiKey: key }),
      llmModel: DEFAULT_MODEL,
      setLlmModel: (model) => set({ llmModel: model }),
      llmProvider: DEFAULT_PROVIDER,
      setLlmProvider: (provider) => set({ llmProvider: provider }),
    }),
    {
      name: "ugtax-session",
      storage: createJSONStorage(() => safeSessionStorage() || sessionStorage),
      // Bumped when llmProvider was added. A tab open across the deploy holds
      // a model id and no provider, which would post an undefined provider.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SessionState> | undefined;
        if (!state || version >= 1) return state;
        const model = canonicalModelId(state.llmModel || DEFAULT_MODEL);
        return {
          ...state,
          llmModel: model,
          llmProvider: providerForModel(model) ?? DEFAULT_PROVIDER,
        };
      },
      // A hand-edited sessionStorage entry would otherwise put an arbitrary
      // string where the picker and the route both expect a known provider.
      onRehydrateStorage: () => (state) => {
        if (state && !isProviderId(state.llmProvider)) {
          state.llmProvider = providerForModel(state.llmModel) ?? DEFAULT_PROVIDER;
        }
      },
      partialize: (state) => {
        // Exclude llmApiKey from persistence (security)
        const rest = { ...state };
        delete (rest as Partial<SessionState>).llmApiKey;
        return rest;
      },
    },
  ),
);
