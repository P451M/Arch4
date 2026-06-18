# Arch4 MCP Cursor Plugin

This plugin installs the Arch4 MCP server for Cursor Agent.

Use this plugin as an alternative to the Arch4 VSIX/OpenVSX extension, not
alongside it. Current Cursor versions treat extension-registered MCP servers
and plugin `mcp.json` servers as separate providers, so installing both creates
duplicate Arch4 MCP servers.

The server exposes tools to prepare an Arch4 workspace, write validated
architecture source, build rendered artifacts, inspect diagnostics, update
layout, and display the interactive architecture map widget.

The plugin contributes these Cursor Agent slash commands:

- `/arch4-open-map`
- `/arch4-build-artifacts`
- `/arch4-update`
- `/arch4-seed`
- `/arch4-review`
- `/arch4-create-support-request`

For local testing, copy this directory to:

```sh
pnpm build
mkdir -p ~/.cursor/plugins/local
rm -rf ~/.cursor/plugins/local/arch4-mcp
cp -R /absolute/path/to/arch4/plugins/cursor/arch4-mcp ~/.cursor/plugins/local/arch4-mcp
```

Then fully restart or reload Cursor in a profile without the Arch4 VSIX
installed and verify the `arch4` MCP server and Arch4 slash commands appear in
Cursor Agent.

Cursor 3.7.42 rejects local plugin symlinks whose targets are outside
`~/.cursor/plugins/local`, so use a copied plugin directory for local smoke
tests.

The committed `mcp.json` runs:

```sh
npx -y @arch4/mcp --root "${workspaceFolder}"
```

That is the intended marketplace configuration, but it requires `@arch4/mcp` to
be published to npm. Before npm publication, test with a local copy of this
plugin whose `mcp.json` points to:

```sh
node /absolute/path/to/arch4/packages/mcp/dist/stdio.js --root "${workspaceFolder}"
```

See `docs/cursor-mcp.md` for the full extension, local plugin, and marketplace
workflow.
