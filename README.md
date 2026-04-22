# EML Reader

A vibe coded zero-dependency single page app that parses `.eml` email files and presents them in a human-readable form.
Does not use any external dependencies and does not phone home.
Runs entirely inside your browser.
Requires no elevated permissions.
No server needed.

## Usage

Open `index.html` directly in your browser (double-click, or `file://` protocol).

1. Click **Upload .eml file** and select an email file.
2. The app displays:
   - **Envelope** — From, To, Cc, Bcc, Subject, Date
   - **Body** — Plain text (`<pre>`) or HTML (sandboxed `<iframe>`)
   - **Attachments** — Downloadable links for each attachment
   - **Raw headers** — Collapsible full header section

## Tests (Bun)

```bash
bun test
```

Runs 121 tests across all 100 `.eml` fixtures from the `mikel/mail` repository, including:
- Smoke tests (every fixture parses without error)
- Structure tests (headers, subject, from, to)
- MIME multipart tests
- Attachment detection tests
- Encoding tests

## File structure

| File | Purpose |
|------|---------|
| `index.html` | Main page shell |
| `style.css` | Styles |
| `parser.js` | RFC 5322 / MIME parser (vanilla JS, works in browser and Bun) |
| `ui.js` | DOM rendering logic |
| `fixtures.js` | All 100 test fixtures from `mikel/mail` (base64-encoded) |
| `parser.test.js` | `bun:test` test file |

## Compatibility

- Works when opened via `file://` (no CORS issues — uses classic `<script>` tags, no modules, no `fetch`)
- Modern browsers with `TextDecoder` support (IE not supported)
- `bun` for CLI testing
