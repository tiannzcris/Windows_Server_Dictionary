# WS Terms

An offline-first Windows Server terminology dictionary containing exactly 100 fixed official terms plus visitor-created notes.

## Stack and setup

It is plain HTML, CSS, and ES modules: no framework, build step, or runtime dependency is needed. This keeps the application small and makes its offline behavior predictable. Service workers require a secure context, so serve the folder rather than opening `index.html` directly:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`. The manifest enables installation as a PWA from a supporting browser.

## Offline architecture

On first visit, `service-worker.js` precaches the app shell, self-hosted fonts, icons, and `data/terms.json` in a versioned Cache API cache. Activation deletes older cache versions. Fetches are cache-first, so a hard reload remains functional with networking disabled. `db.js` seeds IndexedDB from the JSON only when the terms store is empty; subsequent runs load all official and custom records from IndexedDB. Visitor terms and favorites persist only in that browser.

## Using it

Search is instant and typo tolerant; use category filters, Favorites, or A–Z mode to browse. Every official term shows an included offline blueprint sample visual by category. Select a card for details and related-term links. **Add Term** creates a device-local custom entry and can include an image up to 2 MB; that image is saved in IndexedDB only in the current browser. Only custom entries can be edited or deleted. Backup & Restore exports or imports those custom entries as JSON. The status strip reports connection state, the fixed `100/100` official cache count, custom count, and category. Custom data is not synced or remotely backed up unless you export it.

## Structure and limits

`data/terms.json` holds the official dataset; `js/db.js`, `search.js`, `ui.js`, and `terms-editor.js` isolate persistence, search, rendering, and custom-term actions. `service-worker.js` and `manifest.json` provide PWA support. There is intentionally no account, backend, sync, or collaboration layer. Future work could add a user-approved cloud backup without changing the official dataset.
