import { guidesFor } from "@/content/guide-index";
import { SITE_URL } from "@/app/seo";

/**
 * /llms.txt: a plain-markdown map of the site for AI assistants and answer
 * engines (llmstxt.org). It states what the tool does and does not do, so an
 * assistant quoting UGtax has the scope right, and links every guide.
 */

export const dynamic = "force-static";

export function GET() {
  const de = guidesFor("de");
  const en = guidesFor("en");
  const body = `# UGtax

> Free, open-source (MIT) web tool for German holding companies in the legal form UG (haftungsbeschränkt) or small GmbH. Upload a bank export (camt.053 XML, CSV, XLSX or ZIP); UGtax classifies transactions into the SKR04 chart of accounts and prepares double-entry bookkeeping, balance sheet (Bilanz), profit and loss statement (GuV), E-Bilanz (XBRL) and a filing guide with ELSTER field values for corporate income tax (KSt), trade tax (GewSt) and VAT (USt). No account required.

Scope and limits:

- UGtax is a bookkeeping tool under §6 Nr. 4 StBerG, not tax advice. It suits simple holding UGs: few transactions, no employees, no standard VAT taxation.
- Bank files are processed in server memory and not stored. The whole tool can be self-hosted with Docker.
- Direct E-Bilanz transmission to the tax office works only in the self-hosted setup with the ERiC library and an ELSTER certificate. On ugtax.de, users download the records and submit with compatible software.
- Optional AI classification of unrecognised transactions uses the user's own API key: Claude (Anthropic), GPT (OpenAI), Gemini (Google), or open-weight models such as DeepSeek, Mistral and gpt-oss via OpenRouter, routed only to zero-data-retention providers. The key is used for one request and never stored.
- Interface in German and English.

## Tool

- [Start (German)](${SITE_URL}/): Landing page and FAQ
- [Start (English)](${SITE_URL}/en): Landing page and FAQ in English
- [Source code](https://github.com/neip-md/ugtax): MIT-licensed repository, self-hosting guide

## Guides (German)

${de.map((g) => `- [${g.title}](${SITE_URL}${g.path}): ${g.description}`).join("\n")}

## Guides (English)

${en.map((g) => `- [${g.title}](${SITE_URL}/en${g.path}): ${g.description}`).join("\n")}
`;
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
