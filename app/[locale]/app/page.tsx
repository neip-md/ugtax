"use client";

import { useSessionStore } from "@/lib/session-store";
import { useConfigStore } from "@/lib/config-store";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import {
  canonicalModelId,
  DEFAULT_PROVIDER,
  findModel,
  KEY_PLACEHOLDER,
  modelsByProvider,
  PROVIDER_NAME,
  PROVIDERS,
  providerForModel,
  type ProviderId,
} from "@/lib/models";

/** Sentinel for the "type your own model id" entry in the picker. */
const CUSTOM_MODEL = "__custom__";

export default function UploadPage() {
  const router = useRouter();
  const t = useTranslations("upload");
  const sessionStore = useSessionStore();
  const configStore = useConfigStore();
  const config = configStore.config;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bankFileRef = useRef<HTMLInputElement>(null);
  const configFileRef = useRef<HTMLInputElement>(null);
  const [useConfigFile, setUseConfigFile] = useState(false);
  // A model id that is not in the catalogue can only be a custom one, so the
  // custom fields also appear after a session is restored. The flag covers the
  // other direction: picking "custom" while a catalogued model is still set.
  const [customChosen, setCustomChosen] = useState(false);
  const useCustomModel = customChosen || !findModel(sessionStore.llmModel);
  const llmProvider = sessionStore.llmProvider;

  function selectModel(value: string) {
    if (value === CUSTOM_MODEL) {
      setCustomChosen(true);
      // Clearing it means the text field below starts empty and, more to the
      // point, that a catalogued model cannot be silently sent to whichever
      // provider is picked next.
      if (findModel(sessionStore.llmModel)) sessionStore.setLlmModel("");
      return;
    }
    setCustomChosen(false);
    sessionStore.setLlmModel(value);
    sessionStore.setLlmProvider(providerForModel(value) ?? DEFAULT_PROVIDER);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const bankFile = bankFileRef.current?.files?.[0];
      if (!bankFile) {
        setError(t("errorNoFile"));
        setLoading(false);
        return;
      }

      const MAX_FILE_SIZE = 4 * 1024 * 1024;
      if (bankFile.size > MAX_FILE_SIZE) {
        setError(t("errorFileSize", { size: (bankFile.size / 1024 / 1024).toFixed(1) }));
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("bank_file", bankFile);
      formData.append("year", String(config.geschaeftsjahr));

      if (useConfigFile) {
        const configFile = configFileRef.current?.files?.[0];
        if (configFile) {
          const configText = await configFile.text();
          formData.append("config_yaml", configText);
        }
      } else {
        const configYaml = [
          "company:",
          `  name: "${config.name}"`,
          `  steuernummer: "${config.steuernummer}"`,
          `  finanzamt: "${config.finanzamt}"`,
          `  geschaeftsjahr: ${config.geschaeftsjahr}`,
          `  kleinunternehmer: ${config.kleinunternehmer}`,
          `  stammkapital: ${config.stammkapital}`,
          `  gewinnvortrag: ${config.gewinnvortrag}`,
        ].join("\n");
        formData.append("config_yaml", configYaml);
      }

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorUpload"));
        setLoading(false);
        return;
      }

      sessionStore.setClassified(data.classified || []);
      sessionStore.setUnclassified(data.unclassified || []);
      sessionStore.setYear(config.geschaeftsjahr);

      router.push("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorUnknown"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t("subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Labels wrap their control so the association is programmatic, not
            just visual. A sibling <label> with no htmlFor gives the control no
            accessible name at all. */}
        <label className="block space-y-2">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("fileLabel")}
          </span>
          <input
            ref={bankFileRef}
            type="file"
            accept=".xml,.csv,.tsv,.xlsx,.xls,.zip"
            required
            className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-zinc-300 dark:border-zinc-700 file:bg-zinc-100 dark:bg-zinc-800 file:text-zinc-800 dark:text-zinc-200 file:text-sm hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 file:cursor-pointer"
          />
        </label>

        <label className="block space-y-2">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("yearLabel")}</span>
          <input
            type="number"
            value={config.geschaeftsjahr}
            onChange={(e) => configStore.updateConfig({ geschaeftsjahr: Number(e.target.value) })}
            min={2020}
            max={2030}
            className="w-32 rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </label>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("configLabel")}</label>
            <button
              type="button"
              onClick={() => setUseConfigFile(!useConfigFile)}
              className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-300"
            >
              {useConfigFile ? t("useForm") : t("uploadYaml")}
            </button>
          </div>

          {useConfigFile ? (
            <label className="block space-y-1">
              <span className="sr-only">{t("uploadYaml")}</span>
              <input
                ref={configFileRef}
                type="file"
                accept=".yaml,.yml"
                className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-zinc-300 dark:border-zinc-700 file:bg-zinc-100 dark:bg-zinc-800 file:text-zinc-800 dark:text-zinc-200 file:text-sm hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 file:cursor-pointer"
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("companyName")} value={config.name} onChange={(v) => configStore.updateConfig({ name: v })} placeholder={t("companyPlaceholder")} />
              <Field label={t("taxNumber")} value={config.steuernummer} onChange={(v) => configStore.updateConfig({ steuernummer: v })} placeholder="27/123/45678" />
              <Field label={t("taxOffice")} value={config.finanzamt} onChange={(v) => configStore.updateConfig({ finanzamt: v })} placeholder="Berlin Mitte" />
              <Field label={t("shareCapital")} value={config.stammkapital} onChange={(v) => configStore.updateConfig({ stammkapital: v })} placeholder="1000.00" />
              <Field label={t("retainedEarnings")} value={config.gewinnvortrag} onChange={(v) => configStore.updateConfig({ gewinnvortrag: v })} placeholder="0.00" />
              <div className="flex items-center gap-2 self-end pb-1">
                <input
                  type="checkbox"
                  id="kleinunternehmer"
                  checked={config.kleinunternehmer}
                  onChange={(e) => configStore.updateConfig({ kleinunternehmer: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-100 dark:bg-zinc-800"
                />
                <label htmlFor="kleinunternehmer" className="text-sm text-zinc-700 dark:text-zinc-300">
                  {t("smallBusiness")}
                </label>
              </div>
            </div>
          )}
        </div>

        <details className="space-y-2">
          <summary className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
            {t("llmTitle")}
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("llmDescription")}</p>
            <label className="block space-y-1">
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {t("llmApiKeyLabel", { provider: PROVIDER_NAME[llmProvider] })}
              </span>
              <input
                type="password"
                value={sessionStore.llmApiKey}
                onChange={(e) => sessionStore.setLlmApiKey(e.target.value)}
                placeholder={KEY_PLACEHOLDER[llmProvider]}
                className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </label>
            <label className="block space-y-1">
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{t("llmModel")}</span>
              <select
                value={useCustomModel ? CUSTOM_MODEL : canonicalModelId(sessionStore.llmModel)}
                onChange={(e) => selectModel(e.target.value)}
                className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {modelsByProvider().map((group) => (
                  <optgroup key={group.provider} label={PROVIDER_NAME[group.provider]}>
                    {group.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {t(m.labelKey)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={CUSTOM_MODEL}>{t("llmCustom")}</option>
              </select>
            </label>

            {/* The catalogue above dates the moment a provider ships a model.
                These two fields mean a new one is usable the same day. */}
            {useCustomModel && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {t("llmProviderLabel")}
                  </span>
                  <select
                    value={llmProvider}
                    onChange={(e) => sessionStore.setLlmProvider(e.target.value as ProviderId)}
                    className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_NAME[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {t("llmCustomModelLabel")}
                  </span>
                  <input
                    type="text"
                    value={sessionStore.llmModel}
                    onChange={(e) => sessionStore.setLlmModel(e.target.value)}
                    placeholder="gpt-5.6-sol"
                    className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </label>
              </div>
            )}
          </div>
        </details>

        {error && (
          <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("processing") : t("submit")}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
    </label>
  );
}
