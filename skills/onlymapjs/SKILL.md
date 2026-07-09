---
name: onlymapjs
description: Build, edit, debug, or review OnlyMapJS declarative HTML maps and dashboards. Use when a user asks for an interactive map, deck.gl-style visualization, geospatial dashboard, live fleet/telemetry map, choropleth, popup/tooltip map, map story/tour, manual drawing/sketch map, 3D map assets, or help with OnlyMapJS syntax, validation, widgets, data formats, testing, or publishing examples.
---

# OnlyMapJS

Use OnlyMapJS as a declarative HTML map library. Write custom elements such as `<deck-map>`, `<deck-layer>`, `<deck-widget>`, `<deck-overlay>`, `<deck-behavior>`, `<deck-story>`, and `<deck-step>`. Do not write raw imperative deck.gl setup unless the user explicitly asks to integrate below the OnlyMapJS layer.

## Core Workflow

1. Start with valid HTML custom elements with explicit closing tags. Never self-close OnlyMapJS elements.
2. Express deck.gl props as kebab-case attributes. Use `get-*` attributes for data-driven accessors.
3. Use `$field` expressions for data access. Do not write `d.properties.x`, row-object loops, or column-index access in manifests.
4. Add `validate` to `<deck-map>` while authoring.
5. Verify with `DeckMap.validate(html)`, then `DeckMap.snapshotIR(html)`, and use `mountForTest` for interaction behavior when tests are requested.
6. Prefer public, package-safe imports:

```html
<script type="module">
  import "onlymapjs";
  import "onlymapjs/onlymapjs.css";
</script>
```

For no-build CDN examples, use a published module URL such as `https://esm.sh/onlymapjs@0.1.0`.

## Required References

Load the smallest reference needed for the task:

- `references/syntax.md` — element vocabulary, attributes, data formats, accessors, actions, widgets, overlays, drawing, 3D, built-in layer types.
- `references/patterns.md` — copyable manifest patterns for common map requests.
- `references/testing.md` — validation, snapshot, headless harness, and browser testing workflow.

## Non-Negotiable Syntax Rules

- Always use explicit closing tags: `<deck-layer ...></deck-layer>`, not `<deck-layer ... />`.
- Every `<deck-layer>` needs a stable `id`.
- Attribute names are kebab-case: `get-fill-color`, `radius-units`, `line-width-min-pixels`.
- Accessor values are expressions: `get-position="[$lon, $lat]"`.
- `scale()` always needs an explicit `domain=`.
- Inline handlers such as `onclick` are wrong. Use `data-emit`, `<deck-behavior>`, or widget scripts.
- Full JavaScript accessor blocks require the `js` attribute on `<deck-layer>`.
- Do not put secrets in markup. Use `DeckMap.configureData({ headers, credentials, fetch })`.

## Authoring Decisions

- UI panel, control, chart, legend, stats, filter, or draw toolbar -> `<deck-widget>`.
- Sparse rich HTML at one geographic location -> `<deck-overlay>`.
- Many labels/badges -> `<deck-layer type="PopupLayer">`.
- Guided tour or narrative sequence -> `<deck-story>` with `<deck-step>` siblings that reference existing layers/overlays by id.
- Live entity updates -> `wss://` stream with `key` and optional `source` decoder.
- REST snapshot that changes over time -> `refresh="5s"`.
- User sketching -> `data="draw:sketch"` layer plus `<deck-widget type="draw" target="sketch">`.

## Output Expectations

When creating a map page, output a complete runnable HTML file unless the user asks for a fragment. Include CSS only as needed for page sizing or custom widgets/overlays. Keep the first screen the usable map, not a landing page.

When modifying an existing page, preserve the user's data URLs, layer ids, and styling unless the request requires changing them.
