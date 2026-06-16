# Release Policy

Arch4 releases are Cursor/OpenVSX extension releases. NPM publication is
deferred.

Release blockers:

- `pnpm check`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm smoke`
  pass from a clean checkout.
- `pnpm audit --prod` reports no known production dependency vulnerabilities.
- Runtime manifests verify.
- Platform-specific VSIX packages build and pass package-content verification.
- `README.md`, `CHANGELOG.md`, `SUPPORT.md`, `LICENSE`, `NOTICE`, and
  `THIRD_PARTY_NOTICES.md` are included in every extension distribution.

`.arch4/architecture/build/**` outputs are generated and should not be
committed for examples; regenerate them with Arch4 build commands when needed.
Runtime bundles, package staging directories, VSIX files, and unreviewed local
Cursor profile state are not committed.
