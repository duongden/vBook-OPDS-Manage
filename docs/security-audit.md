# Security review — 2026-09-19

Scope: all application source under `src/`, D1 migrations, client rendering, legacy routes, the `reading-room/` reference application, dependency lockfile, configuration, release files and Git secret exclusion. This is a source review with regression and local runtime tests, not an independent penetration-test certification.

## Findings and changes

| Severity | Finding | Resolution |
|---|---|---|
| High | Legacy authentication accepted a caller-selected `?auth=` value ahead of the server credential. Removing query authentication also made query-only links public. | Legacy routes now default to disabled. Query authentication returns 410; optional server credentials are enforced before all legacy routes, including OpenSearch and masking. Partial server credentials fail closed. |
| High | Password/recovery changes and concurrent password verification could race session creation; a verified old password could mint a new session after revocation. | Migration 0002 adds credential versions. Session insertion checks the verified version atomically; every session lookup joins the current version. Password/recovery updates use compare-and-swap. |
| Medium | A D1-only leak exposed unpeppered password hashes with a relatively low PBKDF2 work factor. | New hashes include an HMAC pepper derived from the server secret. Existing hashes upgrade on successful login. The PBKDF2 work factor remains 100,000 for workerd compatibility; this is a partial mitigation, not a claim of meeting OWASP's higher work-factor guidance. |
| Medium | Development dependencies had known advisories. Initial audit reported 17: 6 high, 9 moderate, 2 low. | Updated Wrangler to 4.135.0, matching Worker types and transitive `ws`. Post-update audit reports zero advisories for the installed lockfile. This result is time-dependent. |
| Low | Session cookie could share a name with cookies set by sibling subdomains. | Switched to `__Host-vbook_session`, with Secure, HttpOnly, SameSite=Strict and Path=/. Existing browser sessions must sign in again. |
| Low | Recursive Drive cache was unbounded and keyed only by the root folder. | Cache now includes a digest of the API key and traversal parameters, removes expired entries and caps memory entries at 256. Recursive requests have a timeout. |
| Low | Legacy Drive parsing accepted folder-shaped input from unrelated hosts; provider exceptions could reach logs. | Require HTTPS `drive.google.com` or a bounded raw ID; reject embedded credentials. Legacy provider errors are logged without raw exception details. |
| Low | Loopback Reading Room preview trusted arbitrary Host headers while bypassing login. | Preview accepts only loopback hostnames and rejects foreign Host values; production Basic mode remains separate. |

Also changed rate-limit identifiers to keyed HMACs instead of unkeyed IP hashes. Git exclusions cover local secrets, production infrastructure identifiers, databases and generated builds. CI actions are pinned to commit hashes and receive read-only repository permissions.

## Checks

- TypeScript compile check and Wrangler deployment dry-run.
- 12 existing Gateway suites, including updated legacy authentication expectations.
- 14 managed tests: SQL migrations against SQLite, tenant isolation, CSRF/Origin, malicious metadata/cover schemes, expired/tampered capabilities, body limits, auth rate limits, password/recovery/session invalidation, OPDS credential rotation, UI interactions and Drive error handling.
- Regression tests explicitly reproduce caller-selected auth rejection, partial server configuration, stale retained sessions, password verification racing revocation, pepper validation and legacy hash upgrade.
- Bundled Worker on local Miniflare/D1: migrations, Web Crypto, cookies, metadata update and authenticated OPDS. The test uses the new Miniflare compatibility adapter and blocks real upstream requests through a controlled outbound handler.
- Reading Room reference tests, including loopback Host protection.
- Full dependency audit; staged-file scan for credential patterns and accidental inclusion of values from local `.dev.vars`/`.env`, without printing those values.

## Remaining limits

- No live Cloudflare account/WAF configuration review, external penetration test, load test, real Drive/vBook end-to-end verification, or visual browser assessment was performed by this review.
- Public Drive sharing is required. Google download redirects expose the original file ID to the authorized recipient. Resource tokens are scoped to a library; book/folder tokens do not currently expire or re-check root ancestry after a Drive move. Page cursors expire after one day.
- Public registration can consume D1 and Drive quota. Per-IP limits help but do not prevent distributed abuse. Authenticated large scans consume provider quota and client memory.
- `MASK_SECRET` protects source tokens, metadata keys and password peppers. Losing/rotating it currently requires a planned data migration; there is no automated key rotation. A compromise of both D1 and this secret defeats the pepper's additional protection.
- PBKDF2-SHA256 remains below the [OWASP 600,000-iteration recommendation](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), because of the [workerd iteration cap](https://github.com/cloudflare/workerd/issues/1346). Benchmark CPU on the actual plan; evaluate a supported stronger KDF or identity provider before a larger public rollout.
- External cover URLs are fetched by the user's browser/reader; the image host sees the user's connection. Backend code does not fetch arbitrary cover URLs.
- Dependency auditing and pattern-based secret scanning cannot establish the absence of all vulnerabilities or secrets.

## Upgrade

Run `pnpm install --frozen-lockfile` and apply migrations (local: `pnpm run db:migrate:local`; production: `pnpm exec wrangler d1 migrations apply DB --remote`) before releasing this code. Migration 0002 adds columns and preserves library data. Do not roll back to the old vulnerable authentication implementation. Re-login after the cookie-name change, and replace any legacy `?auth=` links with managed-library OPDS credentials.
