# Arch4 viewer styling

`@arch4/viewer` ships plain CSS through the public import path:

```ts
import "@arch4/viewer/styles.css";
```

The stylesheet is intentionally a single file. It is organized around the `.arch4-viewer` root, public theme variables, and implementation selectors for the viewer layout, React Flow canvas, diagram nodes, edges, legend, sidebar, and details drawer.

## Theme contract

Consumers should theme the viewer by overriding supported `--arch4-*` variables on `.arch4-viewer` or an ancestor that scopes the viewer. The `.arch4-viewer` class is the public styling boundary; other `.arch4-*` class names are implementation details and may change when the component structure changes.

Supported surface, text, and interaction tokens:

```css
.my-viewer-theme .arch4-viewer {
  --arch4-background: #f5f7fb;
  --arch4-surface: #ffffff;
  --arch4-surface-raised: #ffffff;
  --arch4-surface-muted: #f9fafc;
  --arch4-surface-selected: #eef2ff;
  --arch4-surface-control: #ffffff;
  --arch4-surface-control-hover: #f3f5f9;
  --arch4-icon-button-hover: rgba(104, 115, 134, 0.12);
  --arch4-list-hover-background: #f3f5f9;
  --arch4-list-hover-foreground: #172033;
  --arch4-list-active-foreground: #172033;
  --arch4-text: #172033;
  --arch4-text-muted: #687386;
  --arch4-heading-muted: #4b5b73;
  --arch4-border: #d9dee8;
  --arch4-node-border: #b9c3d5;
  --arch4-accent: #4f6df5;
  --arch4-accent-strong: #3652d9;
  --arch4-accent-soft: #eef2ff;
  --arch4-selection-ring: rgba(79, 109, 245, 0.18);
  --arch4-shadow: rgba(22, 32, 51, 0.08);
  --arch4-overlay-shadow: rgba(22, 32, 51, 0.12);
  --arch4-focus-ring: color-mix(in srgb, var(--arch4-accent) 45%, transparent);
  --arch4-error-border: #ef8f8f;
  --arch4-error-background: #fff2f2;
  --arch4-grid-color: #d5dae3;
}
```

Supported diagram semantic tokens:

```css
.my-viewer-theme .arch4-viewer {
  --arch4-person-accent: #7c3aed;
  --arch4-software-system-accent: #2563eb;
  --arch4-container-accent: #0891b2;
  --arch4-database-accent: #16a34a;
  --arch4-component-accent: #d97706;
  --arch4-component-icon-accent: #f59e0b;
  --arch4-infrastructure-accent: #64748b;
  --arch4-deployment-view-accent: #7c8da1;
  --arch4-dynamic-view-accent: #2f9f8f;
}
```

Supported edge label tokens:

```css
.my-viewer-theme .arch4-viewer {
  --arch4-edge-label-background: color-mix(
    in srgb,
    var(--arch4-surface-raised) 96%,
    var(--arch4-background)
  );
  --arch4-edge-label-border: color-mix(
    in srgb,
    var(--arch4-text-muted) 28%,
    var(--arch4-border)
  );
  --arch4-edge-label-shadow: 0 4px 14px var(--arch4-shadow);
  --arch4-edge-active-stroke: var(--arch4-accent);
  --arch4-edge-order-background: color-mix(
    in srgb,
    var(--arch4-text) 88%,
    var(--arch4-accent)
  );
  --arch4-edge-order-foreground: var(--arch4-background);
}
```

The viewer also uses internal derived variables such as `--arch4-node-accent`, `--arch4-node-background`, `--arch4-boundary-fill`, and `--arch4-boundary-border`. Consumers should prefer the public variables above instead of overriding derived internals.

## Cursor extension theming

The Cursor extension imports the viewer stylesheet first and then imports its webview stylesheet:

```ts
import "@arch4/viewer/styles.css";
import "../webview.css";
```

The extension stylesheet keeps the same theme contract and maps `--arch4-*` variables to VS Code webview tokens such as `--vscode-editor-background`, `--vscode-foreground`, `--vscode-focusBorder`, and `--vscode-charts-*`. This lets the reusable viewer remain editor-agnostic while still respecting light, dark, and high-contrast editor themes inside the extension.
