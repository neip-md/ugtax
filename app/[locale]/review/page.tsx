"use client";

import { useSessionStore } from "@/lib/session-store";
import { useConfigStore } from "@/lib/config-store";
import type { TransactionItem } from "@/lib/store-types";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";

type SKR04Account = { number: string; name: string; category: string };

export default function ReviewPage() {
  const router = useRouter();
  const t = useTranslations("review");
  const sessionStore = useSessionStore();
  const config = useConfigStore((s) => s.config);
  const [accounts, setAccounts] = useState<SKR04Account[]>([]);
  const [overrides, setOverrides] = useState<Record<number, Partial<TransactionItem>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const baseItems = useMemo<TransactionItem[]>(
    () =>
      [
        ...sessionStore.classified,
        ...sessionStore.unclassified.map((tx) => ({ ...tx, account: "", account_name: "", source: "" })),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    [sessionStore.classified, sessionStore.unclassified],
  );

  const items = useMemo<TransactionItem[]>(
    () => baseItems.map((item, i) => (overrides[i] ? { ...item, ...overrides[i] } : item)),
    [baseItems, overrides],
  );

  useEffect(() => {
    fetch("/api/skr04")
      .then((res) => res.json())
      .then(setAccounts)
      .catch(() => {});
  }, []);

  function updateAccount(index: number, accountNumber: string) {
    const acct = accounts.find((a) => a.number === accountNumber);
    setOverrides((prev) => ({
      ...prev,
      [index]: {
        account: accountNumber,
        account_name: acct?.name || "",
        source: "manual",
      },
    }));
  }

  async function classifyWithLlm() {
    if (!sessionStore.llmApiKey) return;

    const unclassifiedItems = items
      .map((item, idx) => ({ item, idx }))
      .filter((x) => !x.item.account);

    if (unclassifiedItems.length === 0) return;

    setLlmLoading(true);
    setLlmError(null);

    try {
      const res = await fetch("/api/classify-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: sessionStore.llmApiKey,
          model: sessionStore.llmModel,
          provider: sessionStore.llmProvider,
          transactions: unclassifiedItems.map((x) => x.item),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setLlmError(data.error);
        return;
      }

      const suggestions = data.suggestions || [];
      setOverrides((prev) => {
        const next = { ...prev };
        for (const suggestion of suggestions) {
          if (suggestion.index < unclassifiedItems.length) {
            const target = unclassifiedItems[suggestion.index];
            next[target.idx] = {
              ...next[target.idx],
              account: suggestion.account,
              account_name: suggestion.account_name,
              description: suggestion.description,
              source: `llm (${suggestion.confidence})`,
            };
          }
        }
        return next;
      });
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : "LLM request failed");
    } finally {
      setLlmLoading(false);
    }
  }

  const allClassified = items.every((item) => item.account);

  async function handleContinue() {
    if (!allClassified) {
      setError(t("errorAllRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classified: items,
          config: { company: config },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("errorProcessing"));
        setLoading(false);
        return;
      }

      sessionStore.setClassified(items);
      sessionStore.setUnclassified([]);
      sessionStore.setResults(data);
      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionStore.classified.length === 0 && sessionStore.unclassified.length === 0) {
      router.replace("/");
    }
  }, [sessionStore.classified.length, sessionStore.unclassified.length, router]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          {t("classified", { count: items.filter((i) => i.account).length, total: items.length })}
          {!allClassified && ` ${t("instruction")}`}
        </p>
        {llmLoading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">{t("llmClassifying")}</p>
        )}
        {llmError && (
          <p className="text-xs text-red-600 dark:text-red-400">{t("llmError", { error: llmError })}</p>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-left text-xs text-zinc-500 dark:text-zinc-400">
              {/* scope="col" so a screen reader can announce which column a
                  cell belongs to while moving through the table. */}
              <th scope="col" className="px-3 py-2 font-medium">{t("date")}</th>
              <th scope="col" className="px-3 py-2 font-medium text-right">{t("amount")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("direction")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("counterparty")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("reference")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("account")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("source")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-zinc-200 dark:border-zinc-800/50 ${
                  !item.account ? "bg-red-50 dark:bg-red-950/20" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{item.date}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">
                  {item.direction === "debit" ? "-" : ""}
                  {Number(item.amount).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
                </td>
                <td className="px-3 py-2 text-xs">
                  {/* The -400 shades were unreadable on white (1.78:1). Darker
                      in light mode, unchanged in dark. */}
                  <span className={item.direction === "credit" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                    {item.direction === "credit" ? t("credit") : t("debit")}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs max-w-[150px] truncate">{item.counterparty}</td>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate text-zinc-500 dark:text-zinc-400">{item.reference}</td>
                <td className="px-3 py-2">
                  {/* Assigning an account is the primary interaction on this
                      page. Without a name, a screen-reader user cannot tell
                      which transaction they are classifying. */}
                  <select
                    aria-label={t("accountForTransaction", {
                      counterparty: item.counterparty || item.reference || "",
                      date: item.date,
                    })}
                    value={item.account || ""}
                    onChange={(e) => updateAccount(i, e.target.value)}
                    className={`w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500 ${
                      item.account
                        ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                        : "border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <option value="">{t("selectAccount")}</option>
                    {accounts.map((a) => (
                      <option key={a.number} value={a.number}>
                        {a.number} - {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {item.source?.startsWith("llm") ? (
                    <span className={
                      item.source.includes("high") ? "text-green-600 dark:text-green-400" :
                      item.source.includes("medium") ? "text-yellow-600 dark:text-yellow-400" :
                      "text-orange-600 dark:text-orange-400"
                    }>
                      {item.source}
                    </span>
                  ) : (
                    item.source || "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => router.push("/")}
          className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:bg-zinc-800"
        >
          {t("back")}
        </button>
        {sessionStore.llmApiKey && !allClassified && (
          <button
            onClick={classifyWithLlm}
            disabled={llmLoading}
            className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {llmLoading ? t("llmClassifyLoading") : t("llmClassify")}
          </button>
        )}
        <button
          onClick={handleContinue}
          disabled={loading || !allClassified}
          className="rounded bg-zinc-900 dark:bg-zinc-100 px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t("calculating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
