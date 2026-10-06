export type EnglishGuideContent = {
  path: string;
  title: string;
  description: string;
  intro: string;
  sections: { id: string; title: string; paragraphs: string[]; items?: string[] }[];
  sources: { label: string; href: string }[];
  related: { label: string; href: string }[];
};

const checklistLink = { href: "/ug-tax-filing-checklist", label: "German UG tax filing checklist" };
const noRevenueLink = { href: "/ug-with-no-revenue", label: "UG with no revenue: what still needs filing?" };
const ebilanzLink = { href: "/e-bilanz", label: "How to prepare and submit an E-Bilanz" };
const accountsLink = { href: "/jahresabschluss", label: "Preparing your holding UG's annual accounts" };

export const filingChecklist: EnglishGuideContent = {
  path: checklistLink.href,
  title: "German UG tax filing checklist for founders",
  description: "What must a German UG file? An English checklist covering annual accounts, E-Bilanz, company tax returns, disclosure and records to prepare.",
  intro: "A German UG normally needs annual accounts, tax filings and a separate company-register disclosure. These are different tasks with different destinations. Use this checklist to gather your records, identify the filings that apply and keep evidence of each submission.",
  sections: [
    {
      id: "records", title: "1. Gather the records for the full financial year",
      paragraphs: ["Start with the company's financial year, not just the date range in the latest bank export. You need the opening position as well as the year's movements. Bank transactions alone do not show unpaid invoices, depreciation, provisions or changes in the value of investments."],
      items: ["Bank statements for every business account, including opening and closing balances.", "Invoices, receipts, bank-fee statements and contracts supporting the entries.", "Prior-year accounts, opening balances and tax notices, including any loss carryforwards.", "Documents for share capital, shareholder loans, investments and distributions.", "The company's tax number, register details and access to the filing services you will use."],
    },
    {
      id: "accounts", title: "2. Prepare and approve the annual accounts",
      paragraphs: ["The Jahresabschluss is the company's annual financial statement. It includes a balance sheet (Bilanz) and profit and loss statement (GuV), with notes and other disclosures depending on the applicable rules. Reconcile the bank accounts, review classifications and include entries that do not appear in the bank export.", "Preparation, shareholder approval and filing are separate steps. The ordinary preparation period under §264 HGB is three months after year-end; small companies may use up to six months if this is consistent with proper business practice. Do not confuse that period with the tax-return or disclosure deadline."],
    },
    {
      id: "tax-filings", title: "3. Separate the E-Bilanz from the tax returns",
      paragraphs: ["The E-Bilanz sends structured accounting data to the tax administration. It does not replace the corporate income tax or trade tax return. A balanced set of accounts also does not automatically mean that taxable income equals the accounting profit."],
      items: ["E-Bilanz: prepare the required tax-accounting dataset and transmit it using compatible software.", "Corporate income tax: check the Körperschaftsteuer return and any associated determinations, such as the tax contribution account.", "Trade tax: check the Gewerbesteuer return and the adjustments relevant to the company.", "VAT: determine the company's VAT position separately. Under current §19 UStG, qualifying small businesses are generally exempt from the ordinary annual VAT-return obligation, but a tax-office request or special transactions can still trigger reporting."],
    },
    {
      id: "disclosure", title: "4. File the company-register disclosure separately",
      paragraphs: ["Sending an E-Bilanz to the Finanzamt does not disclose your accounts to the Unternehmensregister. For financial years beginning on or after 1 January 2022, accounting documents go to the Unternehmensregister; older years follow the former Bundesanzeiger route.", "A qualifying micro-company may be able to deposit its balance sheet instead of using full publication. Do not assume that a holding UG qualifies simply because it has few transactions. Section 267a(3) HGB excludes certain companies whose sole purpose is acquiring and managing investments without involvement in the management of those companies. Check the company's actual activity before choosing the filing format."],
    },
    {
      id: "deadlines", title: "5. Track the deadlines independently",
      paragraphs: ["The ordinary deadline for annual tax returns filed without a tax adviser is seven months after the relevant calendar year under §149(2) AO. Different rules can apply to represented taxpayers, extensions and requests from the tax office. Verify the deadline for your specific tax year instead of copying an older checklist.", "For an ordinary non-capital-market UG, the disclosure deadline is generally one year after the financial year-end under §325(1a) HGB. An extension for a tax return does not automatically extend the company-register deadline."],
    },
    {
      id: "proof", title: "6. Keep proof that each filing was accepted",
      paragraphs: ["Save the final accounts, filed datasets, transmission receipts and register confirmations together. Downloading a file, passing a validation check and submitting a filing are three different events. Check the response from each receiving service before marking a task complete.", "UGtax can help prepare bookkeeping records and exports for simple cases. Check that its outputs cover your company's facts and the relevant year's requirements. Formation, investment disposals, foreign transactions, payroll or uncertainty about disclosure relief are reasons to involve a tax adviser."],
    },
  ],
  sources: [
    { label: "§264 HGB: annual accounts and preparation periods", href: "https://www.gesetze-im-internet.de/hgb/__264.html" },
    { label: "§149 AO: tax-return deadlines", href: "https://www.gesetze-im-internet.de/ao_1977/__149.html" },
    { label: "§19 UStG: small-business VAT rules and reporting exceptions", href: "https://www.gesetze-im-internet.de/ustg_1980/__19.html" },
    { label: "§325 HGB: disclosure and its deadline", href: "https://www.gesetze-im-internet.de/hgb/__325.html" },
    { label: "§267a HGB: micro-company criteria and holding exclusions", href: "https://www.gesetze-im-internet.de/hgb/__267a.html" },
    { label: "Federal Office of Justice: disclosure guidance for founders", href: "https://www.bundesjustizamt.de/SharedDocs/Downloads/DE/EHUG/Merkblatt_Unternehmensgruender.pdf?__blob=publicationFile&v=6" },
  ],
  related: [noRevenueLink, ebilanzLink, accountsLink],
};

export const noRevenueGuide: EnglishGuideContent = {
  path: noRevenueLink.href,
  title: "UG with no revenue: what do you still need to file?",
  description: "No sales does not mean no annual accounts. Learn what a dormant German UG still needs to check for bookkeeping, tax returns and company disclosure.",
  intro: "A German UG does not stop having accounting and filing obligations just because it has no revenue. Annual accounts and disclosure generally remain necessary, and tax filings must be checked separately. No sales, no transactions and no tax payable describe different situations.",
  sections: [
    {
      id: "no-sales", title: "Does a UG with no sales still need annual accounts?",
      paragraphs: ["Generally, yes. A UG is a corporation, and its annual-accounting duties do not depend on making sales. A business registration cancellation or a pause in trading does not by itself remove the company's disclosure obligation. The Federal Office of Justice states that disclosure generally continues until the company is deleted from the commercial register.", "Even an inactive UG can have a bank balance, share capital, investments, shareholder loans or unpaid bills. Those balances belong in the annual accounts. An all-zero statement is not a safe substitute for reviewing what the company owns and owes."],
    },
    {
      id: "expenses", title: "Can the company make a loss without revenue?",
      paragraphs: ["Yes. Bank fees, chamber contributions and other expenses can arise even without customer income. The accounting result depends on the company's actual transactions and year-end adjustments. Whether an expense is tax-deductible, and how a tax loss is determined or carried forward, is a separate question.", "For example, a year with only bank fees still contains transactions that need classification. A shareholder payment into the company is not automatically sales revenue: it may be a loan or an equity contribution depending on the documentation. Review the substance rather than labelling every incoming payment as income."],
    },
    {
      id: "returns", title: "Can you skip tax returns if no tax is due?",
      paragraphs: ["Do not assume so. The obligation to submit a return is separate from the resulting tax bill. Check corporate income tax, trade tax and any associated determinations, and respond to filing requests from the Finanzamt. A tax-office estimate does not remove a filing obligation.", "VAT needs its own review. A company with no sales is not automatically a Kleinunternehmer, and a purely passive holding can raise different VAT questions. Qualifying small businesses under current §19 UStG are generally outside the ordinary annual VAT-return requirement, but special transactions or an explicit tax-office request can still require reporting. Do not submit an all-zero VAT return without checking the underlying facts."],
    },
    {
      id: "disclosure", title: "Does an inactive holding UG still need disclosure?",
      paragraphs: ["Generally, yes. Disclosure is a separate obligation from filing tax returns or sending an E-Bilanz. Current-year accounting documents are submitted to the Unternehmensregister. Lack of business activity does not itself remove that duty.", "Check eligibility before choosing the simplified micro-company deposit route. Size alone is not enough: §267a(3) HGB excludes certain passive investment-holding companies. If your company only holds shares, its purpose and involvement in managing the investees matter."],
    },
    {
      id: "checklist", title: "What should you prepare for a quiet financial year?",
      paragraphs: ["Work from the last closing balance sheet and reconcile the complete year. A short transaction list makes review easier, but does not prove that the accounts are complete."],
      items: ["Confirm opening balances and the status of every bank account.", "Collect bank charges, chamber contributions, invoices and any payments made on the company's behalf.", "Review investments, shareholder balances and outstanding liabilities at year-end.", "Prepare the accounts and determine the applicable tax and disclosure filings.", "Retain transmission receipts and disclosure confirmations, even if the tax due is zero."],
    },
    {
      id: "using-ugtax", title: "Can UGtax help with an inactive UG?",
      paragraphs: ["If the company has a simple bank export, UGtax can help classify its transactions and prepare bookkeeping outputs for review. Bring forward the correct opening balances and check items that do not appear on the bank statement. The number of transactions is not a substitute for checking the company's accounting and tax situation.", "If the bank export contains no transactions, do not invent a transaction to make an import work. Prepare the year from the opening balances and any genuine closing entries using an appropriate workflow. Liquidation, potential insolvency, investment write-downs or uncertainty about the filing format deserve individual advice."],
    },
  ],
  sources: [
    { label: "Federal Office of Justice: disclosure duties, including inactive companies", href: "https://www.bundesjustizamt.de/DE/Themen/OrdnungsgeldVollstreckung/Jahresabschluesse/Offenlegung/Fragen/Fragen_node.html" },
    { label: "§264 HGB: annual-accounting obligations", href: "https://www.gesetze-im-internet.de/hgb/__264.html" },
    { label: "§149 AO: filing obligations and tax-office requests", href: "https://www.gesetze-im-internet.de/ao_1977/__149.html" },
    { label: "§19 UStG: small-business VAT reporting", href: "https://www.gesetze-im-internet.de/ustg_1980/__19.html" },
    { label: "§267a HGB: exclusions from micro-company status", href: "https://www.gesetze-im-internet.de/hgb/__267a.html" },
  ],
  related: [checklistLink, ebilanzLink, accountsLink],
};

export const ebilanzGuide: EnglishGuideContent = {
  path: ebilanzLink.href,
  title: "E-Bilanz for a German UG: prepare, validate and submit",
  description: "Prepare your UG's E-Bilanz in XBRL, check the taxonomy and choose a submission route. Learn why Mein ELSTER cannot accept an E-Bilanz file upload.",
  intro: "An E-Bilanz is the structured electronic accounting dataset sent to the German tax administration. Preparing the accounts, generating an XBRL file and transmitting it are separate steps. UGtax helps prepare exports; submission needs compatible software or the self-hosted ERiC setup.",
  sections: [
    {
      id: "what-is-ebilanz", title: "What is an E-Bilanz?",
      paragraphs: ["Under §5b EStG, businesses within its scope transmit balance-sheet and profit-and-loss information electronically using the prescribed dataset. The E-Bilanz uses XBRL, a structured format that assigns financial values to defined taxonomy positions. It is not simply a PDF of the annual accounts.", "An E-Bilanz does not replace the corporate income tax return, trade tax return or company-register disclosure. Depending on the financial year and applicable requirements, additional accounting information can be part of the submission. Confirm the required scope for the year you are filing."],
    },
    {
      id: "mein-elster", title: "Can you upload an E-Bilanz to Mein ELSTER?",
      paragraphs: ["No. The tax administration's E-Bilanz FAQ states that an E-Bilanz file upload to Mein ELSTER is not available. ELSTER is also the transmission infrastructure used by compatible software, which is why a product may support ELSTER without using the Mein ELSTER website for the filing.", "Choose software that supports the relevant E-Bilanz submission. Before buying a service, check whether it accepts your existing XBRL file or requires you to enter the figures into its own forms. An ELSTER certificate alone does not create an upload function."],
    },
    {
      id: "prepare", title: "How do you prepare the accounting data?",
      paragraphs: ["Begin with complete accounts for the financial year. Import the bank export, review every classification and reconcile the opening and closing balances. Add or otherwise account for genuine non-bank entries such as unpaid invoices, depreciation and year-end adjustments before relying on the totals.", "UGtax uses SKR04 classifications to prepare bookkeeping outputs. SKR04 is a chart of accounts; it is not the E-Bilanz taxonomy. A commercial-law balance sheet may also require tax adjustments. Review that mapping and the accounting treatment rather than assuming that an exported file is ready to file."],
    },
    {
      id: "taxonomy", title: "Which taxonomy and software version do you need?",
      paragraphs: ["The applicable taxonomy depends on the financial year and the tax administration's release and transition rules. Check the official E-Bilanz taxonomy publications and your transmission software's support for that year. The newest installed version is not, by itself, proof that the exported dataset is appropriate.", "Micro-company disclosure relief under §267a HGB is a separate question from E-Bilanz taxonomy support. There is no automatic exemption from the tax dataset merely because a company is small. Certain passive holding companies are also excluded from micro-company status under §267a(3) HGB."],
    },
    {
      id: "submission", title: "How can you submit an export prepared with UGtax?",
      paragraphs: ["The hosted website can prepare downloads, but it does not directly transmit your E-Bilanz to the Finanzamt. For the self-hosted route, UGtax provides an ERiC integration. You need the tax administration's ERiC SDK, an appropriate ELSTER certificate and a working local setup.", "Alternatively, use an E-Bilanz provider that supports your filing year and your chosen input method. Confirm compatibility before paying. Passing validation checks does not prove every tax treatment is correct, and a validation-only run is not a submission."],
      items: ["Check company identifiers, financial year, opening balances and the accounting totals.", "Run the current submission software's validation and resolve reported errors.", "Submit through the selected transmission route when the dataset is ready.", "Save the accepted transmission protocol or transfer ticket together with the exact filed dataset."],
    },
    {
      id: "after-submission", title: "What remains after the E-Bilanz is submitted?",
      paragraphs: ["Complete the company's other required tax filings and the separate Unternehmensregister disclosure. Keep a checklist with a receipt for each destination. A downloaded XBRL file or a successful E-Bilanz transfer does not complete those other obligations.", "UGtax is free and open source. Optional AI services, third-party transmission services and hosting may have their own costs. Use professional help when the transactions or required adjustments exceed what you can confidently verify."],
    },
  ],
  sources: [
    { label: "§5b EStG: electronic transmission of accounting data", href: "https://www.gesetze-im-internet.de/estg/__5b.html" },
    { label: "Tax administration: E-Bilanz FAQ, January 2026", href: "https://www.esteuer.de/download/taxonomie/FAQ_Version_2026-01.pdf" },
    { label: "Tax administration: E-Bilanz taxonomy publications", href: "https://www.esteuer.de/" },
    { label: "ELSTER: compatible software products", href: "https://www.elster.de/elsterweb/softwareprodukt" },
    { label: "§267a HGB: micro-company status", href: "https://www.gesetze-im-internet.de/hgb/__267a.html" },
    { label: "UGtax: self-hosting instructions", href: "https://github.com/neip-md/ugtax#self-hosting-docker-compose" },
  ],
  related: [checklistLink, noRevenueLink, accountsLink],
};
