# Security

This repository contains the VBook Library Cloudflare Worker and its supporting tests and documentation.

Report vulnerabilities privately to the repository owner. Do not include real credentials, Drive IDs, database exports or acquisition URLs in public issues.

## Deployment requirements

- Use HTTPS and Cloudflare D1. Apply every migration before deploying the matching code.
- Store `GOOGLE_API_KEY` and a randomly generated `MASK_SECRET` of at least 32 characters in Worker secrets, outside Git. Keep an encrypted backup of the secret and D1.
- Restrict the Google API key to Drive API. Never enter it into an OPDS URL for the managed application.
- Keep `ENABLE_LEGACY_ROUTES` unset. If deliberately enabled, legacy routes are public unless server-side `AUTH_TOKEN` or both `AUTH_USER` and `AUTH_PASS` are configured. Caller-provided `?auth=` credentials are rejected.
- Cloudflare supplies the trusted `CF-Connecting-IP` used for rate limits. Do not expose an alternative origin that trusts a caller-supplied version of this header.
- Set appropriate provider quotas and monitor abuse: registration is open, and application rate limits do not replace network-level traffic controls.
- Keep dependencies current and run `pnpm audit`, typecheck, API tests, reference tests and runtime tests before releases.

Drive content remains accessible according to its Google sharing settings. Gateway authentication protects this catalog and its metadata edits; it cannot make a publicly shared Drive file private. The application never requests Drive write access.

See [the security review](docs/security-audit.md) for findings, evidence and remaining limitations.
