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

Reviewed `.arch4/architecture/build/**` outputs for this repository and its
examples may be committed so fresh checkouts can inspect diagrams without first
rendering them. Runtime bundles, package staging directories, VSIX files, and
unreviewed local Cursor profile state are not committed.
