---
name: arch4-open-map
description: Show this repository's rendered Arch4 architecture map widget.
---

# Open Arch4 Architecture Map

Use the Arch4 MCP tools:

1. Call `arch4_show_map` with no arguments.
2. Let Cursor render the `resource_link` returned by that tool call.
3. Do not call `FetchMcpResource`, `readResource`, or any other MCP resource
   fetch after `arch4_show_map`; the returned `ui://arch4/map.html` resource
   link is already the widget.
4. If the host cannot render the widget, summarize only the `structuredContent`
   from the `arch4_show_map` tool result.

Do not edit files.
