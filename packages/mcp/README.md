# Arch4 MCP

Host-neutral MCP server for Arch4 architecture workflows.

The v1 server is Cursor-first and exposes stdio tools to prepare an Arch4
workspace, write validated architecture source, build rendered artifacts, read
diagnostics, persist layout changes, and display the Arch4 map widget.

```sh
npx -y @arch4/mcp --root /path/to/repo
```

For local development before npm publication:

```sh
pnpm build
node packages/mcp/dist/stdio.js --root /path/to/repo
```

Cursor extension users normally do not run this command directly. The Arch4
extension installs/updates a local Cursor MCP plugin that points to the bundled
VSIX MCP server when it activates for a workspace.

See `docs/cursor-mcp.md` for Cursor-specific testing and publishing steps.
