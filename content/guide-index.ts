/**
 * Every guide page, in one list.
 *
 * The footer, the sitemap and llms.txt all link to the guides; reading them
 * from here keeps a new guide from being published but left unlinked, which
 * is how a page ends up orphaned and never crawled.
 */

type Label = { title: string; description: string };

export type GuideEntry = {
  path: string;
  /** Absent for the English-only guides. */
  de?: Label;
  en: Label;
};

export const GUIDE_INDEX: GuideEntry[] = [
  {
    path: "/jahresabschluss",
    de: {
      title: "Holding-UG Jahresabschluss ohne Steuerberater",
      description: "Was eine Holding-UG abgeben muss und wie UGtax beim Jahresabschluss hilft.",
    },
    en: {
      title: "Holding UG annual accounts without a tax adviser",
      description: "What a holding UG must file and how UGtax helps with the annual accounts.",
    },
  },
  {
    path: "/e-bilanz",
    de: {
      title: "E-Bilanz für die UG selbst erstellen",
      description: "Datensatz vorbereiten, Taxonomie prüfen und den Übermittlungsweg wählen.",
    },
    en: {
      title: "How to prepare and submit an E-Bilanz",
      description: "Prepare the dataset, check the taxonomy and choose a submission route.",
    },
  },
  {
    path: "/holding-ug-steuern",
    de: {
      title: "Holding-UG Steuern: KSt, GewSt und §8b KStG",
      description: "Wie Dividenden und Veräußerungsgewinne in der Holding besteuert werden.",
    },
    en: {
      title: "Holding UG taxes: corporate tax, trade tax and §8b KStG",
      description: "How dividends and gains on shares are taxed inside a German holding UG.",
    },
  },
  {
    path: "/offenlegung",
    de: {
      title: "Jahresabschluss offenlegen: Unternehmensregister und Hinterlegung",
      description: "Frist, Weg und Ordnungsgeld bei der Offenlegung des UG-Jahresabschlusses.",
    },
    en: {
      title: "Disclosing a UG's annual accounts in the Unternehmensregister",
      description: "Deadline, filing route and penalties for disclosing a UG's accounts.",
    },
  },
  {
    path: "/ug-ruecklage",
    de: {
      title: "UG-Rücklage nach §5a GmbHG: die 25-%-Regel",
      description: "Wie viel Gewinn die UG zurücklegen muss und wofür die Rücklage verwendet werden darf.",
    },
    en: {
      title: "The UG reserve under §5a GmbHG: the 25% rule",
      description: "How much profit a UG must retain and what the reserve may be used for.",
    },
  },
  {
    path: "/vergleich",
    de: {
      title: "UGtax vs Steuerberater vs eBilanz+",
      description: "Kosten, Funktionen und wann welche Option sinnvoll ist.",
    },
    en: {
      title: "UGtax vs tax adviser vs eBilanz+",
      description: "Costs, features and when each option makes sense.",
    },
  },
  {
    path: "/ug-tax-filing-checklist",
    en: {
      title: "German UG tax filing checklist",
      description: "Annual accounts, tax returns and disclosure: what to prepare and where to file.",
    },
  },
  {
    path: "/ug-with-no-revenue",
    en: {
      title: "UG with no revenue",
      description: "What an inactive company still needs to check, prepare and file.",
    },
  },
];

/** The guides that exist in a locale, with that locale's labels. */
export function guidesFor(locale: string): (Label & { path: string })[] {
  return GUIDE_INDEX.flatMap((g) => {
    const label = locale === "de" ? g.de : g.en;
    return label ? [{ path: g.path, ...label }] : [];
  });
}
