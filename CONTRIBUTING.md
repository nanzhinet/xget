# Contributing to Xget

Thank you for helping improve Xget. Contributions of all sizes are welcome,
including bug reports, documentation improvements, test coverage, performance
investigations, new platform support, and code changes.

Before you contribute, please read these repository documents:

- [README](README.md) for project scope, supported platforms, and deployment
  options
- [Code of Conduct](CODE_OF_CONDUCT.md) for community expectations
- [Security Policy](SECURITY.md) for responsible vulnerability reporting
- [Governance](GOVERNANCE.md) for maintainer roles and decision-making

## Ways to contribute

- Report bugs with a minimal reproduction and clear expected behavior
- Propose features that improve correctness, usability, observability, or
  maintainability
- Improve documentation, examples, or deployment guidance
- Add or expand automated tests
- Validate behavior against real clients, registries, or upstream platforms

## Before opening an issue

- Search existing issues and pull requests first to avoid duplicates
- Keep one report focused on one problem or one proposal
- Include enough detail for someone else to reproduce the issue
- Do not use public issues for security vulnerabilities; follow
  [`SECURITY.md`](SECURITY.md) instead

Useful details to include:

- The request URL or request shape that failed, with secrets removed
- The upstream platform involved, such as GitHub, npm, Docker Hub, or OpenAI
- Expected behavior and actual behavior
- Steps to reproduce the problem
- Logs, screenshots, or response headers when relevant
- Your runtime or deployment environment, if it affects the issue

## Development setup

Xget uses Node.js and Wrangler for local development.

1. Install Node.js 24 and npm.
2. Install dependencies with `npm ci`.
3. Start the local worker with `npm run dev`.
4. Run tests and checks before opening a pull request.

Common commands:

```bash
npm run dev
npm run lint
npm run format:check
npm run test:run
npm run test:coverage
npm run type-check
```

## Repository layout

- `src/` contains the Worker entry point, request pipeline, protocol handlers,
  routing logic, upstream fetch helpers, and shared utilities
- `test/` contains unit, feature, platform, and integration tests
- `adapters/` contains deployment adapters for non-Workers targets
- `docs/` contains longer-form operational and deployment documentation

## Pull request workflow

1. Fork the repository and create a branch from `main`.
2. Keep the change focused. Avoid mixing unrelated fixes.
3. Add or update tests when behavior changes.
4. Update documentation when user-facing behavior, configuration, or supported
   platforms change.
5. Run the local checks listed below before requesting review.
6. Open a pull request using the repository template and explain the user impact
   clearly.

Required local checks:

```bash
npm run lint
npm run format:check
npm run test:run
npm run type-check
```

If your change affects routing, headers, cache behavior, retries, security
controls, or protocol compatibility, include test coverage for that behavior.

## Coding expectations

- Follow the existing project structure and naming conventions
- Prefer small, reviewable changes over large mixed refactors
- Preserve protocol compatibility for Git, Docker, AI, and package manager
  traffic
- Avoid logging secrets, tokens, or private request data
- Document new platform prefixes and examples in [`README.md`](README.md) when
  support is added

## Commit messages

This repository uses
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
Preferred format:

```text
type(scope): description
```

Examples:

- `feat(docker): normalize blob redirect handling`
- `fix(routing): preserve crates search queries`
- `docs(readme): clarify npm registry setup`

## Review and release expectations

- Maintainers review contributions on a best-effort basis
- Large design changes should start with an issue before implementation
- Merged changes may be edited, squashed, or followed up by maintainers to keep
  the project consistent
- Acceptance of a contribution does not create an obligation for long-term
  support, backports, or maintenance

## Community standards

By participating in this project, you agree to follow
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Please be respectful, assume good
intent, and help keep the project welcoming for users and contributors from a
wide range of backgrounds and experience levels.
