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
<link rel="stylesheet" href="https://unpkg.com/@nika-js/onlymap@0.6.2/dist/onlymapjs.css">
<script type="module" src="https://unpkg.com/@nika-js/onlymap@0.6.2"></script>
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
- `license-key="om_live_…"` — lifts the free-plan limits (5 layers, 25k rows per layer — a layer past the layer cap doesn't render, a layer past the row cap renders its first 25k rows plus a dismissible on-map notice; caps apply only on HOSTED http(s) pages — localhost/file:// and other dev contexts run uncapped, badge stays) and removes the corner badge; publishable origin-restricted token, safe in page source (or `OmMap.configureLicense(key)` once). Free-plan violations don't break the map: the offending layer isn't rendered and validation names the limit.
- `terrain="terrarium|<preset>|<{z}/{x}/{y} DEM URL>|off"` — 3D elevation surface. `terrarium` is keyless (AWS); `mapterhorn` is also keyless and carries a CARTO Positron drape by default; `maptiler-terrain` needs `basemap-key`/`configureBasemap`; raw DEM URLs need `terrain-decoder` (`terrarium`, `mapbox-rgb`, or `{rScaler,gScaler,bScaler,offset}` JSON). `terrain-exaggeration` scales relief (1 = true); `terrain-max-zoom` = the provider's REAL tileset cap; `terrain-texture` drapes a `{z}/{x}/{y}` imagery template. Geographic layers drape automatically; per-layer `terrain="drape|offset|off"` overrides (3D-model layers default to `offset`). Terrain REPLACES an active basemap while on (restored when off) — validation warns. Register presets with `OmMap.registerTerrain(name, {...})`; `set-terrain` action + `terrain` watch token; attribute-backed (undoable). **BIM requires explicit terrain**: a model that resolves real elevation on a map with no `terrain` attribute raises an ERROR through the validation channel at load time — the library never writes `terrain` for you; author a preset (`mapterhorn` pairs a keyless DEM with a CARTO drape) or an explicit `terrain="off"` for flat-ground siting.
- `lighting="daylight|studio|flat|custom"` — scene lighting for 3D content (extruded polygons, models); absent = deck defaults. Preset seeds values; `lighting-ambient`, `lighting-sun` (intensity; 0 removes the sun), `lighting-sun-azimuth` (° CW from north), `lighting-sun-elevation` (° above horizon), `lighting-camera` (model-inspection fill) override individual fields; `lighting-sun-date` (ISO 8601 or epoch ms) computes the sun from solar position at the map center and wins over azimuth/elevation. Attribute-backed: changes are undoable, and the `set-lighting {lighting, sunAzimuth, …}` action makes lighting story-steppable (`lighting="default"` removes the whole attribute set; a bare preset is a clean reset). `<om-widget type="lighting">` is the native UI. Widget scripts can `watch = ["lighting"]`.
- `clip-box-min="[lng, lat, elevation]"` + `clip-box-max="[lng, lat, elevation]"` (issue #34) — a real axis-aligned 3D box clipping the whole scene: geometry outside it is discarded (order of the two corners doesn't matter). Every layer is clipped once a box is configured; opt a specific layer out with `clip="off"` on its `<om-layer>`. `clip-box-invert` shows what's OUTSIDE the box instead; `clip-box-highlight` dims clipped-out geometry instead of discarding it (non-destructive preview — nothing disappears). Works on ANY layer type, including georeferenced `Tile3DLayer`/`BIMLayer` content, so a dense BIM scene can be cut open to see what's inside — not just flat `GeoJsonLayer` extrusions. Attribute-backed (undoable, story-steppable) via `set-clip-box {min, max, invert?, highlight?}` (`{clear: true}` removes the box) and `<om-widget type="clip-box">` (six number inputs + invert/highlight checkboxes + clear button). v1 is axis-aligned only — rotated boxes are a documented follow-up.
- `snap="vertex edge midpoint"` + `snap-tolerance="12"` (issue #34 Part A) — XY snapping for draw/measure vertex capture: refines whatever deck already picked under the cursor to the nearest vertex, edge, or edge midpoint of THAT feature's own geometry, within `snap-tolerance` pixels (default 12) — not a spatial index, only the already-picked feature is searched. Applies to every layer by default; `snap="off"` on any `<om-layer>` opts it out, mirroring `clip="off"`. Also snaps to a `BIMLayer`'s own edge/crease overlay (its real wall corners/edges, converted from local mesh coordinates automatically) — the raw triangle mesh itself is not a snap target. Vertex beats midpoint beats edge on range conflicts. Hold Space to place a point nearby without snapping. No action/attribute-backed toggle beyond the attribute itself; live-reactive like `terrain`/`clip-box-*`.
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
- `pickable` — enable click/hover behaviors. `pickable="3d"` (issue #34) additionally opts the layer into deck's DEPTH-pick pass, so a click/hover's resolved coordinate carries a real third (elevation) component instead of the ray∩z=0-plane guess a flat pick gives you — a click on a building face resolves ON the face, not on the ground behind it. `terrain` sets this on itself. The elevation flows through `ctx.selection.coordinate` and `{{z}}` in `<om-overlay>`/`show-tooltip` templates; `{{z}}` is ABSENT (not `0`) when no layer in the scene ran the depth pass for that pick, so "no elevation" is distinguishable from sea level.
- `visible="false"` or `opacity="0"` — initial visibility/opacity.w

Accessors:

```html
get-position="[$lon, $lat]"
get-radius="$population * 0.001"
get-fill-color="$value > 100 ? [255,0,0] : [0,128,255]"
get-fill-color="scale($depth, sequential, ['#ffffcc','#800026'], domain=[0,700])"
get-text="formatDate($time, 'datetime', 'UTC')"
```

`$field` works on flat rows, GeoJSON properties, columnar JSON, CSV/TSV columns, and Arrow point columns.

Date formatting is a safe built-in rather than an opt-in to arbitrary JavaScript:

```html
get-text="formatDate($time)"
get-text="formatDate($time, 'date')"
get-text="formatDate($time, 'datetime', 'Asia/Singapore')"
```

`formatDate(value, style?, timeZone?)` accepts epoch-millisecond numbers/numeric strings or ISO date strings. Numeric values are always milliseconds—multiply Unix seconds by 1000 before formatting. Styles are `date`, `datetime` (default), `time`, and `iso`; the default time zone is `UTC`, while `local` opts into the viewer's zone and IANA names select a specific zone. Invalid values produce an empty string. Restricted expressions still reject `new Date()`, `Intl`, and instance-method calls.

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

Dashed lines (on path-stroking layers — `PathLayer`, `GeoJsonLayer`, `PolygonLayer`, `TripsLayer`):

```html
dash="[6, 3]"               <!-- 6-long dash, 3-long gap, in line-width units -->
dash="6 3" dash-justified   <!-- SVG-style values; justify so each segment starts/ends on a dash -->
```

For an epoch-millisecond filter, format the built-in widget's numeric labels declaratively:

```html
<om-layer id="quakes" type="GeoJsonLayer" data="./quakes.geojson"
          filter-field="time" filter-range="[1782889284760, 1785480717910]"></om-layer>
<om-widget type="filter" layer="quakes" field="time"
           format="date" date-style="datetime" time-zone="UTC"></om-widget>
```

`format` is `number` (default) or `date`. With `format="date"`, `date-style` uses the same four styles as `formatDate()` and `time-zone` defaults to `UTC`.



### Built-In Layer Types

Use the `type` value exactly:

`A5Layer`, `ArcLayer`, `BIMLayer`, `BitmapLayer`, `COGLayer`, `ColumnLayer`, `ContourLayer`, `GeoJsonLayer`, `GeohashLayer`, `GreatCircleLayer`, `GridCellLayer`, `GridLayer`, `H3ClusterLayer`, `H3HexagonLayer`, `HeatmapLayer`, `HexagonLayer`, `IconLayer`, `ImageOverlay`, `LineLayer`, `MVTLayer`, `PathLayer`, `PointCloudLayer`, `PolygonLayer`, `PopupLayer`, `QuadkeyLayer`, `S2Layer`, `ScatterplotLayer`, `ScenegraphLayer`, `ScreenGridLayer`, `SimpleMeshLayer`, `SolidPolygonLayer`, `TerrainLayer`, `TextLayer`, `Tile3DLayer`, `TileLayer`, `TripsLayer`, `ZarrLayer`.

Common choices:

- Points: `ScatterplotLayer`, `IconLayer`, `TextLayer`, `PopupLayer`.
- Lines/routes: `PathLayer`, `LineLayer`, `ArcLayer`, `TripsLayer`.
- Polygons/choropleths: `GeoJsonLayer`, `PolygonLayer`.
- Aggregation: `HeatmapLayer`, `HexagonLayer`, `GridLayer`, `ScreenGridLayer`.
- Tiles: `TileLayer`, `MVTLayer`, `Tile3DLayer`.
- 3D models: `ScenegraphLayer`, `SimpleMeshLayer`, `PointCloudLayer`, `Tile3DLayer`.
- BIM source files (`.ifc`, loaded in-browser, no pre-conversion step): `BIMLayer`.
- GeoTIFF/COG rasters: `COGLayer`.
- Zarr / GeoZarr rasters (chunked N-D arrays): `ZarrLayer`.
- Geotagged drone JPEGs: `ImageOverlay`.



### COGLayer (GeoTIFF / COG rasters)

```html
<om-layer id="dem" type="COGLayer" label="Elevation"
          src="./elevation.tif" min="0" max="1900" colormap="viridis" nodata="-9999"></om-layer>
```

- `src` (required) — the GeoTIFF URL. NOT `data`: rasters stream tiles by HTTP Range request through the layer's own reader; they are never parsed rows (`$field`, `ctx.data()`, `ctx.stats()`, filters do not apply).
- Sources must be Cloud-Optimized GeoTIFFs (`gdal_translate -of COG` otherwise).
- `min`/`max` — the rescale window mapped onto the colormap. Defaults to 0–255, so ALWAYS set them for float or 16-bit data (DEMs, NDVI, temperature).
- `colormap` — single-band ramps from the bundled sprite: `gray` (default), `viridis`, `plasma`, `inferno`, `magma`, `cividis`, `rdylgn`, `rdbu`, `spectral`, `terrain`, `jet`, `turbo`, `ylorrd` (ColorBrewer yellow→orange→red — a gentler sequential ramp than turbo/jet). Sources with 3+ bands composite as RGB and ignore it.
- `nodata` — overrides the source's nodata sentinel; nodata pixels render transparent.
- Plain 8-bit RGB COGs (satellite truecolor) need no styling attributes at all.
- Restretch/recolor (min/max/colormap edits) are GPU uniform updates — tiles are not refetched. The legend widget renders the colormap ramp automatically when `colormap` + `min`/`max` are authored.

### ZarrLayer (Zarr / GeoZarr rasters)

Chunked, N-dimensional array data (climate/weather grids, datacubes) rendered on the GPU. Same raster styling as COGLayer — `min`/`max`/`colormap`/`nodata` reuse the identical pipeline and legend.

```html
<!-- GeoZarr-compliant store: georeferences itself -->
<om-layer id="sst" type="ZarrLayer"
          src="./ocean.zarr" variable="analysed_sst" select="time=0"
          colormap="viridis" min="270" max="305"></om-layer>

<!-- Plain (non-GeoZarr) store: georeference it in the manifest -->
<om-layer id="temp" type="ZarrLayer"
          src="./ecmwf.zarr" variable="temperature_2m" select="init_time=0, lead_time=0, ensemble_member=0"
          bounds="[-180, -90, 180, 90]" crs="EPSG:4326" spatial-dims="latitude longitude"
          colormap="turbo" min="-40" max="50"></om-layer>
```

- `src` (required) — the `.zarr` store URL. NOT `data`: like COGLayer, chunks stream through the layer's own reader (zarrita); they are never parsed rows.
- `variable` — the array within the store to render.
- `select` — pin every NON-spatial dimension: `"time=0"`, `"init_time=0, lead_time=0, ensemble_member=0"`. The two spatial dims are handled for you. A 2-D array needs no `select`.
- **GeoZarr** stores (with the spatial/geo-proj/multiscales conventions) georeference themselves — no `bounds`/`crs` needed.
- **Plain Zarr** (common for real-world public stores) needs manual georeferencing: `bounds="[west,south,east,north]"`, `crs="EPSG:4326"`, and `spatial-dims="<yName> <xName>"` (the two spatial dimension names). Validation errors if you give `bounds` without `crs` + `spatial-dims`.
- `min`/`max`/`colormap`/`nodata` and the auto legend work exactly as in COGLayer. Non-spatial-dim chunking can make some stores heavy to read — pin dimensions the store chunks finely over.

**External / remote stores.** `src` may be any absolute URL — `src="https://…/store.zarr"` — with everything else identical. Two requirements:

- **CORS.** zarrita fetches the store directly from the browser, so the host must send `Access-Control-Allow-Origin` (public open-data buckets on S3/GCS/source.coop usually do). Verify with `curl -I -H "Origin: https://x" <src>/zarr.json` and look for the header; a store without CORS is browser-blocked with no workaround short of a proxy.
- **Public only, for now.** `ZarrLayer` opens the store with zarrita's own fetch, NOT `OmMap.configureData` — so a store needing an auth header/token is not yet supported (a documented follow-up). Public stores work out of the box.

No server setup is needed: a static host serves Zarr's extensionless chunk keys (`c/0/0`) natively. (In local dev only, Vite's dev server can't, so the repo ships a dev-only middleware — irrelevant to real hosting.)

### ImageOverlay (drone JPEG)

```html
<om-layer id="photo" type="ImageOverlay"
          src="./DJI_0123.jpg" georeference="exif"
          opacity="0.8"></om-layer>
```

- `src` (required) — a JPEG with GPS/relative-altitude/camera/focal-length EXIF and DJI gimbal XMP.
- `georeference="exif"` — fetches through `OmMap.configureData`, computes a flat-ground WGS84 footprint, and bakes yaw/roll into the pixels. `map.ready` waits for it.
- Verified camera paths include DJI FC300S and M30T, including M30T JPEGs carrying a 180° gimbal-roll correction.
- Unknown camera: supply `sensor-width-mm` + `sensor-height-mm` together. If EXIF lacks focal length, also supply `focal-length-mm`. Values are physical millimetres and must be positive.
- Persisted/preprocessed form: omit `georeference` and set `bounds="[west,south,east,north]"`; `src` may be the processed PNG. Optional JSON `metadata` passes through. Explicit bounds perform no EXIF fetch.
- `depth-test` defaults false. `opacity`, `visible`, and `pickable` behave like other layers.
- The public `await OmMap.resolveImageOverlay(fileOrUrl, options?)` returns `{image, bounds, metadata}` for upload/persistence.
- Visualization-grade only: no terrain, lens-distortion, calibration, or perspective-correct four-corner orthorectification. Use `COGLayer` for large orthomosaics.

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
| GPX                  | `data="./hike.gpx"` (opt. `#waypoints`/`#tracks`/`#routes`) | Waypoints/tracks/routes → GeoJSON features, each tagged `_gpxKind`; a URL fragment selects one part (no fragment = all). |
| FlatGeobuf           | `data="./cities.fgb"`                                       | Cloud-native binary vector — whole-file decode to GeoJSON features (bbox-streaming is a later phase). |
| GeoParquet           | `data="./data.parquet"` (or `.geoparquet`)                 | Cloud-native columnar vector — all-Point files stay columnar, lines/polygons become GeoJSON features; needs the `geo` metadata (WKB geometry) and CRS84/EPSG:4326 (a projected CRS errors — reproject first). |
| CityJSON             | `data="./tile.city.json"`                                   | 3D city models → extruded footprints, or `?om-surfaces=1` for real per-face roof geometry; see below. |
| CityJSONSeq          | `data="./tile.city.jsonl"`                                  | Same, streamed line by line as it downloads.                  |
| WebSocket            | `data="wss://feed" key="id" flush="250ms" source="decoder"` | Upsert-by-key stream.                                         |
| Polling              | `data="/api/fleet.json" refresh="5s"`                       | Snapshot replace.                                             |
| Draw store           | `data="draw:sketch"`                                        | Written by draw widget.                                       |
| Tiled layer          | `type="TileLayer" data="…/{z}/{x}/{y}.png"` or `type="MVTLayer" data="…/{z}/{x}/{y}.pbf"` | A `{z}/{x}/{y}` template is deck's tile URL, NOT rows — passed through verbatim (never fetched/parsed). See below. |


Data URLs accept any scheme the runtime's `fetch` supports — desktop webviews (Tauri, Electron) pass asset-protocol URLs (`asset://localhost/…`, custom schemes) straight in; format detection reads the path extension either way.

### Tiled layers (TileLayer, MVTLayer)

deck's `TileLayer` and `MVTLayer` take their `data` prop as a `{z}/{x}/{y}` URL template — a string deck expands per tile, not a document to fetch and parse. OnlyMapJS detects the template and passes it through to deck verbatim (a normal `data` URL is still fetched + parsed):

```html
<!-- Raster XYZ overlay: a default BitmapLayer sublayer renders the image tiles. -->
<om-layer id="wx" type="TileLayer" data="https://tiles.example.com/{z}/{x}/{y}.png" opacity="0.6"></om-layer>

<!-- Vector tiles: MVTLayer self-renders; get-* accessors apply to the decoded features. -->
<om-layer id="roads" type="MVTLayer" data="https://tiles.example.com/{z}/{x}/{y}.pbf"
            get-line-color="'#38bdf8'" line-width-min-pixels="1"></om-layer>
```

`$field` accessors on an `MVTLayer` read the tile feature's `properties`. A tiled layer has no local rows, so `ctx.data()`/`ctx.stats()`/`filter-*` do not apply to it. For a raster `TileLayer` pointing at a non-image endpoint (vector tiles, custom decoding), register a custom layer with your own `renderSubLayers` via `OmMap.registerLayer`.

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
- `scale-bar` — `units="metric|imperial|nautical"` (default metric) picks the length system; snaps to a nice round distance.
- `attribution`
- `filter`
- `draw` — sketch-capture toolbar: `modes="point line polygon"` (default all three), `target="<name>"` (default `sketch`, bound via `data="draw:<target>"`), `save="both|download|file-system"`, `autosave="<localStorage key>"`. `export-3d` (bare = GLB default, `="b3dm"` wraps it for Cesium/3D-Tiles pipelines) adds an "Export 3D" button (spec: issue #34 — region export) — deliberately separate from `save` (that's the drawn shape's own GeoJSON; `export-3d` exports the 3D `Tile3DLayer`/`BIMLayer` content found INSIDE the drawn footprint). Outline a polygon over loaded 3D content, close it, click "Export 3D": clips every loaded tile's triangles to the footprint (a plain 2D clip — no elevation-picking involved), re-frames them to a local coordinate frame at the footprint's own centroid (portable — opens correctly in Blender/three.js/etc. without ECEF-scale support), and downloads it, each triangle carrying its own source color (baked as vertex colors). No textures — BIM/IFC materials are flat colors, not textured meshes. The export only pulls in currently-VISIBLE 3D Tiles/BIM layers — one hidden via `visible="false"` (or the `toggle-layer` action) is excluded, with a distinct console warning distinguishing "nothing has loaded yet" from "everything loaded is hidden." Validation warns on an unrecognized `export-3d` value.
- `clip-box` — native UI over the map's `clip-box-*` scene-state attributes (see the `<om-map>` section above): six number inputs (min/max × lng/lat/elevation), invert/highlight checkboxes, and a clear button, all wired through `set-clip-box`. Manifest is the source of truth — the panel re-syncs from the attributes on every render, so undo/redo and story-scrub move the inputs too.
- `measure` — geodesic ruler: `modes="distance area volume"` (space-separated; default `distance area`), `units="metric|imperial|nautical"`. Click the map to place points; live per-segment + total labels render on the map, and a totals panel + a `units` toggle sit in the widget. Distance is haversine on the WGS84 mean sphere (≤0.56% vs. the true geodesic); area is the spherical-excess integral. Nautical shows nmi for length and falls back to metric for area. Reuses the draw capture stack (measure and draw are mutually exclusive); the geometry is ephemeral (never saved, never an undo step). Consume the reading programmatically via the `om-measure` event on `<om-map>` (`detail = {mode, units, totalMeters, segments, areaMeters2, perimeterMeters, poleWarning, cutMeters3, fillMeters3, netMeters3, totalMeters3, cutAdjustedMeters3, fillAdjustedMeters3, swell, shrink, cutMassKg, fillMassKg, cellSizeM, gsdM, cutErrorM3, fillErrorM3, nodataFraction, baseSurface, stale, profileSeries}` — everything from `cutMeters3` on is volume-mode-only, populating once a footprint closes). `volume` mode outlines a polygon footprint the same way `area` does — double-click (or Enter) closes it, and it turns solid teal to signal it's ready — then a double-headed arrow gizmo (fixed screen-pixel size, unbounded drag distance) appears at the centroid: drag it up to fill, down to cut, panel reads Cut/Fill/Net (signed, fill−cut)/Total (unsigned, cut+fill) volume + Area/Perimeter live — always RAW geometric figures, never altered by `swell`/`shrink`. REQUIRES `terrain` on `<om-map>` (validation warns a `volume` mode with none): the math is a REAL per-cell grid integration (issue #35) — closing a footprint bulk-loads its covering DEM tiles and integrates terrain-vs-base per cell on a metric tangent-plane grid (cell size = the DEM's GSD at the ring's latitude, scanline point-in-polygon, bilinear tile-seam-correct sampling, worker-offloaded with a synchronous fallback), reporting mixed cut AND fill within one footprint on undulating ground plus `cellSizeM`/`gsdM`/`cutErrorM3`/`fillErrorM3` (± = per-cell cellArea × 1.5 × GSD, summed per side) and `nodataFraction` on the readout. `base-surface` picks the reference surface: `custom` (default — the gizmo's draggable target plane, re-summed live from the cached grid during a drag) or boundary-derived stockpile strategies with NO gizmo (`triangulated` boundary TIN — the drone-survey default, `plane` least-squares, `lowest`/`highest`/`average`). No terrain (or a failed tile fetch) falls back to the flat single-elevation approximation with no error figures rather than erroring. Five more volume-only attributes, all no-ops without `volume` in `modes` (validation warns): `base-surface` (above); `profile` — closing a footprint also samples elevation around its own perimeter, dispatched on `profileSeries` for a paired `dynamic-chart` widget to plot, updating live from the first vertex (debounced on hover, immediate on each new vertex) while sketching, not just on close; `deadband` (m³, default 0) — zeroes a Cut/Fill figure below the threshold; `density` (t/m³ metric, lb/yd³ imperial) and `swell`/`shrink` (multipliers, default 1×) populate a SEPARATE Material section instead of touching Cut/Fill/Net/Total — standard Bank/Loose/Compacted convention: `cutAdjustedMeters3` = raw cut × swell (loose/haul volume, bigger — excavating adds air voids), `fillAdjustedMeters3` = raw fill ÷ shrink (loose/borrow volume needed, also bigger — raw fill is already a compacted target void), `cutMassKg`/`fillMassKg` from the RAW volume (mass-conserving — swell/shrink change volume via air voids, not the mass of material). The widget only renders the Material section once at least one of `density`/`swell`/`shrink` is configured — no separate toggle. `stale` flags the brief window between a footprint committing and its elevation sample resolving.
- `vega-lite`
- `dynamic-chart` — same Vega-Lite rendering as `vega-lite`, but data-driven by a live DOM event instead of a layer/`ctx.data`: `on="<event-name>"` (required — the event to listen for on `<om-map>`), `series-field="<name>"` (default `series`) reads `event.detail[seriesField]` as the chart's `data.values` and re-embeds on every event where that field is a present array; `width` (fixed, default 280) and `title` work the same as `vega-lite`. The child `<script type="application/json">` spec is the same Vega-Lite mark/encoding shape, minus `data` (supplied live). A feature "freezes" the chart for free by simply not including the field on a later event (e.g. switching modes) — the widget has no separate pause API, it just does nothing when the field is absent. Built for a feature that computes its own series as the user interacts (a drawn line's elevation profile updating vertex-by-vertex) and has no layer of its own to bind to.
- `player`
- `basemap-switcher` — radio list of presets; `options="positron dark-matter osm"` (default: every keyless registered preset)
- `lighting` — scene-lighting controller: preset radios (Off/daylight/studio/flat/custom) + ambient/sun/azimuth/elevation/camera sliders, all over the lighting* attributes via `set-lighting` (undoable; re-syncs when anything else writes them). A bare preset click is a clean RESET (stale lighting-* overrides removed); a slider edit flips to `custom` and sets only the touched key.
- `widgets-toggle` — one button hiding/showing all OTHER widgets (`widgets-hidden` attribute / `set-widgets-visible {visible}` action; bare payload toggles). Hidden = visibility, never removal — widget state survives; attribution and the toggle itself never hide. Transient (not an undo step), story-scrub-capturable.
- `undo-redo` — undo/redo buttons over the manifest history (layer toggles, filters, basemap switches, element edits, drawn sketches). Keyboard works without the widget: Cmd/Ctrl-Z, Shift-Cmd/Ctrl-Z, Ctrl-Y. Camera moves, hover effects, and story playback are not undo steps.
- `ifc-browser` — the model browser (registered as `ifc-legend` too, the deprecated original name): group the model by any property-table field, colour it, and isolate/hide/ghost per value. `layer` names the `pick-features` layer (defaults to the only one on the map), `fields="ifcClass material container"` are the group-by choices, `scale-fields="netVolume"` adds graduated numeric ramps, `rows="9"` caps the visible list before it scrolls. Each row has I/H/G buttons that write `isolate-features`/`hide-features`/`ghost-features` — so the panel is a UI over the attributes, and everything it does is undoable and story-steppable. **I is multi-select**: pressing it on several rows (or several tree nodes) isolates their union, and pressing it again on one removes just that one, so "ground floor AND roof" is a normal thing to ask for. In a tree, ancestors of an isolated node stay legible so the branch is still reachable from the root. It also keeps the companion outline layer's `filter-categories` in step, or hidden elements would leave their edges behind. Colour mode defaults to the model's own IFC surface colours; `no-color` removes the select. Non-physical classes (`IfcSpace`, `IfcOpeningElement`, …) are hidden from the list unless `show-non-physical` is set, because they otherwise dominate the counts with things nobody can see.

  The select additionally offers whichever **trees** the file supports: **Spatial** (`spatialPath` — IfcSite → IfcBuilding → IfcStorey → space), **Type** (`typePath` — IfcDoorType → Single-Flush), **System** (`systemPath` — a distribution system and its parent systems) and **Classification** (`classificationPath` — CCS → [L]BB Fundamentskonstruktion, built by walking `ReferencedSource` rather than parsing the code string, which would only work for whichever scheme's punctuation you guessed). Each renders expandable, counts aggregated upward, with the same I/H/G on every node — isolating a storey, a system or a classification code reaches every element beneath it. Spatial is not privileged: on a real Danish project the classification tree covered 3,415 elements against spatial's 660.

  A tree is **not** a separate mode — it groups by a hierarchy column exactly as the list groups by `ifcClass`, so it reuses the reset-on-field-change rule, the colour wiring and the isolate/hide/ghost attributes untouched, and a fifth tree would cost one column plus one line. `loadIfc` extracts every hierarchy a model has and emits a column **only when the file populates it** (all four measured at 26 ms of a 290 ms relationship pass on 2,626 elements, and lost in the noise on a 74 MB one), so a tree that would render empty is never offered and an authored hierarchy field in `fields` is dropped rather than shown dead. Trees appear automatically when available — you do not have to list them — while `field="spatialPath"` opens straight onto one. Tilesets converted before these columns existed carry none. Elements with no container get their own bucket rather than disappearing. **One browser per layer:** `feature-filter-field` and the isolate/hide/ghost attributes are single-valued, so two instances pointed at one layer would clobber each other's filtering.
- `ifc-clash` — clash overlay over two CO-REGISTERED model layers. With no `layers` attribute it offers two SELECTS over whatever models are loaded, which is how coordination tools work (append models, then choose a pair) and the only shape that survives a project with five disciplines; `layers="arch mep"` still pins a fixed pair. Controls follow Navisworks' Clash Detective, which is what a coordinator already knows: a **highlight-all** switch in the header, and an **isolation MODE** above the list (`none` / `dim others` / `hide others`) rather than independent toggles — two switches would offer four states, two of them meaningless. Isolation applies to the SELECTED clash, so with nothing selected the model is untouched. Hiding is `opacity: 0`, a shader discard, not partial transparency. Sides are red and BLUE rather than Navisworks' conventional red/green, which is the worst possible pair for a red-green deficiency. CLICKING A ROW focuses that clash: the chosen pair goes full strength, every other clashing element drops to a faint tint, and the camera flies to the centre of the overlap. Without focus, painting all 527 clashing elements the same red means flying to one shows you a red building. Results are GROUPED by the element on side A — one wall crossing four ducts is one row with a count, not four, which is how coordination tools report and what keeps a four-figure result readable. Starts COLLAPSED with the count in its header — a real pass returns four figures of rows and a permanently open list buries the model. Attributes: `tolerance` in metres of real interpenetration before a pair counts (0 reports any overlap), `rows`, `zoom`. Flags element pairs whose bounding boxes interpenetrate, colours both sides through `feature-styles` (which outranks `feature-color-by`, so clearing it hands the colouring back), and gives each pair a Z button that flies to the centre of the OVERLAP rather than of either element. v1 is an axis-aligned box test — it finds a duct through a roof in milliseconds with no server, and it over-reports anything diagonal, since a brace's box is far bigger than the brace. Zones, spaces, openings and proxies are excluded (a zone is a volume, so a box test says it intersects everything inside it), as are pairs sharing a class and name, which are reference markers repeated across disciplines. Persisting or sharing results is what BCF exists for and is not attempted. **Co-registration is checked, not assumed**: differing `site-origin` values are reported rather than silently returning zero, because two mis-registered models look exactly like two clean ones.
- `feature-inspector` (renamed from `ifc-inspector`, which still works as an alias — the widget's body is generic property-row rendering with no IFC dependency, so it works unchanged on any `pick-features` layer, IFC-derived or not) — properties of the currently picked element. `fields="ifcClass material container netVolume"` chooses the rows, `placeholder` is the nothing-selected text. Reads the same property table picking resolves, so it needs no data of its own.
- `ifc-loader` — a drop zone that parses an `.ifc` in the browser and builds the layers for it (see **In-browser IFC** below). Add `federate` and ONE drop zone accepts several models into a co-registered scene — one layer per model, each with its own visibility toggle and remove button — instead of dedicating a widget per discipline. Under `federate`, the FIRST model loaded decides the shared model-space origin and placement, and every later model inherits both (discipline exports of one building routinely disagree by kilometres, so honouring each file's own would scatter it); add `independent` to opt out when the models are unrelated buildings rather than disciplines of one. That sharing never applies without `federate` — a plain loader always resolves each new file's own georeference — and it resets once every model in a federated scene is removed, so the next one dropped in starts fresh rather than inheriting a dead scene's position. `layer="ifc"` is the id it creates (plus `<id>-edges`), `zoom` the flyTo zoom, `field` the filter field, `outline-color`/`no-outlines`/`ghost-opacity` tune what it builds, and `site-origin`/`site-heading`/`site-scale` override what the file declares. If a loaded model turns out to be georeferenced it is AUTO-PLACED: the widget writes the file's own coordinates, heading and scale onto the layers it CREATED and flies the camera there — but it NEVER touches `<om-map>`'s own scene attributes (`basemap`, `terrain`): those are author-owned, and a georeferenced model landing on a map with neither raises a structured warning ("no spatial context") instead of switching one on.

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
<om-widget type="filter" layer="quakes" field="time" format="date"
           date-style="datetime" time-zone="UTC" position="bottom-center"></om-widget>
<om-widget type="draw" target="sketch" modes="point line polygon" save="both"></om-widget>
<om-widget type="basemap-switcher" options="positron dark-matter liberty osm" position="top-right"></om-widget>
```

### Custom widgets & event emission

**Reach for a built-in first.** A plain value/time slider is a built-in:
`<om-widget type="filter" layer="quakes" field="time" format="date">` — it
renders readable date labels AND wires the `filter-layer` action for you (pair
it with the layer's `filter-field`). Author a custom widget ONLY for bespoke UI
or logic the built-ins don't cover — most "it looked right but didn't work"
widgets should have been a `type="filter"`/`legend`/`vega-lite` built-in.

A custom widget is an `<om-widget>` with **no `type`** plus inline HTML and a
`<script type="om/widget">` block. The script is full JS, evaluated ONCE at
connect with `this` bound to the `<om-widget>` element: set `this.watch` (a
list of re-render triggers) and `this.render = (ctx) => {…}`. `vegaEmbed`/`d3`
are available. Content renders in shadow DOM — reach it with `this.$(selector)`
and `this.root`.

**Read map state** through `ctx` (the `render` argument), re-rendering when a
watched token fires:

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

- `ctx.layers`
- `ctx.data(id)`
- `ctx.dataInViewport(id)`
- `ctx.stats(id, field, { scope: "viewport" })`
- `ctx.selection`
- `ctx.viewport`
- `ctx.features(layerId)` — the decoded `EXT_structural_metadata` property table of a `pick-features` tileset, one row per element, or `undefined` before the first tile carrying one has landed. This is what a BIM panel groups and counts by; pair it with the `features` watch token, since the table cannot exist on the first render.
- `ctx.history` — `{ canUndo, canRedo }`; re-render on changes via the `history` watch token
- `ctx.emit(action, payload)`

Watch tokens: `data:<layerId>`, `viewport`, `selection`, `layers` (fires on layer add/remove, visibility, and filter changes), `features` (fires when a tileset's property table decodes), `basemap`, `lighting`, `terrain`, `history`, `widgets` (fires on a `widgets-hidden` hide-all toggle). An EMPTY `watch` array means the widget never re-renders — omit it or list tokens, never `watch: []`.

**Drive the map — the emission contract.** This is the part authors get wrong.
A widget NEVER mutates the map directly and NEVER dispatches its own
`CustomEvent` hoping the map listens. It **emits a registered action**, exactly
two ways:

1. **Declarative `data-emit`** (no script): `data-emit="<action>"` + `data-*`
   payload keys on an element. Fires on **click** (non-form elements) or
   **change** (form controls — `input`/`select`/`textarea`, whose `.value` is
   auto-merged into the payload). `data-*` keys camelCase (`data-feature-id` →
   `featureId`) and arrive as **strings** — fine for `toggle-layer`/`fly-to`,
   but a numeric/array payload (a slider's `range: [min, max]`) needs `ctx.emit`.
   ```html
   <button data-emit="toggle-layer" data-layer="quakes">Toggle quakes</button>
   ```

2. **Programmatic `ctx.emit(action, payload)`** — for typed payloads. Wire it
   INSIDE `render` so `ctx` is in scope, assigning `.oninput`/`.onclick`
   (idempotent across re-renders; prefer over `addEventListener`, which stacks a
   fresh listener every render):
   ```html
   <om-widget position="bottom-center">
     <input id="day" type="range" min="1" max="14" step="1" value="1">
     <script type="om/widget">
       this.render = (ctx) => {
         this.$("#day").oninput = (e) => {
           const d = Number(e.target.value);
           ctx.emit("filter-layer", { layer: "quakes", field: "day", range: [d, d] });
         };
       };
     </script>
   </om-widget>
   ```

**NEVER inline handlers** (`onclick="…"`, `oninput="ctx.emit(…)"`): `ctx` is not
a global, they execute in page scope, and CSP blocks them — the widget looks
right and silently emits nothing. This is the #1 custom-widget failure, and
validation errors on it.

**Actions a widget can emit** (payload keys): `filter-layer`
`{layer, field?, range:[min,max]}` (value/time sliders), `toggle-layer`
`{layer, visible?}`, `fly-to` `{center:[lng,lat], zoom?, pitch?, bearing?,
duration?}`, `zoom-to-feature` `{layer, featureId, duration?}`, `set-basemap`
`{basemap}`, `set-lighting`/`set-terrain`, `highlight-feature`
`{layer, featureId}`, `show-overlay`/`hide-overlay` `{target}`,
`story-play`/`story-pause`/`story-seek` `{story, t?}`, `undo`/`redo`,
`zoom-in`/`zoom-out`, `set-widgets-visible` `{visible}`. Register your own with
`OmMap.registerAction(name, (payload, mapEl) => …)`.

### `<om-overlay>`

Rich sparse HTML anchored to the map.

Anchors:

- `anchor="[lng, lat]"`
- `anchor-from="selection"`
- `anchor-layer="regions" anchor-feature-id="mission"`

Selection scoping (both only apply with `anchor-from="selection"`):

- `layer="quakes"` — only that layer's picks move/re-template the overlay.
- `selection-type="click"` (or `"hover"`) — only that pick type does. A click-opened popup NEEDS `selection-type="click"`: without it, merely hovering any pickable feature drags the popup there and re-interpolates its template against the hovered object (wrong-layer ghost popup). With it, hover is inert and a click on empty space still dismisses. `"hover"` is the mirror for hover-driven overlays.

Viewport clipping:

- `clip-to-map` — hide the overlay when its own BOX would spill past the map viewport, not just when its anchor leaves (the default). Opt-in, because an overhanging absolutely-positioned box inflates the page's scrollable overflow, and the resulting scrollbar → map resize → reprojection loop shows as view jitter. Use it for small transient tips that track the cursor; an authored popup near an edge normally wants to keep showing its visible half.

Templates:

- `{{field}}` HTML-escaped interpolation.
- `{{{field}}}` raw HTML; avoid unless trusted.
- `{{z}}` — the pick's elevation in meters, present only when a `pickable="3d"` layer ran the depth pass for it (see `<om-layer>`'s `pickable` above). Absent, not `0`, otherwise.

Example:

```html
<om-overlay id="detail" anchor-from="selection" selection-type="click" visible="false">
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
- `highlight-feature` — sets the layer's `highlighted-id`; style the selection with `highlight-color="[220, 38, 38, 255]"` (or hex) on the `<om-layer>` — a constant color, not a `get-*` accessor
- `zoom-to-feature`
- `filter-layer`
- `set-basemap` — payload `{ basemap }`; writes the `<om-map basemap>` attribute
- `undo`, `redo` — step the manifest history (no payload)
- `zoom-in`, `zoom-out`
- `fly-to`
- story actions: `story-play`, `story-pause`, `story-seek`
- effect actions: `fade`, `pulse`, `trace`, `populate`
- draw actions: `draw-mode`, `draw-commit`, `draw-cancel`, `draw-delete`, `draw-clear`, `draw-config`, `draw-save`
- measure actions: `measure-mode` (`{mode: "distance"|"area"|"volume"|null}`), `measure-units` (`{units: "metric"|"imperial"}`), `measure-clear`, `measure-config` (`{profile?, baseSurface?, density?, swell?, shrink?, deadband?}`), `measure-flat-target-plane` (`{flat}` — volume mode's target-surface switch)
- clip box: `set-clip-box` (`{min, max, invert?, highlight?}`, or `{clear: true}` to remove it), `clip-box-edit` (`{editing}` — shows/hides the draggable face gizmos)
- region export: `export-region-3d` (`{target?: "sketch", format?: "glb"|"b3dm"}`) — clips the drawn footprint's 3D content and downloads it; this is what the `draw` widget's `export-3d` button emits

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

### Per-element (BIM) picking and styling

A plain `pickable` `Tile3DLayer` picks a whole TILE. To pick individual
elements — a wall, a window, one IFC product — add `pick-features`. The pick's
`selection` then carries `featureId`, `properties` and `class` resolved from the
tile's own `EXT_mesh_features` + `EXT_structural_metadata`:

```html
<om-layer id="building" type="Tile3DLayer"
            tileset="https://example.com/tileset.json"
            pick-features
            feature-id-property="_FEATURE_ID_0"
            load-options='{"gltf":{"loadBuffers":true,"loadImages":true},"image":{"type":"data"}}'
            pickable></om-layer>
```

`feature-styles` recolours, fades or highlights elements by feature ID — an
array indexed BY id, each entry `{color: [r,g,b], strength: 0-1, opacity: 0-1}`.
Set it live (from a widget, a dropdown, a pick handler) and only a small lookup
texture is re-uploaded; no refetch, no re-tesselation:

```html
<om-layer id="building" type="Tile3DLayer" tileset="…" pick-features pickable
            feature-styles='[{"color":[90,200,255],"strength":0.5},{},{"color":[255,215,130],"strength":0.9}]'></om-layer>
```

Use `strength` below 1 to TINT rather than replace — a full-strength colour hides
the model's own texture entirely.

**Isolate / hide / ghost** are declarative, and mirror the vector
`filter-field` + `filter-categories` pair: name the metadata field once, then
list values per state. Values are JSON arrays, matched against the tile's own
property table:

```html
<om-layer id="building" type="Tile3DLayer" tileset="…" pick-features pickable
            feature-filter-field="component"
            hide-features='["Windows","Skylight"]'
            ghost-features='["Wall"]'
            ghost-opacity="0.18"></om-layer>
```

- `isolate-features` is exclusive — anything NOT listed is hidden, so it is a
  scope rather than another kind of hide.
- Hiding is a shader `discard`, so a hidden element also stops being pickable
  and you can select whatever sits behind it.
- These compose ONTO `feature-styles` rather than replacing it: the style table
  supplies colour, these supply visibility. Changing colour scheme never
  un-hides anything, and isolating never drops your colouring.
- Being attributes, they are undoable and story-steppable — prefer them over
  computing a `feature-styles` table in page JS.

**Colour by property.** `feature-styles` is indexed by feature ID, which means
computing a table by hand. These name a property-table FIELD instead and build
that table for you, once the table arrives with the first tile:

```html
<om-layer id="clinic" type="Tile3DLayer" tileset="…" pick-features pickable
            feature-color-by="material"></om-layer>
```

- `feature-color-by` is CATEGORICAL — one palette entry per distinct value.
  `feature-palette='["#4f7cff","#ff9a3c"]'` overrides the built-in
  colour-blind-safe cycle.
- `feature-color-scale` is GRADUATED over a numeric field.
- `feature-color-strength` (default 0.85) is how hard the colour is mixed over
  the model's own material; below 1 tints rather than replaces.
- Setting NEITHER is meaningful, and is the default: the model renders in its
  own IFC surface colours, which is what someone opening a building expects.
  Reach for these to answer a question, not to make it look coloured.
- An authored `feature-styles` always wins — these are sugar over the same
  table, never an override of it.

A graduated ramp needs the field to actually be populated. Revit IFC2x3 exports
frequently carry no `IfcElementQuantity` at all, so every `netVolume` is 0 and
the ramp renders flat — check the property table before blaming the ramp.

**Georeferencing — `site-origin` / `site-heading` / `site-scale`** (Tile3DLayer
and PathLayer). Where a model sits is a viewing decision, not a conversion one,
so it lives on the layer:

```html
<om-layer id="clinic" type="Tile3DLayer" tileset="…/tileset.json" pick-features pickable
            site-origin="[-71.059776, 42.358429]" site-heading="32" site-scale="1"></om-layer>
```

- `site-origin` is `[lng, lat]` or `[lng, lat, elevation]`, and it OVERRIDES the
  position baked into the tileset's root transform rather than offsetting it.
- `site-heading` is a bearing — degrees CLOCKWISE from true north. On its own,
  with no `site-origin`, it rotates the model where it stands.
- Rotation and scale pivot on the model's own anchor, not the tileset origin,
  so a heading change spins the building about itself.
- An IFC model is a PAIR of layers — the mesh tileset and a `PathLayer` outline
  overlay whose paths are local east/north/up metres — and both need the same
  three values, or the building walks away from its own edges. The
  `ifc-loader` widget sets them on both for you.
- Do not trust a model's declared position without looking at it. Authoring
  tools ship a default project location, and a default is indistinguishable
  from a survey: the buildingSMART Medical-Dental Clinic sample carries Revit's
  Boston default and the Duplex a Chicago city-centre point, so both land on
  occupied downtown blocks at an arbitrary rotation. `IfcMapConversion` (real
  georeferencing) is absent from most IFC2x3 exports and `TrueNorth` is
  routinely unset — which is exactly what these attributes are for.
- Editing `site-*` on a live Tile3DLayer reloads the tileset (deck.gl only
  reloads on a URL change, so the runtime cache-busts the URL). The outline
  PathLayer updates as a uniform, with no reload.

Three constraints worth knowing before promising this to a user:

- Multi-material models are fine: glTF allows one material per primitive, so a
  five-material house is five primitives and a real IFC export is often dozens —
  all of them get per-element picking. Only genuinely instanced (i3dm) tiles fall
  back to tile-granularity picking, where `feature-styles` does nothing.
- Datasets that store IDs in a TEXTURE (photogrammetry classification) need
  `load-options` with `gltf.loadImages`, `gltf.loadBuffers` AND
  `image: {"type": "data"}`. Without the last one the tileset takes minutes to
  appear — loaders.gl otherwise reads the whole ID texture back through a canvas
  once per vertex.
- `opacity: 0` HIDES an element (a shader discard, so it also stops being
  pickable and you can select what is behind it). Partial `opacity` (ghosting) is
  still being validated.

Worked example: `examples/ferry-building-features.html`.

### BIMLayer — declarative in-browser loading

`<om-layer type="BIMLayer" src="./model.ifc">` is the declarative counterpart
to `ifc-loader`/`loadIfc`: point it at a BIM source file (an `.ifc` today,
other formats plug into the same layer later) and it runs the file through
the loader itself the moment `src` resolves — no pre-baked tileset, no
`site-origin`/`site-heading`/`site-scale` (the file's own georeference is
read and applied automatically; the attributes exist to OVERRIDE a wrong or
missing reading, not to restate what the loader already computed — an
authored `site-origin` on a BIMLayer is not wired up yet, a documented gap),
and no separate `<om-layer type="PathLayer">` for the outline overlay (it's
added automatically). Everything else about a picked BIM layer — `pick-features`
(defaults ON, unlike a plain `Tile3DLayer`), `feature-filter-field`,
`feature-styles`, `isolate-features`/`hide-features`/`ghost-features`,
`feature-color-by`, `ghost-opacity` — works exactly as it does on
`Tile3DLayer`, because BIMLayer forwards them to a real `Tile3DLayer` it
builds internally:

```html
<om-layer id="clinic" type="BIMLayer" src="./clinic.ifc"
            label="Medical-Dental Clinic"
            feature-filter-field="ifcClass"
            ghost-opacity="0.15"
            pickable></om-layer>
```

Reach for `BIMLayer` when the model is fixed and known ahead of time
(`examples/features/terrain-3d/inspect-a-bim-model.html`); reach for the `ifc-loader` widget (BIM
workbench) when a visitor picks the file, or when several models need to
federate into one coordinated scene. **Known gap:** the outline overlay does
not yet follow isolate/hide/ghost the way the mesh does — `ifc-browser`'s
visibility sync targets a separate `<layer-id>-edges` element by convention,
and BIMLayer's outline never reaches the DOM as one.

### In-browser IFC

`loadIfc` parses an `.ifc` with web-ifc (WASM) and returns a 3D Tiles model held
entirely in memory — nothing is uploaded and nothing is written to disk. Because
the output IS a tileset, `pick-features`, `feature-styles`, `site-*` and the
declarative isolate/hide/ghost attributes work on it unchanged.

Most pages should not call it directly — `<om-widget type="ifc-loader">` owns
the drop zone, the call, the layer elements, the camera and the blob-URL
lifetime. `examples/features/terrain-3d/inspect-a-bim-model.html` is the whole workflow — a model on load, a drop zone for more, browse and coordinate — in five widget tags.

```js
import { loadIfc, configureIfc } from "@nika-js/onlymap";

configureIfc({ wasmPath: "/vendor/web-ifc/" }); // optional: self-host instead of the CDN
const arch = await loadIfc(archBytes, { onProgress: (m) => console.log(m) });
// FEDERATION: pass the first model's origin so the two share a frame.
const mep = await loadIfc(mepBytes, { origin: arch.origin });
```

Returns `tilesetUrl` and `edgesUrl` (blob URLs — assign to a `Tile3DLayer`'s
`tileset` and a companion `PathLayer`'s `data`), `loadOptions` to pass straight
through, `features` (the property table, for legends and category lists —
`ifcClass`, `name`, `material`, `container`, `netVolume`, plus the hierarchy
columns `spatialPath` / `typePath` / `systemPath` / `classificationPath`, each
joined by `SPATIAL_SEPARATOR` (U+001F, which cannot occur in an IFC label) and
emitted only when the file populates it),
`lonLat`/`georeferenced`/`heading`/`scale`/`originSource`/`headingSource` for
the `site-*` attributes, `stats`, `timings` (ms per phase), `bounds`, and
`revoke()`.

- **Call `revoke()` when you swap models.** Blob URLs are held by the document
  and are not garbage collected.
- **`origin` is federation.** Each model is otherwise centred on its own
  bounding box, so two discipline models of one building drift apart by the
  difference between those boxes — and a clash pass then reports nothing, which
  is indistinguishable from a clean model. Pass the first model's `origin` into
  every later `loadIfc` for the same building. `ifc-loader` does this for you
  per map, and shares the PLACEMENT too (`site-origin`/`site-heading`/`site-scale`):
  discipline files routinely declare IfcSite coordinates kilometres apart for the
  same building, so the first model loaded decides where it goes and the rest
  follow. `independent` opts out.
- Every element also gets a bounding box in the property table
  (`bboxMinE`/`bboxMinN`/`bboxMinU`/`bboxMaxE`/`bboxMaxN`/`bboxMaxU`, tile-local
  metres), which is what `ifc-clash` reads.
- web-ifc is MPL-2.0 and is NOT a package dependency — it is dynamic-imported
  from unpkg on first use, so it never reaches the bundle and pages that never
  open an IFC pay nothing. Measured: the IFC loader chunk is 23.7 KB raw /
  8.5 KB gzipped and contains only the CDN URL; no web-ifc code and no `.wasm`
  ship in `dist/`.
- **For OFFLINE, air-gapped or strict-CSP deployments, self-host it.**
  `npm run vendor:web-ifc public/vendor/web-ifc` copies the four files you need (1.37 MB gzipped — the multithreaded pair is included because `IfcAPI.Init()` picks it whenever the page is cross-origin isolated, so vendoring only the single-threaded pair breaks under COOP/COEP),
  then either `wasm-path="/vendor/web-ifc/"` on the `ifc-loader` widget (no
  script needed) or `configureIfc({wasmPath})` once before the first model
  loads. web-ifc is only ONE of the network dependencies though: a georeferenced
  model makes `ifc-loader` switch a basemap on, which reaches a tile server, so
  offline pages also want `basemap="none"` on the loader and `telemetry="off"`
  on the map. They stay STATIC ASSETS fetched by the same lazy import — the JS
  bundle does not grow. Cost: `web-ifc-api.js` 5.31 MB raw / 0.49 MB gzipped
  plus `web-ifc.wasm` 1.20 MB / 0.44 MB, so ~0.93 MB gzipped, served once and
  cached. (`web-ifc-mt.wasm` is a further 1.22 MB and is only needed for the
  multithreaded path.) Note a dynamic import cannot carry subresource
  integrity, so the pinned version in the URL is the only thing fixing what
  runs — another reason to serve it yourself.
- Position is read from the file, preferring the trustworthy route.
  `IfcMapConversion` — a surveyed placement into a named projected CRS — wins
  over `IfcSite.RefLatitude`/`RefLongitude`, which is very often an authoring
  default. `originSource` says which was used: `"map-conversion"`, `"ifc-site"`
  or `"fallback"`.
- **Anything other than `"map-conversion"` raises a structured `"warning"`**
  through the same validation channel other `om-layer` errors use (visible in
  the on-page panel with `validate` set, and on `om-validation-error`'s
  `detail.warnings`) — for both `BIMLayer` and the `ifc-loader` widget, once
  per layer. It does not flip `valid` to `false`; it flags that the position
  may be off by tens of metres with no rotation correction applied. Override
  with `site-origin`/`site-heading` once the real location is known, or
  re-export the model with a proper `IfcMapConversion`.
- Un-projecting a map conversion covers WGS84 UTM zones analytically, plus
  every CRS in the bundled table `src/crs.ts` shares with the CityJSON
  decoder (Dutch RD, Swiss LV95, ETRS89/UTM, Japan's plane systems, …).
  Anything else is declined with a warning naming the bundled codes, rather
  than approximated — a guessed projection lands the model in another
  country while looking entirely plausible.
- A model aligned to a NATIONAL GRID is not aligned to true north, so the
  grid convergence is measured and folded into the heading. Dutch RD at
  Rotterdam leans -0.735 degrees, and it grows with distance from the
  central meridian.
- The conversion is APPLIED, not just read. It anchors the model's ORIGIN,
  while the tileset is recentred on its geometry, so the full affine
  (offset, grid axis, scale) is applied to the anchor point. Skipping that
  put one Revit export 32.7 m out, its survey point being that far from the
  building.
- `IfcMapConversion` OUTRANKS `IfcSite` for position. Files carrying both
  routinely disagree: one Dutch model's two statements are 108 m apart, and
  the projected pair is the surveyed one. Note the eastings/northings are in the target CRS's own
  unit, which is frequently MILLIMETRES.
- `headingSource` distinguishes `"map-conversion"` / `"true-north"` (read from
  the file) from `"assumed"` (the file was silent and project north was taken as
  true north). Report the assumption; do not let it read as a measurement.
- A file can be perfectly georeferenced and still land somewhere useless: all
  three prepared samples in this repo declare placeholder positions (the clinic
  on Revit's Boston default, which reverse-geocodes to a 1630 graveyard; the
  duplex on a Chicago city-centre point; the bridge, which DOES carry a real
  `IfcMapConversion`, into the mid-Pacific at 179.08E 8.46S). Reading the file
  correctly and the model being in a sensible place are separate problems, and
  `site-origin` is the fix for the second.
- `<om-map>` reads its camera attributes ONCE at init, so `setAttribute("center", …)`
  after mount moves nothing and leaves the model outside the frustum. Use
  `map.flyTo(lonLat, zoom)`.
