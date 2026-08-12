<p align="center">
  <img src="https://raw.githubusercontent.com/NikaGeospatial/onlymapjs/main/onlymapbanner.png" alt="OnlyMapJS" width="100%">
</p>

# OnlyMapJS

[![npm version](https://img.shields.io/npm/v/%40nika-js%2Fonlymap?logo=npm&color=cb3837)](https://www.npmjs.com/package/@nika-js/onlymap)
[![npm downloads](https://img.shields.io/npm/dm/%40nika-js%2Fonlymap?color=8956ff)](https://www.npmjs.com/package/@nika-js/onlymap)
[![license](https://img.shields.io/badge/license-free%20for%20non--commercial-2f8fa6)](LICENSE.md)
[![docs](https://img.shields.io/badge/docs-nikaplanet-003646)](https://docs.nikaplanet.com/onlymap/overview)
[![examples](https://img.shields.io/badge/examples-live%20gallery-8956ff)](https://onlymap.nikaplanet.com/)

**[▶ Browse over 50 runnable examples](https://onlymap.nikaplanet.com/)** — heatmaps, choropleths, 3D terrain, live streams and map stories, each with copyable source.

OnlyMapJS is a map rendering and visualization library for web, desktop, and mobile apps. With support for popular frameworks like React, it integrates seamlessly into your existing components via a robust two-way interface for custom map behavior; overlays, charts, and finely controlled story-map animations are all first-class supported alongside 30+ data layer types. Built-in GPU acceleration also means it scales very well for both 2D and 3D use-cases. It is both human and AI agent-readable by design, and troubleshooting is effortless with a compile-time validator and runtime error debugging tools.

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

  <om-overlay id="detail" anchor-from="selection" selection-type="click" visible="false">
    <div><b>{{place}}</b> — M {{magnitude}}</div>
  </om-overlay>
  <om-behavior on="click" layer="quakes" action="show-overlay" target="detail"></om-behavior>
</om-map>
```

That's a complete app: a no-token MapLibre basemap, data-driven colors and sizes, a legend, and a click-for-details popup. Edit any attribute on the live DOM and the map updates — the manifest *is* the state.

It's also designed to be written **by AI agents**: HTML is a reliable generation target, [`llms.txt`](llms.txt) teaches the format, and `OmMap.validate()` returns structured errors **and warnings** with actionable fixes — a real feedback loop instead of a blank canvas (heed both: an "unknown attribute" warning means a prop is being silently dropped).

> ⚠️ **Status: beta.** Proprietary — free for non-commercial use with attribution; commercial licensing terms are in [LICENSE.md](LICENSE.md). APIs may still move before 1.0.

## Why not deck.gl directly?

deck.gl is the best WebGL data-visualization engine there is — and OnlyMapJS is built on it, not against it. What it replaces is everything *around* deck.gl that every project rebuilds by hand:

| | Raw deck.gl | OnlyMapJS |
|---|---|---|
| Setup | `new Deck({...})`, canvas + basemap sync wiring | one `<om-map>` element (or `<OmMap>` in React) |
| State | your reducers/stores drive `setProps` | the manifest **is** the state — edit an attribute, the map reconciles; undo/redo built in |
| Data loading | fetch + parse + reload yourself | `data="…"` — GeoJSON, CSV, Arrow/GeoArrow, Shapefile, KML, GPX, FlatGeobuf, GeoParquet, CityJSON, WebSocket streams, polled REST, tiled XYZ/vector (`TileLayer`/`MVTLayer`); GeoTIFF/COG rasters via `COGLayer`, chunked Zarr/GeoZarr via `ZarrLayer`; geotagged drone JPEGs via `ImageOverlay` |
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

Then `npx @nika-js/onlymap init` wires up VS Code IntelliSense and `!`-prefixed manifest snippets for your project. The library ships with 1,083 unit/behavioral tests and 62 Playwright GPU tests.

The [examples](https://github.com/NikaGeospatial/onlymapjs/tree/main/examples) are the best tour: widgets, behaviors & overlays, basemaps, columnar/Arrow data, manual drawing, 3D models, scene lighting (with the native lighting widget), DEM terrain, a live WebSocket ship feed, and a polled driver fleet.

## The manifest

A handful of elements, one rule: **attributes are kebab-case versions of deck.gl props** (`radius-units` → `radiusUnits`), and `get-*` attributes are data-driven accessors.

| Element | Role |
|---|---|
| `<om-map>` | The map. `center`, `zoom`, `pitch`, `bearing`; `basemap` takes a free preset (`positron`, `liberty`, `dark-matter`, `osm`, …), a style URL, or `"none"` (standalone canvas) — and switches **live**; `validate` for a live on-page error panel. Give it a height: a custom element is `display:inline` by default, so the library injects a `display:block` default (fills a sized parent, else a 400px floor) to keep a bare map visible, but set an explicit height (`om-map { height: 100vh }`) for real layout — any height you set wins outright, including one below the floor. A map that still collapses warns in the console; `hidden` and `display:none` maps stay hidden and stay quiet. |
| `<om-layer>` | Any of **37 layer types** by name — all of deck.gl's core, geo, aggregation, and mesh layers (Scatterplot, GeoJson, Arc, Path, Heatmap, Hexagon, Trips, Tile, Tile3D, Scenegraph, …) plus the built-in `PopupLayer` for WebGL badges/labels at scale, the native `COGLayer` for GeoTIFF rasters, `ZarrLayer` for chunked Zarr/GeoZarr rasters, `ImageOverlay` for georeferenced drone JPEGs, and `BIMLayer` for BIM source files (`.ifc` today) loaded straight in the browser, no pre-conversion step. `id` required; `label`/`color` feed the legend. |
| `<om-widget>` | UI panels. Built-ins: `legend` (symbology-aware: color scales render as gradient ramps or class ranges, categorical ternaries as discrete palettes), `layer-switcher`, `basemap-switcher`, `lighting`, `clip-box`, `zoom-controls`, `undo-redo`, `scale-bar` (metric/imperial/nautical `units`), `attribution`, `filter`, `draw` (point/line/polygon sketch capture, GeoJSON save/autosave; `export-3d` adds an "Export 3D" button that clips loaded `Tile3DLayer`/`BIMLayer` content to the drawn footprint and downloads it as a portable GLB — re-framed to a local coordinate frame at the footprint's own centroid, each triangle carrying its own source color as vertex colors, no textures — or, with `export-3d="b3dm"`, the same mesh wrapped for Cesium/3D-Tiles pipelines; only currently-visible 3D Tiles/BIM layers are included — a layer hidden via `visible="false"` or the `toggle-layer` action is skipped, with a distinct console warning for "nothing loaded" vs. "everything hidden"), `measure` (geodesic distance + area + cut/fill volume — live labels, `units` toggle, an `om-measure` readout event; `modes="distance area volume"` adds a footprint-then-extrude tool: outline a polygon, double-click to close it — it turns solid teal, ready — then drag the double-headed arrow gizmo that appears at its centroid up to fill or down to cut, reading out Cut/Fill/Net (signed, fill−cut)/Total (unsigned, cut+fill) volume plus Area/Perimeter, each labelled with its own sign convention. The math is a REAL per-cell grid integration: closing a footprint bulk-loads its covering DEM tiles, lays a metric grid in a local tangent frame at the ring centroid (cell size = the DEM's ground-sample distance; scanline point-in-polygon; bilinear, tile-seam-correct sampling; worker-offloaded), and integrates terrain-vs-base per cell — mixed cut AND fill within one footprint on undulating ground, with a published ±error (per-cell cellArea × 1.5 × GSD, summed per side), the cell size used, and a no-data warning all carried on the `om-measure` readout (`cellSizeM`/`gsdM`/`cutErrorM3`/`fillErrorM3`/`nodataFraction`). A `base-surface` attribute picks the reference surface: `custom` (default — the gizmo's draggable target plane), or boundary-derived stockpile strategies with no gizmo (`triangulated` boundary TIN, `plane` least-squares fit, `lowest`/`highest`/`average`). On `custom`, the extruded prism's own boundary hugs each corner's real ground elevation by default (so it doesn't visibly float above or sink below sloped terrain) — a "Flat target plane" toggle button appears above the readout once a footprint closes, switching that rendering to a single level plane instead (a rendering choice only; the underlying cut/fill numbers were already computed against one flat target elevation either way). Requires `terrain` on `<om-map>` — validation warns if `volume` is in `modes` with none (without terrain a flat-plane fallback runs, with no error figures — nothing honest to quote). A `profile` attribute alongside `modes` — not a mode of its own — samples elevation around a volume footprint's own perimeter as it's drawn and closed, live, and dispatches it on `om-measure`'s `profileSeries` field for a `dynamic-chart` widget to plot. Each sample is `{x: distance-from-start-m, y: elevation-m}`, and samples that ARE one of the drawn footprint's own corners additionally carry `vertexIndex` (0-based, in draw order) — so a chart can mark the real corners instead of every interpolated sample, and the widget's built-in profile chart marks each corner, labelling the first `1 · Start`. The map badges the first two vertices in draw order (`1 · Start`, `2`), which states the ring's direction outright — a start marker alone leaves clockwise vs counter-clockwise ambiguous, and the two wind to mirror-image profiles. Two badges is the minimum that fixes a direction and a constant cost regardless of how many corners the footprint has. Also volume-only: `deadband` (m³) zeroes out a Cut/Fill figure below the threshold, filtering drag noise near zero height (Cut/Fill/Net/Total are always RAW geometric volumes — deliberately unaffected by `swell`/`shrink`, so they keep answering "does this reach target elevation" regardless of what material's configured); `density` (t/m³ metric, lb/yd³ imperial) and `swell`/`shrink` (multipliers, default 1×) instead populate a separate Material section, standard Bank/Loose/Compacted earthworks convention — Adjusted Cut = raw × swell (loose/haul volume, bigger — excavating adds air voids), Adjusted Fill = raw ÷ shrink (loose/borrow volume needed, also bigger — the raw fill is already the compacted target void), plus Cut/Fill tonnage computed from the raw (not adjusted) volume, since swell/shrink change volume, not mass; the section only appears once at least one of `density`/`swell`/`shrink` is actually configured, no separate toggle. A `stale` field on the `om-measure` readout flags the brief window between a footprint committing and its elevation sample resolving, so a consumer doesn't read numbers left over from a prior footprint as current), `vega-lite` (live charts bound to a layer's data), `dynamic-chart` (the same Vega-Lite rendering, but data-driven by a live DOM event instead of a layer — `on="<event-name>"` + `series-field="<name>"` reads `event.detail[seriesField]` as the chart's `values` on every matching event, redrawing at a fixed `width`; a feature "freezes" it for free by simply omitting that field the next time it fires, no separate pause API needed), and the BIM set `ifc-browser` / `feature-inspector` / `ifc-loader` / `ifc-clash`. Or write your own inline with HTML + a `<script type="om/widget">`. Adjacent compact button widgets (`zoom-controls`, `undo-redo`, `widgets-toggle`) **auto-cluster** into one control group (opt out per widget with `cluster="false"`), and `<om-map widgets-hidden>` / the `set-widgets-visible` action / `<om-widget type="widgets-toggle">` hide all authored chrome without destroying it — provider attribution and the license badge never hide. **Placement is managed**: `position` takes one of 8 logical, RTL-aware slots (`top-start`, `top-center`, `top-end`, `center-start`, `center-end`, `bottom-start`, `bottom-center`, `bottom-end`; legacy corner names alias) — same-slot widgets stack with flush edges and a shared gap, `order` sets in-slot ordering, and `position="manual"` opts out entirely (a plain block you style yourself, even outside the map). At map widths ≤640px, managed widgets automatically move into accessible top/end/bottom/start drawers; `fold="never"` keeps an essential control out, `widgets-fold="off"` disables folding, and `--om-widget-fold-breakpoint` changes the map-width threshold. Provider attribution is an in-flow member of `bottom-end` and the license badge of `bottom-start`, so neither covers a widget. A slot dims automatically while an open popup covers it (`widgets-dim="off"` to disable), except slots containing required chrome. Themeable from plain page CSS via custom properties: `om-map { --om-widget-bg: #111827; --om-widget-fg: #f9fafb; }` (also `-muted`, `-border`, `-hover-bg`, `-accent`), plus layout tokens (`--om-widget-inset-x/-y`, `--om-widget-gap-x/-y`, `--om-widget-opacity`, `--om-widget-radius`) or the no-CSS sugar `<om-map widget-style="gap:10 opacity:0.9">`. |
| `<om-overlay>` | Rich HTML anchored to a map location — a static `anchor="[lng, lat]"`, the current selection, or a feature's own geometry via `anchor-layer`/`anchor-feature-id`. Selection-anchored overlays scope with `layer` (one layer's picks) and `selection-type="click"`/`"hover"` (one pick type — give a click-opened popup `selection-type="click"` so hovering elsewhere doesn't drag it along). `{{field}}` interpolates the picked feature, HTML-escaped by default; `{{z}}` is a real depth-picked elevation when some layer under the cursor set `pickable="3d"` (terrain does this itself, so hovering the ground always has one) — empty otherwise, never a misleading 0. `clip-to-map` (opt-in) hides the overlay when its own box would spill past the map viewport, not just when its anchor leaves — for small transient tips that track the cursor, where an overhanging box would otherwise inflate the page's scroll overflow and cause visible view jitter. |
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
get-text="formatDate($time, 'datetime', 'UTC')"
```

Built-ins: `scale()` (types: `sequential`, `diverging`, `threshold`, `sqrt`, `log`, `pow` — explicit `domain=` required), `colorRamp()`, `clamp()`, `lerp()`, `formatDate()`, and `Math.*`. `formatDate(value, style?, timeZone?)` turns epoch-millisecond or ISO values into readable labels; styles are `date`, `datetime` (default), `time`, and `iso`, with `UTC` as the default zone (`local` or an IANA zone such as `Asia/Singapore` are explicit alternatives). Multi-line accessors go in a `<script type="om/accessors">` block; genuinely arbitrary JS needs an explicit `js` opt-in on the layer. Untrusted (agent-written) expressions are safe by construction: the compiler is an AST whitelist, not an eval.

Date-valued filter sliders use the same contract without a custom widget:

```html
<om-layer id="quakes" type="GeoJsonLayer" data="./quakes.geojson"
          filter-field="time" filter-range="[1782889284760,1785480717910]"></om-layer>
<om-widget type="filter" layer="quakes" field="time"
           format="date" date-style="datetime" time-zone="UTC"></om-widget>
```

Numeric timestamps are always epoch **milliseconds**, never guessed as seconds. Invalid date values render as an empty label rather than crashing an accessor or widget.

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
| **Zarr / GeoZarr raster** | `<om-layer type="ZarrLayer" src="./x.zarr" variable="temp" select="time=0" colormap="viridis" min="…" max="…">` | Chunked N-dimensional arrays (climate/weather grids, datacubes) rendered on the GPU (lazy chunk; built on `@developmentseed/deck.gl-zarr` + zarrita). Pin non-spatial dims with `select`; GeoZarr stores georeference themselves, a plain Zarr takes manual `bounds`/`crs`/`spatial-dims`; `min`/`max`/`colormap` reuse the COG pipeline. `src` can be any absolute URL — an external/remote store needs no server setup, but must be CORS-enabled (fetched directly in the browser) and public (authenticated stores are a follow-up) |
| **Drone JPEG image overlay** | `<om-layer type="ImageOverlay" src="./survey.jpg" georeference="exif">` | Reads GPS, relative altitude, camera, focal length, and DJI gimbal XMP; computes a WGS84 footprint, bakes yaw/roll into the pixels, and renders through `BitmapLayer`. Persist the processed image plus returned bounds for reloads — see [docs/image-overlays.md](docs/image-overlays.md) |
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

Dashed lines are one attribute — `dash="[6, 3]"` (or `dash="6 3"`, plus optional `dash-justified`) on a `PathLayer`/`GeoJsonLayer`/`PolygonLayer`/`TripsLayer` — wired through deck's `PathStyleExtension` under the hood.

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

`ScenegraphLayer` instances glTF/GLB models at coordinates (no three.js, no loader wiring), `Tile3DLayer` consumes OGC 3D Tiles, `GeoJsonLayer` extrudes polygons (`extruded get-elevation="$height"`), and the camera tilts via `pitch`/`bearing` attributes. Terrain is one attribute: `<om-map terrain="terrarium">` raises a real DEM surface (keyless AWS tiles; `mapterhorn` keyless too, paired with a CARTO Positron drape by default; `maptiler-terrain` keyed; or a bring-your-own `{z}/{x}/{y}` DEM URL + `terrain-decoder`), geographic layers drape onto it automatically (per-layer `terrain="drape|offset|off"` overrides; 3D models sit ON the surface), `terrain-exaggeration` scales the relief, and `terrain-texture` drapes imagery. Terrain replaces an active basemap while on (flat canvas vs raised surface) and restores it when off. **BIM models require explicit terrain**: a georeferenced model's absolute elevation only means anything against a DEM surface, and the library never writes attributes for you — a model that resolves real elevation on a map without a `terrain` attribute raises an error through the validation channel at load time (any authored value satisfies it, including an explicit `terrain="off"` for flat-ground siting). When terrain IS active, `BIMLayer` automatically re-plants itself at its file's own `IfcMapConversion.OrthogonalHeight` (its real absolute elevation) instead of the local Z≈0 a flat basemap expects — no attribute to author, it just lands on the surface. Scene lighting is declarative: `<om-map lighting="daylight">` (presets `daylight`/`studio`/`flat`/`custom`, tuned via `lighting-ambient`, `lighting-sun`, `lighting-sun-azimuth`/`-elevation`, or `lighting-sun-date` for a solar-position sun) — attribute-backed, so lighting changes are undoable and story-steppable via the `set-lighting` action. `<om-widget type="lighting">` gives users native preset radios + tuning sliders over the same attributes. Converting IFC/CAD upstream: [docs/3d-assets.md](docs/3d-assets.md).

**Clip box.** `<om-map clip-box-min="[lng,lat,elev]" clip-box-max="[lng,lat,elev]">` cuts a real axis-aligned 3D box through the whole scene — every layer is clipped by default (`clip="off"` opts a layer out), `clip-box-invert` shows outside the box instead of inside, and `clip-box-highlight` dims clipped-out geometry instead of discarding it (a non-destructive preview). Works on any layer type, including georeferenced `Tile3DLayer`/`BIMLayer` content, so a dense BIM scene can be cut open to see what's inside. Attribute-backed (undoable, story-steppable) via the `set-clip-box` action; `<om-widget type="clip-box">` gives users the same six numeric fields plus invert/highlight toggles. v1 is axis-aligned only — rotated boxes are a documented follow-up.

**XY snapping**, for draw/measure vertex capture. `<om-map snap="vertex edge midpoint" snap-tolerance="12">` (pixels, default 12) refines whatever deck already picked under the cursor to the nearest vertex, edge, or edge midpoint of that feature's own geometry — a two-stage design, not a spatial index: deck's own hover/click pick narrows to one feature every frame for free, and only THAT feature's geometry gets searched, on the CPU, when snapping is on. Applies to every vector layer by default (`snap="off"` opts a layer out, mirroring clip box's own default) and to a BIMLayer's own edge/crease overlay — its real wall corners and edges, converted from the model's local mesh coordinates back to `[lng, lat]` automatically, so a drawn footprint can snap onto an actual building rather than free-clicking near it. Vertex beats midpoint beats edge when more than one is in range. Hold Space to place a point nearby without snapping (standard CAD/GIS convention); a small "Snapped: …" tip shows which agent fired. XY only — a snapped vertex takes the tolerance-matched feature's horizontal position, not its exact elevation (drawn geometry still drapes onto terrain the normal way). See `examples/features/widgets/3d-snapping-cutting-tools.html`.

**Per-element picking on 3D Tiles (BIM/photogrammetry).** `pickable="3d"` (instead of a bare `pickable`) runs deck's depth-pick pass, so a click/hover's coordinate carries a real 3rd (elevation) component instead of the ray∩z=0-plane guess a flat pick gives you — needed for any tool that reads *where in 3D* you picked, not just *what*; terrain sets this on itself automatically. A `pickable` `Tile3DLayer` picks a whole tile; adding `pick-features` picks an individual ELEMENT — a wall, a window, one IFC product — and the `selection` carries that element's `featureId`, `properties` and `class`, resolved from the tile's own `EXT_mesh_features` + `EXT_structural_metadata` (`feature-id-property` selects the ID set, default `_FEATURE_ID_0`). Isolate/hide/ghost are declarative and mirror the vector filter vocabulary — `feature-filter-field="component"` names the metadata field, then `isolate-features`/`hide-features`/`ghost-features` take JSON value lists (`ghost-opacity` tunes the fade); hiding is a shader discard, so a hidden element also stops being pickable and you can select what's behind it, and `isolate-features` is exclusive (anything unlisted is hidden). Because they're attributes they're undoable and story-steppable. Underneath, `feature-styles` recolours, fades or highlights elements by feature ID — an array indexed by id of `{color, strength, opacity}` — uploaded as a small lookup texture, so restyling costs no refetch and no re-tesselation. IDs stored per texel (how photogrammetry classification ships) are sampled per FRAGMENT, so element boundaries are pixel-sharp rather than snapped to triangle edges. Multi-material models fan out correctly (glTF allows one material per primitive, so a five-material house is five primitives and a real IFC export is often dozens); only genuinely instanced i3dm content falls back to tile-granularity picking. Two limits, stated plainly: texture-backed IDs need `load-options` with `gltf.loadImages`/`loadBuffers` **and** `image: {"type": "data"}` (without it loaders.gl reads the whole ID texture back through a canvas once per vertex and the tileset takes minutes to appear); and `opacity` below 1 currently blanks the model, so use `strength` to tint for now. See `examples/features/terrain-3d/inspect-a-bim-model.html` (per-element picking, isolate/hide/ghost, the model tree) and `examples/features/widgets/3d-snapping-cutting-tools.html` (`pickable="3d"` with `{{z}}`, the clip box, region export and snapping).


**The BIM widgets.** Three built-ins turn a `pick-features` tileset into a usable model browser without page JS. `ifc-browser` (renamed from `ifc-legend`, which still works — it browses a model, it doesn't explain symbology) groups the model by any property-table field (`fields="ifcClass material container spatialPath"`), counts each value, and gives every row I/H/G buttons that write `isolate-features`/`hide-features`/`ghost-features` — so the panel is a UI over the attributes, and everything it does is undoable and story-steppable; it keeps the companion outline layer's `filter-categories` in step too, since hidden elements would otherwise leave their edges behind. It also offers whichever **model trees** the file supports — spatial (IfcSite → IfcBuilding → IfcStorey), type, system, and classification — each expandable, counts aggregated upward, the same I/H/G on every node so isolating a storey, a duct system or a CCS code reaches everything beneath it. Spatial isn't privileged: on a real Danish project the classification tree covered 3,415 elements to spatial's 660. A tree isn't a second mode or a second widget — it's a group-by on a metadata column, which is why it reuses the visibility attributes untouched (and why there's one browser per layer: those attributes are single-valued). `loadIfc` extracts every hierarchy a model has and emits a column only when the file populates it, so a tree that would render empty is never offered. `feature-inspector` (renamed from `ifc-inspector`, which still works — its body is generic property-row rendering with no IFC dependency, so it works unchanged on a non-IFC `pick-features` layer) shows the picked element's properties (`fields="ifcClass material container netVolume"`). `ifc-loader` is a drop zone that parses an `.ifc` in the browser and builds both layers for it; add `federate` and one drop zone accepts SEVERAL models into a co-registered scene, each with its own visibility toggle — the shape coordination tools use, because a real project has architecture, structure, mechanical, electrical and plumbing rather than two. `ifc-clash` compares any two loaded models. Colour is a question, not decoration: `feature-color-by` colours categorically by a field, `feature-color-scale` graduates over a numeric one, `feature-palette` and `feature-color-strength` tune them — and setting *neither* is the default, leaving the model in its own IFC surface colours. Widget scripts reach the same data through `ctx.features(layerId)` (the decoded property table) plus the `features` watch token, which fires when the table decodes off the first tile.

**Clash detection, coarse and honest.** `<om-widget type="ifc-clash">` flags element pairs from two co-registered models whose bounding boxes interpenetrate, colours both sides, and flies to the centre of each overlap. Results are grouped by element the way coordination tools report them — one wall crossing four ducts is one row, not four — with a highlight switch and an isolation mode (`Dim Other` / `Hide Other`, Navisworks' own terms) so the pair you selected is the only thing that reads. On a real architecture-vs-HVAC pair it finds 1,443 clashes across 9.6M candidate combinations in ~96 ms, entirely in the browser.

It is deliberately **not** Navisworks. An axis-aligned box test over-reports anything diagonal, and it cannot tell a resolved penetration from a collision: on that same pair, 676 of the results are air diffusers sitting inside ceilings, which is how buildings work. Treat the number as *"here are the places two disciplines occupy the same box — go look"*, not as a defect list. Persisting and sharing results is what BCF exists for and is not attempted here.

**In-browser IFC.** `loadIfc(bytes)` parses an `.ifc` with web-ifc (WASM) and returns a 3D Tiles model held entirely in memory — nothing uploaded, nothing written to disk. Because the output *is* a tileset, per-element picking, styling, `site-*` and isolate/hide/ghost work on it unchanged. It returns `tilesetUrl`/`edgesUrl` blob URLs, the property table, the georeferencing (`lonLat`, `heading`, `scale`, and a `headingSource` that distinguishes a real reading from an assumption), per-phase `timings`, and a `revoke()` you must call when swapping models. web-ifc is MPL-2.0 and is *not* a package dependency — it's dynamic-imported from unpkg on first use, so it never reaches the bundle and pages that never open an IFC pay nothing (measured: the IFC chunk is 8.5 KB gzipped and contains only the URL). **For offline, air-gapped or strict-CSP deployments**, `npm run vendor:web-ifc public/vendor/web-ifc` copies the four files you serve yourself, then `wasm-path="/vendor/web-ifc/"` on the loader — 1.37 MB gzipped of *static assets*, with the JS bundle unchanged. Note that web-ifc is only one network dependency: a georeferenced model also switches a basemap on, so an offline page wants `basemap="none"` and `telemetry="off"` too. See `examples/features/terrain-3d/inspect-a-bim-model.html`.
**Georeferencing is declarative too.** `site-origin="[lng, lat]"` (optionally `[lng, lat, elevation]`), `site-heading` (a bearing, degrees clockwise from true north) and `site-scale` place a model from the markup instead of baking a position into the tileset — `site-origin` overrides whatever the root transform carries, and rotation/scale pivot on the model's own anchor so a heading change spins the building about itself. They work on `Tile3DLayer` and on `PathLayer` (whose paths are then local east/north/up metres), which is what lets an IFC mesh and its outline overlay move together. This matters more than it sounds: authoring tools ship a default project location and a default is indistinguishable from a survey — the buildingSMART Medical-Dental Clinic sample carries Revit's Boston default, the Duplex a Chicago city-centre point — while `IfcMapConversion` is absent from most IFC2x3 exports and `TrueNorth` is routinely unset. Being attributes, corrections are undoable and story-steppable rather than a reconversion. Whenever a model resolves anything short of a real `IfcMapConversion` — `IfcSite` coordinates or no georeference at all — `BIMLayer` and `ifc-loader` raise a structured `"warning"` through the same validation channel other `om-layer` errors use (the `validate` on-page panel, `om-validation-error`'s `detail.warnings`), rather than only a status-line sentence a human has to notice; it never fails the map (`valid` stays `true`), it just names the layer and points at `site-origin`/`site-heading` as the fix. See `examples/features/terrain-3d/inspect-a-bim-model.html`.

## Programmatic surface

- **`OmMap.*`** — `validate`, `snapshotIR`, `resolveImageOverlay`, `registerLayer`, `registerWidget`, `registerAction`, `registerSource`, `registerFormat`, `registerBasemap`, `configureBasemap`, `configureData`, `configureTelemetry`, `configureLicense`, `getLayerSchema`
- **`@nika-js/onlymap/deck`** — the bundled deck.gl classes (`CompositeLayer`, `TileLayer`, …) for building custom layer types: shims must extend the same class hierarchy the core renders with, not a second installed deck.gl copy. Recipe: [docs/custom-layers.md](docs/custom-layers.md)
- **On a `<om-map>` element** — `ready` (promise), `flyTo(coords, zoom?)`, `setLayerVisible(id, bool)`, `getLayers()`, `emit(action, payload)`, `snapshot(opts?)` (canvas-only PNG of basemap + layers at device pixels — DOM widgets/overlays and provider attribution are NOT captured, so exports must render credits themselves; `{as: "blob"}` for files, default dataURL); the `om-view-changed` event fires once the camera settles (debounced; `detail` = `{longitude, latitude, zoom, pitch, bearing, origin}`, where `origin` is `"user"` for gesture-driven bursts vs `"programmatic"` for API/story moves — the echo-suppression signal for state sync) — the camera-persistence hook; the `om-map-point` event (`detail = {coordinate: [lng,lat]|null, kind: "click"|"hover"}`) fires on every click/hover with the map coordinate, including empty-map clicks picks discard — the hook for custom capture tools the built-in draw widget doesn't cover; the `om-tileset-load` event (`detail = {layerId, tileset}`) surfaces a `Tile3DLayer`'s live deck `Tileset3D` for tools that need the real tileset (e.g. region export), not the IR; `document.querySelector("om-map")` is fully typed
- **`MapController`** — the framework-grade programmatic front-end (typed `LayerDescriptor`s → the same reconcile core, no DOM manifest): `setLayers`, `watch`, `emit`, camera methods, `injectPick`, `ready`, `snapshot`, an `onViewChange(view, origin)` option (the `om-view-changed` twin), plus `onMapPoint` / `onTilesetLoad` options (the `om-map-point` / `om-tileset-load` twins). The React adapter rides it; usable directly from vanilla TS or other frameworks
- **`getStore(token)`** — the external-store contract: per-token `{subscribe, getSnapshot}` stores (`viewport`/`selection`/`layers`/`data:<id>`) with cached immutable plain-data snapshots and `origin` tagging — directly consumable by `useSyncExternalStore` (the React adapter's own hooks ride it), MobX autoruns, Redux listeners, Zustand mirrors. ~20-line integration-tested recipes for Redux Toolkit, MobX/mobx-keystone, Zustand, and Jotai: [docs/external-stores.md](docs/external-stores.md)
- **Testing** — `mountForTest`, and imports are SSR-safe (importing in Node/jsdom never touches browser globals)

## Free tier & licensing

**Non-commercial use is free with attribution** (LICENSE.md §3); commercial use requires a license. Without a license key, maps run on the **free plan**: up to **5 layers** and **25,000 rows per layer** (20 MB per data fetch), with a small "OnlyMap by NIKA. Free for non-commercial use." badge in the corner. Exceeding a limit never breaks the map. Past the **layer** cap the extra layer simply doesn't render; past the **row** cap the layer renders its first 25,000 rows (an arbitrary subset, in source order) rather than nothing, with a dismissible on-map notice saying the data is partial — so a capped map is still useful to look at without ever pretending it's complete. Either way the validation stream/error panel tells you exactly which limit, why, and how to lift it. **Limits apply only on hosted http(s) pages** — in a dev context (localhost, `file://`, or any non-web scheme) every cap lifts so you can build without friction; the attribution badge stays in all contexts. The exemption is a technical convenience, not a license grant: commercial deployment — hosted **or** shipped inside a packaged app — requires a commercial key regardless of whether the technical gates fired (LICENSE.md §3).

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

Mapbox GL basemaps, depth-interleaved 3D compositing, globe projection, SSE transport, multi-field filters, `dblclick` behaviors, the `transform` data pipeline, the typed fluent builder, and stories/draw as React components (both work via the HTML manifest). On `pick-features`: instanced (i3dm) tiles keep tile-granularity picking, and `feature-styles`' `opacity` below 1 is still being validated. On BIM: clash detection is bounding-box only (no mesh-level test, and it cannot tell a resolved penetration from a collision), there is no BCF export, no equivalent of Navisworks' Auto Reveal, and prepared tilesets converted before the `bbox*` columns existed cannot take part in a clash pass — `strength` tinting and `opacity: 0` (hide, a shader discard) work. On the measure widget's `volume` mode: the per-cell grid integration measures against the map's active terrain DEM only — measuring against an imported design surface or a previous survey (period-over-period reconciliation) and a cut/fill heat-map overlay are not implemented yet, and a snapped footprint vertex takes the matched feature's horizontal position only — its exact elevation is not threaded through (see **XY snapping** above).

## Going deeper

| | |
|---|---|
| [docs/react.md](docs/react.md) · [docs/basemaps.md](docs/basemaps.md) · [docs/testing.md](docs/testing.md) · [docs/live-data.md](docs/live-data.md) · [docs/image-overlays.md](docs/image-overlays.md) · [docs/3d-assets.md](docs/3d-assets.md) · [docs/stories.md](docs/stories.md) · [docs/telemetry.md](docs/telemetry.md) | Consumer guides |
| [CHANGELOG.md](CHANGELOG.md) | Version-by-version release notes |
| [llms.txt](llms.txt) | The agent-facing quick reference |
| `skills/onlymapjs` | Installable LLM skill for OnlyMapJS authoring |
