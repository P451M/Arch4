#!/usr/bin/env node
export { STABLE_GENERATED_AT } from "./generated.js";
import { run } from "./commands.js";

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);
const root = process.cwd();

try {
  await run({ root, args }, command);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
