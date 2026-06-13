# Contributing

Arch4 welcomes issues and pull requests after the repository is public.

## Development Setup

```sh
pnpm install
pnpm setup:runtime
pnpm build
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm smoke
```

## Package Boundaries

- Shared contracts, workspace layout helpers, validation, and deterministic
  indexing belong in `@arch4/core`.
- Structurizr-specific rendering belongs in `@arch4/renderer-structurizr`.
- Diagram UI belongs in `@arch4/viewer`.
- Cursor integration belongs in `packages/cursor-extension`.
- Release and packaging automation belongs in `scripts/` and `.github/`.

## Generated Files

The Arch4 repository and its example workspace intentionally commit reviewed
`.arch4/architecture/build/**` output so fresh checkouts can inspect diagrams
without rendering first. Keep those files deterministic and update them when
architecture source changes.

Do not commit runtime bundles, packaged VSIXs, coverage output, package staging
directories, or local Cursor workspace artifacts unless they are documented
fixtures.

Arch4-owned Cursor files are marked with `arch4-owned: true`. The `.arch4`
directory is Arch4-owned workspace state and may be removed after explicit user
confirmation. The extension intentionally does not create backup copies.

## Pull Requests

Pull requests should include tests for behavioral changes and update docs when
the user workflow, release process, runtime behavior, or generated-file policy
changes.
