#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widgetDir = path.join(root, "packages", "mcp", "dist", "widget");
const htmlPath = path.join(widgetDir, "index.html");

let html = readFileSync(htmlPath, "utf8");

html = inlineStyles(html);
html = inlineScripts(html);

if (/<(script|link)\b[^>]+(?:src|href)=["']\/?assets\//.test(html)) {
  throw new Error("MCP widget HTML still references external Vite assets.");
}

writeFileSync(htmlPath, html, "utf8");
console.log(`Inlined MCP widget assets in ${path.relative(root, htmlPath)}`);

function inlineStyles(source) {
  return source.replace(
    /<link\b([^>]*?)href=["']([^"']*assets\/[^"']+\.css)["']([^>]*)>/g,
    (_match, before, href, after) => {
      const css = readWidgetAsset(href).replaceAll("</style", "<\\/style");
      const attributes = `${before} ${after}`;
      const nonce = nonceAttribute(attributes);
      return `<style${nonce}>${css}</style>`;
    },
  );
}

function inlineScripts(source) {
  return source.replace(
    /<script\b([^>]*?)src=["']([^"']*assets\/[^"']+\.js)["']([^>]*)><\/script>/g,
    (_match, before, src, after) => {
      const js = readWidgetAsset(src).replaceAll("</script", "<\\/script");
      const attributes = `${before} ${after}`;
      const nonce = nonceAttribute(attributes);
      return `<script type="module"${nonce}>${js}</script>`;
    },
  );
}

function readWidgetAsset(assetRef) {
  const normalized = assetRef.startsWith("/") ? assetRef.slice(1) : assetRef;
  return readFileSync(path.join(widgetDir, normalized), "utf8");
}

function nonceAttribute(attributes) {
  const match = attributes.match(/\bnonce=(["'][^"']+["'])/);
  return match ? ` nonce=${match[1]}` : "";
}
