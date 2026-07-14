<p align="center">
  <img src="https://raw.githubusercontent.com/NikaGeospatial/onlymapjs/main/onlymapbanner.png" alt="OnlyMapJS" width="100%">
</p>

# OnlyMapJS

**Interactive WebGL maps from plain HTML.** Write a declarative manifest — layers, widgets, popups, behaviors as custom elements — and OnlyMapJS drives [deck.gl](https://deck.gl) underneath: rendering, data loading, live updates, picking, and UI, with no build step and no imperative glue code.

```html
<script type="module" src="https://esm.sh/@nika-js/onlymap"></script>

<om-map center="[-122.42, 37.77]" zoom="11" basemap="maplibre">
  <om-layer id="quakes" type="ScatterplotLayer" data="./quakes.json"
              label="Earthquakes" color="#b30000"
              get-position="[$lon, $lat]"
              get-fill-color="scale($magnitude, sequential, ['#fee8c8','#b30000'], domain=[0,7])"
              get-radius="scale($magnitude, sqrt, [2, 18], domain=[0,7])"
              radius-units="pixels" pickable></om-layer>

  <om-widget type="legend" position="top-right"></om-widget>

  <om-overlay id="detail" anchor-from="selection" visible="false">
    <div><b>{{place}}</b> — M {{magnitude}}</div>
  </om-overlay>
  <om-behavior on="click" layer="quakes" action="show-overlay" target="detail"></om-behavior>
</om-map>
```

That's a complete app: a no-token MapLibre basemap, data-driven colors and sizes, a legend, and a click-for-details popup. Edit any attribute on the live DOM and the map updates — the manifest *is* the state.

It's also designed to be written **by AI agents**: HTML is a reliable generation target, [`llms.txt`](llms.txt) teaches the format, and `OmMap.validate()` returns structured errors with actionable fixes — a real feedback loop instead of a blank canvas.

> ⚠️ **Status: v0.1.** Proprietary — commercial licensing terms are in [LICENSE.md](LICENSE.md); APIs may still move before 1.0.

## Install

```bash
npm install @nika-js/onlymap
```

Or with no build step at all, straight from a CDN:

```html
<script type="module" src="https://esm.sh/@nika-js/onlymap"></script>
```

Then `npx @nika-js/onlymap init` wires up VS Code IntelliSense and `!`-prefixed manifest snippets for your project. The library ships with 297 unit/behavioral tests and 19 Playwright GPU tests.

The [examples](https://github.com/NikaGeospatial/onlymapjs/tree/main/examples) are the best tour: widgets, behaviors & overlays, basemaps, columnar/Arrow data, manual drawing, 3D models, a live WebSocket ship feed, and a polled driver fleet.

## The manifest

A handful of elements, one rule: **attributes are kebab-case versions of deck.gl props** (`radius-units` → `radiusUnits`), and `get-*` attributes are data-driven accessors.

| Element | Role |
|---|---|
| `<om-map>` | The map. `center`, `zoom`, `pitch`, `bearing`; `basemap` takes a free preset (`positron`, `liberty`, `dark-matter`, `osm`, …), a style URL, or `"none"` (standalone canvas) — and switches **live**; `validate` for a live on-page error panel. |
| `<om-layer>` | Any of **33 layer types** by name — all of deck.gl's core, geo, aggregation, and mesh layers (Scatterplot, GeoJson, Arc, Path, Heatmap, Hexagon, Trips, Tile, Tile3D, Scenegraph, …) plus the built-in `PopupLayer` for WebGL badges/labels at scale. `id` required; `label`/`color` feed the legend. |
| `<om-widget>` | UI panels. Built-ins: `legend`, `layer-switcher`, `basemap-switcher`, `zoom-controls`, `scale-bar`, `attribution`, `filter`, `draw`, `vega-lite` (live charts). Or write your own inline with HTML + a `<script type="om/widget">`. |
| `<om-overlay>` | Rich HTML anchored to a map location — a static `anchor="[lng, lat]"`, the current selection, or a feature's own geometry via `anchor-layer`/`anchor-feature-id`. `{{field}}` interpolates the picked feature, HTML-escaped by default. |
| `<om-behavior>` | Declarative interactions: `on="click|hover|drag|load|data-loaded"` → a named action. |
| `<om-story>` | A storyboard: `<om-step>` children fire actions on a timeline. Controlled by the `player` widget, behaviors, or `storyEl.play()/pause()/seek()`. |
| `<om-fallback>` | What shows where scripts never run — chat-app/email file previews (iOS QuickLook renders HTML attachments with JS off), file managers, sandboxed webviews. A direct child of `<om-map>`, hidden automatically the moment the map boots; pages without one get a text-only default banner from the stylesheet. Good practice on any page that may travel as a file. The gate is pure CSS (`om-map:not(:defined)`), so `onlymapjs.css` must load without JS — a real `<link>`, a bundler-emitted sheet, or an inlined `<style>`. |

### Accessors without JavaScript

`get-*` attributes take a small, safe expression language — `$field` reads a datum field regardless of data shape (flat JSON, GeoJSON properties, or Arrow columns):

```html
get-position="[$lon, $lat]"
get-radius="$population * 0.001"
get-fill-color="$value > 100 ? [255,0,0] : [0,128,255]"
get-fill-color="scale($depth, sequential, ['#ffffcc','#800026'], domain=[0,700])"
```

Built-ins: `scale()` (types: `sequential`, `diverging`, `threshold`, `sqrt`, `log`, `pow` — explicit `domain=` required), `colorRamp()`, `clamp()`, `lerp()`, and `Math.*`. Multi-line accessors go in a `<script type="om/accessors">` block; genuinely arbitrary JS needs an explicit `js` opt-in on the layer. Untrusted (agent-written) expressions are safe by construction: the compiler is an AST whitelist, not an eval.

### Data sources

| Source | Manifest | Notes |
|---|---|---|
| JSON / GeoJSON URL | `data="./points.json"` | flat arrays or FeatureCollections; `$field` works on both |
| Inline JSON | `<script type="application/json">` child | zero-request demos and tests |
| **Apache Arrow / GeoArrow** | `data="./big.arrow"` | points stay columnar (zero row objects on the render path); GeoArrow line/polygon geometry becomes GeoJSON features — trace, anchored cards, picking all work; zstd-compressed IPC supported; parsers lazy-load on first use |
| Columnar JSON | `{"columns": {"lon": [...], ...}}` | same columnar fast path without Arrow tooling |
| **CSV / TSV** | `data="./quakes.csv"` | parsed to typed columns (lazy ~48 KB chunk); numbers auto-typed, quoted fields intact |
| **Shapefile** | `data="./countries.shp"` | geometry + `.dbf` attributes joined into GeoJSON features (sidecars fetched with your auth config) |
| **KML** | `data="./tour.kml"` | placemarks → GeoJSON features; other formats plug in via `OmMap.registerFormat` |
| **WebSocket stream** | `data="wss://feed" key="id" flush="250ms" source="myFormat"` | upsert-by-key, burst coalescing, auto-reconnect; decode any format via `OmMap.registerSource` |
| **Polled REST snapshot** | `data="/api/fleet.json" refresh="5s"` | full-snapshot replace per poll; outages keep the last good data |
| **Draw store** | `data="draw:sketch"` | live in-memory GeoJSON feature store written by `<om-widget type="draw" target="sketch">` |

Private endpoints: `OmMap.configureData({ headers, credentials, fetch })` — applied to every fetch including refreshes. Credentials stay out of markup by design. Full guide: [docs/live-data.md](docs/live-data.md).

### Interaction

Built-in actions wire to picks, widget buttons (`data-emit`), or script (`ctx.emit`) with one shared payload contract: `show-overlay`, `hide-overlay`, `show-tooltip`, `hide-tooltip`, `toggle-layer`, `highlight-feature`, `zoom-to-feature`, `filter-layer`, `set-basemap`, `zoom-in`, `zoom-out` — plus `OmMap.registerAction` for your own.

**Basemaps:** free presets out of the box — OpenFreeMap `liberty`/`bright`/`positron` (no key, no limits), CARTO `dark-matter`/`voyager`, classic `osm` raster, and keyed `maptiler-*` presets (MapTiler's style editor is the visual way to customize basemap JSON; keys are publishable, via `basemap-key` or `OmMap.configureBasemap`). The `basemap` attribute switches **live** — camera and layers survive — from a hand edit, the `set-basemap` action, or `<om-widget type="basemap-switcher">`. Add your own with `OmMap.registerBasemap(name, { style })`; required attribution renders automatically. Guide: [docs/basemaps.md](docs/basemaps.md).

**Animation:** camera moves accept a duration — `map.flyTo(coords, zoom, { duration: 1200, curve: true })`, or the `fly-to` action (`center`/`zoom`/`pitch`/`bearing`/`duration`) from any behavior or button; `prefers-reduced-motion` is honored (moves become instant, final state identical). Per-prop GPU transitions via the `transition` attribute: `transition="get-fill-color 800ms"` fades color changes; on a streaming layer, `transition="get-position 300ms"` makes entities glide between updates.

**Map stories:** a guided tour as markup — `<om-story>` holds `<om-step>` children that fire the same actions behaviors use, on a timeline (`duration`, `delay`, `parallel`); the built-in `type="player"` widget gives play/pause/scrub, seeking restores the scene's captured initial state, one story is active per map, and grabbing the map pauses playback. Effect verbs — `fade`, `pulse`, `trace` (progressive TripsLayer draw-on; with `feature-id`, a single polygon draws itself on inside its own layer), and `populate` (rows drop in one by one via a GPU filter sweep) — work as step shorthands or plain actions. The story is a sibling that references layers by id — delete it and the map is unchanged. Guide: [docs/stories.md](docs/stories.md).

GPU filtering is declarative — `filter-field="magnitude" filter-range="[4,10]"` — updates live from the built-in `filter` slider widget, and widget statistics stay coherent with what the map shows (`ctx.stats` respects the active filter unless you opt out).

### Widgets get a real runtime API

Custom widget scripts receive `ctx`: layer metadata, `viewport` (bounds/zoom/project), the current `selection`, `emit()`, and data access — `ctx.data(id)`, `ctx.dataInViewport(id)`, `ctx.stats(id, field)` (count/min/max/mean/stddev/percentiles/histogram, viewport-scoped on request). Declare `watch` tokens (`data:quakes viewport selection layers`) and the runtime re-renders you only when relevant state changes. `vegaEmbed` and `d3` are available as globals for charts.

## React

The same engine, as real components — `@nika-js/onlymap/react` (React ≥ 18, optional peer). No `om-*` elements are rendered, so React and the library never fight over the DOM: components feed a typed programmatic front-end that produces the same layer IR the HTML manifest does. Accessors are plain functions (no expression language), interactions are event handlers, and `useOmMap()` is the widget `ctx` contract as a fully-typed hook:

```tsx
import { OmMap, OmLayer, OmWidget, OmOverlay, useOmMap } from "@nika-js/onlymap/react";

<OmMap center={[-119, 36]} zoom={5} basemap="maplibre">
  <OmLayer id="quakes" type="ScatterplotLayer" data={features} pickable
           getPosition={d => [d.lon, d.lat]}
           getFillColor={d => (d.mag >= 6 ? [214, 40, 40] : [252, 191, 73])}
           onClick={sel => setSelected(sel.object)} />
  <OmWidget position="top-left"><StatsPanel /></OmWidget>
  <OmOverlay anchorFrom="selection">{sel => sel && <Card feature={sel.object} />}</OmOverlay>
</OmMap>
```

`<OmOverlay>` manages projection, per-frame tracking, and off-screen culling for you; `<OmMap headless>` makes the whole tree testable in jsdom/happy-dom. Full guide: [docs/react.md](docs/react.md).

## Editor IntelliSense

`onlymapjs.html-data.json` (generated from the layer registry — `npm run gen:html-data`) gives autocomplete and hover docs for every `om-*` element and attribute in VS Code and any editor speaking the [html-customData](https://github.com/microsoft/vscode-custom-data) format:

```bash
npx @nika-js/onlymap init
```

That opt-in command updates `.vscode/settings.json` and copies the `!`-prefixed manifest snippets into `.vscode/onlymap.code-snippets`. It never runs automatically during install.

```jsonc
// .vscode/settings.json
{ "html.customData": ["./node_modules/@nika-js/onlymap/onlymapjs.html-data.json"] }
```

The package also ships `!`-prefixed manifest snippets (`node_modules/@nika-js/onlymap/.vscode/onlymap.code-snippets`) — type `!starter`, `!map`, `!layer`, `!draw`, etc. to scaffold a well-formed element.

## LLM Skill

The npm package and public mirror include a portable Skill at `skills/onlymapjs`. Skill-aware agents can install that folder to learn the OnlyMapJS manifest syntax, authoring patterns, and validation workflow instead of treating the library like raw deck.gl.

With the Vercel Labs `skills` CLI, install it from the public GitHub repo:

```bash
npx -y skills add NikaGeospatial/onlymapjs --skill onlymapjs --agent codex
```

Or install globally for Codex:

```bash
npx -y skills add NikaGeospatial/onlymapjs --skill onlymapjs --agent codex --global
```

To inspect it without installing:

```bash
npx -y skills add NikaGeospatial/onlymapjs --list
```

## Validation — the feedback loop

```js
const result = OmMap.validate(manifestHtml);
// { valid, errors: [{ severity, element, attribute, message, fix }], warnings: [...] }
```

Exhaustive (every problem in one pass) and prescriptive (each entry carries a `fix` instruction). The same pass runs live via the `validate` attribute, rendering an on-page error panel with click-to-locate. Runtime errors (crashing accessors, bad props) are formatted into the same shape. Attributes for not-yet-implemented features warn instead of failing silently.

## Testing your map pages

Uniquely for a WebGL map library, pages built with OnlyMapJS are testable in plain vitest/jest — no browser, no GPU:

```js
const h = await mountForTest(myPageHtml);            // headless: real projection math, no WebGL
await h.pick({ layer: "quakes", featureId: "q1" }); // same code path as a real click
expect(overlay.shadowRoot.textContent).toContain("M 6.5");
```

Plus `OmMap.snapshotIR(html)` to lock down what a manifest *means* in a snapshot test, and `await mapEl.ready` / the `om-map-ready` event to de-flake browser e2e tests. Full guide: [docs/testing.md](docs/testing.md).

## 3D

`ScenegraphLayer` instances glTF/GLB models at coordinates (no three.js, no loader wiring), `Tile3DLayer` consumes OGC 3D Tiles, and the camera tilts via `pitch`/`bearing` attributes. Converting IFC/CAD upstream: [docs/3d-assets.md](docs/3d-assets.md).

## Programmatic surface

- **`OmMap.*`** — `validate`, `snapshotIR`, `registerLayer`, `registerWidget`, `registerAction`, `registerSource`, `registerFormat`, `registerBasemap`, `configureBasemap`, `configureData`, `getLayerSchema`
- **On a `<om-map>` element** — `ready` (promise), `flyTo(coords, zoom?)`, `setLayerVisible(id, bool)`, `getLayers()`, `emit(action, payload)`; `document.querySelector("om-map")` is fully typed
- **`MapController`** — the framework-grade programmatic front-end (typed `LayerDescriptor`s → the same reconcile core, no DOM manifest): `setLayers`, `watch`, `emit`, camera methods, `injectPick`, `ready`. The React adapter rides it; usable directly from vanilla TS or other frameworks
- **Testing** — `mountForTest`, and imports are SSR-safe (importing in Node/jsdom never touches browser globals)

## Not implemented yet (honestly)

Mapbox GL basemaps, depth-interleaved 3D compositing, globe projection, SSE transport, multi-field filters, `dblclick` behaviors, the `transform` data pipeline, the typed fluent builder, and stories/draw as React components (both work via the HTML manifest).

## Going deeper

| | |
|---|---|
| [docs/react.md](docs/react.md) · [docs/basemaps.md](docs/basemaps.md) · [docs/testing.md](docs/testing.md) · [docs/live-data.md](docs/live-data.md) · [docs/3d-assets.md](docs/3d-assets.md) · [docs/stories.md](docs/stories.md) | Consumer guides |
| [llms.txt](llms.txt) | The agent-facing quick reference |
| `skills/onlymapjs` | Installable LLM skill for OnlyMapJS authoring |
