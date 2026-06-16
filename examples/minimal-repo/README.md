# Travel Booking Recovery Example

This fixture is a reviewed mock workspace for testing the Arch4 CLI and Cursor
extension. It models a travel booking platform with context, container,
component, deployment, and dynamic views.

Use this repo to validate map rendering, theming, legends, boundaries, edge
labels, and built context without bootstrapping a production repository. Build
artifacts are generated locally from the tracked architecture source.

The `.arch4/architecture/workspace.dsl` source,
`.arch4/architecture/layout.json` layout preferences, and
`.arch4/architecture/entities/*.json` metadata are intentionally tracked here.
Generated `.arch4/architecture/build/**` outputs and extension-installed
`.cursor/**` helper files are intentionally ignored.

From the Arch4 repo root:

```sh
pnpm build
pnpm dev:cursor
```

To refresh build architecture artifacts directly from this directory after
building:

```sh
arch4 render
arch4 index
```

In Cursor, run `Arch4: Build Architecture Artifacts`, then
`Arch4: Open Architecture Map`.
