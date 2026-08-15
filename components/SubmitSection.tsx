"use client";

import { useState, useRef, useEffect } from "react";
import { useSessionStore } from "@/lib/session-store";
import { useConfigStore } from "@/lib/config-store";
import { useTranslations } from "next-intl";

type SubmitState = "idle" | "validating" | "validated" | "submitting" | "success" | "error";

interface SubmitResult {
  transferTicket?: string;
  message?: string;
  warnings?: string[];
}

export function SubmitSection() {
  const t = useTranslations("submit");
  const classified = useSessionStore((s) => s.classified);
  const config = useConfigStore((s) => s.config);
  const [state, setState] = useState<SubmitState>("idle");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null);
  const certRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!expanded || serviceAvailable !== null) return;
    fetch("/api/submit", { method: "HEAD" })
      .then((res) => setServiceAvailable(res.status !== 503))
      .catch(() => setServiceAvailable(false));
  }, [expanded, serviceAvailable]);

  async function handleAction(action: "validate" | "submit") {
    const certFile = certRef.current?.files?.[0];
    if (action === "submit" && (!certFile || !password)) {
      setResult({ message: t("errorCertRequired") });
      setState("error");
      return;
    }

    setState(action === "validate" ? "validating" : "submitting");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("classified", JSON.stringify(classified));
      formData.append("config", JSON.stringify({ company: config }));
      formData.append("action", action);
      if (certFile) formData.append("certificate", certFile);
      if (password) formData.append("password", password);

      const res = await fetch("/api/submit", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success || data.valid) {
        if (action === "validate") {
          setState("validated");
          setResult({ message: t("validationSuccess"), warnings: data.warnings });
        } else {
          setState("success");
          setResult({
            transferTicket: data.transfer_ticket,
            message: data.message || t("successTitle"),
            warnings: data.warnings,
          });
        }
      } else {
        setState("error");
        setResult({
          message: data.message || data.error || t("errorSubmission"),
          warnings: data.warnings,
        });
      }
    } catch {
      setState("error");
      setResult({ message: t("errorServiceUnavailable") });
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide"
      >
        <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>&#9654;</span>
        {t("title")}
      </button>

      {expanded && (
        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          {serviceAvailable === false ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("selfHostOnly")}</p>
              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("setup")}</h4>
                <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>
                    <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
                      <strong>Docker Desktop</strong>
                    </a>{" "}
                    {t("step1install")}
                  </li>
                  <li>
                    <strong>ERiC SDK</strong>{" "}
                    <a href="https://www.elster.de/eportal/infoseite/entwickler" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
                      elster.de/entwickler
                    </a>{" "}
                    {t("step2download")}
                  </li>
                  <li>
                    {t("step3clone")} <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">./eric/</code> {t("step3unpack")}
                  </li>
                  <li>
                    <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">docker compose up --build</code> {t("step4run")}{" "}
                    <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">localhost:4114</code> {t("step4open")}
                  </li>
                </ol>
              </div>
              <div className="flex gap-3">
                <a
                  href="https://github.com/neip-md/ugtax#self-hosting-docker-compose"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {t("githubGuide")}
                </a>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-600">
                {t("alternative")}{" "}
                <code className="font-mono">ug-steuer submit</code> {t("alternativeSubmit")}
              </p>
            </div>
          ) : state === "success" && result?.transferTicket ? (
            <div className="space-y-3">
              <div className="rounded border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">{t("successTitle")}</p>
                <p className="font-mono text-lg text-green-800 dark:text-green-200">
                  {t("transferTicket", { ticket: result.transferTicket })}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">{t("keepTicket")}</p>
              </div>
              {result.warnings && result.warnings.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
              <button
                onClick={() => { setState("idle"); setResult(null); }}
                className="text-xs underline text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {t("reset")}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("description")}</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-sm text-zinc-500 dark:text-zinc-400">{t("certLabel")}</label>
                  <input
                    ref={certRef}
                    type="file"
                    accept=".pfx,.p12"
                    className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-zinc-300 dark:file:border-zinc-700 file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-800 dark:file:text-zinc-200 file:text-sm hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 file:cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm text-zinc-500 dark:text-zinc-400">{t("passwordLabel")}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                    className="w-64 rounded border border-zinc-500 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
              </div>

              {state === "error" && result?.message && (
                <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {result.message}
                </div>
              )}

              {state === "validated" && (
                <div className="rounded border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-700 dark:text-green-300">
                  {t("validationSuccess")}
                  {result?.warnings && result.warnings.length > 0 && (
                    <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleAction("validate")}
                  disabled={state === "validating" || state === "submitting"}
                  className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  {state === "validating" ? t("validating") : t("validate")}
                </button>
                <button
                  onClick={() => handleAction("submit")}
                  disabled={state === "validating" || state === "submitting"}
                  className="rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50"
                >
                  {state === "submitting" ? t("submitting") : t("submitButton")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
