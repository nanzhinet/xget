# Security Policy

Xget proxies requests across code hosting platforms, package registries,
container registries, and AI inference providers. If you believe you have found
a security vulnerability, please report it responsibly and avoid public
disclosure until maintainers have had a chance to investigate.

## Supported versions

Security fixes are developed against the latest code on `main`. Backports to
older revisions or downstream forks are not guaranteed.

| Version                        | Supported        |
| ------------------------------ | ---------------- |
| `main`                         | Yes              |
| Older commits, tags, and forks | Best effort only |

## How to report a vulnerability

Please do not open a public GitHub issue for suspected vulnerabilities.

Instead, use one of these private channels:

1. GitHub private vulnerability reporting for this repository, if it is enabled
2. The maintainer contact page at <https://xi-xu.me/#contact>

Please include as much of the following as you can:

- A clear description of the vulnerability
- The affected code path, route shape, platform prefix, or deployment flow
- Reproduction steps or a proof of concept
- Impact assessment, including confidentiality, integrity, or availability
  concerns
- Any suggested remediation, if you have one
- Sanitized logs, headers, or payload samples with secrets removed

## What to expect

- Maintainers will acknowledge reports on a best-effort basis
- Reports will be reviewed privately and handled confidentially where possible
- Maintainers may ask follow-up questions to validate severity and scope
- If the report is confirmed, maintainers will work toward a fix and coordinate
  a disclosure timeline

## Scope notes

The following are usually in scope:

- Vulnerabilities in Xget source code
- Security weaknesses in official deployment manifests or adapters
- Authentication, header forwarding, request validation, cache isolation, and
  secret handling issues

The following are usually out of scope unless Xget directly introduces them:

- Availability-only complaints caused by third-party outages
- Misconfiguration in self-hosted deployments outside the repository defaults
- Issues in upstream services that Xget only proxies

## Handling sensitive information

Do not include private tokens, credentials, or other secrets in public issues,
pull requests, or discussion threads. If a proof of concept requires secrets,
share them only through a private reporting channel and rotate them afterward.
