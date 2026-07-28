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

Static CDN page (raw-file CDNs only — unpkg/jsDelivr; never esm.sh or another rebundling CDN, which duplicates the WebGL runtime and breaks layer shaders):

```html
<link rel="stylesheet" href="https://unpkg.com/@nika-js/onlymap@0.5.0/dist/onlymapjs.css">
<script type="module" src="https://unpkg.com/@nika-js/onlymap@0.5.0"></script>
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
- `license-key="om_live_…"` — lifts the free-plan limits (5 layers, 25k rows per layer — a layer past the layer cap doesn't render, a layer past the row cap renders its first 25k rows plus a dismissible on-map notice) and removes the corner badge; publishable origin-restricted token, safe in page source (or `OmMap.configureLicense(key)` once). Free-plan violations don't break the map: the offending layer isn't rendered and validation names the limit.
- `terrain="terrarium|<preset>|<{z}/{x}/{y} DEM URL>|off"` — 3D elevation surface. `terrarium` is keyless (AWS); `maptiler-terrain` needs `basemap-key`/`configureBasemap`; raw DEM URLs need `terrain-decoder` (`terrarium`, `mapbox-rgb`, or `{rScaler,gScaler,bScaler,offset}` JSON). `terrain-exaggeration` scales relief (1 = true); `terrain-max-zoom` = the provider's REAL tileset cap; `terrain-texture` drapes a `{z}/{x}/{y}` imagery template. Geographic layers drape automatically; per-layer `terrain="drape|offset|off"` overrides (3D-model layers default to `offset`). Terrain REPLACES an active basemap while on (restored when off) — validation warns. Register presets with `OmMap.registerTerrain(name, {...})`; `set-terrain` action + `terrain` watch token; attribute-backed (undoable).
- `lighting="daylight|studio|flat|custom"` — scene lighting for 3D content (extruded polygons, models); absent = deck defaults. Preset seeds values; `lighting-ambient`, `lighting-sun` (intensity; 0 removes the sun), `lighting-sun-azimuth` (° CW from north), `lighting-sun-elevation` (° above horizon), `lighting-camera` (model-inspection fill) override individual fields; `lighting-sun-date` (ISO 8601 or epoch ms) computes the sun from solar position at the map center and wins over azimuth/elevation. Attribute-backed: changes are undoable, and the `set-lighting {lighting, sunAzimuth, …}` action makes lighting story-steppable (`lighting="default"` removes the whole attribute set; a bare preset is a clean reset). `<om-widget type="lighting">` is the native UI. Widget scripts can `watch = ["lighting"]`.
- `widgets-dim="off"` disables collision-dim — by default a widget slot dims (`--om-widget-opacity-dimmed`, 0.35) while an open `<om-overlay>` popup covers it, rather than the popup dodging (attribution/toggle slots never dim).
- `headless width="800" height="600"` for test harness use

Events: `om-map-ready` (boot complete; `await mapEl.ready` is the promise twin), `om-validation-error`, `om-view-changed` — fires once the camera settles after a move (debounced; `detail = {longitude, latitude, zoom, pitch, bearing}`), the hook for persisting the camera — `om-map-point` (`detail = {coordinate: [lng,lat]|null, kind: "click"|"hover"}` — every click/hover map coordinate, including empty-map clicks; the hook for custom capture tools the built-in draw widget doesn't cover), and `om-tileset-load` (`detail = {layerId, tileset}` — a `Tile3DLayer`'s live deck `Tileset3D`, for tools needing the real tileset such as region export). `MapController` mirrors these as `onViewChange` / `onMapPoint` / `onTilesetLoad` options.

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
- `visible="false"` or `opacity="0"` — initial visibility/opacity.w

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

`A5Layer`, `ArcLayer`, `BitmapLayer`, `COGLayer`, `ColumnLayer`, `ContourLayer`, `GeoJsonLayer`, `GeohashLayer`, `GreatCircleLayer`, `GridCellLayer`, `GridLayer`, `H3ClusterLayer`, `H3HexagonLayer`, `HeatmapLayer`, `HexagonLayer`, `IconLayer`, `LineLayer`, `MVTLayer`, `PathLayer`, `PointCloudLayer`, `PolygonLayer`, `PopupLayer`, `QuadkeyLayer`, `S2Layer`, `ScatterplotLayer`, `ScenegraphLayer`, `ScreenGridLayer`, `SimpleMeshLayer`, `SolidPolygonLayer`, `TerrainLayer`, `TextLayer`, `Tile3DLayer`, `TileLayer`, `TripsLayer`.

Common choices:

- Points: `ScatterplotLayer`, `IconLayer`, `TextLayer`, `PopupLayer`.
- Lines/routes: `PathLayer`, `LineLayer`, `ArcLayer`, `TripsLayer`.
- Polygons/choropleths: `GeoJsonLayer`, `PolygonLayer`.
- Aggregation: `HeatmapLayer`, `HexagonLayer`, `GridLayer`, `ScreenGridLayer`.
- Tiles: `TileLayer`, `MVTLayer`, `Tile3DLayer`.
- 3D models: `ScenegraphLayer`, `SimpleMeshLayer`, `PointCloudLayer`, `Tile3DLayer`.
- GeoTIFF/COG rasters: `COGLayer`.



### COGLayer (GeoTIFF / COG rasters)

```html
<om-layer id="dem" type="COGLayer" label="Elevation"
          src="./elevation.tif" min="0" max="1900" colormap="viridis" nodata="-9999"></om-layer>
```

- `src` (required) — the GeoTIFF URL. NOT `data`: rasters stream tiles by HTTP Range request through the layer's own reader; they are never parsed rows (`$field`, `ctx.data()`, `ctx.stats()`, filters do not apply).
- Sources must be Cloud-Optimized GeoTIFFs (`gdal_translate -of COG` otherwise).
- `min`/`max` — the rescale window mapped onto the colormap. Defaults to 0–255, so ALWAYS set them for float or 16-bit data (DEMs, NDVI, temperature).
- `colormap` — single-band ramps from the bundled sprite: `gray` (default), `viridis`, `plasma`, `inferno`, `magma`, `cividis`, `rdylgn`, `rdbu`, `spectral`, `terrain`, `jet`, `turbo`. Sources with 3+ bands composite as RGB and ignore it.
- `nodata` — overrides the source's nodata sentinel; nodata pixels render transparent.
- Plain 8-bit RGB COGs (satellite truecolor) need no styling attributes at all.
- Restretch/recolor (min/max/colormap edits) are GPU uniform updates — tiles are not refetched. The legend widget renders the colormap ramp automatically when `colormap` + `min`/`max` are authored.

External layer classes become manifest types via `OmMap.registerLayer({type, deckClass, props})`. Build them on `@nika-js/onlymap/deck` (the bundled `CompositeLayer`/`TileLayer`/… re-exports — a separately-installed deck.gl is a different class hierarchy and breaks in the renderer); function-valued props ride the subclass's `static defaultProps`; register at module top level before the manifest mounts. Full recipe: docs/custom-layers.md.

### Data Sources


| Source               | Manifest                                                    | Notes                                                         |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| JSON / GeoJSON URL   | `data="./points.json"`                                      | Arrays or FeatureCollections.                                 |
| Inline JSON          | child `<script type="application/json">`                    | Good for tests/demos.                                         |
| Columnar JSON        | `{"columns": {"lon": [...], "lat": [...]}}`                 | Fast point path.                                              |
| CSV / TSV            | `data="./quakes.csv"`                                       | Parsed to typed columns.                                      |
| Arrow / GeoArrow IPC | `data="./big.arrow"`                                        | Points stay columnar; lines/polygons become GeoJSON features. |
| Shapefile            | `data="./countries.shp"`                                    | Loads sidecars and joins `.dbf` attributes.                   |
| KML                  | `data="./tour.kml"`                                         | Placemarks become GeoJSON features.                           |
| CityJSON             | `data="./tile.city.json"`                                   | 3D city models → extruded footprints, or `?om-surfaces=1` for real per-face roof geometry; see below. |
| CityJSONSeq          | `data="./tile.city.jsonl"`                                  | Same, streamed line by line as it downloads.                  |
| WebSocket            | `data="wss://feed" key="id" flush="250ms" source="decoder"` | Upsert-by-key stream.                                         |
| Polling              | `data="/api/fleet.json" refresh="5s"`                       | Snapshot replace.                                             |
| Draw store           | `data="draw:sketch"`                                        | Written by draw widget.                                       |


Data URLs accept any scheme the runtime's `fetch` supports — desktop webviews (Tauri, Electron) pass asset-protocol URLs (`asset://localhost/…`, custom schemes) straight in; format detection reads the path extension either way.

CityJSON (3DBAG, PLATEAU, swisstopo) decodes to one of two shapes, chosen by the `data` URL — there is no CityJSON layer type:

```html
<!-- Default: one GeoJSON footprint per CityObject, extruded to a single
     derived height. Lit, terrain-aware; can't show a pitched roof's shape. -->
<om-layer id="buildings" type="GeoJsonLayer" data="./tile.city.json"
          extruded get-elevation="$roof_height"
          get-fill-color="$b3_dak_type == 'slanted' ? '#d6604d' : '#4393c3'"
          pickable></om-layer>

<!-- ?om-surfaces=1: one row per FACE, each at its own real height — a
     pitched LoD2.2 roof actually looks pitched. Flat-shaded (unlit). NO
     get-fill-color needed: SolidPolygonLayer defaults it to a `fill_color`
     field the decoder populates with a ninja-viewer-style palette. -->
<om-layer id="roofs" type="SolidPolygonLayer" data="./tile.city.json?om-surfaces=1"
          get-polygon="$polygon" full3d
          pickable></om-layer>

<!-- Surfaces mode is unlit, so face edges are invisible without this: a
     companion PathLayer tracing the decoder's `outline` field (the same
     face, flattened to a closed 2D path). ALWAYS pair one with the
     SolidPolygonLayer above in surfaces mode — SolidPolygonLayer's own
     `wireframe` prop is a no-op here (deck only builds wireframe geometry
     when `extruded: true`). Match filter-field/filter-range to the fill
     layer so filtered-out buildings' outlines disappear too. -->
<om-layer id="roof-outlines" type="PathLayer" data="./tile.city.json?om-surfaces=1"
          get-path="$outline" get-color="[0, 0, 0]" width-min-pixels="1"
          pickable="false"></om-layer>
```

Derived properties (these win over same-named source attributes, present in both modes): `roof_height` (area-weighted mean roof height above ground — the one to extrude by in the default mode), `eaves_height`, `ridge_height`, `ground_height`, `roof_area` (true 3D m²), `surface_count`, `lod`, `cityobject_id`, `cityobject_type`, `parent_id`. Surfaces-mode rows add `polygon` (this face's rings, `[[lng, lat, elevation], …]` — bind `get-polygon` to it), `outline` (same face's outer ring only, flattened and closed — bind a `PathLayer`'s `get-path` to it for visible edges, per above), `surface_type` (`"RoofSurface"` / `"WallSurface"` / `"GroundSurface"` / undefined), and `fill_color` — a default color per surface_type/cityobject_type (RoofSurface red, WallSurface white, Building blue, WaterBody light blue, …), verified against the actual default palette `cityjson-threejs-loader` (the engine behind the ninja reference viewer) ships. `SolidPolygonLayer`'s `get-fill-color` reads `$fill_color` automatically when left unauthored — zero color attributes needed for a reasonable render — and an authored `get-fill-color` (or a plain `color="…"`) still overrides it, same as any layer. Every source attribute survives, with a parent `Building`'s attributes inherited by its `BuildingPart` rows. National grids (NL 28992/7415, CH 2056, DE 25832/25833/5555/5556, JP 6668/6697/6669–6687, AT 31254/31255/31256, SG 3414) reproject automatically, axis order included; any other EPSG code fails with an error naming it. The highest LoD is used — pin one with `?om-lod=1.2` (combine as `?om-lod=1.2&om-surfaces=1`). `?om-surfaces=1` is flat-shaded — deck's solid-polygon shader only lights `extruded` geometry; it also costs roughly 30× the rows (one per face, not per building), so it reaches the free tier's 25k-row cap at a few hundred buildings where the footprint mode would not — past which the layer renders its first 25k rows (a partial scene, with an on-map notice) rather than going blank. See `docs/3d-assets.md`.

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

- `legend` — symbology-aware by default: it parses each layer's `get-fill-color`. A `sequential`/`diverging` `scale()` renders as a gradient ramp with the domain ends labeled; a `threshold` scale as discrete class ranges (`< b1`, `b1 – b2`, `≥ bN`); an equality ternary chain (`$f == 'a' ? '#c1' : $f == 'b' ? '#c2' : '#fallback'`) as a category palette with an "other" row. Any other expression falls back to the single `color` swatch — so writing the canonical shapes buys a self-describing legend for free.
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
- `widgets-toggle` — one button hiding/showing all OTHER widgets (`widgets-hidden` attribute / `set-widgets-visible {visible}` action; bare payload toggles). Hidden = visibility, never removal — widget state survives; attribution and the toggle itself never hide. Transient (not an undo step), story-scrub-capturable.
- `undo-redo` — undo/redo buttons over the manifest history (layer toggles, filters, basemap switches, element edits, drawn sketches). Keyboard works without the widget: Cmd/Ctrl-Z, Shift-Cmd/Ctrl-Z, Ctrl-Y. Camera moves, hover effects, and story playback are not undo steps.

Positions — 8 managed slots (logical, RTL-aware): `top-start`, `top-center`, `top-end`, `center-start`, `center-end`, `bottom-start`, `bottom-center`, `bottom-end`. Legacy corner names (`top-left`, `top-right`, `bottom-left`, `bottom-right`) are aliases. Same-slot widgets stack in one library-owned flex container: flush edges, shared gap — never overlapping. `order="1"` sets deterministic in-slot ordering (default: DOM order). Adjacent COMPACT button widgets (zoom-controls, undo-redo, widgets-toggle) in one slot auto-merge into a single control group (shared radius/shadow, 1px dividers); `cluster="false"` keeps one out — validation warns if set on a non-compact widget. At map widths ≤640px, managed widgets auto-fold into top/end/bottom/start disclosure drawers; `fold="never"` keeps an essential control outside, `widgets-fold="off"` opts the map out, and `--om-widget-fold-breakpoint` changes the map-width threshold. `position="manual"` opts out of management: the widget renders as a plain block you place with your own CSS (even outside the map, e.g. in an app header, driving the map through actions). Layout tokens: `--om-widget-inset-x/-y` (slot inset, default 12px), `--om-widget-gap-x/-y` (stack gap, default 8px), `--om-widget-opacity`, `--om-widget-opacity-dimmed` (default 0.35 — the collision-dim level), `--om-widget-radius`, `--om-widget-fold-breakpoint` — or the no-CSS sugar attribute `<om-map widget-style="gap:10 opacity:0.9 inset:16">` (keys: inset, gap, inset-x/-y, gap-x/-y, opacity, radius, size; numbers are px except opacity).

Theming: built-in widgets read `--om-widget-*` CSS custom properties, which inherit through their shadow roots — so plain page CSS themes them, no JS:

```css
/* map-wide (every widget) */
om-map { --om-widget-bg: #111827; --om-widget-fg: #f9fafb; }
/* or one widget */
om-widget[type="legend"] { --om-widget-bg: #111827; --om-widget-fg: #f9fafb; }
```

The full set: `--om-widget-bg` (panel/button background), `--om-widget-fg` (text), `--om-widget-muted` (secondary text: legend field/domain labels, disabled buttons, clocks), `--om-widget-border` (separators, button outlines), `--om-widget-hover-bg` (button hover), `--om-widget-accent` (player transport buttons). Unset properties fall back to the stock light palette.

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

Watch tokens: `data:<layerId>`, `viewport`, `selection`, `layers` (fires on layer add/remove, visibility, and filter changes), `basemap`, `lighting`, `terrain`, `history`, `widgets` (fires on a `widgets-hidden` hide-all toggle).

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

