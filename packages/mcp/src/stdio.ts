#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createArch4McpServer, resolveMcpProjectRoot } from "./server.js";

const server = createArch4McpServer({
  projectRoot: resolveMcpProjectRoot(process.argv.slice(2)),
});

await server.connect(new StdioServerTransport());
