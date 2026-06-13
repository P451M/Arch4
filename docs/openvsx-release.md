# OpenVSX Release

Arch4 is distributed to Cursor through OpenVSX.

## Maintainer Setup

1. Create or sign in to an Eclipse/OpenVSX account.
2. Accept the OpenVSX Publisher Agreement.
3. Create the `arch4` publisher namespace, or update
   `packages/cursor-extension/package.json` if a different verified namespace is
   chosen.
4. Verify namespace ownership according to OpenVSX requirements.
5. Create an OpenVSX access token.
6. Store the token as the GitHub Actions secret `OVSX_PAT`.

## Dry Run

```sh
pnpm install
pnpm build
pnpm setup:runtime
pnpm package:extension
```

`pnpm package:extension:all` expects runtime bundles for every supported target
under `runtime/bundles/<platform>/`. Because `pnpm setup:runtime` validates
executables on the current OS, all-platform packaging is normally verified by
the GitHub release workflow's platform matrix. A local all-platform package run
is only expected to work after those bundles already exist on disk.

The package script fails if a VSIX is missing marketplace docs, legal files, the
bundled CLI, webview assets, exactly one target runtime bundle, or contains
development-only files such as compiled tests or source maps.

## Publish

The release workflow builds one platform-specific VSIX for each supported
platform:

- `darwin-arm64`
- `darwin-x64`
- `linux-x64`
- `win32-x64`

Publishing requires the GitHub Actions secret `OVSX_PAT` and should run only
from a tagged release. The publish script passes the token through the process
environment and relies on the pinned `ovsx` CLI to read it from `OVSX_PAT`.

## Post-Publish Verification

After publishing:

1. Query OpenVSX for `arch4.arch4-cursor-extension`.
2. Download each platform artifact.
3. Verify the VSIX contains only the expected target runtime and legal files.
4. Open Cursor's Extensions pane and confirm `Arch4` appears in search.
5. Install the extension in a clean repository and verify initialize, update,
   render, index, and open-map workflows without external Java or Structurizr.
   Rendering must not require Graphviz.
