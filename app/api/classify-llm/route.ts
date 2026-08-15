import { NextRequest, NextResponse } from "next/server";
import { ACCOUNTS } from "@/lib/engine";
import { parseLlmResponse } from "@/lib/llm";
import { callLlm, LlmError } from "@/lib/llm-providers";
import {
  canonicalModelId,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  isProviderId,
  providerForModel,
} from "@/lib/models";
import { checkArrayLength, checkOrigin, readJsonCapped } from "@/lib/security";

type UnclassifiedItem = {
  date: string;
  amount: string;
  direction: "credit" | "debit";
  counterparty: string;
  reference: string;
};

// Bounded so an oversized or slow request cannot pin a worker indefinitely.
export const maxDuration = 30;

/**
 * Output budget for the classification.
 *
 * This was a flat 1024, which is about 25 suggestions. Past that the JSON
 * array was cut off mid-object, parseLlmResponse found no closing bracket, and
 * the user got zero suggestions with no error - the worst kind of failure for
 * a tool whose only feature is being right.
 *
 * The floor is large because every current frontier model reasons before it
 * answers and those tokens come out of this same budget: Claude Fable 5
 * always thinks, Sonnet 5 and Opus 5 think by default, and the GPT-5.6 and
 * Gemini 3.x families reason too. A ceiling sized for the answer alone would
 * be spent before the first suggestion. It is only a cap, so the headroom is
 * free unless the model uses it.
 */
function maxTokensFor(transactionCount: number): number {
  return Math.min(16384, 8192 + transactionCount * 64);
}

export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const parsed = await readJsonCapped(request);
    if (parsed.error) return parsed.error;
    const body = parsed.data as Record<string, unknown>;
    const { apiKey, model: rawModel, provider: rawProvider, transactions } = body as {
      apiKey: string;
      model?: string;
      provider?: string;
      transactions: UnclassifiedItem[];
    };

    if (!apiKey || !transactions?.length) {
      return NextResponse.json(
        { error: "apiKey and transactions are required" },
        { status: 400 },
      );
    }

    const tooMany = checkArrayLength(transactions, "transactions");
    if (tooMany) return tooMany;

    if (rawProvider !== undefined && !isProviderId(rawProvider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const named = typeof rawModel === "string" ? rawModel.trim() : "";
    // A client that predates multi-provider support sends a model and no
    // provider, and every model it could send was an Anthropic one.
    const provider = rawProvider ?? providerForModel(named) ?? DEFAULT_PROVIDER;
    // Defaulting a blank model only makes sense for the provider the default
    // belongs to. Anywhere else it would send a Claude id to OpenAI.
    if (!named && provider !== DEFAULT_PROVIDER) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }
    const model = canonicalModelId(named || DEFAULT_MODEL);

    // Build account reference from existing ACCOUNTS record
    const accountRef = Object.entries(ACCOUNTS)
      .map(([num, info]) => `${num} ${info.name}`)
      .join("\n");

    const txList = transactions
      .map(
        (tx, i) =>
          `[${i}] ${tx.date} | ${tx.direction === "credit" ? "IN" : "OUT"} ${tx.amount} EUR | ${tx.counterparty} | ${tx.reference}`,
      )
      .join("\n");

    const reply = await callLlm({
      provider,
      apiKey,
      model,
      maxTokens: maxTokensFor(transactions.length),
      prompt: `You are a German bookkeeping assistant for a holding UG (haftungsbeschränkt) using the SKR04 chart of accounts.

Classify each unclassified bank transaction into the correct SKR04 account.

SKR04 accounts:
${accountRef}

Transactions to classify:
${txList}

Respond with ONLY a JSON array. Each element:
{"index": <number>, "account": "<SKR04 number>", "description": "<short German booking text>", "confidence": "high"|"medium"|"low"}

Rules:
- Use the most specific account that fits
- "high" confidence = obvious match (e.g. IHK → 6830)
- "medium" = reasonable guess
- "low" = uncertain, user should verify
- If completely unsure, omit that transaction from the array`,
    });

    const suggestions = parseLlmResponse(reply.text, transactions.length);

    // A truncated reply and a model with nothing to say both parse to zero
    // suggestions. Saying which one happened is the difference between the
    // user retrying in smaller batches and the user concluding the feature
    // is broken.
    if (suggestions.length === 0 && reply.truncated) {
      return NextResponse.json(
        {
          error:
            "Die Antwort des Modells wurde abgeschnitten, bevor ein Vorschlag fertig war. " +
            "Bitte in kleineren Schritten klassifizieren oder ein schnelleres Modell wählen.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof LlmError) {
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json({ error: "Ungültiger API-Key." }, { status: 401 });
      }
      if (err.status === 429) {
        return NextResponse.json(
          { error: "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut." },
          { status: 429 },
        );
      }
      // Anything else keeps the provider's own wording, which is what tells
      // the user that the model id is wrong or the account has no credit.
      const status = err.status >= 400 && err.status <= 599 ? err.status : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    const msg = err instanceof Error ? err.message : "LLM classification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
