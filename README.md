# PokéVault – Vercel + Supabase

Pokémon-Sammlungsportal für zwei Benutzerkonten: eigenes Portfolio, gemeinsames Dashboard, fehlertolerante Suche, Sets und Promo-Ordner, Cardmarket-Richtpreise und Tagesverlauf. Heller und dunkler Modus, mobile Navigation und Kartenfotos.

## Aktueller Stand

- Supabase-Projekt `pokevault` in Frankfurt aktiv, Free-Tarif.
- Zwei bestätigte Auth-Konten sind mit den Benutzernamen `nichtfabi` und `nichttobi` verknüpft.
- Datenbank und Edge Function `pokevault` veröffentlicht.
- Täglicher Preisauftrag aktiv: ab 08:00 deutscher Ortszeit, schrittweise bis zehn unterschiedliche Karten pro Minute.
- Live auf Vercel Hobby: https://cards-chi-dusky.vercel.app/
- Vercel-API und Supabase-Datenbank in Frankfurt; automatische Veröffentlichung aus GitHub `main` geprüft.
- Login und Kartensuche wurden bei der Einrichtung geprüft. Bestehende Sammlungen bleiben bei Portal-Updates erhalten.
- Suche normalisiert Bindestriche, Akzente, Großschreibung und die Abkürzung M für Mega; kleinere Tippfehler und Buchstabendreher werden gewichtet. Nummern bleiben exakt. Fokus: Deutsch und Englisch.
- Das gemeinsame Dashboard zeigt die Karten und Werte beider konfigurierten Konten, ohne Einkaufskosten oder Notizen.
- Eigene Kartenfotos liegen im privaten Storage-Bucket `card-photos`; Vorschauen verwenden zeitlich begrenzte URLs.

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

E-Mail-Zuordnungen liegen ausschließlich in `portal_accounts` in der Datenbank. Der eigene Portfolio-Endpunkt und alle Änderungen sind auf den Besitzer beschränkt. Der ausdrücklich gemeinsame Dashboard-Endpunkt liefert beiden erlaubten Konten Karten, Sammlungsnamen und Werte des anderen als Leseansicht; er entfernt E-Mails, Einkaufspreise und Notizen. Es gibt keine öffentliche Sammlung und keine neuen RLS-Freigaben. Benutzer können die Zuordnung nicht ändern. Kartentabellen verwenden Row Level Security und eine zusammengesetzte Fremdschlüsselprüfung, damit Karten nicht in fremde Sammlungen verschoben werden können. Der Server prüft die Supabase-Identität und Kontozuordnung vor jedem Kartenzugriff.

Privilegierte Supabase-Schlüssel bleiben ausschließlich in der Edge-Runtime. Das Backend bevorzugt die modernen `SUPABASE_SECRET_KEYS` und `SUPABASE_PUBLISHABLE_KEYS`; ältere Runtime-Schlüssel werden nur als Kompatibilitätsfallback verwendet. Die Funktion hat eine eigene Authentifizierung: Login öffentlich, Kartenzugriff nur mit bestätigtem Konto, Preis-Cron nur mit internem Schlüssel. Deshalb ist die vorgeschaltete JWT-Prüfung ausgeschaltet. Keine privilegierten Schlüssel im Vercel-Projekt oder Browser erforderlich.

`portal_scheduler_secret`, `login_attempts` und `refresh_jobs` sind ausschließlich für den Server zugänglich. RLS ohne öffentliche Policies ist dort beabsichtigt. Die Datenbankprüfung meldet außerdem die deaktivierte Prüfung auf geleakte Passwörter als allgemeinen Auth-Hinweis; diese zusätzliche Anbieterfunktion wurde nicht als kostenpflichtige Option aktiviert.

Der Cron-Schlüssel wurde innerhalb der Datenbank erzeugt und erscheint weder im Repository noch in dieser Dokumentation. Das Schema in `supabase/schema.sql` ist eine Referenz, keine automatisch ausgeführte Migration. Die reale Migration wird durch Supabase verwaltet. Kontozuordnungen und Scheduler werden bei einer Neuinstallation separat eingerichtet.

## Preise und Verlauf

Cardmarket-Richtpreise über TCGdex sind Schätzwerte; Varianten ohne passenden Preis und gegradete Karten ohne manuelle Bewertung bleiben unbewertet. Fehlgeschlagene Aktualisierungen behalten den letzten Preis. Der Tagesstand wird nach dem kompletten Durchlauf gespeichert. Gegradete Karten können über eine eBay-Suche nach verkauften Angeboten verglichen werden. Aus mindestens drei selbst erfassten Vergleichsverkäufen berechnet die Oberfläche einen Median, der als eigener Wert übernommen werden kann. Es gibt keinen automatischen Abruf abgeschlossener eBay-Verkäufe und keine erfundenen Grading-Multiplikatoren.

Supabase Free kann bei längerer Inaktivität pausieren. Das alte Portal bleibt bis zur erfolgreich geprüften Umstellung aktiv.

## Prüfungen

```sh
npm ci
npm run build
node scripts/check-supabase.mjs
node scripts/check-catalog-fixtures.mjs
# Optional: Live-Abfragen beim Anbieter
node scripts/check-catalog.mjs
```

Der Prüflauf simuliert Auth-Antworten und prüft Kontotrennung, anonyme Zugriffssperre, fremde Sammlungen, Origin-Prüfung und Cron-Schutz. Die tatsächliche Datenbank wurde zusätzlich mit beiden Konto-Identitäten auf Isolation und auf verweigerte fremde Kartenreferenzen geprüft. Zusätzliche Fixtures prüfen den gemeinsamen Zugriff beider Konten, ausgeblendete Privatfelder, Foto-Eigentum, ungültige Uploads und private Bildvorschauen. Die Suche wird mit Mega Gengar ohne Bindestrich, Tippfehlern, Buchstabendrehern, Promo-Nummern und Pocket-Ausschluss geprüft. Der veröffentlichte Server verweigert anonyme Zugriffe mit 401. Zusätzlich wurde der echte Passwort-Login als `nichttobi` im veröffentlichten Portal geprüft. Die Kartensuche zeigte Altaria-ex mit Bild und Richtpreis; keine Testkarte wurde gespeichert.

Cloudflare-Dateien in `worker/`, `migrations/` und `wrangler.jsonc` bleiben vorerst als Referenz erhalten. Für Vercel werden sie nicht verwendet.

## Eigene Kartenbilder

Bei verfügbaren Anbieterbildern werden WebP, PNG und JPEG versucht, danach die andere Sprache derselben Karten-ID. Die Ersatzsprache ist gekennzeichnet; Sprache und Preise bleiben unverändert. Fehlende Bilder werden nicht durch Bilder anderer Karten ersetzt. Eine gespeicherte Karte kann beim Bearbeiten ein eigenes Foto erhalten. Der Browser skaliert es auf maximal 1200 Pixel und erzeugt JPEG ohne Original-Metadaten, der Server begrenzt Uploads auf 1 MB und prüft den Eigentümer. Neue Uploads ersetzen das vorherige Foto. Ohne eigenes Foto bleiben tatsächliche Lücken des Kartenanbieters sichtbar.

Migration: `supabase/migrations/202610022015_private_card_photos.sql`. Vor dem Edge-Deploy anwenden. Der Bucket bleibt privat und hat keine öffentlichen oder allgemeinen Auth-Policies; Zugriff erfolgt ausschließlich über die verifizierte Portal-API.

## Sets, Bilder und Filter

Der Kartenkatalog lädt im Hintergrund die Metadaten des gesamten geöffneten Sets in begrenzten Sechser-Batches. Preis, Nummer, Name und Kartentyp lassen sich auf- und absteigend sortieren; Typ und Seltenheit sind filterbar. SAR/SIR, Hyper Rare und Secret Rare werden in einem gemeinsamen Filter hervorgehoben. Bis alle Preise geladen sind, zeigt die Oberfläche den Fortschritt und kennzeichnet die noch vorläufige Preisreihenfolge. Preise gelten pro Karte; fehlende Werte bleiben in beiden Richtungen am Ende.

`Sammlungen & Freunde` öffnet zunächst das andere Konto und bietet eine ausdrückliche Kontoauswahl. Beide Sammlungsansichten unterstützen dieselben Filter und Sortierungen.

`verified-images.ts` enthält ausschließlich Bildadressen mit bestätigter Bildantwort für die genaue Karten-ID. Ersatzbilder in der anderen Sprache sind gekennzeichnet. Set-Ordner zeigen eine echte Karte aus dem Set. Weitere Metadaten bleiben beim Anbieter abrufbar; für vollständige Bildlücken bleibt das eigene Kartenfoto möglich.

Image verification snapshot: 400 DE/EN rarity records processed on 2026-10-02; verified images are assigned to 248 distinct printed card IDs (496 language records including labeled alternate-language previews). This is a partial audit, not a guarantee of complete catalog image coverage. Remaining cards retain provider URLs and exact-ID alternate-language fallback. `scripts/image-audit.json` records the scope and unresolved source checks. Mega Zeraora ex, Pitch Black #114, uses the image explicitly linked by its Serebii card page.

## Persistent images and camera search

`supabase/persistent-card-images.sql` creates the private `card_images` table and copies existing image references without removing collection entries or storage objects. Photos are keyed by account, printed card ID and language, independent of collection rows. The catalog, search, metadata and saved-card views all resolve the same reference. Removing a collection row never deletes its catalog image. Shared views retain access only while the owning account has that card in its collection. Image uploads can be made from the card detail before adding a collection entry.

The detail dialog uses one bounded, touch-scrollable body with dynamic viewport sizing. Image upload and camera capture are placed beside the preview.

Camera search uses pinned Tesseract.js 6.0.1 loaded on demand from jsDelivr. OCR runs locally on the device; the image is not sent to an OCR service or automatically saved. Users can correct the recognized name/number, search matching catalog entries, then confirm the print and collection before saving. An internet connection is needed for the initial OCR engine/language downloads and catalog lookup. A browser camera file picker (`capture=environment`) supports iPhone capture and desktop photo selection. Optical recognition depends on lighting, reflections and sharpness; manual input remains available on download or recognition errors.

Checks: `node scripts/check-supabase.mjs` covers persistence across delete/re-add, pre-add uploads, account/language isolation and shared image authorization. `node scripts/check-scanner.mjs` covers OCR text parsing; build checks TypeScript and JSX. Actual iPhone capture/recognition remains to be verified on a device.

## Region scanner and repeated additions

OCR now reads only the name band at the top and four overlapping footer crops (whole lower edge, left, middle, right). Footer fractions/promos take priority over uncertain standalone digits; names never come from attack/rule text in the card body. Optional pointer/touch cropping removes sleeves/backgrounds. Images are processed locally at region-specific resolution with contrast enhancement. Printed denominators are included in the search and used to distinguish matching sets when official card counts are available. Recognition still needs user confirmation, especially for tilted or reflective photos.

The catalog remains mounted while card details are shown. After adding, the dialog returns to the same browsing context and scroll position; page, query, sorting, filters, language and selected set are retained. The last chosen collection stays selected for the next card. Editing an existing entry continues to close after save.

Photos are shared as an exact-card, same-language fallback between the two allowed accounts. Each account's own upload has priority and cannot be overwritten by the other account. Only signed private previews are exposed. Friends views poll every 15 seconds while visible and refresh on focus. This supersedes the earlier per-account-only fallback/collection-presence restriction.

## Combined queries and OCR agreement

The shared query parser supports names plus numbers (`Pikachu 181`, `Pikachu 181/132`, `181/132 Pikachu`), bare fractions, promo prefixes and exact card IDs. Name and number predicates are combined rather than searched independently. Printed denominators are checked against official set card counts before the result limit is applied. Results include set names and complete printed numbers; the current global query automatically reruns after edits once a search has been performed. The same parser is used in set/portfolio/friends filtering.

Camera OCR now uses three top-of-card crops with single-line and sparse-text modes, original/contrast variants, narrow and broad footer crops plus a binary pass. Number candidates are grouped by agreement rather than choosing the single highest OCR confidence. Numeric-region ambiguities (I/l/O/B/S) are corrected only within printed number slots and flagged when unsupported by another pass. OCR names are offered as options and compared with exact-number catalog candidates; an unambiguous printed-number catalog result can supply the canonical name. Alternative readings remain selectable. Actual photo quality still requires testing on representative user photos.
