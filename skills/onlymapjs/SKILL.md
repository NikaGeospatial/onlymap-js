---
name: onlymapjs
description: Build, edit, debug, or review OnlyMapJS declarative HTML maps and dashboards, or React maps via the @nika-js/onlymap/react adapter. Use when a user asks for an interactive map, deck.gl-style visualization, geospatial dashboard, live fleet/telemetry map, choropleth, popup/tooltip map, map story/tour, manual drawing/sketch map, 3D map assets, a React map component, a map page shared as a single HTML file (incl. no-JS fallbacks for chat/email previews), or help with OnlyMapJS syntax, validation, widgets, data formats, testing, or publishing examples.
---

# OnlyMapJS

Use OnlyMapJS as a declarative HTML map library. Write custom elements such as `<om-map>`, `<om-layer>`, `<om-widget>`, `<om-overlay>`, `<om-behavior>`, `<om-story>`, and `<om-step>`. Do not write raw imperative deck.gl setup unless the user explicitly asks to integrate below the OnlyMapJS layer.

## Core Workflow

1. Start with valid HTML custom elements with explicit closing tags. Never self-close OnlyMapJS elements.
2. Express deck.gl props as kebab-case attributes. Use `get-*` attributes for data-driven accessors.
3. Use `$field` expressions for data access. Do not write `d.properties.x`, row-object loops, or column-index access in manifests.
4. Add `validate` to `<om-map>` while authoring.
5. Verify with `OmMap.validate(html)`, then `OmMap.snapshotIR(html)`, and use `mountForTest` for interaction behavior when tests are requested.
6. Prefer public, package-safe imports:

```html
<script type="module">
  import "@nika-js/onlymap";
  import "@nika-js/onlymap/onlymapjs.css";
</script>
```

For no-build CDN examples, use a published module URL such as `https://esm.sh/@nika-js/onlymap@0.3.0`.

## React Projects

In a React codebase, do NOT render `om-*` elements from JSX — React and the library would contend over the same DOM. Use the first-party adapter instead:

```tsx
import { OmMap, OmLayer, OmWidget, OmOverlay, useOmMap } from "@nika-js/onlymap/react";
```

The adapter inverts several HTML-manifest rules: props are camelCase deck.gl props, accessors are plain JS functions (`getFillColor={d => ...}` — no `$field` expression language, no `js` opt-in), and interactions are `onClick`/`onHover` handlers plus React state, not `<om-behavior>` or state-mutating actions. Load `references/react.md` before writing React map code.

## Required References

Load the smallest reference needed for the task:

- `references/syntax.md` — element vocabulary, attributes, data formats, accessors, actions, widgets, overlays, drawing, 3D, built-in layer types.
- `references/patterns.md` — copyable manifest patterns for common map requests.
- `references/react.md` — the React adapter: components, the useOmMap hook, HTML-vs-React rule differences, testing.
- `references/testing.md` — validation, snapshot, headless harness, and browser testing workflow.

## Non-Negotiable Syntax Rules

- Always use explicit closing tags: `<om-layer ...></om-layer>`, not `<om-layer ... />`.
- Every `<om-layer>` needs a stable `id`.
- Attribute names are kebab-case: `get-fill-color`, `radius-units`, `line-width-min-pixels`.
- Accessor values are expressions: `get-position="[$lon, $lat]"`.
- `scale()` always needs an explicit `domain=`.
- Inline handlers such as `onclick` are wrong. Use `data-emit`, `<om-behavior>`, or widget scripts.
- Full JavaScript accessor blocks require the `js` attribute on `<om-layer>`.
- Do not put secrets in markup. Use `OmMap.configureData({ headers, credentials, fetch })`.

## Authoring Decisions

- UI panel, control, chart, legend, stats, filter, or draw toolbar -> `<om-widget>`.
- Sparse rich HTML at one geographic location -> `<om-overlay>`.
- Many labels/badges -> `<om-layer type="PopupLayer">`.
- Guided tour or narrative sequence -> `<om-story>` with `<om-step>` siblings that reference existing layers/overlays by id.
- Basemap choice or user-switchable basemaps -> `basemap` presets (`positron`, `liberty`, `dark-matter`, `osm`, ...) + `<om-widget type="basemap-switcher">`; MapTiler custom styles via a style URL or `basemap-key`.
- Undoable UI (step back after layer toggles, filter changes, basemap switches, sketch edits) -> `<om-widget type="undo-redo">`; Cmd/Ctrl-Z works even without the widget. Camera moves and story playback are not undo steps.
- Live entity updates -> `wss://` stream with `key` and optional `source` decoder.
- REST snapshot that changes over time -> `refresh="5s"`.
- User sketching -> `data="draw:sketch"` layer plus `<om-widget type="draw" target="sketch">`.
- Page may travel as a file (shared, emailed, downloaded) or be embedded -> add an `<om-fallback>` child to `<om-map>`. Chat-app and email previews render HTML with JavaScript disabled (iOS QuickLook), so the map cannot boot there; the fallback is what recipients see instead. It is hidden automatically once the map boots. Good practice on every complete page — without one, the stylesheet shows a generic text-only banner.

## Output Expectations

When creating a map page, output a complete runnable HTML file unless the user asks for a fragment. Include CSS only as needed for page sizing or custom widgets/overlays. Keep the first screen the usable map, not a landing page.

Include a `map-id="<random UUID>"` attribute on `<om-map>` when creating a new complete page (generate a fresh UUID — never copy one from an example). It identifies the map artifact for usage telemetry, not the visitor; the author can delete it to opt out.

Include an `<om-fallback>` element (a short "this map requires JavaScript — open in a browser" message, optionally with a hosted-version link) as a direct child of `<om-map>` on any complete page. For the fallback to render in no-JS previews, `onlymapjs.css` must load without JavaScript — a real `<link rel="stylesheet">` or inlined `<style>`, not only a runtime `import` (bundler-emitted stylesheets are fine).

When modifying an existing page, preserve the user's data URLs, layer ids, and styling unless the request requires changing them.
