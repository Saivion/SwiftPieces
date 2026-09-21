# Security Policy

## Reporting a vulnerability

**Do not open a public issue.**

Report privately through [GitHub's private vulnerability reporting](https://github.com/Saivion/SwiftPieces/security/advisories/new), or email **security@swiftpieces.com**.

Please include:

- What the issue is and where it lives, with a file path or URL.
- How to reproduce it, ideally with the smallest case that shows the problem.
- What an attacker gets out of it.

You will get an acknowledgement within 72 hours and an assessment within a week. If the report is valid, you will hear when a fix ships, and you will be credited in the release notes unless you ask not to be.

Please give a fix a reasonable window before disclosing publicly. If a report goes unanswered past the windows above, treat that as a failure on our side and disclose as you see fit.

## Supported versions

Fixes land on `main` and deploy from there. There are no long-lived release branches, and older tags are not patched, so the supported version is whatever `main` currently is.

Pieces are copied into your project rather than installed as a package, so a fix here does not reach code you have already copied. Anything security-relevant in a piece is called out in the [changelog](https://swiftpieces.com/changelog) so you can re-copy it.

## Scope

In scope:

- swiftpieces.com and its API routes (`/api/registry/[name]`, `/api/mcp`, search).
- The `swiftpieces` CLI and the `@swiftpieces/brand` package on npm.
- Anything in a registry piece that would compromise an app shipping it: unsafe deserialization, an injection path, a capability requested without cause.

Out of scope:

- Findings from automated scanners with no demonstrated impact.
- Missing hardening headers or best-practice warnings that do not lead to an exploit.
- Denial of service through volume alone.
- Social engineering, physical attacks, and anything requiring access to a maintainer's device.

This project holds **no database, no billing, no entitlement logic and no authenticated routes**, which rules out whole categories of finding before you start. `npm run audit:public` enforces that on every build.
