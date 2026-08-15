"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CompanyConfig } from "./engine";

const CONFIG_VERSION = 1;

type ConfigState = {
  config: CompanyConfig;
  setConfig: (config: CompanyConfig) => void;
  updateConfig: (partial: Partial<CompanyConfig>) => void;
};

const defaultConfig: CompanyConfig = {
  name: "",
  steuernummer: "",
  finanzamt: "",
  geschaeftsjahr: 2025,
  kleinunternehmer: true,
  stammkapital: "1000.00",
  gewinnvortrag: "0.00",
};

function safeLocalStorage(): Storage | undefined {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("__test", "1");
      window.localStorage.removeItem("__test");
      return window.localStorage;
    }
  } catch {
    // Storage unavailable
  }
  return undefined;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      setConfig: (config) => set({ config }),
      updateConfig: (partial) =>
        set((state) => ({ config: { ...state.config, ...partial } })),
    }),
    {
      name: "ugtax-config",
      version: CONFIG_VERSION,
      storage: createJSONStorage(() => safeLocalStorage() || localStorage),
      migrate: (persisted, version) => {
        // If version mismatch, reset to defaults
        if (version !== CONFIG_VERSION) {
          return { config: defaultConfig };
        }
        return persisted as ConfigState;
      },
    },
  ),
);

export { defaultConfig };
export type { ConfigState };
