<p align="center">
  <img src="https://raw.githubusercontent.com/NikaGeospatial/onlymapjs/main/onlymapbanner.png" alt="OnlyMapJS" width="100%">
</p>

# OnlyMapJS

[![npm version](https://img.shields.io/npm/v/%40nika-js%2Fonlymap?logo=npm&color=cb3837)](https://www.npmjs.com/package/@nika-js/onlymap)
[![npm downloads](https://img.shields.io/npm/dm/%40nika-js%2Fonlymap?color=8956ff)](https://www.npmjs.com/package/@nika-js/onlymap)
[![license](https://img.shields.io/badge/license-free%20for%20non--commercial-2f8fa6)](LICENSE.md)
[![docs](https://img.shields.io/badge/docs-nikaplanet-003646)](https://docs.nikaplanet.com/onlymap/overview)

**Interactive WebGL maps from plain HTML.** OnlyMapJS is a declarative mapping library built on [deck.gl](https://deck.gl), written in TypeScript, with first-class HTML and React APIs. Write a manifest — layers, widgets, popups, behaviors as custom elements — and it drives deck.gl underneath: rendering, GeoJSON/CSV/Arrow data loading, live updates, GPU picking, MapLibre basemaps, and UI, with no build step and no imperative glue code. If you've wanted a declarative deck.gl wrapper — for a geospatial dashboard, a React mapping component, or a single-file HTML map — that's the entire premise.

```html
<link rel="stylesheet" href="https://unpkg.com/@nika-js/onlymap/dist/onlymapjs.css">
<script type="module" src="https://unpkg.com/@nika-js/onlymap"></script>

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

It's also designed to be written **by AI agents**: HTML is a reliable generation target, [`llms.txt`](llms.txt) teaches the format, and `OmMap.validate()` returns structured errors **and warnings** with actionable fixes — a real feedback loop instead of a blank canvas (heed both: an "unknown attribute" warning means a prop is being silently dropped).

> ⚠️ **Status: v0.2.** Proprietary — free for non-commercial use with attribution; commercial licensing terms are in [LICENSE.md](LICENSE.md). APIs may still move before 1.0.

## Why not deck.gl directly?

deck.gl is the best WebGL data-visualization engine there is — and OnlyMapJS is built on it, not against it. What it replaces is everything *around* deck.gl that every project rebuilds by hand:

| | Raw deck.gl | OnlyMapJS |
|---|---|---|
| Setup | `new Deck({...})`, canvas + basemap sync wiring | one `<om-map>` element (or `<OmMap>` in React) |
| State | your reducers/stores drive `setProps` | the manifest **is** the state — edit an attribute, the map reconciles; undo/redo built in |
| Data loading | fetch + parse + reload yourself | `data="…"` — GeoJSON, CSV, Arrow/GeoArrow, Shapefile, KML, GPX, FlatGeobuf, GeoParquet, CityJSON, WebSocket streams, polled REST, tiled XYZ/vector (`TileLayer`/`MVTLayer`); GeoTIFF/COG rasters via `type="COGLayer"` |
| Accessors | JS functions + `updateTriggers` bookkeeping | `get-*` expressions; update triggers derived automatically |
| UI | build legends/popups/filters from scratch | built-in widgets, overlays, behaviors — declarative |
| Testing | mock WebGL or ship untested | `OmMap.validate`, IR snapshots, headless behavioral harness |
| Escape hatch | — | every deck.gl prop still passes through; custom layers register by name |

If you're comparing React mapping libraries: the React adapter (`@nika-js/onlymap/react`) gives you typed `<OmLayer>` components over the same core, so React owns state and deck.gl's `updateTriggers` gymnastics disappear. And when you need raw deck.gl behavior, every kebab-case attribute maps 1:1 to the underlying prop — it's a wrapper, not a wall.

## Install

```bash
npm install @nika-js/onlymap
```

Or with no build step at all, straight from a CDN:

```html
<link rel="stylesheet" href="https://unpkg.com/@nika-js/onlymap/dist/onlymapjs.css">
<script type="module" src="https://unpkg.com/@nika-js/onlymap"></script>
```

The bare package URL serves `dist/onlymap.standalone.js`, a single-file bundle built for exactly this (jsDelivr too). Use a CDN that serves the package's raw files — **not** a rebundling CDN like esm.sh, which re-splits the bundle into duplicate copies of the deck.gl/luma.gl runtime and breaks every layer's shader compilation.

Then `npx @nika-js/onlymap init` wires up VS Code IntelliSense and `!`-prefixed manifest snippets for your project. The library ships with 630 unit/behavioral tests and 58 Playwright GPU tests.

The [examples](https://github.com/NikaGeospatial/onlymapjs/tree/main/examples) are the best tour: widgets, behaviors & overlays, basemaps, columnar/Arrow data, manual drawing, 3D models, scene lighting (with the native lighting widget), DEM terrain, a live WebSocket ship feed, and a polled driver fleet.

## The manifest

A handful of elements, one rule: **attributes are kebab-case versions of deck.gl props** (`radius-units` → `radiusUnits`), and `get-*` attributes are data-driven accessors.

| Element | Role |
|---|---|
| `<om-map>` | The map. `center`, `zoom`, `pitch`, `bearing`; `basemap` takes a free preset (`positron`, `liberty`, `dark-matter`, `osm`, …), a style URL, or `"none"` (standalone canvas) — and switches **live**; `validate` for a live on-page error panel. Give it a height: a custom element is `display:inline` by default, so the library injects a `display:block` default (fills a sized parent, else a 400px floor) to keep a bare map visible, but set an explicit height (`om-map { height: 100vh }`) for real layout — any height you set wins outright, including one below the floor. A map that still collapses warns in the console; `hidden` and `display:none` maps stay hidden and stay quiet. |
| `<om-layer>` | Any of **34 layer types** by name — all of deck.gl's core, geo, aggregation, and mesh layers (Scatterplot, GeoJson, Arc, Path, Heatmap, Hexagon, Trips, Tile, Tile3D, Scenegraph, …) plus the built-in `PopupLayer` for WebGL badges/labels at scale and the native `COGLayer` for GeoTIFF rasters. `id` required; `label`/`color` feed the legend. |
| `<om-widget>` | UI panels. Built-ins: `legend` (symbology-aware: color scales render as gradient ramps or class ranges, categorical ternaries as discrete palettes), `layer-switcher`, `basemap-switcher`, `lighting`, `zoom-controls`, `undo-redo`, `scale-bar` (metric/imperial/nautical `units`), `attribution`, `filter`, `draw`, `measure` (geodesic distance + area — live labels, `units` toggle, an `om-measure` readout event), `vega-lite` (live charts). Or write your own inline with HTML + a `<script type="om/widget">`. Adjacent compact button widgets (`zoom-controls`, `undo-redo`, `widgets-toggle`) **auto-cluster** into one control group (opt out per widget with `cluster="false"`), and `<om-map widgets-hidden>` / the `set-widgets-visible` action / `<om-widget type="widgets-toggle">` hide all authored chrome without destroying it — provider attribution and the license badge never hide. **Placement is managed**: `position` takes one of 8 logical, RTL-aware slots (`top-start`, `top-center`, `top-end`, `center-start`, `center-end`, `bottom-start`, `bottom-center`, `bottom-end`; legacy corner names alias) — same-slot widgets stack with flush edges and a shared gap, `order` sets in-slot ordering, and `position="manual"` opts out entirely (a plain block you style yourself, even outside the map). At map widths ≤640px, managed widgets automatically move into accessible top/end/bottom/start drawers; `fold="never"` keeps an essential control out, `widgets-fold="off"` disables folding, and `--om-widget-fold-breakpoint` changes the map-width threshold. Provider attribution is an in-flow member of `bottom-end` and the license badge of `bottom-start`, so neither covers a widget. A slot dims automatically while an open popup covers it (`widgets-dim="off"` to disable), except slots containing required chrome. Themeable from plain page CSS via custom properties: `om-map { --om-widget-bg: #111827; --om-widget-fg: #f9fafb; }` (also `-muted`, `-border`, `-hover-bg`, `-accent`), plus layout tokens (`--om-widget-inset-x/-y`, `--om-widget-gap-x/-y`, `--om-widget-opacity`, `--om-widget-radius`) or the no-CSS sugar `<om-map widget-style="gap:10 opacity:0.9">`. |
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
| **CityJSON / CityJSONSeq** | `data="./tile.city.json"` + `extruded get-elevation="$roof_height"` | semantic 3D city models (3DBAG, PLATEAU) → extruded footprints with derived `roof_height`/`eaves_height`/`ridge_height`/`roof_area`; national grids reprojected automatically (NL/CH/DE/JP/AT/SG); `.city.jsonl` streams in as it downloads; lazy chunk — see [docs/3d-assets.md](docs/3d-assets.md#semantic-city-models-cityjson) |
| **GeoTIFF / COG raster** | `<om-layer type="COGLayer" src="./dem.tif" min="0" max="1900" colormap="viridis">` | Cloud-Optimized GeoTIFFs stream tiles by Range request (lazy chunk); min/max restretch + colormap swaps are GPU uniforms, nodata → transparent, legend ramp derives automatically; plain 8-bit RGB COGs need no attributes at all |
| **WebSocket stream** | `data="wss://feed" key="id" flush="250ms" source="myFormat"` | upsert-by-key, burst coalescing, auto-reconnect; decode any format via `OmMap.registerSource` |
| **Polled REST snapshot** | `data="/api/fleet.json" refresh="5s"` | full-snapshot replace per poll; outages keep the last good data |
| **Tiled layer (XYZ / vector)** | `<om-layer type="TileLayer" data="…/{z}/{x}/{y}.png">` or `type="MVTLayer"` | a `{z}/{x}/{y}` `data` template is deck's tile URL — passed through, never fetched as rows; raster `TileLayer` gets a built-in `BitmapLayer` renderer, `MVTLayer` self-renders vector tiles (`get-*` accessors apply to tile features) |
| **Draw store** | `data="draw:sketch"` | live in-memory GeoJSON feature store written by `<om-widget type="draw" target="sketch">` |

Private endpoints: `OmMap.configureData({ headers, credentials, fetch })` — applied to every fetch including refreshes. Credentials stay out of markup by design. Full guide: [docs/live-data.md](docs/live-data.md).

### Interaction

Built-in actions wire to picks, widget buttons (`data-emit`), or script (`ctx.emit`) with one shared payload contract: `show-overlay`, `hide-overlay`, `show-tooltip`, `hide-tooltip`, `toggle-layer`, `highlight-feature`, `zoom-to-feature`, `filter-layer`, `set-basemap`, `zoom-in`, `zoom-out`, `undo`, `redo` — plus `OmMap.registerAction` for your own.

**Undo/redo:** user-facing manifest changes — layer toggles, filter changes, basemap switches, element edits, drawn sketches — are undoable out of the box; the manifest *is* the state, so history is recorded from the DOM itself. Add `<om-widget type="undo-redo">` for buttons, or just press Cmd/Ctrl-Z (Shift-Cmd/Ctrl-Z or Ctrl-Y to redo). Camera moves, hover effects, and story playback are deliberately not undo steps.

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

## Quick-start guide

### Use OnlyMapJS with Claude Code and Codex

The public repo includes a portable `onlymapjs` Skill that teaches coding agents the manifest syntax, React adapter, common map patterns, and validation/testing workflow. Install the library in the app you want to map:

```bash
npm install @nika-js/onlymap
```

Then, from that app's repository root, install the Skill for your agent:

```bash
# Claude Code
npx -y skills add NikaGeospatial/onlymapjs --skill onlymapjs --agent claude-code

# Codex
npx -y skills add NikaGeospatial/onlymapjs --skill onlymapjs --agent codex
```

Using both agents in the same repository? Install it for both in one command:

```bash
npx -y skills add NikaGeospatial/onlymapjs \
  --skill onlymapjs \
  --agent claude-code \
  --agent codex
```

Start or restart Claude Code or Codex in that repository, then describe the map you want. Mention the installed Skill explicitly when you want to guarantee it is used:

```text
Use the installed OnlyMapJS skill to build a full-screen map in this project.
Inspect my data before choosing accessors. Add a legend and click details,
include a no-JavaScript fallback, validate the result, and run the relevant tests.
```

For an existing React app:

```text
Use the installed OnlyMapJS skill to add this map to my React app. Use the
@nika-js/onlymap/react adapter, preserve the app's existing state patterns,
and verify the result with the library's headless testing tools.
```

The Skill steers HTML projects toward declarative `om-*` manifests and React projects toward the first-party adapter. It also tells the agent to use `OmMap.validate()`, `OmMap.snapshotIR()`, and the headless harness rather than guessing whether the generated map works.

To inspect the Skill before installing it:

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

Plus `OmMap.snapshotIR(html)` to lock down what a manifest *means* in a snapshot test, and `await mapEl.ready` / the `om-map-ready` event to de-flake browser e2e tests.

**Layout, checked like types.** `npx @nika-js/onlymap check-layout <manifest.html>` audits a page's real rendered widget layout in headless Chromium — no screenshots, no eyeballing: it asserts no widgets overlap, each is hit-testable (not painted under the canvas), each sits in its slot, and same-slot edges are flush, across a viewport-width sweep, emitting structured `{severity, element, message, fix}` diagnostics and exiting 0/1. The same audit is importable as `auditLayout(page)` for your own Playwright suite. Full guide: [docs/testing.md](docs/testing.md).

## 3D

`ScenegraphLayer` instances glTF/GLB models at coordinates (no three.js, no loader wiring), `Tile3DLayer` consumes OGC 3D Tiles, `GeoJsonLayer` extrudes polygons (`extruded get-elevation="$height"`), and the camera tilts via `pitch`/`bearing` attributes. Terrain is one attribute: `<om-map terrain="terrarium">` raises a real DEM surface (keyless AWS tiles; `maptiler-terrain` keyed; or a bring-your-own `{z}/{x}/{y}` DEM URL + `terrain-decoder`), geographic layers drape onto it automatically (per-layer `terrain="drape|offset|off"` overrides; 3D models sit ON the surface), `terrain-exaggeration` scales the relief, and `terrain-texture` drapes imagery. Terrain replaces an active basemap while on (flat canvas vs raised surface) and restores it when off. Scene lighting is declarative: `<om-map lighting="daylight">` (presets `daylight`/`studio`/`flat`/`custom`, tuned via `lighting-ambient`, `lighting-sun`, `lighting-sun-azimuth`/`-elevation`, or `lighting-sun-date` for a solar-position sun) — attribute-backed, so lighting changes are undoable and story-steppable via the `set-lighting` action. `<om-widget type="lighting">` gives users native preset radios + tuning sliders over the same attributes. Converting IFC/CAD upstream: [docs/3d-assets.md](docs/3d-assets.md).

## Programmatic surface

- **`OmMap.*`** — `validate`, `snapshotIR`, `registerLayer`, `registerWidget`, `registerAction`, `registerSource`, `registerFormat`, `registerBasemap`, `configureBasemap`, `configureData`, `configureTelemetry`, `configureLicense`, `getLayerSchema`
- **`@nika-js/onlymap/deck`** — the bundled deck.gl classes (`CompositeLayer`, `TileLayer`, …) for building custom layer types: shims must extend the same class hierarchy the core renders with, not a second installed deck.gl copy. Recipe: [docs/custom-layers.md](docs/custom-layers.md)
- **On a `<om-map>` element** — `ready` (promise), `flyTo(coords, zoom?)`, `setLayerVisible(id, bool)`, `getLayers()`, `emit(action, payload)`, `snapshot(opts?)` (canvas-only PNG of basemap + layers at device pixels — DOM widgets/overlays and provider attribution are NOT captured, so exports must render credits themselves; `{as: "blob"}` for files, default dataURL); the `om-view-changed` event fires once the camera settles (debounced; `detail` = `{longitude, latitude, zoom, pitch, bearing, origin}`, where `origin` is `"user"` for gesture-driven bursts vs `"programmatic"` for API/story moves — the echo-suppression signal for state sync) — the camera-persistence hook; the `om-map-point` event (`detail = {coordinate: [lng,lat]|null, kind: "click"|"hover"}`) fires on every click/hover with the map coordinate, including empty-map clicks picks discard — the hook for custom capture tools the built-in draw widget doesn't cover; the `om-tileset-load` event (`detail = {layerId, tileset}`) surfaces a `Tile3DLayer`'s live deck `Tileset3D` for tools that need the real tileset (e.g. region export), not the IR; `document.querySelector("om-map")` is fully typed
- **`MapController`** — the framework-grade programmatic front-end (typed `LayerDescriptor`s → the same reconcile core, no DOM manifest): `setLayers`, `watch`, `emit`, camera methods, `injectPick`, `ready`, `snapshot`, an `onViewChange(view, origin)` option (the `om-view-changed` twin), plus `onMapPoint` / `onTilesetLoad` options (the `om-map-point` / `om-tileset-load` twins). The React adapter rides it; usable directly from vanilla TS or other frameworks
- **`getStore(token)`** — the external-store contract: per-token `{subscribe, getSnapshot}` stores (`viewport`/`selection`/`layers`/`data:<id>`) with cached immutable plain-data snapshots and `origin` tagging — directly consumable by `useSyncExternalStore` (the React adapter's own hooks ride it), MobX autoruns, Redux listeners, Zustand mirrors. ~20-line integration-tested recipes for Redux Toolkit, MobX/mobx-keystone, Zustand, and Jotai: [docs/external-stores.md](docs/external-stores.md)
- **Testing** — `mountForTest`, and imports are SSR-safe (importing in Node/jsdom never touches browser globals)

## Free tier & licensing

**Non-commercial use is free with attribution** (LICENSE.md §3); commercial use requires a license. Without a license key, maps run on the **free plan**: up to **5 layers** and **25,000 rows per layer** (20 MB per data fetch), with a small "OnlyMap by NIKA. Free for non-commercial use." badge in the corner. Exceeding a limit never breaks the map. Past the **layer** cap the extra layer simply doesn't render; past the **row** cap the layer renders its first 25,000 rows (an arbitrary subset, in source order) rather than nothing, with a dismissible on-map notice saying the data is partial — so a capped map is still useful to look at without ever pretending it's complete. Either way the validation stream/error panel tells you exactly which limit, why, and how to lift it. Limits apply identically everywhere (including localhost — no dev/prod surprises).

A license key lifts all limits and removes the badge:

```html
<om-map license-key="om_live_…">        <!-- keys are publishable & origin-restricted — safe in page source -->
```
```ts
OmMap.configureLicense("om_live_…");     // or once, in code
```

Keys are self-verifying signed tokens (no network round-trip, works offline and in CI) bound to your domains. Licensing: https://www.nikaplanet.com/onlymap.

## Telemetry

The library reports one **deployment-scoped** usage snapshot per map per page load — layer types and counts, widget types, renderer; hostname only, no page URLs, no visitor identifiers, and `headless` (test) maps never report — plus errors caused by the library's own code (own-bundle stack filtering, scrubbed, rate-limited). Reports go to a first-party endpoint, never a third-party domain. Opt out globally with `OmMap.configureTelemetry({ disabled: true })` or per map with `telemetry="off"`. Full schema, rules, and the license disclosure: [docs/telemetry.md](docs/telemetry.md), LICENSE.md §11.

## Not implemented yet (honestly)

Mapbox GL basemaps, depth-interleaved 3D compositing, globe projection, SSE transport, multi-field filters, `dblclick` behaviors, the `transform` data pipeline, the typed fluent builder, and stories/draw as React components (both work via the HTML manifest).

## Going deeper

| | |
|---|---|
| [docs/react.md](docs/react.md) · [docs/basemaps.md](docs/basemaps.md) · [docs/testing.md](docs/testing.md) · [docs/live-data.md](docs/live-data.md) · [docs/3d-assets.md](docs/3d-assets.md) · [docs/stories.md](docs/stories.md) · [docs/telemetry.md](docs/telemetry.md) | Consumer guides |
| [llms.txt](llms.txt) | The agent-facing quick reference |
| `skills/onlymapjs` | Installable LLM skill for OnlyMapJS authoring |
