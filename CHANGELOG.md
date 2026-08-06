# Changelog

All notable changes to `@nika-js/onlymap`, newest first. The full rationale for
each entry lives in the architecture doc's dated changelog; this is the concise,
version-by-version record.

Note: npm collapsed a few closely-spaced releases — the GPX/FlatGeobuf (0.5.4)
and GeoParquet (0.5.5) work shipped to npm together as **0.5.6**, so npm's
version list jumps 0.5.3 → 0.5.6. Each logical version is listed here regardless.

## 0.6.1 — 2026-08-06

### Added
- **`ylorrd` joins the curated raster colormaps**: the ColorBrewer yellow→orange→red sequential ramp now renders a proper gradient in the legend (any sprite colormap always rendered on the map; only curated names get legend ramps) and is listed in the docs as the gentler alternative to `turbo`/`jet` for heat-like fields.
- **`selection-type` on `<om-overlay>`** (React: `selectionType` on `<OmOverlay>`): scope a selection-anchored overlay to one pick type — `"click"` or `"hover"`. Fixes the reported ghost-popup bug: a popup wired to open on click re-anchored *and re-interpolated its template* on every hover pick (deck fires hover on all pointer movement), so it followed the pointer onto other features and rendered their objects into the wrong template with blank fields — with no author-side workaround. With `selection-type="click"`, hover picks are inert; a click on empty space still dismisses (empty picks now carry the pointer-event type internally), while hovering empty space no longer does. Absent attribute keeps the old behavior. Validation warns on a typoed value and on `selection-type` without `anchor-from="selection"`; the test harness's `clearSelection()` gains a kind (`"hover"` default, `"click"` for empty-space clicks).
- **BIM / IFC support**: `BIMLayer` loads `.ifc` files entirely in the browser (web-ifc WASM, CDN-fetched + integrity-pinned on first use, never bundled) and renders them as 3D Tiles; per-element **feature picking** on `Tile3DLayer` (`pick-features`, EXT_structural_metadata property tables, texture-backed IDs included); declarative **isolate / hide / ghost** (`feature-filter-field` + `isolate-features`/`hide-features`/`ghost-features`) and **style-by-property** (`feature-color-by`/`feature-color-scale`/`feature-palette`); **multi-model federation** (`ifc-loader federate`) and an AABB **clash-detection overlay**; widgets `ifc-loader`, `ifc-browser`, `feature-inspector` (alias `ifc-inspector`), `ifc-clash`; IFC georeferencing via `IfcMapConversion` (UTM + non-UTM projected CRS, grid-convergence heading correction) with a structured warning when a model's placement can't be trusted.

### Changed
- **Explicit-terrain contract for georeferenced BIM**: the auto-terrain reaction — the library writing `terrain="mapterhorn"` onto the map at load time — was removed as a violation of the what-you-write-is-what-you-see contract. In its place, a model that actually resolves real-world elevation (`IfcMapConversion` + `OrthogonalHeight`) loading on a map with no `terrain` attribute raises a structured **error** through the validation channel (report-only, never a write; any authored value satisfies it, including an explicit `terrain="off"`). Checked at load time against the file's resolved facts, so flat models with no elevation data don't false-positive.
- Same contract for **basemap**: the `ifc-loader` widget no longer switches the map's `basemap` on/off as a side effect of a drop — `<om-map>` scene attributes are author-owned. A georeferenced model landing on a map with no basemap and no terrain raises a structured "no spatial context" warning instead.
- Widgets gained a `destroy` teardown hook; removing an `ifc-loader` (or its map) now releases all loaded-model resources.

### Fixed
- **`ZarrLayer` ignored `select` changes**: writing the `select` attribute (the documented animation path) re-rendered stale cached chunks instead of re-slicing — deck's `TileLayer` only refetches when `updateTriggers.getTileData` changes, and that trigger was never wired. Scrubbing or animating any non-spatial dimension now repaints; the store stays open and cached across frames. Also guards a first-paint race on the same path: the frame drawn right after a re-slice could rasterize the reprojection mesh incompletely and stick (nothing scheduled another frame on an idle map) — one extra redraw is now poked in after the tiles load.

## 0.6.0 — 2026-08-06

### Changed
- **Licensing gate reworked: free-tier caps apply only on hosted http(s) pages.** In a dev context — localhost/loopback, `file://`, any non-web scheme, or headless — every cap (5 layers / 25k rows / 20 MB) lifts entirely. The attribution badge stays in all contexts. The exemption is a technical convenience, not a license grant: commercial deployment (hosted or packaged) still requires a commercial key — enforcement for shipped apps is legal, not technical (LICENSE.md §3).

## 0.5.12 — 2026-08-05

### Added
- This `CHANGELOG.md` — a version-by-version record, shipped in the package and mirror.

### Fixed
- **`highlight-color` was silently inert** with the library's own `highlighted-id` / `highlight-feature` selection: the auto-derive compiled it to a function accessor, but deck's `highlightedObjectIndex` path only honors a plain color array — selections rendered in deck's default navy. It now resolves as a constant color (array or hex), which drives both the programmatic-highlight and hover-highlight paths.

## 0.5.11 — 2026-08-05

### Added
- **`ZarrLayer`** — Zarr / GeoZarr raster layer: chunked N-dimensional array data (climate/weather grids, datacubes) rendered on the GPU (`@developmentseed/deck.gl-zarr` + zarrita, a lazy chunk). `variable` + `select="time=0, …"` pick the slice; a GeoZarr store georeferences itself, a plain Zarr takes manual `bounds`/`crs`/`spatial-dims`; `min`/`max`/`colormap`/`nodata` and the legend reuse the COGLayer pipeline. `src` can point at any public, CORS-enabled remote store — no server setup.

## 0.5.10 — 2026-08-04

### Added
- **Dashed lines** — `dash="[6, 3]"` (or SVG-style `dash="6 3"`, plus `dash-justified`) on path-stroking layers (PathLayer/GeoJsonLayer/PolygonLayer/TripsLayer), wired through deck's `PathStyleExtension`.

## 0.5.9 — 2026-08-04

### Fixed
- Layers now render across the antimeridian and when zoomed out past a single world copy (standalone maps set `MapView({ repeat: true })`). Previously, data near ±180° or a wide zoomed-out view went blank.

## 0.5.8 — 2026-08-04

### Fixed
- **COGLayer** works from a CDN / cross-origin build. Its decode worker is now inlined as a same-origin blob and asset paths are relative (`base: "./"`); previously it rendered nothing on any built page served from a CDN (present since 0.5.2).

## 0.5.7 — 2026-08-04

### Added
- **`ImageOverlay`** — georeferenced drone-JPEG overlay: reads GPS/EXIF + DJI-XMP, computes a flat-ground WGS84 footprint, bakes yaw/roll. `OmMap.resolveImageOverlay(fileOrUrl)` preprocesses once for persistence; explicit `bounds` reconstructs without re-reading EXIF.

## 0.5.6 — 2026-07-31

### Added
- **Safe date formatting** — `formatDate($time, 'datetime', 'UTC')` turns epoch-millisecond/ISO fields into readable `get-text` labels without enabling arbitrary JavaScript; the built-in filter widget shares the contract.

## 0.5.5 — 2026-07-31

### Added
- **GeoParquet** data format (`.parquet` / `.geoparquet`) — cloud-native columnar vector: all-Point files stay columnar, lines/polygons become GeoJSON features; requires the `geo` metadata (WKB) and CRS84/EPSG:4326.

## 0.5.4 — 2026-07-30

### Added
- **GPX** (`.gpx`, waypoints/tracks/routes, `#fragment` part selection) and **FlatGeobuf** (`.fgb`, cloud-native binary vector) data formats.

## 0.5.3 — 2026-07-30

### Added
- **`measure` widget** — geodesic distance and area with live per-segment/total labels, a metric/imperial/nautical units toggle, and an `om-measure` readout event.

### Changed
- Validation flags a data-driven expression (`$field`, `scale()`, …) placed on a scalar attribute — the silent "invisible layer / black squares" trap.

## 0.5.2 — 2026-07-29

### Changed
- Made `om-map-point` (raw map click/hover capture) discoverable by task in the skill and `llms.txt`, steering agents away from poking deck.gl internals.

## 0.5.1 — 2026-07-29

### Added
- **Tiled layers** — `{z}/{x}/{y}` `data` templates for `TileLayer`/`MVTLayer` (raster templates get a built-in `BitmapLayer` sublayer; MVT self-renders with `get-*` accessors on decoded features).

## 0.5.0 — 2026-07-28

### Added
- **CityJSON / CityJSONSeq** ingestion — semantic 3D city models decoded to extruded footprints, or per-face surfaces with `?om-surfaces=1`; national coordinate grids reproject automatically.
- First-shot layout guardrail: a bare `<om-map>` with no author height still renders (injected `display:block` default + 400px floor + an actionable console warning when it still collapses).

### Changed
- The free-tier per-layer row cap now truncates to the first rows with a dismissible on-map notice instead of hard-dropping the layer.

## 0.4.x — 2026-07-22…27

### Added
- Managed, adaptive **widget layout**: eight logical `position` slots, same-slot stacking with shared gaps, compact-button clustering, automatic folding into drawers on narrow maps, and the `check-layout` CLI that audits a manifest's widget layout in headless Chromium.

### Fixed
- Post-publication review hardening across the layout and widget features.

## 0.3.x — 2026-07-16…

### Added
- Native **GeoTIFF / Cloud-Optimized GeoTIFF raster** layer (`COGLayer`) with `min`/`max` rescale and bundled colormaps.
- A full 3D scene from attributes: `terrain`, scene `lighting`, and canvas `snapshot()`.
- CDN-delivery posture: a single-file standalone bundle plus raw-file-CDN guidance.

## 0.2.x

### Added
- The v0.2 format registry: CSV/TSV (typed columns), Shapefile (+`.dbf`), KML, and Apache Arrow / GeoArrow (a columnar fast path).
- First public npm release of `@nika-js/onlymap`.

## 0.1.x

### Added
- The initial declarative core: `<om-map>` / `<om-layer>` / `<om-widget>` / `<om-overlay>` / `<om-behavior>`, the manifest reconcile loop, the `get-*` accessor expression compiler, and MapLibre basemaps — no build step, no imperative deck.gl code.
