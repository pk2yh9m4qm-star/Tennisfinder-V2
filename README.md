# Tennis Finder Stuttgart

Mobile-first Web-App zum Finden freier Tennisplaetze in und um Stuttgart.

## Struktur

- `index.html`, `styles.css`, `client.js`: Frontend
- `assets/`: Icons fuer Indoor/Outdoor
- `data/`: Quellen und Venue-Metadaten
- `api/`: Vercel Serverless Functions
- `lib/`: eBuSy Parser fuer Live-Daten

## Deployment auf Vercel

Dieses Paket ist bewusst minimal gehalten:

- kein `server.js`
- kein `local-server.js`
- keine Root-Datei `app.js`
- kein Build-Step

In Vercel:

- Framework Preset: `Other`
- Build Command: leer lassen
- Output Directory: leer lassen

