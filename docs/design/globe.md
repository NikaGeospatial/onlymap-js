# Globe view — scope

*Draft 2026-10-08; the basemap path (phase 0 and 1) is built — see "As built" at the end. Tracks onlymap-js #48 (split out of #2, step 3). Builds
on the architecture doc's Q10, which already chose the attribute and named the risks;
this turns that into a build plan against the installed libraries.*

## What it is

`<om-map projection="globe">` draws the Earth as a sphere you can spin. When zoomed far
out it is a globe; when zoomed in it becomes an ordinary flat map. It is for
whole-hemisphere and polar maps: Antarctica, flight routes, global datasets.

**What stays the same:** data stays longitude/latitude. `$field` accessors, the
manifest, reconciliation, widgets, legends and `ctx` are untouched. The authored camera
stays `center` + `zoom`, as it already does on a projected (`crs=`) map, so stories,
`seek()` and `getCamera()` keep their shape.

## What the installed libraries give us (verified 2026-10-08)

| Library | Globe support | Limits that shape this design |
|---|---|---|
| deck.gl 9.3.5 (exact pin) | `_GlobeView`, `_GlobeViewport`, `_GlobeController` — **underscore = experimental**, no stable export | The globe camera has **no pitch or bearing**; the controller disables rotation. Above **zoom 12** the view hands over to a flat `WebMercatorViewport`. `getBounds()` samples four edge midpoints, which is wrong when a pole or space is in view. `unproject` of a point in space clamps to the limb instead of returning nothing. |
| maplibre-gl 5.24 | `setProjection({ type: "globe" })` on a live map; style-level `projection` | Live switching between globe and Mercator is supported. MapLibre's globe also blends to Mercator at high zoom. |
| @deck.gl/mapbox 9.3.5 | `MapboxOverlay` detects MapLibre's globe and switches deck to `GlobeView`, resetting views on style change | Any other non-Mercator MapLibre projection (e.g. `vertical-perspective`) throws "Unsupported projection". |

deck.gl guards a few things itself: MaskExtension warns, MVTLayer drops binary mode,
the 2D tileset has a globe traversal branch, ArcLayer draws great circles, PathLayer cuts
paths. **The aggregation layers (Heatmap, Hexagon, Grid, Contour) and TerrainLayer have
no guard** — they break silently, so validation has to say so.

## Two renderer paths

1. **With a basemap** (`basemap="satellite"`, `"positron"`, …). MapLibre owns the camera
   and draws the globe; one `setProjection` call in the MapLibre adapter, and the overlay
   follows. This is the showcase: a satellite globe, keyless, the day it ships.
2. **Without one** (`basemap="none"`, optionally an image `TileLayer` as the surface).
   deck owns the camera: `_GlobeView` + `_GlobeController` in place of `MapView`, the same
   seam the projected map already uses for `OrthographicView`.

Both keep `viewState` geographic. The projected-map work left about eighteen
`this.plane` branches in the runtime core (view class, controller, view-state
translation, picking, clustering, raster tiles, viewport wrapping, camera
interpolation); a globe needs a sibling branch at most of them.

## What a globe map cannot do (each a validation error with a fix, as on `crs=` maps)

| Limit | Why | Fix text points to |
|---|---|---|
| `crs` together with `projection="globe"` | a globe is not a plane | pick one |
| `terrain` | TerrainLayer is unsupported on deck's globe | drop it, or use a flat map |
| `pitch` / `bearing` without a basemap | deck's globe camera has neither | a basemap globe, or a flat map |
| Heatmap / Hexagon / Grid / Contour / Screen-grid layers | screen-space aggregation, no globe path in deck | pre-aggregate to polygons (H3 cells work) |
| `MaskExtension` | unsupported, deck only warns | — |
| A globe inside a cartograph frame, and SVG export | a print sheet is flat; the frame's georeference is a plane | a flat or projected map in the frame |

A registry flag (`globeCompatible: false`, mirroring `warpsInPlane`) carries the layer
list, so teaching a layer the globe later is a flag, not a validator edit.

## What has to change, in our code

- **Camera:** view and controller choice, view-state translation, the zoom-22 clamp,
  double-click zoom (its maths assumes Mercator), `flyToBounds` (the globe viewport has no
  `fitBounds`).
- **Picking and clicks:** a click in space must report no coordinate, not the limb point
  deck clamps to.
- **Overlays:** `<om-overlay>` needs a far-hemisphere test. Today it only hides points
  behind the camera, and a point on the back of the globe still projects to a pixel.
- **Anything that uses the viewport's lng/lat rectangle:** clustering, viewport
  filtering, `ctx` stats. On a sphere the visible area is a cap that can contain a pole
  or cross the antimeridian. First release: compute a correct cap; failing that, disable
  clustering with a warning, as projected maps do today.
- **Camera flights:** `flyTo`, story steps and `seek()` all interpolate along a Web
  Mercator arc (`tile-warm.ts`, `om-story.ts`). On a globe a flight should follow the
  great circle and pull the zoom out over long legs. `seek()` must give the same frame as
  live playback, because onlymap-remotion records stories frame by frame through it.
  Tile warming builds Mercator viewports and would pre-fetch the wrong tiles.
- **Widgets:** scale bar, draw and measure use the Mercator metres-per-pixel formula;
  correct at the centre, wrong toward the limb. Measure's distances already use
  haversine and stay correct.
- **Curved labels (`TextOnPathLayer`):** project paths to the screen and back; far-side
  and limb points need culling.

## Decisions needed

- **G1 — live or fixed?** `crs` is fixed for a map's life because it re-ingests data. A
  globe does not re-ingest anything, and MapLibre switches live. **Recommend live:**
  `projection` can change on a mounted map, and a `set-projection` action plus a toggle
  in the basemap switcher make "zoom out to the globe" one click.
- **G2 — which path first?** **Recommend the basemap path first.** It is the smaller
  change (MapLibre does the sphere), it covers most real maps, and the satellite globe is
  the demo. Standalone follows.
- **G3 — incompatible layers: error or warning?** **Recommend error**, the `crs=`
  precedent: a layer that silently draws nothing or draws garbage is the failure this
  library exists to prevent.
- **G4 — how to label it.** deck's globe is experimental (underscore APIs, an exact
  pin). **Recommend shipping it documented as a preview** for its first minor, with the
  limits table above in the docs, and dropping the label once deck stabilises the API or
  we have run it through a release cycle.

## Measure before building

These decide whether the basemap path is as small as it looks:

1. **Alignment.** deck layers over MapLibre's globe at zoom 1, 4, 8, 11, 12, 13 and
   pitched. deck's globe camera ignores pitch; if MapLibre's pitched globe and deck's
   overlay disagree, the basemap path needs `max-pitch="0"` on a globe until fixed.
2. **The zoom-12 handover.** Both libraries switch to flat Mercator near zoom 12, by
   different rules. Points must not jump across it.
3. **Picking off the sphere** in both paths.
4. **Story determinism.** A globe story seeked twice gives byte-identical frames.

## Plan

| Phase | Scope | Rough effort |
|---|---|---|
| 0 | The four measurements above, as browser tests that start red | half a day |
| 1 | `projection="globe"` on the basemap path; validation table; registry flag; overlay far-side culling; space clicks; docs | 2 days |
| 2 | Standalone globe (`_GlobeView`), image TileLayer as the surface, controller, `flyTo` / `flyToBounds` / double-click | 2 days |
| 3 | Great-circle flights for `flyTo`, stories and `seek()`; tile warming; an onlymap-remotion parity run | 2 days |
| 4 | Spherical-cap viewport for clustering and filtering; scale bar, draw and measure at the limb; curved labels | 1–2 days |

Phases 1 and 2 are a releasable feature, labelled preview (G4). Phase 3 is required
before the docs can say stories work on a globe. Phase 4 can follow.

**Not in scope:** a globe in a cartograph frame or SVG export (flat outputs), terrain on
a globe, pitch on the standalone globe, other MapLibre projections such as
`vertical-perspective` (the deck overlay throws on them).

## Downstream

- **onlymap-remotion** is hit hardest: it drives stories frame by frame through
  `seek()`. Phase 3 must land before it claims globe support.
- **nika-agent:** its cartography skill and vendored llms.txt learn the attribute and its
  limits in the release that ships it.
- **onlymap-native:** nothing beyond the version bump; it hosts the same web map.

## As built (2026-10-08) — the basemap path

The user chose the basemap path. G1, G3 and G4 were taken as recommended: live,
errors, preview.

**Measured** (`e2e/globe.spec.ts`; synthetic basemap tiles paint a disc at each place,
deck paints a dot, both must land on `map.project()`):
- deck and MapLibre agree to within **0.5 px** at every zoom from 1.6 to 12.4,
  including the 10–12 range where MapLibre blends its globe into the flat map and deck
  switches at 12. The handover was the feared failure; it is not one.
- **Pitch is the real misalignment:** at 40° deck's dots missed by up to 13 px and some
  vanished — deck's GlobeView has no pitch or bearing. So a globe is held flat-on and
  north-up (`applyCameraLimits` in the adapter: max pitch 0, rotation gestures off,
  camera levelled on switch) and authored `pitch`/`bearing` are validation errors.
- **A test-machine trap, recorded so nobody chases it again:** on this Mac's default
  headless Chromium backend (ANGLE over desktop OpenGL), BOTH renderers drew the globe
  ~1 km poleward of `project()` — 11 px at z10 over 45°N, zero at the equator. Bare
  MapLibre with no OnlyMapJS reproduced it; Firefox, WebKit and Chromium on Metal drew
  it exactly. The globe suite runs Chromium with `--use-angle=metal`.

**Layers, rendered one by one on the globe:** ScatterplotLayer, PathLayer (and its far
side culls correctly), image TileLayer, HillshadeLayer and clustering draw. HeatmapLayer
(nothing, plus a luma binding error), HexagonLayer (a speck), TextLayer, IconLayer,
TextOnPathLayer, PopupLayer and ArcLayer (with or without `great-circle`) do not. Text
and icons are culled: their quads are wound the other way round, and GlobeView culls
back faces to hide the far side; `cullMode: "none"` draws them, far side and all, so
that is not a fix. The list is `NOT_ON_GLOBE` in `layer-registry.ts`; each is a
validation error with a type-specific fix. Clustering warns (counts are text).

**Interaction:** far-side `<om-overlay>`s hide (the adapter's `project()` returns a
negative depth for an occluded point, the existing behind-camera signal); a click in
space reports no coordinate (`unproject()` → null, `om-map-point` coordinate null).
Both use MapLibre's internal `transform.isLocationOccluded` / `isPointOnMapSurface`
behind type checks, with a geometric round-trip fallback, since maplibre-gl is a caret
range.

**Surface:** `projection` on `<om-map>` (live), `set-projection` action (story-captured),
`MapController` `projection` option + `setProjection`, React `<OmMap projection>`. A
standalone (no basemap) map ignores the attribute with one console error.

**Found on the way, older than the globe:** a fixed-anchor `<om-overlay>` on a basemap
map stayed hidden until the first camera move — overlays were positioned only before
MapLibre had loaded (no viewport) and on camera moves. Fixed: one flush when the
renderer loads.

**Not built (phases 2–4):** the deck-only globe; great-circle flights for `seek()`
(stories are documented as unchecked on a globe); text, icons and arcs on a globe; the
spherical-cap viewport for clustering and filtering.
