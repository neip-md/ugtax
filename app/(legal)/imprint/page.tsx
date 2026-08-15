import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum - UGtax",
};

export default function ImprintPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Angaben gem&auml;&szlig; DDG &sect;5
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          NEIP Ventures UG (haftungsbeschr&auml;nkt)<br />
          Retzbacher Weg 44<br />
          13189 Berlin<br />
          Deutschland
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Vertreten durch
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Noah E. I. Petermann (Gesch&auml;ftsf&uuml;hrer)
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Registereintrag
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Amtsgericht Charlottenburg (Berlin)<br />
          HRB 270942 B
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Kontakt
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          E-Mail:{" "}
          <a href="mailto:noah@neip.vc" className="underline hover:text-zinc-900 dark:hover:text-zinc-200">
            noah@neip.vc
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Umsatzsteuer-Identifikationsnummer
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect;27a UStG: nicht vorhanden.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Verantwortlich f&uuml;r den Inhalt nach &sect;18 Abs. 2 MStV
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Noah E. I. Petermann<br />
          Retzbacher Weg 44<br />
          13189 Berlin
        </p>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Haftung f&uuml;r Inhalte
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Die Inhalte unserer Seiten wurden mit gr&ouml;&szlig;ter Sorgfalt erstellt. F&uuml;r die Richtigkeit,
          Vollst&auml;ndigkeit und Aktualit&auml;t der Inhalte k&ouml;nnen wir jedoch keine Gew&auml;hr
          &uuml;bernehmen. Als Diensteanbieter sind wir gem&auml;&szlig; DDG &sect;7 Abs. 1 f&uuml;r eigene
          Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach DDG &sect;&sect;8 bis 10
          sind wir als Diensteanbieter jedoch nicht verpflichtet, &uuml;bermittelte oder gespeicherte fremde
          Informationen zu &uuml;berwachen oder nach Umst&auml;nden zu forschen, die auf eine rechtswidrige
          T&auml;tigkeit hinweisen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Haftung f&uuml;r Links
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Unser Angebot enth&auml;lt Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
          Deshalb k&ouml;nnen wir f&uuml;r diese fremden Inhalte auch keine Gew&auml;hr &uuml;bernehmen. F&uuml;r
          die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf m&ouml;gliche Rechtsverst&ouml;&szlig;e
          &uuml;berpr&uuml;ft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Urheberrecht
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
          Urheberrecht. Die Vervielf&auml;ltigung, Bearbeitung, Verbreitung und jede Art der Verwertung
          au&szlig;erhalb der Grenzen des Urheberrechts bed&uuml;rfen der schriftlichen Zustimmung des jeweiligen
          Autors bzw. Erstellers. Der Quellcode dieses Projekts ist unter der MIT-Lizenz ver&ouml;ffentlicht.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Streitschlichtung
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Die Europ&auml;ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </div>
  );
}
