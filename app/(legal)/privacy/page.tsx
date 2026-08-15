import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung - UGtax",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Datenschutzerkl&auml;rung</h1>

      {/* 1. Verantwortlicher */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          1. Verantwortlicher
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          NEIP Ventures UG (haftungsbeschr&auml;nkt)<br />
          Retzbacher Weg 44, 13189 Berlin<br />
          E-Mail:{" "}
          <a href="mailto:noah@neip.vc" className="underline hover:text-zinc-900 dark:hover:text-zinc-200">
            noah@neip.vc
          </a>
          <br />
          Gesch&auml;ftsf&uuml;hrer: Noah E. I. Petermann
        </p>
      </section>

      {/* 2. Allgemeines */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          2. Allgemeines zur Datenverarbeitung
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          UGtax erfordert kein Benutzerkonto. Es werden keine personenbezogenen Daten erhoben, die &uuml;ber die
          technisch notwendige Bereitstellung der Website hinausgehen.
        </p>
      </section>

      {/* 3. Hosting */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          3. Hosting
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Diese Website wird von Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA gehostet.
          Beim Aufruf der Website werden automatisch technische Daten in Server-Logfiles erfasst:
          IP-Adresse, Browsertyp und -version, Betriebssystem, Referrer-URL, Zeitpunkt des Zugriffs.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der sicheren und effizienten
          Bereitstellung der Website).
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Drittlandtransfer:</strong>{" "}
          Vercel nimmt am EU-US Data Privacy Framework teil. Weitere Informationen:{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            vercel.com/legal/privacy-policy
          </a>
          .
        </p>
      </section>

      {/* 4. Webanalyse */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          4. Webanalyse (Vercel Analytics)
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Wir verwenden Vercel Analytics zur anonymen Analyse der Websitenutzung (Seitenaufrufe,
          Herkunft, Ger&auml;tetyp). Vercel Analytics setzt keine Cookies und speichert keine
          personenbezogenen Daten. Es werden keine IP-Adressen oder Fingerprints erfasst.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Analyse und Verbesserung
          der Website).
        </p>
      </section>

      {/* 5. Cookies */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          5. Cookies
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          UGtax verwendet ausschlie&szlig;lich ein funktionales First-Party-Cookie:{" "}
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">theme</code>{" "}
          (Wert: &ldquo;dark&rdquo; oder &ldquo;light&rdquo;, G&uuml;ltigkeit: 1 Jahr).
          Dieses Cookie speichert Ihre bevorzugte Farbdarstellung und enth&auml;lt keine
          personenbezogenen Daten.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der korrekten Darstellung
          der Website gem&auml;&szlig; Nutzerpr&auml;ferenz). Streng notwendiges Cookie
          gem&auml;&szlig; &sect; 25 Abs. 2 Nr. 2 TDDDG.
        </p>
      </section>

      {/* 6. Bankexport-Verarbeitung */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          6. Bankexport-Verarbeitung
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Wenn Sie einen Bankexport hochladen (XML, CSV, XLSX oder ZIP), wird die Datei serverseitig
          verarbeitet, um Transaktionen zu klassifizieren und Bilanz sowie GuV zu berechnen. Die Datei
          wird ausschlie&szlig;lich im Arbeitsspeicher verarbeitet und nach Abschluss der Anfrage
          sofort gel&ouml;scht. Es erfolgt keine dauerhafte Speicherung Ihrer Bankdaten.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Verarbeitete Daten:</strong>{" "}
          Transaktionsdatum, Betrag, Richtung, Gegenpartei, Verwendungszweck.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO (Durchf&uuml;hrung vorvertraglicher Ma&szlig;nahmen /
          Nutzung des Dienstes auf Ihre Anfrage hin).
        </p>
      </section>

      {/* 7. KI-Klassifizierung */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          7. KI-Klassifizierung (Anthropic, OpenAI oder Google)
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Optional k&ouml;nnen Sie einen eigenen API-Key eingeben, um nicht erkannte Transaktionen
          per KI klassifizieren zu lassen. In diesem Fall werden Transaktionsdaten (Datum, Betrag,
          Gegenpartei, Verwendungszweck) an denjenigen Anbieter &uuml;bermittelt, dessen Modell Sie
          ausgew&auml;hlt haben. Zur Auswahl stehen:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <li>
            Anthropic, PBC, 548 Market St, PMB 90375, San Francisco, CA 94104, USA (
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Datenschutzerkl&auml;rung
            </a>
            )
          </li>
          <li>
            OpenAI Ireland Ltd., Dublin, Irland bzw. OpenAI, L.L.C., San Francisco, USA (
            <a
              href="https://openai.com/policies/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Datenschutzerkl&auml;rung
            </a>
            )
          </li>
          <li>
            Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland (
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Datenschutzerkl&auml;rung
            </a>
            )
          </li>
        </ul>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Es wird ausschlie&szlig;lich der von Ihnen ausgew&auml;hlte Anbieter kontaktiert; die
          &uuml;brigen erhalten keine Daten. Mit der &Uuml;bermittlung kann eine Verarbeitung in den
          USA verbunden sein. Die Datenverarbeitung richtet sich nach der Datenschutzerkl&auml;rung
          und den vertraglichen Garantien des jeweiligen Anbieters, mit dem Sie als Inhaber des
          API-Keys in einem eigenen Vertragsverh&auml;ltnis stehen.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Ihr API-Key wird ausschlie&szlig;lich f&uuml;r die aktuelle Sitzung verwendet und
          zu keinem Zeitpunkt von UGtax gespeichert oder protokolliert.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Sie aktivieren die KI-Klassifizierung
          aktiv und freiwillig. Sie k&ouml;nnen die Funktion jederzeit nicht nutzen.
        </p>
      </section>

      {/* 8. ELSTER */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          8. ELSTER-&Uuml;bermittlung
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Bei Nutzung der Self-Hosting-Variante kann die E-Bilanz direkt &uuml;ber die ERiC-Schnittstelle
          an das Finanzamt &uuml;bermittelt werden. Hierf&uuml;r laden Sie Ihr ELSTER-Zertifikat (.pfx)
          im Browser hoch. Das Zertifikat wird ausschlie&szlig;lich zur Authentifizierung gegen&uuml;ber
          der Finanzverwaltung verwendet, verschl&uuml;sselt &uuml;bertragen und zu keinem Zeitpunkt
          gespeichert oder an Dritte weitergegeben.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <strong className="text-zinc-700 dark:text-zinc-300">Rechtsgrundlage:</strong>{" "}
          Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung - Übermittlung gem&auml;&szlig; &sect;87a AO).
        </p>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* 9. Betroffenenrechte */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          9. Ihre Rechte
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Sie haben nach der DSGVO folgende Rechte:
        </p>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed list-disc list-inside space-y-1">
          <li>Auskunft &uuml;ber Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>L&ouml;schung Ihrer Daten (Art. 17 DSGVO)</li>
          <li>Einschr&auml;nkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Daten&uuml;bertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
        </ul>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Zur Aus&uuml;bung Ihrer Rechte wenden Sie sich an{" "}
          <a href="mailto:noah@neip.vc" className="underline hover:text-zinc-900 dark:hover:text-zinc-200">
            noah@neip.vc
          </a>
          .
        </p>
      </section>

      {/* 10. Aufsichtsbehörde */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          10. Beschwerderecht bei der Aufsichtsbeh&ouml;rde
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbeh&ouml;rde &uuml;ber die
          Verarbeitung Ihrer personenbezogenen Daten zu beschweren. Die f&uuml;r uns zust&auml;ndige
          Aufsichtsbeh&ouml;rde ist:
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Berliner Beauftragte f&uuml;r Datenschutz und Informationsfreiheit<br />
          Friedrichstra&szlig;e 219, 10969 Berlin<br />
          <a
            href="https://www.datenschutz-berlin.de"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            datenschutz-berlin.de
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Stand: M&auml;rz 2026
        </p>
      </section>
    </div>
  );
}
