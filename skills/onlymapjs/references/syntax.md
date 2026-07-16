# OnlyMapJS Syntax Reference

This reference is public-safe and self-contained. Use it when authoring or reviewing OnlyMapJS manifests.

## Import Patterns

Vite/npm project:

```html
<script type="module">
  import "@nika-js/onlymap";
  import "@nika-js/onlymap/onlymapjs.css";
</script>
```

Static CDN page:

```html
<script type="module" src="https://esm.sh/@nika-js/onlymap@0.1.0"></script>
```

Always include `onlymapjs.css` — it carries the MapLibre basemap styles and the no-JS fallback rules (`<om-fallback>` / default banner). For the fallback to work in script-disabled previews it must load without JavaScript: a real `<link rel="stylesheet">` or inlined `<style>` on no-build pages (a bundler-emitted stylesheet is fine in npm projects).

## Elements

### `<om-map>`

Root element. Children are layers, widgets, overlays, behaviors, stories, and an optional fallback.

Common attributes:

- `center="[lng, lat]"`
- `zoom="11"`
- `pitch="55"`
- `bearing="20"`
- `basemap` — a free preset (`liberty`, `bright`, `positron`, `dark-matter`, `voyager`, `osm`; keyed `maptiler-streets|dataviz|satellite` with `basemap-key="…"` or `OmMap.configureBasemap({ maptilerKey })`), `maplibre` (bare demo style), a MapLibre style URL (any scheme fetch supports, including desktop asset protocols; query strings fine), or `none` (standalone canvas). The attribute is live: writing it switches the basemap in place (camera and layers survive). Register more with `OmMap.registerBasemap(name, { style })`.
- `attribution="false"` to opt out of the automatic provider-attribution control (only if you render equivalent credits yourself)
- `validate` to show live validation errors during authoring
- `map-id="<random UUID>"` — identifies the map artifact for usage telemetry (not a visitor id). Include one on new complete pages, freshly generated — never copied from an example; deleting it is the opt-out.
- `telemetry="off"` disables usage telemetry for this map (global: `OmMap.configureTelemetry({ disabled: true })`)
- `license-key="om_live_…"` — lifts the free-plan limits (5 layers, 25k rows per layer) and removes the corner badge; publishable origin-restricted token, safe in page source (or `OmMap.configureLicense(key)` once). Free-plan violations don't break the map: the offending layer isn't rendered and validation names the limit.
- `terrain="terrarium|<preset>|<{z}/{x}/{y} DEM URL>|off"` — 3D elevation surface. `terrarium` is keyless (AWS); `maptiler-terrain` needs `basemap-key`/`configureBasemap`; raw DEM URLs need `terrain-decoder` (`terrarium`, `mapbox-rgb`, or `{rScaler,gScaler,bScaler,offset}` JSON). `terrain-exaggeration` scales relief (1 = true); `terrain-max-zoom` = the provider's REAL tileset cap; `terrain-texture` drapes a `{z}/{x}/{y}` imagery template. Geographic layers drape automatically; per-layer `terrain="drape|offset|off"` overrides (3D-model layers default to `offset`). Terrain REPLACES an active basemap while on (restored when off) — validation warns. Register presets with `OmMap.registerTerrain(name, {...})`; `set-terrain` action + `terrain` watch token; attribute-backed (undoable).
- `lighting="daylight|studio|flat|custom"` — scene lighting for 3D content (extruded polygons, models); absent = deck defaults. Preset seeds values; `lighting-ambient`, `lighting-sun` (intensity; 0 removes the sun), `lighting-sun-azimuth` (° CW from north), `lighting-sun-elevation` (° above horizon), `lighting-camera` (model-inspection fill) override individual fields; `lighting-sun-date` (ISO 8601 or epoch ms) computes the sun from solar position at the map center and wins over azimuth/elevation. Attribute-backed: changes are undoable, and the `set-lighting {lighting, sunAzimuth, …}` action makes lighting story-steppable (`lighting="default"` removes the whole attribute set; a bare preset is a clean reset). `<om-widget type="lighting">` is the native UI. Widget scripts can `watch = ["lighting"]`.
- `headless width="800" height="600"` for test harness use

Events: `om-map-ready` (boot complete; `await mapEl.ready` is the promise twin), `om-validation-error`, and `om-view-changed` — fires once the camera settles after a move (debounced; `detail = {longitude, latitude, zoom, pitch, bearing}`), the hook for persisting the camera. `MapController` takes an `onViewChange` option for the same signal.

`await mapEl.snapshot()` (also on `MapController`) returns a canvas-only PNG dataURL of the scene — basemap + layers composited at device pixels (`{as: "blob"}` for files; `type`/`quality` for jpeg/webp). DOM widgets, overlays, and the provider attribution are NOT in the pixels: exports must render credits themselves. Await `ready` first; headless maps reject.

Example:

```html
<om-map center="[-122.42, 37.77]" zoom="11" basemap="maplibre" validate>
  ...
</om-map>
```

### `<om-layer>`

Declares a deck.gl layer. Required: `id`, `type`.

Core attributes:

- `id="quakes"` — stable identity for behaviors, widgets, tests, stories.
- `type="ScatterplotLayer"` — any bundled layer type.
- `data="./points.json"` — URL, stream, draw store, or omit for inline JSON.
- `label="Earthquakes"` and `color="#b30000"` — legend metadata.
- `pickable` — enable click/hover behaviors.
- `visible="false"` or `opacity="0"` — initial visibility/opacity.

Accessors:

```html
get-position="[$lon, $lat]"
get-radius="$population * 0.001"
get-fill-color="$value > 100 ? [255,0,0] : [0,128,255]"
get-fill-color="scale($depth, sequential, ['#ffffcc','#800026'], domain=[0,700])"
```

`$field` works on flat rows, GeoJSON properties, columnar JSON, CSV/TSV columns, and Arrow point columns.

Smart shorthands:

- `color="#1f9e89"` sets a constant `getFillColor` when no explicit `get-fill-color` exists, and always feeds the legend swatch.
- `radius="6"` sets a constant `getRadius` when no explicit `get-radius` exists.

Transitions:

```html
transition="get-fill-color 800ms, get-radius 400ms"
```

Filtering:

```html
filter-field="magnitude" filter-range="[4, 10]"
```

### Built-In Layer Types

Use the `type` value exactly:

`A5Layer`, `ArcLayer`, `BitmapLayer`, `ColumnLayer`, `ContourLayer`, `GeoJsonLayer`, `GeohashLayer`, `GreatCircleLayer`, `GridCellLayer`, `GridLayer`, `H3ClusterLayer`, `H3HexagonLayer`, `HeatmapLayer`, `HexagonLayer`, `IconLayer`, `LineLayer`, `MVTLayer`, `PathLayer`, `PointCloudLayer`, `PolygonLayer`, `PopupLayer`, `QuadkeyLayer`, `S2Layer`, `ScatterplotLayer`, `ScenegraphLayer`, `ScreenGridLayer`, `SimpleMeshLayer`, `SolidPolygonLayer`, `TerrainLayer`, `TextLayer`, `Tile3DLayer`, `TileLayer`, `TripsLayer`.

Common choices:

- Points: `ScatterplotLayer`, `IconLayer`, `TextLayer`, `PopupLayer`.
- Lines/routes: `PathLayer`, `LineLayer`, `ArcLayer`, `TripsLayer`.
- Polygons/choropleths: `GeoJsonLayer`, `PolygonLayer`.
- Aggregation: `HeatmapLayer`, `HexagonLayer`, `GridLayer`, `ScreenGridLayer`.
- Tiles: `TileLayer`, `MVTLayer`, `Tile3DLayer`.
- 3D models: `ScenegraphLayer`, `SimpleMeshLayer`, `PointCloudLayer`, `Tile3DLayer`.

External layer classes become manifest types via `OmMap.registerLayer({type, deckClass, props})`. Build them on `@nika-js/onlymap/deck` (the bundled `CompositeLayer`/`TileLayer`/… re-exports — a separately-installed deck.gl is a different class hierarchy and breaks in the renderer); function-valued props ride the subclass's `static defaultProps`; register at module top level before the manifest mounts. Full recipe: docs/custom-layers.md.

### Data Sources

| Source | Manifest | Notes |
|---|---|---|
| JSON / GeoJSON URL | `data="./points.json"` | Arrays or FeatureCollections. |
| Inline JSON | child `<script type="application/json">` | Good for tests/demos. |
| Columnar JSON | `{"columns": {"lon": [...], "lat": [...]}}` | Fast point path. |
| CSV / TSV | `data="./quakes.csv"` | Parsed to typed columns. |
| Arrow / GeoArrow IPC | `data="./big.arrow"` | Points stay columnar; lines/polygons become GeoJSON features. |
| Shapefile | `data="./countries.shp"` | Loads sidecars and joins `.dbf` attributes. |
| KML | `data="./tour.kml"` | Placemarks become GeoJSON features. |
| WebSocket | `data="wss://feed" key="id" flush="250ms" source="decoder"` | Upsert-by-key stream. |
| Polling | `data="/api/fleet.json" refresh="5s"` | Snapshot replace. |
| Draw store | `data="draw:sketch"` | Written by draw widget. |

Data URLs accept any scheme the runtime's `fetch` supports — desktop webviews (Tauri, Electron) pass asset-protocol URLs (`asset://localhost/…`, custom schemes) straight in; format detection reads the path extension either way.

Authenticated fetches:

```js
import { OmMap } from "@nika-js/onlymap";
OmMap.configureData({ headers: { Authorization: `Bearer ${token}` } });
```

Custom format:

```js
OmMap.registerFormat({
  match: (url, contentType) => url.endsWith(".custom"),
  parse: async (res, url) => /* return rows or columnar data */
});
```

Custom stream decoder:

```js
OmMap.registerSource("fleet", {
  onOpen: (send) => send(JSON.stringify({ subscribe: "vehicles" })),
  decode: (msg) => msg.type === "position" ? { id: msg.id, lon: msg.lon, lat: msg.lat } : null
});
```

### Accessor Blocks

Restricted expression block:

```html
<script type="om/accessors">
  export const getPosition = d => [$lon, $lat];
  export const getRadius = d => Math.max(2, $magnitude * 3);
</script>
```

Full JavaScript block:

```html
<om-layer id="routes" type="PathLayer" js>
  <script type="om/accessors">
    const speeds = { slow: [80, 120, 255], fast: [255, 80, 80] };
    export const getColor = d => speeds[d.speedClass] ?? [180, 180, 180];
  </script>
</om-layer>
```

Do not use full-JS blocks on columnar/Arrow layers.

### `<om-widget>`

Built-ins:

- `legend`
- `layer-switcher`
- `zoom-controls`
- `scale-bar`
- `attribution`
- `filter`
- `draw`
- `vega-lite`
- `player`
- `basemap-switcher` — radio list of presets; `options="positron dark-matter osm"` (default: every keyless registered preset)
- `lighting` — scene-lighting controller: preset radios (Off/daylight/studio/flat/custom) + ambient/sun/azimuth/elevation/camera sliders, all over the lighting* attributes via `set-lighting` (undoable; re-syncs when anything else writes them). A bare preset click is a clean RESET (stale lighting-* overrides removed); a slider edit flips to `custom` and sets only the touched key.
- `undo-redo` — undo/redo buttons over the manifest history (layer toggles, filters, basemap switches, element edits, drawn sketches). Keyboard works without the widget: Cmd/Ctrl-Z, Shift-Cmd/Ctrl-Z, Ctrl-Y. Camera moves, hover effects, and story playback are not undo steps.

Positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`.

Examples:

```html
<om-widget type="legend" position="bottom-right" title="Layers" interactive></om-widget>
<om-widget type="filter" layer="quakes" field="magnitude" position="top-left"></om-widget>
<om-widget type="draw" target="sketch" modes="point line polygon" save="both"></om-widget>
<om-widget type="basemap-switcher" options="positron dark-matter liberty osm" position="top-right"></om-widget>
```

Custom widget:

```html
<om-widget position="top-left">
  <div id="out"></div>
  <script type="om/widget">
    this.watch = ["data:quakes", "viewport", "selection"];
    this.render = (ctx) => {
      const s = ctx.stats("quakes", "magnitude", { scope: "viewport" });
      this.$("#out").textContent = `${s.count} quakes`;
    };
  </script>
</om-widget>
```

Widget context:

- `ctx.layers`
- `ctx.data(id)`
- `ctx.dataInViewport(id)`
- `ctx.stats(id, field, { scope: "viewport" })`
- `ctx.selection`
- `ctx.viewport`
- `ctx.history` — `{ canUndo, canRedo }`; re-render on changes via the `history` watch token
- `ctx.emit(action, payload)`

Watch tokens: `data:<layerId>`, `viewport`, `selection`, `layers` (fires on layer add/remove, visibility, and filter changes), `basemap`, `history`.

Use `this.$()` and `this.root`; widgets render in shadow DOM.

### `<om-overlay>`

Rich sparse HTML anchored to the map.

Anchors:

- `anchor="[lng, lat]"`
- `anchor-from="selection"`
- `anchor-layer="regions" anchor-feature-id="mission"`

Templates:

- `{{field}}` HTML-escaped interpolation.
- `{{{field}}}` raw HTML; avoid unless trusted.

Example:

```html
<om-overlay id="detail" anchor-from="selection" visible="false">
  <div><b>{{place}}</b> M {{magnitude}}</div>
</om-overlay>
<om-behavior on="click" layer="quakes" action="show-overlay" target="detail"></om-behavior>
```

### `<om-fallback>`

Static content shown only where scripts never run — chat-app/email file previews (iOS QuickLook), file managers, sandboxed webviews. Hidden automatically once the map boots. Good practice on every complete page, especially one that may be shared as a file.

Rules:

- Direct child of `<om-map>` (validation warns elsewhere), one per map.
- No attributes; plain HTML content — links work, so include a hosted-version URL when one exists.
- Without an `<om-fallback>`, the stylesheet shows a generic text-only banner instead.
- Requires `onlymapjs.css` to load without JavaScript (see Import Patterns above).

Example:

```html
<om-fallback>
  <p><strong>This interactive map requires JavaScript.</strong><br />
     Open this file in a web browser, or visit <a href="https://example.com/map">the hosted version</a>.</p>
</om-fallback>
```

### `<om-behavior>`

Declarative event to action binding.

Events: `click`, `hover`, `drag`, `load`, `data-loaded`.

Common built-in actions:

- `show-overlay`, `hide-overlay`
- `show-tooltip`, `hide-tooltip`
- `toggle-layer`
- `highlight-feature`
- `zoom-to-feature`
- `filter-layer`
- `set-basemap` — payload `{ basemap }`; writes the `<om-map basemap>` attribute
- `undo`, `redo` — step the manifest history (no payload)
- `zoom-in`, `zoom-out`
- `fly-to`
- story actions: `story-play`, `story-pause`, `story-seek`
- effect actions: `fade`, `pulse`, `trace`, `populate`
- draw actions: `draw-mode`, `draw-commit`, `draw-cancel`, `draw-delete`, `draw-clear`, `draw-config`, `draw-save`

Payload attributes are kebab-case and become camelCase payload keys.

Example:

```html
<om-behavior on="click" layer="regions" action="zoom-to-feature" duration="1200ms"></om-behavior>
```

### Stories

Use `<om-story>` with `<om-step>` children. Stories are siblings of layers/overlays, not containers.

```html
<om-story id="tour" interrupt="pause">
  <om-step duration="2s" action="fly-to" center="[-122.44, 37.78]" zoom="12" curve></om-step>
  <om-step duration="1s" action="show-overlay" target="intro" parallel></om-step>
  <om-step duration="1500ms" fade layer="regions"></om-step>
  <om-step duration="2s" trace layer="regions" feature-id="mission"></om-step>
</om-story>
<om-widget type="player" story="tour" position="bottom-left"></om-widget>
```

Story timing attributes:

- `duration`
- `delay`
- `parallel`

Use declarative payloads for scrub-safe state: `visible="true"` when toggling, explicit `filter-range`, explicit camera target.

Scene actions (`set-basemap`, `set-lighting`, `set-terrain`) are story-steppable AND scrub-capturable — the story snapshots the map's scene attributes before first play, so seeking rewinds basemap/lighting/terrain exactly like layer attributes. A sunset storyboard is just steps:

```html
<om-story id="sunset">
  <om-step duration="2s" action="set-lighting" lighting="custom" sun-elevation="35" sun-azimuth="245"></om-step>
  <om-step duration="2s" action="set-lighting" lighting="custom" sun-elevation="8" sun-azimuth="270" ambient="0.5"></om-step>
  <om-step duration="1s" action="set-lighting" lighting="flat"></om-step>  <!-- bare preset = clean reset -->
</om-story>
```

Lighting swaps are stepwise (the LightingEffect changes at each step's start — no tweening between steps); more steps = smoother sunsets.

### Manual Drawing

Use a normal GeoJSON layer bound to a draw store plus a draw widget:

```html
<om-layer id="sketch" type="GeoJsonLayer" data="draw:sketch"
            get-fill-color="[80, 140, 255, 90]"
            get-line-color="[40, 90, 220]"
            point-radius-min-pixels="6"
            line-width-min-pixels="3"
            stroked filled pickable></om-layer>
<om-widget type="draw" target="sketch" position="top-left"
             modes="point line polygon" save="both"
             autosave="my-sketch"></om-widget>
```

The draw widget supports points, lines, polygons, delete-last, clear, save, and autosave. Lines/polygons close with double-click or Enter; Escape cancels the in-progress shape.

### 3D

ScenegraphLayer places GLB/glTF models at coordinates:

```html
<om-layer id="vehicles" type="ScenegraphLayer"
            scenegraph="./truck.glb"
            data="./vehicles.json"
            get-position="[$lon, $lat]"
            get-orientation="[0, $heading, 90]"
            get-scale="[1, 1, 1]"
            lighting="pbr" pickable></om-layer>
```

Roll `90` stands Y-up glTF assets upright. Use `Tile3DLayer` for large 3D Tiles datasets.

3D Tiles roots use `tileset`, not `data`, because OnlyMapJS reserves `data` for parsed datasets:

```html
<om-layer id="city" type="Tile3DLayer"
            tileset="https://example.com/tileset.json"></om-layer>
```

For 3D Tiles LOD/refinement experiments, use:

```html
<om-layer id="city" type="Tile3DLayer"
            tileset="https://example.com/tileset.json"
            maximum-screen-space-error="2"
            maximum-memory-usage="256"
            view-distance-scale="0.85"></om-layer>
```
