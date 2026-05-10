# Tennisplatz-Finder Stuttgart

Ziel: Eine Web-App, die freie Tennisplaetze in und um Stuttgart fuer Nicht-Mitglieder gebuendelt anzeigt.

## Was die App spaeter koennen soll

- Freie Plaetze nach Uhrzeit sehen
- Anlage, Stadtteil und Adresse sehen
- Innen/Aussen und idealerweise Belag sehen
- Nur Plaetze zeigen, die Gaeste wirklich online buchen koennen
- Optional direkt zur Buchung springen oder Buchung ausloesen

## Aktueller Stand

Die erste Recherche ist in [research/venues.md](./research/venues.md) dokumentiert.
Ein klickbares Frontend-MVP liegt in `index.html`, `styles.css`, `app.js` und `local-server.js`.

Wichtigstes Zwischenfazit:

- Es gibt nicht nur ein einziges Buchungssystem.
- In Stuttgart tauchen aktuell mindestens `eBuSy`, `Eversports` und `GotCourts` auf.
- Fuer das eigentliche Produkt sind `eBuSy` und `Eversports` aktuell die heissesten Kandidaten.
- `GotCourts` wird haeufig fuer Vereine genutzt, scheint aber oft mit Mitgliedslogik oder Gast-nur-mit-Mitglied verknuepft zu sein.

## Realistischer MVP

1. Nur Anlagen erfassen, die fuer Gaeste online buchbar sind.
2. Verfuegbarkeiten systemweise abrufen.
3. Ein gemeinsames Raster anzeigen:
   - Datum
   - Startzeit
   - Endzeit
   - Anlage
   - Innen/Aussen
   - Belag
   - Preis
   - Buchungslink
4. Zunaechst per Weiterleitung ins Originalsystem buchen.

## Warum nicht sofort Direktbuchung?

Direktbuchung ist moeglich, aber risikoreicher:

- Login- und Session-Handhabung je nach Anbieter unterschiedlich
- Eventuell CSRF/Token/Checkout-Floesse
- AGB und technische Grenzen der Systeme
- Hoeherer Wartungsaufwand

Darum ist die beste Reihenfolge:

1. Anzeige der freien Plaetze
2. Deep-Link zur Buchung
3. Erst danach pruefen, ob echte In-App-Buchung stabil machbar ist

## Naechster sinnvoller Schritt

Der naechste technische Durchbruch ist ein Test mit deinem echten Login fuer das gemeinsame System, sehr wahrscheinlich `eBuSy`.

Damit koennen wir pruefen:

- ob freie Slots maschinenlesbar abrufbar sind
- ob Innen/Aussen und Platzdaten strukturiert vorliegen
- ob ein gemeinsamer Account mehrere Anlagen abdecken kann
- ob eine Buchungsweiterleitung oder sogar Buchung technisch moeglich ist

## MVP lokal starten

Im Projektordner:

```bash
npm run dev
```

Dann im Browser:

```text
http://localhost:4173
```

## Was das MVP schon zeigt

- kuratierte Anlagenliste
- Filter nach Gaststatus, System und Platztyp
- Suchfeld fuer Stadtteil, System oder Anlagennamen
- direkte Links in die Original-Buchungssysteme
- ersten Live-Connector fuer `Tennispark Stuttgart Outdoor` ueber `eBuSy`
- ersten alternativen Live-Connector fuer `TC Weissenhof Botnang` ueber das oeffentliche `tennis-club.net`-System
- mehrere konfigurierbare Live-Quellen ueber `data/live-sources.json`
- angebundene eBuSy-Quellen koennen jetzt gemischt `indoor`, `outdoor` oder beides enthalten
- einzelne Kandidaten koennen trotz passender Struktur lokal noch an DNS-/Netzauflosung scheitern und werden dann erst nach erfolgreichem Lauf in die Live-Liste aufgenommen

## Was noch fehlt

- echte freie Uhrzeiten pro Tag
- Preis- und Slot-Normalisierung
- Login-gestuetzte Connectoren fuer die Buchungssysteme

## Live-Endpoints

Beim laufenden lokalen Server:

```text
/api/live-sources
/api/availability?source=tennispark-stuttgart-outdoor&date=2026-04-26
```

Der Availability-Endpoint liest serverseitig:

- die oeffentliche `eBuSy`-HTML-Tabelle
- die dazugehoerige JSON-Reservierungsliste

und berechnet daraus freie Slots fuer die Outdoor-Plaetze.

## Deployment mit GitHub und Vercel

Das Projekt ist fuer Vercel vorbereitet:

- statische App-Dateien liegen im Projektroot
- API-Funktionen liegen unter `api/`
- `vercel.json` setzt die Function-Laufzeitdauer
- `package.json` enthaelt lokale Scripts
- `local-server.js` ist nur fuer lokale Entwicklung und wird nicht auf Vercel deployed

### GitHub

```bash
git init
git add .
git commit -m "Initial tennisplatz finder app"
git branch -M main
git remote add origin <DEIN_GITHUB_REPO_URL>
git push -u origin main
```

### Vercel

1. In Vercel `Add New Project` waehlen.
2. Das GitHub-Repository importieren.
3. Framework Preset: `Other`.
4. Build Command leer lassen.
5. Output Directory leer lassen.
6. Deploy starten.

Nach dem Deploy pruefen:

- Startseite laedt
- `/api/live-sources` liefert JSON
- Suche zeigt Live-Slots
- `Buchen`-Links fuehren zu den eBuSy-Seiten
