import { ACCOUNTS } from "@/lib/engine";

export type LlmSuggestion = {
  index: number;
  account: string;
  account_name: string;
  description: string;
  confidence: "high" | "medium" | "low";
};

/** Parse the LLM's JSON response, validating each suggestion. */
export function parseLlmResponse(
  text: string,
  transactionCount: number,
): LlmSuggestion[] {
  // Extract JSON array from the response (LLM may wrap it in markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let raw: unknown[];
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  const valid: LlmSuggestion[] = [];
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).index !== "number" ||
      typeof (item as Record<string, unknown>).account !== "string"
    ) {
      continue;
    }

    const idx = (item as Record<string, unknown>).index as number;
    const account = String((item as Record<string, unknown>).account);
    const confidence = (item as Record<string, unknown>).confidence;

    if (idx < 0 || idx >= transactionCount) continue;

    const acct = ACCOUNTS[account];
    if (!acct) continue; // Invalid account number - skip

    valid.push({
      index: idx,
      account,
      account_name: acct.name,
      description: String((item as Record<string, unknown>).description || ""),
      confidence:
        confidence === "high" || confidence === "medium" || confidence === "low"
          ? confidence
          : "low",
    });
  }

  return valid;
}
