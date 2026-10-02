# PokéVault für Cloudflare Free

Vorbereitetes Umzugspaket für Tobias: zwei getrennte Benutzerkonten, Pokémon-Karten mit Bildern, mehrere Sammlungen, Cardmarket-Richtpreise via TCGdex und täglicher Portfolio-Chart. Der Quellcode liegt im GitHub-Repository `Nichttobi12/cards`. Das Portal ist noch nicht auf deinem Cloudflare-Konto veröffentlicht. Die Anmeldung mit deinem realen Supabase-Projekt ist noch nicht geprüft.

## Voraussetzungen

- Cloudflare-Konto im Workers Free-Tarif.
- GitHub-Konto mit dem Repository `cards` für diesen Code. Zugangsdaten und Sammlungsdaten gehören nicht in das Repository.
- Supabase-Projekt im Free-Tarif. Keine eigene Domain und kein Clerk-Konto erforderlich.
- Aktuelles Node.js (mindestens 22.13). Der Code ist eine React-Anwendung mit einem kleinen Cloudflare Worker; keine ChatGPT-Anmeldung.

## 1. Supabase einrichten

1. Im Supabase-Dashboard ein Free-Projekt anlegen, vorzugsweise in einer EU-Region. Das Projektpasswort bleibt bei dir.
2. Unter Authentication → Users → Add user zwei Benutzer mit E-Mail und jeweils eigenem Passwort anlegen. E-Mail-Bestätigung für diese manuell angelegten Benutzer im Dashboard durchführen. Keine Passwörter in ChatGPT, GitHub oder Cloudflare-Code eintragen.
3. Unter Authentication → Sign In / Providers E-Mail/Passwort aktivieren. Öffentliche Registrierung für weitere Benutzer deaktivieren.
4. Aus den Projekt-Einstellungen die Project URL (`https://….supabase.co`) und den **Publishable Key** (`sb_publishable_…`) übernehmen. Keine Secret- oder service_role-Schlüssel verwenden.
5. Die gewünschten zwei Benutzernamen werden im Cloudflare-Secret `USER_ACCOUNTS_JSON` den beiden E-Mail-Adressen zugeordnet. Supabase selbst prüft die Passwörter; das Portal zeigt eine Benutzername-Anmeldung.
6. Vergessene Passwörter werden zunächst über die Benutzerverwaltung im Supabase-Dashboard zurückgesetzt. Das Portal enthält keine öffentliche Registrierung und keine Passwort-Zurücksetzen-E-Mailfunktion.

Die Supabase-Datenbank wird vom Portal nicht für Kartendaten verwendet. Deshalb erstellt das Paket dort keine Tabellen, Funktionen oder RLS-Regeln. Kartendaten liegen in Cloudflare D1. Supabase Free kann bei längerer Inaktivität pausieren; im Dashboard lässt sich das Projekt dann wieder aktivieren. Es wird kein kostenpflichtiger Tarif automatisch eingerichtet.

## 2. Cloudflare-Datenbank anlegen

1. In Cloudflare unter Storage & Databases → D1 eine Datenbank `pokevault` anlegen.
2. Deren Database ID in `wrangler.jsonc` anstelle von `REPLACE_WITH_YOUR_D1_DATABASE_ID` eintragen und die Änderung in GitHub speichern.
3. Die drei SQL-Dateien im Ordner `migrations` werden beim Veröffentlichen der Anwendung angewendet. Sie erstellen die Tabellen für Sammlungen, Karten, Wertstände und Anmeldebegrenzung. Die bestehenden Sites-Daten werden hierdurch nicht übertragen.

## 3. GitHub und Cloudflare verbinden

1. Das bestehende GitHub-Repository `Nichttobi12/cards` verwenden. Der Code liegt bereits im Stammverzeichnis; `package.json` und `wrangler.jsonc` müssen direkt im Repository-Stamm liegen.
2. Cloudflare → Workers & Pages → Create application → Import a repository → Get started.
3. GitHub verbinden und das Repository auswählen.
4. Worker-Name: **pokevault** (muss dem Namen in `wrangler.jsonc` entsprechen).
5. Produktionsbranch: **main**. Stammverzeichnis: leer bzw. `/`.
6. Build-Befehl: `npm run build`.
7. Deploy-Befehl: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`.
8. Free-Tarif beibehalten. Keine eigene Domain kaufen; die zugewiesene `workers.dev`-Adresse verwenden.
9. Falls beim ersten Deploy die Anmeldung noch nicht konfiguriert ist, erscheint ein Einrichtungsfehler. Setze die unten stehenden Laufzeitwerte und veröffentliche erneut.

## 4. Laufzeitwerte in Cloudflare setzen

Unter Workers & Pages → pokevault → Settings → Variables and Secrets folgende Werte setzen, anschließend neu veröffentlichen:

| Name | Typ | Inhalt |
| --- | --- | --- |
| SUPABASE_URL | Variable | Project URL deines Supabase-Projekts |
| SUPABASE_PUBLISHABLE_KEY | Secret | Publishable Key, kein service_role/Secret API Key |
| USER_ACCOUNTS_JSON | Secret | `{"Tobias":"erste-email@example.com","Sammler2":"zweite-email@example.com"}` mit genau zwei eigenen Konten |

Die beiden tatsächlichen Passwörter bleiben ausschließlich bei Supabase. Ein Zugriff auf das Portal ist nur für die zwei konfigurierten E-Mail-Adressen zulässig, auch wenn im Supabase-Projekt andere Konten existieren. Kartendaten werden serverseitig ausschließlich anhand der bestätigten Supabase-Benutzer-ID ausgewählt. Sitzungen verwenden HttpOnly-/Secure-Cookies und werden bei Ablauf erneuert. Zehn Anmeldeversuche je IP in zehn Minuten sind erlaubt.

## 5. Vorhandene Sammlung übertragen

1. Im bisherigen ChatGPT-Portal unter Pflege & Daten einen vollständigen JSON-Export herunterladen.
2. Im Supabase-Dashboard die User ID des Kontos kopieren, das diese Sammlung erhalten soll.
3. Lokal im Projekt ausführen:

```sh
node scripts/import-backup.mjs BACKUP.json SUPABASE_USER_ID > import.sql
npx wrangler d1 execute DB --remote --file import.sql
```

Das Importskript erzeugt SQL mit deinen vorhandenen IDs und weist Daten ausschließlich dem angegebenen Konto zu. Es ist für eine leere Ziel-Datenbank bzw. noch nicht importierte Sammlungen vorgesehen. Bei bereits vorhandenen IDs bricht die Transaktion ab; es überschreibt oder löscht keine bestehenden Karten. `import.sql` enthält private Sammlungsdaten und gehört nicht ins GitHub-Repository.

## 6. Tagespreise und Chart

- Cloudflare startet die Aktualisierung ab **08:00 Uhr Europe/Budapest** (entspricht deutscher Ortszeit).
- Ein Cron-Aufruf pro Minute prüft den Fortschritt. Je Aufruf werden höchstens zehn unterschiedliche Karten/Sprache-Kombinationen für ein Portfolio aktualisiert. Damit bleiben die externen Aufrufe pro Worker-Aufruf begrenzt.
- Bei 570 unterschiedlichen Karten dauert ein kompletter Tagesdurchlauf grob eine Stunde; bei zwei großen Portfolios entsprechend länger. Bereits aktuelle Karten sind sofort sichtbar, der Tagesstand wird nach dem kompletten Durchlauf gespeichert.
- Fehlgeschlagene Preisabrufe behalten den bisherigen Preis; der Tagesstand vermerkt diese Ausfälle. Am nächsten Tag wird wieder versucht. Manuelles Aktualisieren ist zusätzlich möglich und läuft ebenfalls in kleinen Teilabrufen.
- Cloudflare Free hat neben Anfragekontingenten auch CPU- und Unteranfragegrenzen. Vor dem Live-Einsatz müssen Anmeldung, ein repräsentativer Kartensatz und der Cron-Aufruf auf dem echten Free-Konto geprüft werden. Kein erfolgreicher Live-Test wird durch dieses Paket behauptet.
- Das bisherige Sites-Portal und seine tägliche Automatisierung laufen weiter, bis der Umzug erfolgreich geprüft ist. Danach sollte die alte Automatisierung pausiert werden.

## Entwicklung und Updates

```sh
npm ci
npm run build
npx wrangler d1 migrations apply DB --local
```

Für lokale Tests `.dev.vars.example` nach `.dev.vars` kopieren und eigene Werte eintragen. Die Anwendung dann über `npx wrangler dev` öffnen; reine Vite-Entwicklung stellt keine API oder Anmeldung bereit. Für Tests mit HTTPS-Cookies muss die lokale Sitzung entsprechend über HTTPS bereitgestellt werden.

Spätere Updates: Code ändern → in den verbundenen Produktionsbranch hochladen → Cloudflare baut und veröffentlicht automatisch. Das Repo sollte für Änderungen über das GitHub-Plugin erreichbar sein; das installierte Plugin allein beweist noch keinen funktionierenden Schreibzugriff.

## Dokumentation

- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://developers.cloudflare.com/d1/get-started/
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword

## Verifikation dieses Pakets

TypeScript- und Build-Prüfungen, Migrationen und Datenimport wurden lokal geprüft. Ein isolierter Worker-Test mit simulierten Supabase-Antworten bestätigt: anonymer Zugriff abgewiesen, beide Konten getrennt, fremde Sammlungen abgewiesen und fremde Origin bei der Anmeldung abgewiesen. Dieser Test ersetzt keinen echten Supabase-Login. Die tatsächlichen beiden Supabase-Anmeldungen, Cloudflare-CPU-Nutzung, öffentliche Veröffentlichung benötigen die noch fehlende Cloudflare-Verbindung und Laufzeitkonfiguration. Der GitHub-Upload wurde geprüft.
