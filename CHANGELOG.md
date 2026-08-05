# Changelog

All notable changes to `@nika-js/onlymap`, newest first. The full rationale for
each entry lives in the architecture doc's dated changelog; this is the concise,
version-by-version record.

Note: npm collapsed a few closely-spaced releases — the GPX/FlatGeobuf (0.5.4)
and GeoParquet (0.5.5) work shipped to npm together as **0.5.6**, so npm's
version list jumps 0.5.3 → 0.5.6. Each logical version is listed here regardless.

## 0.5.12 — 2026-08-05

### Added
- This `CHANGELOG.md` — a version-by-version record, shipped in the package and mirror.

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
