# Grading-Preise aktivieren

Die Auswahl und Preisanbindung sind implementiert. Ohne Anbieter-Schlüssel zeigt das Portal ausdrücklich „Marktpreis noch nicht verfügbar“.

1. Auf https://rapidapi.com/tcggopro/api/cardmarket-api-tcg/pricing den **Basic-Tarif** prüfen und im eigenen RapidAPI-Konto aktivieren. Am 02.10.2026: 0 USD/Monat, 100 Abfragen/Tag, Graded Prices und eBay Sold Graded Prices inklusive. Zusätzliche Abfragen können kostenpflichtig sein. Keine kostenpflichtige Tarifoption wählen.
2. Den RapidAPI-Schlüssel direkt in **Supabase → Edge Functions → Secrets** speichern. Name: `GRADING_RAPIDAPI_KEY`. Wert: der eigene Schlüssel. Den Schlüssel weder in GitHub noch im Chat oder im Frontend hinterlegen.
3. Eine seltene Karte öffnen und PSA 10 auswählen. Den Live-Abruf mit einer bekannten Karte gegen die Quelle prüfen. Anschließend speichern oder bestehende Sammlungspreise aktualisieren.

Das Portal reserviert vor jeder Anbieter-Anfrage atomar einen Zählerplatz in der privaten bestehenden `login_attempts`-Tabelle, mit eigenem Namensraum `grading-provider:YYYY-MM-DD`. Bei 95 Abfragen pro UTC-Tag wird geschlossen gestoppt, auch über mehrere Edge-Instanzen hinweg. Der API-Schlüssel sollte ausschließlich für dieses Portal genutzt werden; andere Anwendungen teilen die RapidAPI-Kontingente. Erfolgreiche Ergebnisse werden 24 Stunden im Edge-Prozess zwischengespeichert. Der Live-Abruf konnte ohne Benutzer-Schlüssel noch nicht getestet werden.

Karten werden nur bei eindeutig gleicher Nummer, englischem Namen und Set zugeordnet. Unklare Druckversionen werden abgewiesen. Es werden eBay-Verkaufsmediane mit positiver Verkaufsanzahl verwendet, keine Angebots- oder Rohkartenpreise. Die Quelle trennt Grading-Verkäufe nicht nach Sprache; deshalb wird der Preis als internationaler Vergleichswert bezeichnet. USD werden mit einer frischen EZB-Referenz in EUR umgerechnet; ohne verfügbare Umrechnung wird kein Eurobetrag im Portfolio verwendet. Quellenstand und Abrufdatum sind getrennt.

**AOG 9,5 und AOG 10 verwenden auf ausdrücklichen Benutzerwunsch den PSA-10-Vergleichswert.** Diese Werte werden als AOG-Schätzung markiert. AOG 9 erhält keinen PSA-10-Ersatz. Ein eigener Wert hat Vorrang. Nicht verfügbare Werte bleiben offen und werden nicht in die Gesamtsumme eingerechnet.

Quelle: https://www.cardmarket-api.com/ – unabhängiger Drittanbieter, keine offizielle Cardmarket-API.
