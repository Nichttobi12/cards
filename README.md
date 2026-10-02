# PokéVault – Vercel + Supabase

Pokémon-Sammlungsportal für zwei getrennte Konten mit Bildern, Kartennummer-Suche, mehreren Sammlungen, Cardmarket-Richtpreisen über TCGdex und Portfolio-Verlauf.

## Aktueller Stand

- Supabase-Projekt `pokevault` in Frankfurt aktiv, Free-Tarif.
- Zwei bestätigte Auth-Konten sind mit den Benutzernamen `nichtfabi` und `nichttobi` verknüpft.
- Datenbank und Edge Function `pokevault` veröffentlicht.
- Täglicher Preisauftrag aktiv: ab 08:00 deutscher Ortszeit, schrittweise bis zehn unterschiedliche Karten pro Minute.
- Frontend für Vercel vorbereitet, noch nicht dort veröffentlicht. Echte Anmeldung im fertigen Portal und Preisabrufe mit einer realen Sammlung müssen nach der Veröffentlichung geprüft werden.

## Vercel veröffentlichen

1. Mit deinem GitHub-Konto bei Vercel anmelden, Hobby-Tarif für dieses private Hobbyprojekt wählen.
2. Add New → Project → Repository `Nichttobi12/cards` importieren.
3. Produktionsbranch `main`, Root Directory leer, Framework Preset `Other`.
4. Build Command `npm run build`, Output Directory `dist/client`. `vercel.json` enthält diese Einstellungen.
5. Deploy wählen. Keine API-Schlüssel, Passwörter oder eigene Domain erforderlich. Die kostenlose vercel.app-Adresse verwenden.
6. Die bereitgestellte URL öffnen und beide Konten prüfen. Danach eine Karte hinzufügen und manuelle Aktualisierung testen.

Änderungen im verbundenen GitHub-Produktionsbranch veröffentlichen die Oberfläche automatisch. Änderungen an `supabase/functions/pokevault` müssen zusätzlich über Supabase deployt werden; der GitHub-Push allein veröffentlicht keine Edge Functions.

## Aufbau und Datenschutz

`src/` enthält die Oberfläche. `api/proxy.ts` leitet nur die vier Portal-Routen an Supabase weiter und prüft den Origin bei schreibenden Browseranfragen. Zugangstokens bleiben in HttpOnly-/Secure-/SameSite-Cookies. Backend: `supabase/functions/pokevault/`.

E-Mail-Zuordnungen liegen ausschließlich in `portal_accounts` in der Datenbank. Das Konto darf nur seinen eigenen Datensatz lesen. Benutzer können die Zuordnung nicht ändern. Kartentabellen verwenden Row Level Security und eine zusammengesetzte Fremdschlüsselprüfung, damit Karten nicht in fremde Sammlungen verschoben werden können. Der Server prüft die Supabase-Identität und Kontozuordnung vor jedem Kartenzugriff.

Privilegierte Supabase-Schlüssel bleiben ausschließlich in der Edge-Runtime. Das Backend bevorzugt die modernen `SUPABASE_SECRET_KEYS` und `SUPABASE_PUBLISHABLE_KEYS`; ältere Runtime-Schlüssel werden nur als Kompatibilitätsfallback verwendet. Die Funktion hat eine eigene Authentifizierung: Login öffentlich, Kartenzugriff nur mit bestätigtem Konto, Preis-Cron nur mit internem Schlüssel. Deshalb ist die vorgeschaltete JWT-Prüfung ausgeschaltet. Keine privilegierten Schlüssel im Vercel-Projekt oder Browser erforderlich.

`portal_scheduler_secret`, `login_attempts` und `refresh_jobs` sind ausschließlich für den Server zugänglich. RLS ohne öffentliche Policies ist dort beabsichtigt. Die Datenbankprüfung meldet außerdem die deaktivierte Prüfung auf geleakte Passwörter als allgemeinen Auth-Hinweis; diese zusätzliche Anbieterfunktion wurde nicht als kostenpflichtige Option aktiviert.

Der Cron-Schlüssel wurde innerhalb der Datenbank erzeugt und erscheint weder im Repository noch in dieser Dokumentation. Das Schema in `supabase/schema.sql` ist eine Referenz, keine automatisch ausgeführte Migration. Die reale Migration wird durch Supabase verwaltet. Kontozuordnungen und Scheduler werden bei einer Neuinstallation separat eingerichtet.

## Preise und Verlauf

Cardmarket-Richtpreise über TCGdex sind Schätzwerte; Varianten ohne passenden Preis und gegradete Karten ohne manuelle Bewertung bleiben unbewertet. Fehlgeschlagene Aktualisierungen behalten den letzten Preis. Der Tagesstand wird nach dem kompletten Durchlauf gespeichert. Bestehende Karten sind noch nicht aus dem früheren Portal übertragen.

Supabase Free kann bei längerer Inaktivität pausieren. Das alte Portal bleibt bis zur erfolgreich geprüften Umstellung aktiv.

## Prüfungen

```sh
npm ci
npm run build
node scripts/check-supabase.mjs
```

Der Prüflauf simuliert Auth-Antworten und prüft Kontotrennung, anonyme Zugriffssperre, fremde Sammlungen, Origin-Prüfung und Cron-Schutz. Die tatsächliche Datenbank wurde zusätzlich mit beiden Konto-Identitäten auf Isolation und auf verweigerte fremde Kartenreferenzen geprüft. Der veröffentlichte Server antwortet anonym mit 401; der interne Preisauftrag antwortet erfolgreich mit 200 bei noch leerer Sammlung. Dies ersetzt keinen echten Passwort-Login.

Cloudflare-Dateien in `worker/`, `migrations/` und `wrangler.jsonc` bleiben vorerst als Referenz erhalten. Für Vercel werden sie nicht verwendet.
