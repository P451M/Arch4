# Travel Booking Recovery Example

This fixture is a reviewed mock workspace for testing the Arch4 CLI and Cursor
extension. It models a travel booking platform with context, container,
component, deployment, and dynamic views.

Use this repo to validate map rendering, theming, legends, boundaries, edge
labels, and built context without bootstrapping a production repository.

The `.arch4/architecture/workspace.dsl` source,
`.arch4/architecture/layout.json` layout preferences, and
`.arch4/architecture/build/**` outputs are intentionally tracked here so tests
and extension development have a ready-to-open architecture fixture.

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
