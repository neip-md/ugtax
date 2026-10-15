import type { EnglishGuideContent } from "./english-guides";

/** One guide in one locale. The English-only guides use the same shape. */
export type GuideContent = EnglishGuideContent;

/** Guides published in German and English under the same path. */
export type BilingualGuide = { de: GuideContent; en: GuideContent };

const GII = "https://www.gesetze-im-internet.de";

const links = {
  de: {
    steuern: { href: "/holding-ug-steuern", label: "Holding-UG Steuern: KSt, GewSt und §8b KStG" },
    offenlegung: { href: "/offenlegung", label: "Jahresabschluss offenlegen: Unternehmensregister und Hinterlegung" },
    ruecklage: { href: "/ug-ruecklage", label: "UG-Rücklage nach §5a GmbHG" },
    jahresabschluss: { href: "/jahresabschluss", label: "Holding-UG Jahresabschluss ohne Steuerberater" },
    ebilanz: { href: "/e-bilanz", label: "E-Bilanz für die UG selbst erstellen" },
  },
  en: {
    steuern: { href: "/holding-ug-steuern", label: "Holding UG taxes: corporate tax, trade tax and §8b KStG" },
    offenlegung: { href: "/offenlegung", label: "Disclosing a UG's annual accounts" },
    ruecklage: { href: "/ug-ruecklage", label: "The UG reserve under §5a GmbHG" },
    checklist: { href: "/ug-tax-filing-checklist", label: "German UG tax filing checklist" },
    noRevenue: { href: "/ug-with-no-revenue", label: "UG with no revenue: what still needs filing?" },
  },
};

export const holdingTaxGuide: BilingualGuide = {
  de: {
    path: "/holding-ug-steuern",
    metaTitle: "Holding-UG Steuern: KSt, GewSt und §8b KStG | UGtax",
    title: "Holding-UG Steuern: Körperschaftsteuer, Gewerbesteuer und §8b KStG",
    description: "Wie eine Holding-UG Dividenden und Veräußerungsgewinne versteuert: 95-%-Freistellung nach §8b KStG, 10-%- und 15-%-Grenze, KSt-Senkung ab 2028 und Fristen.",
    intro: "Eine Holding-UG ist eine Kapitalgesellschaft und zahlt Körperschaftsteuer, Solidaritätszuschlag und Gewerbesteuer. Ihr Vorteil liegt in §8b KStG: Dividenden und Gewinne aus dem Verkauf von Beteiligungen sind unter Voraussetzungen zu 95 % steuerfrei. Dieser Ratgeber erklärt die Schwellen, die dafür gelten, und welche Erklärungen jedes Jahr fällig sind.",
    sections: [
      {
        id: "dividenden", title: "Dividenden: 95 % steuerfrei ab 10 % Beteiligung",
        paragraphs: [
          "Gewinnausschüttungen, die die Holding von einer Kapitalgesellschaft erhält, bleiben bei der Ermittlung des Einkommens außer Ansatz (§8b Abs. 1 KStG). Zugleich gelten 5 % davon als nicht abziehbare Betriebsausgaben (§8b Abs. 5 KStG). Im Ergebnis sind Dividenden zu 95 % von der Körperschaftsteuer freigestellt.",
          "Die Freistellung setzt voraus, dass die Holding zu Beginn des Kalenderjahres unmittelbar mindestens 10 % am Grund- oder Stammkapital hielt (§8b Abs. 4 KStG). Bei Streubesitz unter 10 % ist die Dividende voll steuerpflichtig. Erwirbt die Holding im Laufe des Jahres eine Beteiligung von mindestens 10 %, gilt sie als zu Beginn des Kalenderjahres erworben.",
          "Beispiel: Die Holding erhält 100.000 EUR Dividende aus einer 25-%-Beteiligung und hat sonst keine Einkünfte oder Kosten. Steuerpflichtig sind 5.000 EUR. Darauf fallen 750 EUR Körperschaftsteuer und 41,25 EUR Solidaritätszuschlag an, bei einem Gewerbesteuer-Hebesatz von 400 % weitere 700 EUR Gewerbesteuer. Zusammen sind das rund 1.491 EUR, also etwa 1,5 % der Dividende.",
        ],
      },
      {
        id: "veraeusserung", title: "Veräußerungsgewinne: 95 % steuerfrei ohne Mindestbeteiligung",
        paragraphs: [
          "Gewinne aus der Veräußerung von Anteilen an Kapitalgesellschaften bleiben ebenfalls außer Ansatz (§8b Abs. 2 KStG); 5 % des Gewinns gelten als nicht abziehbare Betriebsausgaben (§8b Abs. 3 Satz 1 KStG). Eine Mindestbeteiligung wie bei Dividenden verlangt das Gesetz für Veräußerungsgewinne nicht. Die Freistellung gilt nicht, soweit die Anteile früher steuerwirksam abgeschrieben wurden (§8b Abs. 2 Satz 4 KStG).",
          "Die Kehrseite: Veräußerungsverluste und Teilwertabschreibungen auf solche Anteile wirken sich steuerlich nicht aus (§8b Abs. 3 Satz 3 KStG). Unter Voraussetzungen gilt das auch für Verluste aus Darlehen, die die Holding einer Gesellschaft gewährt, an der sie zu mehr als einem Viertel beteiligt ist (§8b Abs. 3 Satz 4 ff. KStG). Wer über die Holding Angel-Investments mit Ausfallrisiko hält, sollte das vor dem Erwerb einplanen.",
        ],
      },
      {
        id: "gewerbesteuer", title: "Gewerbesteuer: die 15-%-Grenze",
        paragraphs: [
          "Für die Gewerbesteuer gilt eine eigene Schwelle. Dividenden werden nur gekürzt, wenn die Beteiligung zu Beginn des Erhebungszeitraums mindestens 15 % beträgt (§9 Nr. 2a GewStG); auch dann bleiben die 5 % nach §8b Abs. 5 KStG gewerbesteuerpflichtig. Liegt die Beteiligung darunter, wird die körperschaftsteuerlich freigestellte Dividende wieder hinzugerechnet (§8 Nr. 5 GewStG) und ist voll gewerbesteuerpflichtig.",
          "Zwischen 10 % und 15 % entsteht damit eine Lücke: körperschaftsteuerlich zu 95 % frei, gewerbesteuerlich voll belastet. Veräußerungsgewinne folgen dagegen über §7 GewStG der körperschaftsteuerlichen Gewinnermittlung; die Hinzurechnung nach §8 Nr. 5 GewStG erfasst nur Gewinnanteile, keine Veräußerungsgewinne.",
          "Ab dem Erhebungszeitraum 2027 beträgt der Mindesthebesatz 280 % statt bisher 200 % (§16 Abs. 4 GewStG). Das betrifft vor allem Holdings, die in Gemeinden mit sehr niedrigem Hebesatz ansässig sind.",
        ],
      },
      {
        id: "steuersatz", title: "Körperschaftsteuer sinkt ab 2028 schrittweise auf 10 %",
        paragraphs: [
          "Die Körperschaftsteuer beträgt 15 % des zu versteuernden Einkommens, zuzüglich 5,5 % Solidaritätszuschlag auf die festgesetzte Körperschaftsteuer. Die Freigrenze beim Solidaritätszuschlag gilt nur für natürliche Personen, nicht für die UG. Mit dem Gesetz für ein steuerliches Investitionssofortprogramm vom Juli 2025 sinkt der Körperschaftsteuersatz (§23 Abs. 1 KStG):",
        ],
        items: [
          "bis Veranlagungszeitraum 2027: 15 %",
          "2028: 14 %",
          "2029: 13 %",
          "2030: 12 %",
          "2031: 11 %",
          "ab 2032: 10 %",
        ],
      },
      {
        id: "erklaerungen", title: "Welche Erklärungen jedes Jahr fällig sind",
        paragraphs: [
          "Die Erklärungen sind elektronisch über ELSTER oder kompatible Software abzugeben. Eine Befreiung davon gibt es nur auf Antrag in Härtefällen.",
        ],
        items: [
          "Körperschaftsteuererklärung einschließlich der Erklärung zur gesonderten Feststellung des steuerlichen Einlagekontos zum Schluss jedes Wirtschaftsjahres (§27 Abs. 2, §31 Abs. 1a KStG).",
          "Gewerbesteuererklärung (§14a GewStG). Jede nicht steuerbefreite Kapitalgesellschaft muss sie abgeben, auch ohne Gewerbeertrag (§25 Abs. 1 Nr. 2 GewStDV).",
          "E-Bilanz: Bilanz und GuV als Datensatz nach amtlicher Taxonomie (§5b EStG). Für Wirtschaftsjahre, die nach dem 31. Dezember 2024 beginnen, gehören unverdichtete Kontennachweise dazu.",
          "Umsatzsteuer: Ob eine reine Holding überhaupt umsatzsteuerliche Unternehmerin ist, hängt von ihrer Tätigkeit ab. Kleinunternehmer (Vorjahresumsatz bis 25.000 EUR, laufendes Jahr bis 100.000 EUR) sind seit 2025 grundsätzlich von der Jahreserklärung befreit, solange das Finanzamt nicht zur Abgabe auffordert.",
        ],
      },
      {
        id: "fristen", title: "Abgabefristen für 2025 und 2026",
        paragraphs: [
          "Ohne Steuerberater gilt eine Frist von sieben Monaten nach Ablauf des Kalenderjahres (§149 Abs. 2 AO), mit Steuerberater grundsätzlich bis Ende Februar des übernächsten Jahres (§149 Abs. 3 AO). Fällt das Fristende auf ein Wochenende, verschiebt es sich auf den nächsten Werktag. Die Corona-Verlängerungen sind mit dem Veranlagungszeitraum 2024 ausgelaufen.",
        ],
        items: [
          "Steuerjahr 2025: ohne Berater 31. Juli 2026 (abgelaufen), mit Berater 1. März 2027.",
          "Steuerjahr 2026: ohne Berater 2. August 2027, mit Berater 29. Februar 2028.",
          "Das Finanzamt kann Erklärungen früher anfordern (§149 Abs. 4 AO). Die Offenlegung im Unternehmensregister hat eine eigene Frist.",
        ],
      },
    ],
    faqs: [
      { q: "Ist eine Holding-UG steuerfrei?", a: "Nein. Dividenden und Veräußerungsgewinne aus Beteiligungen sind zu 95 % freigestellt, wenn die Voraussetzungen erfüllt sind. Die übrigen 5 % und alle anderen Einkünfte, etwa Zinsen, unterliegen Körperschaftsteuer, Solidaritätszuschlag und Gewerbesteuer. Auf eine Dividende, die beide Schwellen erfüllt, ergibt sich bei üblichen Hebesätzen (280 bis 500 %) eine Belastung von etwa 1,3 bis 1,7 %." },
      { q: "Ab welcher Beteiligung sind Dividenden in der Holding steuerfrei?", a: "Für die Körperschaftsteuer ab 10 % zu Beginn des Kalenderjahres, für die Gewerbesteuer ab 15 % zu Beginn des Erhebungszeitraums. Darunter ist die Dividende für die jeweilige Steuer voll steuerpflichtig." },
      { q: "Muss eine Holding-UG eine Gewerbesteuererklärung abgeben, wenn sie nur Dividenden erhält?", a: "Ja. Jede nicht steuerbefreite Kapitalgesellschaft gibt jährlich eine Gewerbesteuererklärung ab (§25 Abs. 1 Nr. 2 GewStDV), auch wenn sich nach den Kürzungen kein Gewerbeertrag ergibt." },
      { q: "Wann sinkt die Körperschaftsteuer?", a: "Ab dem Veranlagungszeitraum 2028 um einen Prozentpunkt pro Jahr, von 15 % bis auf 10 % ab 2032 (§23 Abs. 1 KStG)." },
    ],
    sources: [
      { label: "§8b KStG: Beteiligungen an anderen Körperschaften", href: `${GII}/kstg_1977/__8b.html` },
      { label: "§23 KStG: Steuersatz", href: `${GII}/kstg_1977/__23.html` },
      { label: "§27 KStG: steuerliches Einlagekonto", href: `${GII}/kstg_1977/__27.html` },
      { label: "§8 GewStG: Hinzurechnungen", href: `${GII}/gewstg/__8.html` },
      { label: "§9 GewStG: Kürzungen", href: `${GII}/gewstg/__9.html` },
      { label: "§16 GewStG: Hebesatz", href: `${GII}/gewstg/__16.html` },
      { label: "§25 GewStDV: Gewerbesteuererklärung", href: `${GII}/gewstdv/__25.html` },
      { label: "§5b EStG: E-Bilanz", href: `${GII}/estg/__5b.html` },
      { label: "§149 AO: Abgabefristen", href: `${GII}/ao_1977/__149.html` },
    ],
    related: [links.de.offenlegung, links.de.ruecklage, links.de.ebilanz],
  },
  en: {
    path: "/holding-ug-steuern",
    metaTitle: "German Holding UG Taxes: §8b KStG Explained | UGtax",
    title: "Holding UG taxes: corporate tax, trade tax and §8b KStG",
    description: "How a German holding UG is taxed on dividends and share gains: the 95% exemption in §8b KStG, the 10% and 15% thresholds, the 2028 rate cut and deadlines.",
    intro: "A holding UG is a corporation and pays corporate income tax (Körperschaftsteuer), solidarity surcharge and trade tax (Gewerbesteuer). Its advantage lies in §8b KStG: dividends and gains on selling shares are 95% tax-free if the conditions are met. This guide explains the thresholds that apply and which returns are due every year.",
    sections: [
      {
        id: "dividends", title: "Dividends: 95% tax-free from a 10% stake",
        paragraphs: [
          "Dividends the holding receives from a corporation are disregarded when its income is determined (§8b(1) KStG). At the same time, 5% of them count as non-deductible business expenses (§8b(5) KStG). The net effect is a 95% exemption from corporate income tax.",
          "The exemption requires a direct stake of at least 10% of the share capital at the start of the calendar year (§8b(4) KStG). Below 10%, the dividend is fully taxable. A stake of at least 10% acquired during the year counts as held from the start of that year.",
          "Example: the holding receives a 100,000 EUR dividend from a 25% stake and has no other income or costs. 5,000 EUR is taxable. That gives 750 EUR corporate income tax and 41.25 EUR solidarity surcharge, plus 700 EUR trade tax at a municipal multiplier (Hebesatz) of 400%. Roughly 1,491 EUR in total, about 1.5% of the dividend.",
        ],
      },
      {
        id: "capital-gains", title: "Gains on shares: 95% tax-free with no minimum stake",
        paragraphs: [
          "Gains on selling shares in corporations are also disregarded (§8b(2) KStG), with 5% of the gain treated as non-deductible expenses (§8b(3) sentence 1 KStG). Unlike dividends, there is currently no minimum stake for gains. The exemption does not apply to the extent the shares were previously written down with tax effect (§8b(2) sentence 4 KStG).",
          "The flip side: losses on such shares and write-downs to a lower value have no tax effect (§8b(3) sentence 3 KStG). Under certain conditions, this also covers losses on loans the holding grants to a company in which it holds more than a quarter (§8b(3) sentences 4 et seq. KStG). If your holding makes angel investments that may fail, plan for this before investing.",
        ],
      },
      {
        id: "trade-tax", title: "Trade tax: the 15% threshold",
        paragraphs: [
          "Trade tax has its own threshold. Dividends are only deducted if the stake was at least 15% at the start of the assessment period (§9 no. 2a GewStG), and even then the 5% under §8b(5) KStG stays subject to trade tax. Below 15%, the dividend exempted for corporate income tax is added back (§8 no. 5 GewStG) and is fully subject to trade tax.",
          "Between 10% and 15% there is therefore a gap: 95% exempt from corporate income tax, fully subject to trade tax. Gains on shares, by contrast, follow the corporate-tax computation via §7 GewStG; the add-back in §8 no. 5 GewStG covers profit distributions only, not gains on disposal.",
          "From the 2027 assessment period, the minimum municipal multiplier rises from 200% to 280% (§16(4) GewStG). This mainly affects holdings based in municipalities with very low multipliers.",
        ],
      },
      {
        id: "rate", title: "The corporate tax rate falls to 10% from 2028",
        paragraphs: [
          "Corporate income tax is 15% of taxable income, plus a 5.5% solidarity surcharge on the assessed corporate tax. The solidarity-surcharge exemption threshold applies only to individuals, not to a UG. The July 2025 Gesetz für ein steuerliches Investitionssofortprogramm reduces the rate in steps (§23(1) KStG):",
        ],
        items: [
          "up to the 2027 assessment year: 15%",
          "2028: 14%",
          "2029: 13%",
          "2030: 12%",
          "2031: 11%",
          "from 2032: 10%",
        ],
      },
      {
        id: "returns", title: "The returns due every year",
        paragraphs: [
          "Returns must be filed electronically via ELSTER or compatible software. Paper filing is only possible on application in hardship cases.",
        ],
        items: [
          "Corporate income tax return, including the separate determination of the tax contribution account (steuerliches Einlagekonto) at the end of each financial year (§27(2), §31(1a) KStG).",
          "Trade tax return (§14a GewStG). Every non-exempt corporation must file one, even with no trade income (§25(1) no. 2 GewStDV).",
          "E-Bilanz: balance sheet and P&L as a dataset in the official taxonomy (§5b EStG). For financial years beginning after 31 December 2024, unaggregated account statements (Kontennachweise) are part of it.",
          "VAT: whether a pure holding is a VAT entrepreneur at all depends on its activities. Small businesses (prior-year turnover up to 25,000 EUR, current year up to 100,000 EUR) are generally exempt from the annual return since 2025, unless the tax office asks for one.",
        ],
      },
      {
        id: "deadlines", title: "Filing deadlines for 2025 and 2026",
        paragraphs: [
          "Without a tax adviser, returns are due seven months after the end of the calendar year (§149(2) AO); with an adviser, generally by the end of February of the second following year (§149(3) AO). A deadline falling on a weekend moves to the next working day. The COVID-era extensions ended with the 2024 tax year.",
        ],
        items: [
          "Tax year 2025: without an adviser 31 July 2026 (passed), with an adviser 1 March 2027.",
          "Tax year 2026: without an adviser 2 August 2027, with an adviser 29 February 2028.",
          "The tax office can request returns earlier (§149(4) AO). Disclosure in the Unternehmensregister has its own deadline.",
        ],
      },
    ],
    faqs: [
      { q: "Is a German holding UG tax-free?", a: "No. Dividends and gains on shares are 95% exempt if the conditions are met. The remaining 5% and all other income, such as interest, are subject to corporate income tax, solidarity surcharge and trade tax. On a dividend that meets both thresholds, the total burden is roughly 1.3 to 1.7% at typical municipal multipliers (280 to 500%)." },
      { q: "From what stake are dividends tax-free in a German holding?", a: "For corporate income tax, from 10% at the start of the calendar year; for trade tax, from 15% at the start of the assessment period. Below those thresholds the dividend is fully taxable for the respective tax." },
      { q: "Does a holding UG that only receives dividends have to file a trade tax return?", a: "Yes. Every non-exempt corporation files a trade tax return each year (§25(1) no. 2 GewStDV), even if no trade income remains after the deductions." },
      { q: "When does German corporate tax go down?", a: "From the 2028 assessment year, by one percentage point a year, from 15% to 10% from 2032 (§23(1) KStG)." },
    ],
    sources: [
      { label: "§8b KStG: holdings in other corporations", href: `${GII}/kstg_1977/__8b.html` },
      { label: "§23 KStG: tax rate", href: `${GII}/kstg_1977/__23.html` },
      { label: "§27 KStG: tax contribution account", href: `${GII}/kstg_1977/__27.html` },
      { label: "§8 GewStG: add-backs", href: `${GII}/gewstg/__8.html` },
      { label: "§9 GewStG: deductions", href: `${GII}/gewstg/__9.html` },
      { label: "§16 GewStG: municipal multiplier", href: `${GII}/gewstg/__16.html` },
      { label: "§25 GewStDV: trade tax return", href: `${GII}/gewstdv/__25.html` },
      { label: "§5b EStG: E-Bilanz", href: `${GII}/estg/__5b.html` },
      { label: "§149 AO: filing deadlines", href: `${GII}/ao_1977/__149.html` },
    ],
    related: [links.en.checklist, links.en.offenlegung, links.en.ruecklage],
  },
};

const BFJ_MERKBLATT =
  "https://www.bundesjustizamt.de/SharedDocs/Downloads/DE/EHUG/Merkblatt_Unternehmensgruender.pdf?__blob=publicationFile&v=6";

export const disclosureGuide: BilingualGuide = {
  de: {
    path: "/offenlegung",
    metaTitle: "UG Jahresabschluss offenlegen: Frist & Hinterlegung | UGtax",
    title: "Jahresabschluss offenlegen: Unternehmensregister und Hinterlegung für die UG",
    description: "Frist, Übermittlungsweg und Ordnungsgeld: wie eine UG ihren Jahresabschluss im Unternehmensregister offenlegt und wann die Hinterlegung möglich ist.",
    intro: "Jede UG muss ihren Jahresabschluss offenlegen, auch ohne Umsatz. Für Geschäftsjahre ab 2022 geht er nicht mehr an den Bundesanzeiger, sondern an das Unternehmensregister. Die Offenlegung ist ein eigener Vorgang neben der E-Bilanz ans Finanzamt; das eine ersetzt das andere nicht.",
    sections: [
      {
        id: "pflicht", title: "Wer offenlegen muss",
        paragraphs: [
          "Die UG gilt als Handelsgesellschaft (§13 Abs. 3 GmbHG) und damit als Kaufmann (§6 Abs. 1 HGB). Als Kapitalgesellschaft muss sie ihren Jahresabschluss elektronisch bei der Stelle einreichen, die das Unternehmensregister führt (§325 Abs. 1 HGB). Eine Ausnahme für ruhende Gesellschaften oder Gesellschaften ohne Umsatz gibt es nicht.",
        ],
      },
      {
        id: "frist", title: "Frist: ein Jahr nach dem Abschlussstichtag",
        paragraphs: [
          "Die Unterlagen sind spätestens ein Jahr nach dem Abschlussstichtag einzureichen (§325 Abs. 1a HGB). Entspricht das Geschäftsjahr dem Kalenderjahr, endet die Frist für den Abschluss 2025 am 31. Dezember 2026.",
          "Der Weg über das Unternehmensregister gilt für Geschäftsjahre, die nach dem 31. Dezember 2021 begonnen haben. Ältere Jahre liefen noch über den Bundesanzeiger.",
        ],
      },
      {
        id: "hinterlegung", title: "Hinterlegung statt Veröffentlichung: nur für Kleinstkapitalgesellschaften",
        paragraphs: [
          "Eine Kleinstkapitalgesellschaft reicht nur ihre Bilanz ein und kann deren dauerhafte Hinterlegung beantragen, statt sie veröffentlichen zu lassen (§326 Abs. 2 HGB). Bei der Einreichung teilt sie mit, dass sie die Größenmerkmale nicht überschreitet.",
          "Kleinstkapitalgesellschaft ist, wer an zwei aufeinanderfolgenden Abschlussstichtagen, bei einer Neugründung am ersten, mindestens zwei der drei folgenden Merkmale nicht überschreitet (§267a Abs. 1, §267 Abs. 4 HGB). Diese Schwellen gelten für Geschäftsjahre, die nach dem 31. Dezember 2023 beginnen:",
        ],
        items: [
          "Bilanzsumme bis 450.000 EUR",
          "Umsatzerlöse bis 900.000 EUR in den zwölf Monaten vor dem Abschlussstichtag",
          "im Jahresdurchschnitt bis zu 10 Arbeitnehmer",
        ],
      },
      {
        id: "holding", title: "Die Holding-Ausnahme in §267a Abs. 3 HGB",
        paragraphs: [
          "Viele Holding-UGs können die Kleinst-Erleichterungen trotzdem nicht nutzen. Eine Gesellschaft, deren einziger Zweck darin besteht, Beteiligungen zu erwerben und zu verwalten, ohne unmittelbar oder mittelbar in die Verwaltung dieser Unternehmen einzugreifen, ist keine Kleinstkapitalgesellschaft (§267a Abs. 3 Nr. 3 HGB). Sie wird als kleine Kapitalgesellschaft behandelt und reicht Bilanz und Anhang zur Veröffentlichung ein (§326 Abs. 1 HGB).",
          "Ob eine Holding in die Verwaltung ihrer Beteiligungen eingreift, ist eine Frage des Einzelfalls. Klären Sie das, bevor Sie das Format der Offenlegung wählen, im Zweifel mit einem Steuerberater.",
        ],
      },
      {
        id: "ordnungsgeld", title: "Ordnungsgeld bei verspäteter Offenlegung",
        paragraphs: [
          "Wer nicht rechtzeitig offenlegt, bekommt ein Ordnungsgeldverfahren des Bundesamts für Justiz, gerichtet gegen die Geschäftsführung, die Gesellschaft oder beide. Das Bundesamt droht ein Ordnungsgeld von 2.500 bis 25.000 EUR an und setzt eine Frist von sechs Wochen, um die Offenlegung nachzuholen (§335 HGB).",
          "Wird die Pflicht erst nach Ablauf der sechs Wochen erfüllt, ermäßigt sich das Ordnungsgeld auf 500 EUR für Kleinstkapitalgesellschaften, die von der Hinterlegung Gebrauch machen, auf 1.000 EUR für kleine Kapitalgesellschaften und auf 2.500 EUR für größere. Bei nur geringfügiger Überschreitung kann es niedriger ausfallen (§335 Abs. 4 HGB).",
        ],
      },
      {
        id: "e-bilanz", title: "Offenlegung und E-Bilanz sind zwei Vorgänge",
        paragraphs: [
          "Die E-Bilanz geht an das Finanzamt und ist nicht öffentlich. Die Offenlegung geht an das Unternehmensregister. Beide haben eigene Formate, Fristen und Nachweise. Eine fristgerecht übermittelte E-Bilanz schützt nicht vor einem Ordnungsgeld des Bundesamts für Justiz.",
        ],
      },
    ],
    faqs: [
      { q: "Muss eine UG ohne Umsatz ihren Jahresabschluss offenlegen?", a: "Ja. Die Pflicht hängt an der Rechtsform, nicht an der Geschäftstätigkeit. Auch eine ruhende UG reicht jedes Jahr ihren Jahresabschluss beim Unternehmensregister ein." },
      { q: "Wo reicht eine UG ihren Jahresabschluss seit 2022 ein?", a: "Elektronisch bei der Stelle, die das Unternehmensregister führt. Für Geschäftsjahre, die nach dem 31. Dezember 2021 begonnen haben, ist das nicht mehr der Bundesanzeiger." },
      { q: "Kann meine Holding-UG ihre Bilanz nur hinterlegen?", a: "Nur wenn sie Kleinstkapitalgesellschaft ist. Reine Beteiligungsholdings, die nicht in die Verwaltung ihrer Beteiligungen eingreifen, sind nach §267a Abs. 3 Nr. 3 HGB ausgeschlossen, auch wenn sie die Größenmerkmale einhalten." },
      { q: "Wie hoch ist das Ordnungsgeld bei verspäteter Offenlegung?", a: "Angedroht werden 2.500 bis 25.000 EUR mit sechs Wochen Frist zur Nachholung. Wird erst danach offengelegt, ermäßigt es sich je nach Größe auf 500, 1.000 oder 2.500 EUR." },
    ],
    sources: [
      { label: "§325 HGB: Offenlegung und Frist", href: `${GII}/hgb/__325.html` },
      { label: "§326 HGB: Erleichterungen für kleine und Kleinstkapitalgesellschaften", href: `${GII}/hgb/__326.html` },
      { label: "§267a HGB: Kleinstkapitalgesellschaft und Holding-Ausnahme", href: `${GII}/hgb/__267a.html` },
      { label: "§267 HGB: Größenklassen", href: `${GII}/hgb/__267.html` },
      { label: "§335 HGB: Ordnungsgeldverfahren", href: `${GII}/hgb/__335.html` },
      { label: "§13 GmbHG: Handelsgesellschaft", href: `${GII}/gmbhg/__13.html` },
      { label: "Bundesamt für Justiz: Merkblatt für Unternehmensgründer", href: BFJ_MERKBLATT },
    ],
    related: [links.de.jahresabschluss, links.de.steuern, links.de.ruecklage],
  },
  en: {
    path: "/offenlegung",
    metaTitle: "Disclosing UG Annual Accounts in Germany | UGtax",
    title: "Disclosing a UG's annual accounts: Unternehmensregister and deposit",
    description: "Deadline, filing route and fines: how a German UG discloses its annual accounts in the Unternehmensregister, and when it may just deposit the balance sheet.",
    intro: "Every German UG must disclose its annual accounts, even with no revenue. For financial years from 2022, they go to the Unternehmensregister instead of the Bundesanzeiger. Disclosure is separate from the E-Bilanz sent to the tax office; one does not replace the other.",
    sections: [
      {
        id: "obligation", title: "Who must disclose",
        paragraphs: [
          "A UG counts as a commercial company (§13(3) GmbHG) and therefore as a merchant (§6(1) HGB). As a corporation, it must submit its annual accounts electronically to the body that keeps the Unternehmensregister (§325(1) HGB). There is no exception for dormant companies or companies without revenue.",
        ],
      },
      {
        id: "deadline", title: "Deadline: one year after the balance-sheet date",
        paragraphs: [
          "The documents are due no later than one year after the balance-sheet date (§325(1a) HGB). With a calendar financial year, the 2025 accounts are due by 31 December 2026.",
          "The Unternehmensregister route applies to financial years beginning after 31 December 2021. Earlier years still went through the Bundesanzeiger.",
        ],
      },
      {
        id: "deposit", title: "Deposit instead of publication: micro companies only",
        paragraphs: [
          "A micro company (Kleinstkapitalgesellschaft) submits only its balance sheet and can apply for permanent deposit (Hinterlegung) instead of publication (§326(2) HGB). When filing, it confirms that it does not exceed the size criteria.",
          "A company is a micro company if, on two consecutive balance-sheet dates (for a newly formed company, the first one), it does not exceed at least two of these three criteria (§267a(1), §267(4) HGB). The thresholds apply to financial years beginning after 31 December 2023:",
        ],
        items: [
          "balance-sheet total up to 450,000 EUR",
          "revenue up to 900,000 EUR in the twelve months before the balance-sheet date",
          "an annual average of up to 10 employees",
        ],
      },
      {
        id: "holding", title: "The holding exclusion in §267a(3) HGB",
        paragraphs: [
          "Many holding UGs still cannot use the micro-company relief. A company whose sole purpose is acquiring and managing investments without being involved, directly or indirectly, in the management of those companies is not a micro company (§267a(3) no. 3 HGB). It is treated as a small company and submits its balance sheet and notes for publication (§326(1) HGB).",
          "Whether a holding is involved in the management of its investments depends on the facts. Settle this before choosing the disclosure format, with a tax adviser if in doubt.",
        ],
      },
      {
        id: "penalties", title: "Penalties for late disclosure",
        paragraphs: [
          "Late filers face proceedings by the Federal Office of Justice (Bundesamt für Justiz) against the managing directors, the company or both. The office announces an administrative fine (Ordnungsgeld) of 2,500 to 25,000 EUR and sets six weeks to make up the filing (§335 HGB).",
          "If the filing is only made after those six weeks, the fine is reduced to 500 EUR for micro companies using the deposit option, 1,000 EUR for small companies and 2,500 EUR for larger ones. If the deadline was missed only slightly, it can be lower (§335(4) HGB).",
        ],
      },
      {
        id: "e-bilanz", title: "Disclosure and the E-Bilanz are two separate filings",
        paragraphs: [
          "The E-Bilanz goes to the tax office and is not public. Disclosure goes to the Unternehmensregister. Each has its own format, deadline and proof of submission. An E-Bilanz filed on time does not protect against a fine from the Federal Office of Justice.",
        ],
      },
    ],
    faqs: [
      { q: "Does a UG with no revenue have to disclose its annual accounts?", a: "Yes. The obligation follows from the legal form, not from business activity. A dormant UG still submits its annual accounts to the Unternehmensregister every year." },
      { q: "Where does a UG file its annual accounts since 2022?", a: "Electronically with the body that keeps the Unternehmensregister. For financial years beginning after 31 December 2021, that is no longer the Bundesanzeiger." },
      { q: "Can my holding UG just deposit its balance sheet?", a: "Only if it is a micro company. Pure investment holdings that are not involved in managing their investments are excluded by §267a(3) no. 3 HGB, even if they meet the size criteria." },
      { q: "How high is the fine for late disclosure?", a: "2,500 to 25,000 EUR is announced, with six weeks to make up the filing. If disclosure only follows after that, it is reduced to 500, 1,000 or 2,500 EUR depending on company size." },
    ],
    sources: [
      { label: "§325 HGB: disclosure and deadline", href: `${GII}/hgb/__325.html` },
      { label: "§326 HGB: relief for small and micro companies", href: `${GII}/hgb/__326.html` },
      { label: "§267a HGB: micro companies and the holding exclusion", href: `${GII}/hgb/__267a.html` },
      { label: "§267 HGB: size classes", href: `${GII}/hgb/__267.html` },
      { label: "§335 HGB: administrative fine proceedings", href: `${GII}/hgb/__335.html` },
      { label: "§13 GmbHG: commercial company", href: `${GII}/gmbhg/__13.html` },
      { label: "Federal Office of Justice: guidance for company founders", href: BFJ_MERKBLATT },
    ],
    related: [links.en.checklist, links.en.noRevenue, links.en.steuern],
  },
};

export const reserveGuide: BilingualGuide = {
  de: {
    path: "/ug-ruecklage",
    metaTitle: "UG-Rücklage nach §5a GmbHG: die 25-%-Regel | UGtax",
    title: "UG-Rücklage nach §5a GmbHG: die 25-%-Regel",
    description: "Wie viel Gewinn die UG in die gesetzliche Rücklage einstellen muss, wofür die Rücklage verwendet werden darf und wann die Pflicht endet.",
    intro: "Eine UG (haftungsbeschränkt) kann mit einem Euro Stammkapital gegründet werden. Im Gegenzug muss sie einen Teil ihrer Gewinne zurücklegen, bis sie zur regulären GmbH heranwächst. Die Regel steht in §5a Abs. 3 GmbHG und gilt für jede UG, auch für die Holding.",
    sections: [
      {
        id: "regel", title: "Ein Viertel des Jahresüberschusses",
        paragraphs: [
          "In der Bilanz ist eine gesetzliche Rücklage zu bilden, in die ein Viertel des um einen Verlustvortrag aus dem Vorjahr geminderten Jahresüberschusses einzustellen ist (§5a Abs. 3 Satz 1 GmbHG). Eine Obergrenze gibt es nicht: Die Pflicht besteht in jedem Jahr mit Jahresüberschuss, unabhängig davon, wie hoch die Rücklage bereits ist.",
          "Beispiel: Jahresüberschuss 2025 von 12.000 EUR, Verlustvortrag aus 2024 von 2.000 EUR. In die Rücklage sind 25 % von 10.000 EUR einzustellen, also 2.500 EUR.",
          "Maßgeblich ist der handelsrechtliche Jahresüberschuss laut GuV, also der Gewinn nach Steuern, nicht das steuerliche Einkommen. Bei einer Holding zählen Dividenden, die nach §8b KStG weitgehend steuerfrei sind, deshalb in voller Höhe mit.",
        ],
      },
      {
        id: "verwendung", title: "Wofür die Rücklage verwendet werden darf",
        paragraphs: [
          "Die Rücklage ist gebunden und darf nicht an die Gesellschafter ausgeschüttet werden. Zulässig ist nur die Verwendung (§5a Abs. 3 Satz 2 GmbHG)",
        ],
        items: [
          "für eine Kapitalerhöhung aus Gesellschaftsmitteln nach §57c GmbHG,",
          "zum Ausgleich eines Jahresfehlbetrags, soweit er nicht durch einen Gewinnvortrag aus dem Vorjahr gedeckt ist,",
          "zum Ausgleich eines Verlustvortrags aus dem Vorjahr, soweit er nicht durch einen Jahresüberschuss gedeckt ist.",
        ],
      },
      {
        id: "ende", title: "Wann die Pflicht endet",
        paragraphs: [
          "Die Sonderregeln für die UG, einschließlich der Rücklagenpflicht, gelten nicht mehr, sobald die Gesellschaft ihr Stammkapital auf mindestens 25.000 EUR erhöht (§5a Abs. 5 GmbHG). Die Firma \"UG (haftungsbeschränkt)\" darf sie danach beibehalten. Eine Kapitalerhöhung aus Gesellschaftsmitteln mit der angesparten Rücklage ist der vorgesehene Weg dorthin.",
        ],
      },
      {
        id: "fehlende-ruecklage", title: "Was passiert, wenn die Rücklage fehlt",
        paragraphs: [
          "Wird die Rücklage nicht gebildet, verstößt der Jahresabschluss gegen eine gesetzliche Bindung. In der Literatur wird für diesen Fall die Nichtigkeit des Jahresabschlusses in entsprechender Anwendung von §256 Abs. 1 Nr. 4 AktG vertreten; eine höchstrichterliche Entscheidung dazu ist uns nicht bekannt. Eine Gewinnausschüttung auf Grundlage eines solchen Abschlusses ist entsprechend riskant.",
          "UGtax prüft beim Jahresabschluss, ob die Rücklage nach §5a Abs. 3 GmbHG gebildet wurde, und weist auf einen Fehlbetrag hin.",
        ],
      },
    ],
    faqs: [
      { q: "Wie viel muss eine UG in die Rücklage einstellen?", a: "25 % des Jahresüberschusses, gemindert um einen Verlustvortrag aus dem Vorjahr. Bei 8.000 EUR Jahresüberschuss ohne Verlustvortrag sind das 2.000 EUR." },
      { q: "Gilt die Rücklagenpflicht auch für steuerfreie Dividenden?", a: "Ja. Maßgeblich ist der handelsrechtliche Jahresüberschuss. Dividenden, die nach §8b KStG weitgehend steuerfrei sind, erhöhen ihn trotzdem in voller Höhe." },
      { q: "Gibt es eine Obergrenze für die UG-Rücklage?", a: "Nein. Die Pflicht endet erst, wenn das Stammkapital auf mindestens 25.000 EUR erhöht wird." },
      { q: "Darf die UG-Rücklage ausgeschüttet werden?", a: "Nein. Sie darf nur für eine Kapitalerhöhung aus Gesellschaftsmitteln oder zum Ausgleich von Verlusten verwendet werden." },
    ],
    sources: [
      { label: "§5a GmbHG: Unternehmergesellschaft", href: `${GII}/gmbhg/__5a.html` },
      { label: "§57c GmbHG: Kapitalerhöhung aus Gesellschaftsmitteln", href: `${GII}/gmbhg/__57c.html` },
      { label: "§256 AktG: Nichtigkeit des Jahresabschlusses", href: `${GII}/aktg/__256.html` },
    ],
    related: [links.de.jahresabschluss, links.de.steuern, links.de.offenlegung],
  },
  en: {
    path: "/ug-ruecklage",
    metaTitle: "UG Reserve under §5a GmbHG: the 25% Rule | UGtax",
    title: "The UG reserve under §5a GmbHG: the 25% rule",
    description: "How much profit a German UG must put into its statutory reserve, what the reserve may be used for, and when the obligation ends.",
    intro: "A UG (haftungsbeschränkt) can be formed with one euro of share capital. In return, it must retain part of its profits until it grows into a regular GmbH. The rule is in §5a(3) GmbHG and applies to every UG, holdings included.",
    sections: [
      {
        id: "rule", title: "A quarter of the annual net profit",
        paragraphs: [
          "The balance sheet must show a statutory reserve, into which a quarter of the annual net profit (Jahresüberschuss), reduced by any loss carried forward from the previous year, is transferred (§5a(3) sentence 1 GmbHG). There is no cap: the obligation applies in every year with a profit, however large the reserve already is.",
          "Example: 2025 net profit of 12,000 EUR and a 2,000 EUR loss carried forward from 2024. 25% of 10,000 EUR, that is 2,500 EUR, goes into the reserve.",
          "What counts is the commercial-law net profit in the P&L, after tax, not taxable income. In a holding, dividends that are largely tax-exempt under §8b KStG therefore count in full.",
        ],
      },
      {
        id: "use", title: "What the reserve may be used for",
        paragraphs: [
          "The reserve is restricted and may not be distributed to shareholders. It may only be used (§5a(3) sentence 2 GmbHG)",
        ],
        items: [
          "for a capital increase from company funds under §57c GmbHG,",
          "to offset an annual net loss not covered by profit carried forward from the previous year,",
          "to offset a loss carried forward from the previous year not covered by an annual net profit.",
        ],
      },
      {
        id: "end", title: "When the obligation ends",
        paragraphs: [
          "The special UG rules, including the reserve requirement, stop applying once the company raises its share capital to at least 25,000 EUR (§5a(5) GmbHG). It may keep the name \"UG (haftungsbeschränkt)\". A capital increase from company funds using the accumulated reserve is the intended route.",
        ],
      },
      {
        id: "missing-reserve", title: "If the reserve is missing",
        paragraphs: [
          "Accounts that omit the reserve breach a statutory restriction. Legal commentary argues that such accounts are void by analogy to §256(1) no. 4 AktG; we are not aware of a supreme-court decision on the point. Distributing profit on the basis of such accounts is correspondingly risky.",
          "UGtax checks whether the §5a(3) GmbHG reserve has been formed when preparing the annual accounts and flags any shortfall.",
        ],
      },
    ],
    faqs: [
      { q: "How much must a UG put into its reserve?", a: "25% of the annual net profit, reduced by any loss carried forward from the previous year. With an 8,000 EUR profit and no loss carried forward, that is 2,000 EUR." },
      { q: "Does the reserve requirement apply to tax-free dividends?", a: "Yes. The commercial-law net profit is what counts. Dividends that are largely tax-exempt under §8b KStG still increase it in full." },
      { q: "Is there a cap on the UG reserve?", a: "No. The obligation only ends when share capital is raised to at least 25,000 EUR." },
      { q: "Can the UG reserve be paid out?", a: "No. It may only be used for a capital increase from company funds or to offset losses." },
    ],
    sources: [
      { label: "§5a GmbHG: the Unternehmergesellschaft", href: `${GII}/gmbhg/__5a.html` },
      { label: "§57c GmbHG: capital increase from company funds", href: `${GII}/gmbhg/__57c.html` },
      { label: "§256 AktG: void annual accounts", href: `${GII}/aktg/__256.html` },
    ],
    related: [links.en.checklist, links.en.steuern, links.en.offenlegung],
  },
};
