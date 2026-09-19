# Reading Room

A private library browser and OPDS 1.2 acquisition catalog. Eight clearly labeled, original sample publications, with real EPUB 3 files. No third-party scripts, fonts, trackers, or remote book downloads.

## Features

- Responsive shelves, title/author/summary search, category and language filters, sorting, book details, in-browser sample reading, EPUB downloads.
- `/opds`: Atom acquisition feed, six entries per page, stable entry IDs, self/start/next/previous links, language facets, Dublin Core metadata, sample labels and acquisition links.
- `/opds/search.xml`: OpenSearch discovery; `/opds?q=...` searches the catalog.
- `/opds/books/:id`: standalone entry. `/books/:id.epub`: EPUB. `/covers/:id.svg`: cover.
- Feed & validation view fetches real responses and checks XML, metadata, pagination, uniqueness, search, all EPUB bytes/sizes, and cover responses. It is a core validator, not full OPDS certification.

## Privacy and reader compatibility

The deployed Sites copy uses owner-only ChatGPT authentication at the hosting gate. Common reading apps cannot complete this sign-in, so this private deployment is **not directly connectable from those readers**. Its feed can be inspected and downloaded from an authenticated browser. Do not change the Site audience to public merely to work around reader authentication.

The same server supports HTTP Basic authentication for a separately hosted private deployment that OPDS readers can use. All application, API, book, cover and feed routes are protected. Missing credentials fail closed. Do not expose platform mode on an unprotected origin.

## Run a private OPDS server

Requires Node 22+ and Python 3; there are no application dependencies.

```sh
npm run build
OPDS_USERNAME=reader OPDS_PASSWORD='replace-with-a-long-random-password' PORT=4173 npm start
```

Place this behind HTTPS before remote access. Use `https://your-private-host/opds` with the configured credentials in a reader supporting OPDS 1.2 and HTTP Basic authentication. Credentials are never placed in feed URLs. Authentication is server-side and returns a standard `401` challenge.

For isolated loopback preview only: `AUTH_MODE=platform LOCAL_PREVIEW=1 npm start`. Sites production receives `AUTH_MODE=platform` as a runtime environment variable and relies on its external owner-only gate.

## Edit the catalog

The initial catalog is intentionally read-only, with no upload/admin interface. Edit `src/books.json` and rebuild to change the original sample stories. The build script creates deterministic EPUBs from each sample's title, language and paragraphs. For real EPUB imports, extend the build to read real files and their metadata; do not label generated samples as full books. Source fields include id, title, author, language, category, summary, subtitle, paragraphs, cover color/accent/pattern.

`npm test` checks authentication denial and valid credentials, browse/search/filter/pagination, acquisition and cover routes, method handling, and private caching. `node test/browser.cjs` uses Playwright when available for desktop/mobile flows. `test/validate.py` validates emitted XML and EPUB structure against independent parsers.

## Deployment

`dist/index.js` is a self-contained Cloudflare-compatible module Worker. `.openai/hosting.json` stores the private Sites project identity. Build with `npm run build`, push the exact source state, save the built artifact as a Site version, and use private deployment. Never commit credentials. The build output embeds all small sample EPUBs; large real libraries should use authenticated object storage rather than embedding every file.

Specification: https://specs.opds.io/opds-1.2.html
