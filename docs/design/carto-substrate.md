# Cartographic substrate — plane view, geometry transforms, vector export

Design for the layer beneath the cartograph overhaul: **real projections**,
**geometry the data doesn't contain**, and **vector output**.

**Versions are assigned at release, not here.** The phases in §9 are independently
shippable and deliberately not mapped onto a fixed set of version numbers: there are
several of them, the warp is plausibly a release on its own, and an earlier draft of this
line had already gone stale before anything was built. Each phase lands as a minor
while pre-1.0, which is also the only boundary at which the bundled deck.gl pin may
move — nothing here requires it to.

The goal is flexibility of the cartograph use case — a sheet that can be in Albers or
British National Grid, whose coastlines are smoothed and whose land carries a coastal
vignette, and whose frozen frame is editable vector rather than a bitmap — **without a
second renderer**. Everything here is a lazy chunk in core that the cartograph calls
through the seam it already has.

Every file, line and mechanism below was read in this codebase or in the pinned deck
(9.3.5). Where a claim rests on a prior decision, the decision is cited. Where a
number appears — buffer accuracy in §5, warp subdivision and projection scale factors
in §9 — it was **measured**, not estimated, against analytically exact references; the
harnesses are small and standalone, and the phase gates re-run them.

---

## 1. Why not a second renderer (the decision this document rests on)

The two capabilities a second renderer would buy are non-Mercator projections and
vector output. Neither needs one:

- deck's maintainers' own path for a non-Mercator map is *pre-project the data and
  render in `OrthographicView`* (tracked in #2, re-sequenced 2026-09-03). For static
  data that is pixel-identical to a GPU projection — the shader version only matters
  for switching projection live.
- Vector output is a **serializer** over the IR, not a renderer: it needs no picking,
  no tiles, no interaction, no 3D.

A second interactive renderer would duplicate the attribute surface, legend
derivation, widgets, picking, stories/`seek()`, validation, IntelliSense and the
skill/`llms.txt` surfaces, and would *lose* effects, hillshade, terrain, Tile3D/BIM and
the COG/Zarr stack — a fork with a different feature set, plus a permanent double tax
on `onlymap-native` and `onlymap-remotion`, which pin this package exactly. Not taken.

## 2. Where it lives, and why the cartograph can't own it

`src/cartograph/core-loader.ts` states **the lazy-core rule**: `src/cartograph/` never
imports the core entry at module scope, so a static-only sheet loads no deck.gl and no
MapLibre. `dev/assert-bundle-cdn-safe.mjs` (check 5) fails the build if that regresses.
The cartograph's only route to the runtime is typed `typeof import("../index")` — the
core's **public** entry.

The serializer needs the IR (`LayerIR.props` holds compiled deck accessors,
`src/ir.ts:99`) and the projection step needs the data pipeline
(`src/parse-manifest.ts`). Housing them in the cartograph would mean widening the
public API just to reach internals. So:

| Piece | Home | Loaded when |
|---|---|---|
| Projection core (`src/projection.ts`) | core | `<om-map crs>` or a projected transform/export asks; proj4 stays lazy as it is in `src/crs.ts` today |
| Plane view | core (`runtime-core.ts`) | `<om-map crs>` |
| Geometry transforms (`src/transforms/`) | core, lazy chunk | first `<om-transform>` |
| Vector serializer (`src/vector-export/`) | core, lazy chunk | first `snapshot({ format: "svg" })` |
| Raster warp (`src/warp/`) | core, lazy chunk | a projected map that carries a raster, relief or contours (Phase 6) |
| Freeze-to-vector, print plumbing | cartograph | live frame freeze |

The pattern is `src/post-process/`: metadata in core, the heavy part in a chunk
fetched only when a document uses it, pinned by a "never downloads it" browser test.

A vector static frame keeps the static-only promise **better** than today's PNG: the
serialization happens at freeze time while the live core is mounted, and what lands in
the file is inert markup that the static build renders with no runtime at all.

## 3. The shared piece: one projection function outside the GPU

Both the plane view (at ingest) and the serializer (at export) need *"lng/lat → plane
x/y, and back"* without the GPU. Today that exists twice, half each:

- `src/cartograph/georef.ts` — `CrsForward` interface, closed-form Mercator (clamped
  and `MERCATOR_CONTINUOUS`), `resolveCrsForward()` reaching proj4 lazily, homography
  and `FrameGeoref { crs, corners }`.
- `src/crs.ts` — `CRS_DEFS` for a handful of codes, `projectedToLonLat()` (inverse
  only, built for IFC placement), `gridConvergence()`.

`src/projection.ts` unifies them: `registerCrs(code, def)`, `resolveProjection(crs)`
returning `{ forward, inverse, code, units }`, a batch `forwardCoords(Float64Array)`
for whole layers, and a **local origin**. The cartograph's georef keeps its interface
and becomes a consumer.

**Justifications.**
- *Local origin is not optional.* Measured, fp32 resolves no better than **0.48 m** at
  a 500 km easting and **5.7 m** at a 6 000 km northing, against **1.9 mm** two
  kilometres from an origin — and fp32 is what reaches the screen, whatever the CPU
  computed. #2 §0 called this jitter and predicted "whoever builds it will hit this in
  the first hour"; the numbers are worse than the word, since metres of error is
  geometry in the wrong place rather than shimmer. The plane holds `(x − x₀, y − y₀)`; the origin is the map's initial centre,
  fixed for the map's life, and is written into the frame georef so nothing downstream
  has to know.
- *The interface is the contract, not the library.* proj4 covers the conic,
  cylindrical and azimuthal families most sheets need (Albers, LCC, UTM, BNG, State
  Plane) and several world projections. Anything missing — an interrupted or artistic
  projection — registers as a `CrsForward` from another library without changing a
  caller. The cartograph's graticule already works this way.
- *Web Mercator is just another code.* `EPSG:3857` resolves to the closed form, so a
  map with no `crs` pays nothing and changes nothing.

## 4. Part A — the plane view: `<om-map crs="EPSG:5070">`

### What changes

Data is projected **once, at ingest**, in `parse-manifest`'s data stage — after
`normalizeData` and before accessor resolution and `applySurfaceAnchor`
(`src/parse-manifest.ts:38`, `:129`) — and the renderer swaps `MapView` for
`OrthographicView`. Every layer, accessor, classification, effect and the legend are
untouched: none of them ever asked what the coordinates meant.

**Corrected while building: positional ACCESSORS did ask.** The sentence above is
true of colours, sizes and classification and false of positions.
`get-position="[$lon, $lat]"` compiles to a function deck evaluates per row at draw
time, reading fields off the row, so projecting the data never reaches it — the layer
keeps emitting lng/lat into a metre plane and renders nothing, silently. Five accessors
across every registered schema return coordinates (`getPosition`, `getPath`,
`getPolygon`, `getSourcePosition`, `getTargetPosition`) and are wrapped alongside the
ingest projection, at the single point where a deck layer is constructed —
deliberately NOT in `parse-manifest` or `attribute-resolution`, which are the hottest
shared paths in the library and must stay byte-identical for a Mercator map.

Two things make that safe rather than merely working. The wrappers are memoised per
`(accessor, plane)`, because an accessor's cache key IS its deck `updateTrigger`: a
wrapper minted per rebuild would leave the trigger unchanged while the reference
churned, and deck would recompute every attribute of every layer on every frame. And
the list is guarded by a test that enumerates every registered schema and fails when an
unclassified spatial accessor appears — a hand-maintained list would otherwise rot the
first time a layer type was added, and the symptom would be geometry in the wrong place
rather than an error.

**Six accessors cannot be fixed this way and are a limit instead.** `getHexagon`,
`getHexagons`, `getGeohash`, `getPentagon`, `getQuadkey` and `getS2Token` hand deck a
spatial-index TOKEN, and deck builds the geometry inside the layer using its own
geographic maths. There is no coordinate to intercept, so H3, S2, geohash and quadkey
layers cannot draw in a plane view at all; that is a validation error naming the
conversion to polygons, not a layer that quietly vanishes.

### What deliberately does not change: the authored camera

`center="[lng, lat]"` and `zoom` stay geographic. The plane view translates:
`target = forward(center) − origin`, and orthographic zoom is chosen so that
**metres per CSS pixel at the centre equal Web Mercator's at that latitude** —
`zoom="9"` means the same visual scale it always meant. `getCamera()`,
`om-view-changed`, `setCamera` and `flyTo` speak lng/lat/zoom by unprojecting.

*Justification:* stories, `seek()`, `paced-flyby`, `onlymap-remotion`'s frame driver and
every existing document express cameras geographically. A projected map that required
a projected camera would fork the story format. Translation at the boundary keeps one
camera model.

### The limits, each a validation error with a fix

From #2 step 2, plus what this codebase adds:

| Limit | Why | Fix string points to |
|---|---|---|
| No MapLibre basemap | separate Mercator renderer | `basemap="none"` — already required for effects and relief |
| No `terrain` | `TerrainLayer` is Mercator | drop `terrain`, or use Mercator |
| No `pitch`, no `bearing` | `OrthographicView` is planimetric; rotation via a model matrix is a follow-up | a print sheet is planimetric; rotate the frame in the layout |
| ~~`HillshadeLayer` is Mercator-only~~ — **LIFTED by Phase 6.** `contour` off the same tiles still is | the warp re-indexes Mercator tiles from the plane's own geography and draws them as subdivided meshes; `contour` needs marching squares in the source grid and the polylines projected, which is Phase 5 | nothing — global relief works on a projected sheet. Freezing relief from a Mercator frame is still affine and sound only over small extents (C3b) |
| CRS fixed for the map's life | re-ingest on switch is a remount | author two maps |
| `flyTo` arcs are linear | `FlyToInterpolator` is Web Mercator only; the `LinearInterpolator` branch at `runtime-core.ts:2235` is the plane path | none needed |

### Relief on a projected sheet — available from Phase 1

**Both routes now work.** A DEM of the author's own worked from Phase 1, by the route a
cartographer would take anyway; the keyless global source works from Phase 6. The
original framing — that the limits table's Mercator-only row read as though a projected
sheet could not carry relief at all — is kept below because the reasoning is what made
the second route cheap.

`shading="hillshade"` on a raster source takes the file's geotransform, the file's CRS
units, and the tile's own pixels — **no viewport, no map projection, no zoom**. The
shade at a ground point is therefore the same whatever projection the sheet is drawn
in, and the feature is projection-independent by construction rather than by effort.
So an author with a DEM — in the sheet's CRS, in UTM, in anything — gets correct relief
as soon as the plane view exists. What Phase 1 owes it is placement: the raster tileset
projects to Web Mercator today and must target the plane instead, which is close to
identity when the DEM is already in the sheet's CRS.

What Phase 6 buys is narrower than "relief on a projected sheet": it is **global relief
with no data of your own**, the keyless convenience. Worth having, not load-bearing.

#### Shade first, warp second

Which also settles the warp's internal order. Shading in the **source** grid and warping
the result is simpler than warping heights into a plane-space heightfield and shading
there — no offscreen float target, and the gradient is never taken over resampled data,
which is where a derivative finds the resampler. `contour` gains more: march squares in
the source grid and project the resulting **polylines**, which is exact, instead of
contouring a warped raster.

#### Which north does the sun mean?

Shading in the source grid makes the *apparent* light direction vary across a projected
sheet, because geographic north is not sheet-up. Measured, at latitude 40:

| Albers CONUS, longitude | north tilts from sheet-up |
|---|---|
| −124 (west coast) | +16.9° |
| −96 (central meridian) | 0° |
| −70 (east coast) | −15.7° |

A 34° swing across the plate. On British National Grid the same figure is ±4° and
nobody would notice; on a continental sheet it is unmissable.

Both readings are defensible. **Geographic north** is physically true — that slope
really is lit from the north-west. **Sheet north** is what relief atlases do, because
constant apparent illumination looks right and lighting that rotates across a plate
reads as a mistake. Proposed: **sheet north by default, geographic as an opt-in**,
applied per tile through `crs.ts`'s existing `gridConvergence()`. Open question §12.4 —
a cartographic judgement, not a technical one, and visible only on the sheets this
document exists to serve.

### Everything else the view touches

- **Picking, hover, draw, snapping** — screen-space, but NOT unchanged, which an
  earlier draft assumed on #2's word. Two seams carry coordinates out of the renderer
  and both spoke lng/lat only because every viewport used to. `getViewport()` is the
  shared one — overlays anchor through it, widgets read `getBounds()` for filtering and
  stats, `ctx` hands it to accessors — so a plane view returns an adapter that converts
  at the seam rather than teaching each consumer about the plane (its `getBounds`
  samples along the EDGES, since a conic's extreme latitude sits mid-edge, not at a
  corner). And deck reports `info.coordinate` in the viewport's own world space, which
  is metres here: draw, measure, `om-map-point` and every behaviour would have received
  plane coordinates. The resolution runs in the plane, where geometry and viewport
  agree, and converts once on the way out. **Measuring is why this matters rather than
  being tidy** — the measure tool feeds those points to `geodesy.ts`, and a projected
  metre in a geodesic formula returns a confident, wrong distance. One snap branch
  (BIMLayer's edge overlay, which builds its candidates in lng/lat from the model's own
  georeference) is skipped on a projected map, because mixing those with plane
  candidates would snap to a point hundreds of kilometres away rather than fail.
- **Measure** — unproject to lng/lat, then the existing `geodesy.ts`. Never measure
  in projected metres: scale factor varies across a conic sheet.
- **Scale bar** — computed at the frame centre, the cartographic convention; the
  cartograph scale bar already resolves proj4 lazily for projected grids.
- **Graticule** — already reprojects and densifies (`docs/cartograph.md`); in a conic
  view it curves correctly with no new work. This is the first visible payoff.
- **Frame georef** — an orthographic frame's corners are an **affine** map of the
  plane, so `FrameGeoref { crs: "EPSG:5070", corners }` is exact and world-file-able:
  no pitch cap, no wrap, and the projective fit carries no residue (interior points
  land where the plane's own linear mapping says, to 1e-5 mm). The continuous-Mercator
  georef work stays for Mercator frames. **Measured cost of getting it wrong:** fitting
  a projected frame's corners in Mercator's plane instead puts the SHEET CENTRE 7.12 mm
  out on a 180×120 mm sheet — a homography through four corners is least constrained
  exactly in the middle, which is where a reader looks. Only the map can tell a frame
  which case it is in, so it answers rather than being asked to guess.
- **World copies** — a projected plane does not wrap. The antimeridian seam and
  `repeat: true` are Mercator-only concerns.
- **Camera limits** — the Mercator zoom floor/pitch logic is bypassed; the plane needs
  only a zoom range.
- **`snapshot({scale})`** — the composite draws `deck.getCanvas()`
  (`runtime-core.ts:1444`), view-agnostic.

## 5. Part B — geometry transforms: `<om-transform>`

```html
<om-layer id="coast" type="GeoJsonLayer" data="./coast.geojson">
  <om-transform type="simplify" tolerance="0.15mm"></om-transform>
  <om-transform type="smooth" iterations="3"></om-transform>
  <om-transform type="buffer" distance="1.2mm" repeat="5" fade></om-transform>
</om-layer>
```

### Placement in the pipeline, and why it is the whole design

Transforms run in the **data stage**, after normalisation and before accessor
resolution — the same seam as the plane view's projection, immediately after it. That
placement is what makes the rest of this document coherent:

- the GPU and the serializer receive **the same geometry**, so a smoothed coastline is
  smoothed in the interactive frame and in the frozen vector;
- `anchor="surface"` (`src/surface-anchor.ts`) and the legend see the transformed
  shape;
- transforms are pure functions of `(geometry, params, metresPerMm)` — worker-able,
  cacheable by data identity + params, and unit-testable headless.

**Correction, from building it: transforms run on lng/lat, not on the plane.** §5's
first draft placed them "immediately after" the plane view's projection. In the code
those are not the same seam at all — ingest lands in `parse-manifest.ts`, while the
plane projection happens at layer-construction time in `runtime-core.ts`, because it
also has to reach positional accessors (C18). Putting geometry transforms after it
would have meant either moving the projection earlier — which C18 says cannot be done
— or running transforms twice.

They run on lng/lat instead, in a per-feature **equirectangular metric frame** about
the feature's own centre latitude: metres in, metres out, degrees only at the boundary.
That is what makes a tolerance mean the same thing everywhere; simplifying raw degrees
thins a Norwegian coastline five times harder than an Ecuadorian one from the same
authored number, and there is a test that measures exactly this with the naive version
as its negative control. The frame is exact north-south and off by the cosine
difference across the feature's own latitude span east-west: 0.02% across a 1°-tall
feature at 45°, 0.3% across 10°. A tolerance is a threshold, not a measurement, so that
is well inside the point of the number.

**Columnar layers are out of scope, and say so.** Every primitive here operates on line
or polygon geometry, while a columnar layer is precisely the case that has none: large
point datasets stay in columns for speed, and GeoArrow lines and polygons are already
converted to features on the way in. So `<om-transform>` on a columnar layer is a
validation error naming the layer, not a silent no-op — the same treatment, for the
same reason, that the full-JS accessor opt-in already gets on Arrow sources.

### Units

Spatial knobs are **millimetres on paper**, resolved against metres-per-mm at a
reference scale — in a plane view directly, in Mercator at the centre latitude. Same
contract as `<om-effect>`, same reason: a tolerance in metres silently changes the
look between a screen and a 300 dpi plate.

**"At what scale" is an open question, not a detail** (§12.3). Unlike an effect's
millimetre knobs, which are uniforms re-pointed per frame for nothing, geometry cannot
be re-resolved for free: transforms run once at ingest and are cached by data identity
plus params, while an interactive map's scale changes on every zoom. A sheet has a
scale and the question is moot; a live map does not. This decides the caching key, so
it is settled before Phase 2 rather than during it.

### Determinism

Dot density takes a `seed` (default fixed). `onlymap-remotion` drives stories
frame-by-frame and cross-checks against `onlymapjs record`; a random scatter that
differs per frame would fail its battery. Seeded, it is a pure function.

### Primitives, ranked by payoff over cost

1. **`simplify`** (Douglas–Peucker, mm tolerance) — small, self-contained.
2. **`smooth`** (Chaikin, iterations) — small; with 1, the loudest "web map" tell gone.
3. **`dot-density`** (points per value inside a polygon, seeded) — small; unreachable today.
4. **`contour`** from a DEM — marching squares over the tiles the hillshade already
   fetches and decodes (`src/hillshade.ts`, `dem-decode.ts`). Not deck's
   `ContourLayer`, which contours *point density*, not a raster. Off the tiled DEM it
   inherits that path's Mercator tie until the warp (Phase 6); off a raster of the
   author's own it is projection-independent for the same reason relief is (§4a).
5. **`buffer`** (with `repeat` + `fade` for the coastal vignette) — see below. No
   longer the primitive that decides the project's shape, and still not on the
   critical path for 1–4.

### `buffer` is a cartographic ornament, not an analytic product

The earlier draft deferred this behind a spike — vendor a proven clipper, or write
the narrow subset — on the grounds that robust polygon offsetting is where geometry
libraries die (self-intersections, slivers, collapse). That framing asked the wrong
question. The right one is *which feature is this*, and the answer follows a line this
library has already drawn once.

Shaded relief shipped after a closed decision that said "raster analysis — app
territory", because the boundary turned out to be **queryability, not the arithmetic**:
cartographic relief is rendered texture, slope-in-degrees is an analytic product. The
same split applies here. A coastal vignette is an ornament measured by eye; a 500 m
setback is a number somebody will act on. **The first is in scope; the second is not,
and is a non-goal (§11).**

That decides the method, because an ornament does not need exact offsetting:

1. rasterize the polygon (the scanline fill the volumetrics grid already uses);
2. run an exact Euclidean distance transform (Felzenszwalb & Huttenlocher — separable,
   O(n), ~40 lines, no dependency);
3. sign it by transforming from both sides;
4. iso-contour at *d* with the marching squares `contour` needs anyway.

A buffer of *d* is "the set of points at distance *d*", so once a distance field
exists a buffer is a **threshold** — and `repeat` + `fade` is three thresholds of one
field rather than three offset operations.

**Measured error.** Against analytically exact signed distance, every output vertex
compared to its true distance, across three grid resolutions (errors in cell widths
`h`, and stable across resolutions — so absolute error falls linearly with cell size):

| Shape | full pipeline mean / max | reconstruction only mean / max |
|---|---|---|
| circle | 0.22 / 0.54 | 0.0003 / 0.0011 |
| coastline | 0.18 / 0.70 | 0.0003 / 0.045 |
| square | 0.64 / 1.42 | 0.003 / 0.007 |
| L-shape | 0.77 / 1.42 | 0.003 / 0.007 |

Two results matter. **Virtually all the error is the rasterization step** — the
transform is exact and marching squares on a distance field contributes about a
thousandth of a cell, because such a field is locally linear and that is what linear
interpolation reconstructs well. And the 1.42 worst case is √2, the cell diagonal,
reached only at sharp convex corners; coastlines do not have those.

**Re-measured on the shipped implementation, which is better than the spike** — and
better for a reason worth recording, because the spike's numbers were used to argue the
whole method:

| Shape | mean | max |
|---|---|---|
| circle | 0.27 | 0.50 |
| coastline | 0.26 | 0.50 |
| square | 0.48 | 0.50 |

The √2 corner penalty is gone and the bound is **half a cell everywhere, corners
included**. The spike signed its field from one side; the shipped one transforms from
both and subtracts, then shrinks the magnitude by half a cell — because a cell centre
*t* outside the boundary has its nearest inside centre at about *t* + ½, so the raw
difference is biased outward by exactly that. Uncorrected, the zero crossing still lands
correctly (the biases cancel across the boundary) but every level ABOVE zero — which is
every buffer anyone asks for — sits half a cell too far out. It presented as a maximum
vertex error of exactly 1.000 cell widths, and *exactly* is the tell: noise is never
round. The residual is now the rasterisation's own quantisation and nothing else, which
is what the spike predicted and could not reach.

On paper, at 300 dpi on a 200 mm frame: 0.085 mm cell, so **0.022 mm mean and 0.042 mm
max** — against a 0.088 mm hairline and a ~0.1 mm visual threshold. Comfortably under
half a hairline at the worst point of the worst shape.

On a 200×150 mm frame that is:

| | cell | coastline mean | coastline max | sharp corner |
|---|---|---|---|---|
| 300 dpi | 0.085 mm | 0.017 mm | 0.059 mm | 0.12 mm |
| 600 dpi | 0.042 mm | 0.008 mm | 0.030 mm | 0.06 mm |

A 0.25 pt hairline is 0.088 mm and the eye resolves about 0.1 mm at reading distance,
so at 300 dpi the coastline error is roughly a fifth of visual threshold. Cost,
measured single-threaded: 4.2 M cells and ~100 ms at 300 dpi, 16.7 M cells and ~390 ms
at 600 dpi, one Float32 field being 17 MB and 67 MB respectively. Acceptable for a
freeze, which happens once; an interactive vignette wants a worker.

**The trade, stated plainly.** An exact clipper has zero error and unbounded failure
modes on exactly the input this feature targets. A distance field has bounded,
measurable, sub-visual error and **cannot** self-intersect, because it never performs
polygon arithmetic. It also adds no dependency and needs no licence review.

**If the error ever matters**, do not refine the grid — 4× the memory buys 2× the
accuracy. The measurement says the rasterizer is the whole error, so seed the field
with exact point-to-edge distances in a narrow band around the boundary and let the
transform propagate outward: that lands in the right-hand column above, at the same
resolution, for about thirty extra lines.

**Consequences to plan for.** Features below a cell vanish at rasterization (0.085 mm
on paper at 300 dpi — below a printable line, but a silent change to the data);
areas are only grid-accurate; ring nesting is re-derived from the contour rather than
carried through; and the output carries roughly one vertex per crossed cell edge —
about 2 400 per band across a 200 mm frame — so a faded five-band vignette is ~12 000
vertices of ornament. That last one is why `simplify` and `buffer` belong in the same
phase: the buffer's output is the simplifier's input.

The four open draw-editing tickets (#43 snapping, #44 angle-constrained, #45 split,
#46 cut with an area-conserving polygonizer) need the same primitives; this seam is
where they should land rather than each bringing its own.

## 6. Part C — the vector serializer: `snapshot({ format: "svg" })`

### Contract

Walk the IR in document order; for each layer choose a strategy:

| Layer kind | Strategy |
|---|---|
| Polygon / path / point / text (`GeoJsonLayer`, `PolygonLayer`, `PathLayer`, `ScatterplotLayer`, `TextLayer`, `IconLayer`, …) | `<path d>` / `<circle>` / `<text>` with the style the accessors resolve |
| Raster (`COGLayer`, `ZarrLayer`, `BitmapLayer`, `TileLayer`, `HillshadeLayer`) | rendered by the GPU into a **raster band**, embedded as `<image>` at the correct stacking position |
| 3D (`Tile3DLayer`, `BIMLayer`, `ScenegraphLayer`, terrain) | raster band |
| a **post-process pass** is present | **the whole map frame** becomes one raster band at `effect-dpi` — such a pass treats the finished frame, and there is no vector equivalent (see below) |

Consecutive raster layers merge into one band. The "hybrid" is not a fallback: vector
linework over placed relief is how cartographic production has always worked.

### Effects: the whole frame rasterises, at a resolution you choose

A post-process pass treats the **finished frame**, so there is no "some layers". Every
layer is beneath every such pass, and a sheet carrying a finish exports its map frame
as a single raster band.

**The test is `instanceof PostProcessEffect`**, applied to the resolved effect chain —
not "is there an `<om-effect>` element", and not "does deck have any effects". Both of
those are wrong, in opposite directions, and §13.1 has the reasoning: deck's effect
array also carries effects it installs itself, while the authored element is not the
only way an author supplies a real pass. Legend, crop marks, graticule labels and the rest of the sheet furniture
stay vector, because they are not inside the frame.

What that actually costs is narrower than it sounds. Almost everything on a map
survives print rasterization; **type does not**, and linework only just — a 0.1 mm
hairline at 300 dpi is one pixel, and a 6 pt label is about 25 pixels tall. So the band
carries its own resolution, `effect-dpi`, independent of the sheet's: raise it to 600
and fine type is genuinely good, at the cost of embedded bytes. This is a knob, not a
wall, and it is the whole mitigation.

The serializer emits a **dev notice** whenever it rasterises for this reason — naming
the effect, the resolution used, and that removing the effect yields fully editable
linework. An author who wanted vector type and did not realise a finish forecloses it
should be told, not left to discover it in a print shop.

**Why not the alternatives.** Three were considered and are recorded here so they are
not re-proposed as though new:

- *SVG filter primitives* (`feColorMatrix`, `feTurbulence`, `feGaussianBlur`, …) would
  keep linework vector and carry a finish, and most of the op catalogue maps onto them
  at least approximately. **Ruled out, and specifically because this is a print
  product:** SVG filters are the format's least reliable corner in print workflows —
  editors rasterise them on import and RIP support varies — so the file would look
  vector and be flattened downstream at a resolution nobody chose. Rasterising
  deliberately, at a stated dpi, is strictly better than that. (`halftone` has no
  equivalent regardless, and filter output would not match the GLSL, loosening the SSIM
  gate.)
- *Decomposing the effect* — baking pointwise colour maths into the vector fills,
  emitting position-dependent texture as one overlay, rasterising only for
  neighbourhood ops — is exact for flat fills and would keep type vector. It reaches
  only `muted` and `night`; the other five shipped presets contain `edges`, `blur` or
  `halftone`, because that pressed-ink line is the look. Shelved, not rejected: if
  type-crispness under a finish proves to matter, it lands precisely on `muted`, which
  is documented as the type-safe preset. It would be an internal optimisation for
  pointwise-only chains, never an authored mode.
- *Per-layer effect scoping* — letting an author place layers above the effect — is
  cartographically correct (treating the base and laying clean type over it is how
  sheets have always been made) and is the right long-term answer. But it does not
  exist in the live renderer, and inventing it for export alone would make one document
  mean two things: grained labels on screen, clean labels in the file, contradicting
  this document's own parity criterion. If it is wanted it belongs in the renderer, as
  layer grouping with its own pass — at which point the serializer needs no effect
  policy at all, and this section shrinks to a sentence.

### Style mapping, and the gate that keeps it honest

deck's blending, antialiasing and dash rendering will not match SVG's exactly. The
mapping is explicit (fill/stroke/opacity, `dash` → `stroke-dasharray` in line-width
units, `line-width-units` pixels vs metres, `visibleZoomRange`, `opacity`) and a
**visual-diff gate** compares the SVG rasterised by the browser against the GPU
capture of the same fixture within an SSIM threshold. Where they must diverge, the
divergence is documented, not discovered.

### Text — parity by construction

`src/cartograph/textlayout.ts` already states the rule: compute line boxes once and
have every renderer draw *those*, because two measurers disagree at the margins. The
serializer follows it. Labels are emitted as real `<text>` with the same measured
positions; the font family is carried, and when a font URL is known it is embedded via
`@font-face` so the sheet renders identically off-machine. Outline-to-path (glyphs as
`<path>`) is a later option for print shops that reject embedded fonts.

**Decluttering caveat, and why it is a feature.** `CollisionFilterExtension` decides
survivors on the GPU at a resolution that scales with capture ratio (its framebuffer
is canvas pixels ÷ 2), so the serializer *cannot* ask deck which labels it hid. The
serializer runs its own **CPU greedy pass by priority over measured boxes** —
deterministic, resolution-independent, and the natural home for the gallery-grade
placement work (candidate positions, leader lines, text on a path) that the GPU path
has no room for. Deck-side collision remains the interactive preview; the CPU pass is
the print truth.

### Feature-count guard

A print sheet is thousands of features; an SVG with half a million paths is unusable.
Geometry is clipped to the frame bounds before emission (also removes the giant-path
problem), and above a configurable count the serializer emits a dev notice and offers
`simplify`. Below the count, it just works.

### Bundle

The serializer chunk pins a "never downloads it" browser test, like
`e2e/effects.spec.ts` does for `/post-process/ops`. `dev/assert-bundle-cdn-safe.mjs`
gains the assertion that no serializer symbol appears in the core chunk.

## 7. Part D — the cartograph: freeze to vector

Today freezing a live frame calls `snapshot({scale})` and stores a PNG data URL
(`src/cartograph/elements/om-frame.ts:556`); a static frame is a georeferenced `<img>`
placed by `crs` + `corners` (`docs/cartograph.md`, "`<om-frame>` mode=static").

A vector static frame is an inline `<svg>` child placed by the **same** `crs` +
`corners`, with the raster bands embedded inside it. The georef model does not change;
the plane view makes it exact (§4). Print CSS, bleed, crop marks and the atlas treat it
as they treat the `<img>`. The producer-written legend rows for static frames carry
over unchanged.

Downstream: `nika-agent`'s cartograph export path embeds frame rasters into the
standalone document; it needs a branch for an inline `<svg>` with embedded `<image>`
data URIs. That is its ticket, filed when Phase 4 lands.

`docs/cartograph.md`'s non-goals line — *"SVG export; … projections other than Web
Mercator on live frames; automatic label placement"* — was right for a raster-sheet
product. Phases 1, 3 and 4 retire the first two deliberately; the third is narrowed to
"on the GPU path" once the CPU pass exists. The line is rewritten in Phase 7, not
silently contradicted.

## 8. Caveat register

Everything learned on the way here that a builder would otherwise rediscover.

| # | Caveat | Decision |
|---|---|---|
| C1 | fp32 cannot resolve METRES at projected magnitudes — measured 0.48 m at a 500 km easting and **5.7 m** at a 6 000 km northing, against 1.9 mm at 2 km from an origin | local origin, fixed per map, written into georef. "Jitter" understated it: at a real northing this is geometry in the wrong place, not shimmer |
| C2 | `FlyToInterpolator` is Mercator-only | plane view uses the existing `LinearInterpolator` branch |
| C3 | `HillshadeLayer` samples Mercator `{z}/{x}/{y}` tiles, so **that layer** is Mercator-only | A limit on the keyless-global-tiles convenience, NOT on relief. `shading="hillshade"` on a raster is projection-independent already (§4a), so a projected sheet can carry relief from Phase 1. The warp (Phase 6) restores the keyless path; validation error with the fix meanwhile |
| C3b | Relief frozen from a Mercator frame into a projected sheet is an **affine approximation** | Sound over a city, wrong over a continent — the Mercator↔target difference is not affine. Bound the interim workaround by extent, or use a DEM in the sheet's own CRS (§4a) |
| C4 | A post-process pass cannot be vectorised, and treats the whole frame, so there is no partial answer | the map frame becomes one raster band at its own `effect-dpi` (600 keeps fine type good), with a dev notice naming the trade. Triggered by `instanceof PostProcessEffect` over the resolved chain — not by the authored element, not by deck having effects (§13.1). SVG filters ruled out on print reliability; decomposition shelved; per-layer scoping is a renderer feature, not an export policy (§6) |
| C5 | GPU collision is resolution-dependent and unqueryable | serializer runs its own CPU pass; deck collision stays preview-only — which means the two legitimately keep different label sets, so §10 excepts labels from the parity bar and §13.2 records the choice |
| C6 | Two text measurers disagree | one measured layout (`textlayout.ts` rule); fonts embedded when known |
| C7 | deck vs SVG rendering differences | explicit mapping + SSIM gate |
| C8 | Random scatter breaks remotion determinism | seeded `dot-density`, default seed |
| C9 | Robust polygon offsetting is where geometry libraries die | sidestepped, not solved: `buffer` is scoped as a cartographic ornament and built on a distance field, which cannot self-intersect because it never does polygon arithmetic (§5). Exact offsetting is a non-goal |
| C10 | Measuring in projected metres is wrong on a conic | unproject then geodesic |
| C11 | Camera model fork | authored camera stays geographic; translation at the boundary |
| C12 | Lazy-core rule | nothing runtime-dependent lives in `src/cartograph/`; each new chunk gets a "never downloads it" test and a bundle assertion |
| C13 | `docs/` ships to the public mirror | this document is public; no internal detail, no cross-repo hyperlinks |
| C14 | Downstream pins are exact | native parity and the remotion battery run against each release; plane-view stories go into remotion's fixtures |
| C15 | Reports of "still broken" may be a stale dep cache | every phase's gate runs in a real browser with a negative control (the spec against the previous version) |
| C16 | Millimetre geometry cannot be re-resolved per frame the way a millimetre uniform can | transforms resolve against a reference scale, fixed for the map's life; open question §12.3 |
| C17 | Geographic north is not sheet-up on a projection — ±17° across an Albers CONUS sheet | `sun-azimuth` needs a stated datum. Default **sheet north** (constant apparent lighting, the relief-atlas convention), geographic as an opt-in, corrected per tile through `gridConvergence()` (§4a) |
| C18 | Positional ACCESSORS are not reached by ingest projection | five of them, wrapped at the layer-construction site and memoised per `(accessor, plane)` — an accessor's cache key is its deck `updateTrigger`, so a wrapper minted per rebuild would silently recompute every attribute every frame. A schema-enumerating test stops the list rotting (§4) |
| C19 | Spatial-index layers (H3, S2, geohash, quadkey) build geometry inside deck from a token | no coordinate to intercept, so a limit rather than a fix: validation error naming the conversion to polygons (§4) |
| C20 | `MapController` asserts on a viewState with no longitude/latitude | a plane view takes `OrthographicController`, with only the overrides that mean anything without a third dimension. An `OrthographicController` also normalises its initial viewState DURING `new Deck()`, so the controlled-viewState echo fires once before the assignment lands |
| C21 | A projected map cannot build its renderer synchronously | proj4 is lazy and the view type depends on its answer, so Deck creation defers exactly as the basemap adapter already defers on its chunk — `isReady()` stays false and `om-map-ready` waits, which is what "the renderer finished async init" already meant. Layers reconciled before the projection lands are REBUILT, never replayed: they were prepared for a Mercator world |
| C22 | A transformed layer has nothing honest to show on its first pass | the primitives are a lazy chunk and ingest is synchronous, so the first parse resolves to the EMPTY placeholder — the same Q6 state a URL-backed layer sits in before its fetch lands — and the chunk's completion triggers the reparse. Emitting the untransformed coastline and smoothing it a frame later is a flash of the wrong map, not progressive loading (§5) |
| C23 | `dot-density` replaces the row set rather than rewriting geometry | it is the one primitive whose output is a different number of features, so every accessor the author already wrote has to keep working — each dot carries its source row's own `properties`. Dots are distributed across a MultiPolygon BY AREA, or a state's mainland and its offshore island get the same count; rejection sampling is budgeted, because an unbounded loop on a panhandle is a hung tab |
| C24 | A plane view's VIEWPORT zoom is about -12, and deck's TileLayer gates on it | `minZoom: 0` is deck's default and it compares the viewport's own zoom, which is in plane units — a metre against a sixty-kilometre Mercator world unit. Every tile was selected, fetched and decoded, and `renderSubLayers` was never called: a blank sheet, no error, no warning. The plane path passes `minZoom: -Infinity` and applies the PYRAMID's zoom range inside the tileset, where it means something |
| C25 | A tile's cull box and its geographic extent are different facts | deck culls `tile.bbox` against `viewport.unproject()` of the screen rect — plane metres here — so a geographic bbox in that slot compares degrees against metres, never overlaps, and every tile is invisible with nothing logged. The plane tileset returns BOTH: `bbox` as a plane-metre envelope (sampled along the tile's edges, since a conic bows them) and `lngLatBbox` for the warp to project |
| C26 | Deck's `log2(512 / tileSize)` term is not optional | leaving it out of the plane's zoom derivation chose a pyramid level one coarser than the identical Mercator map — half the relief resolution, rendering perfectly, looking only slightly soft. Found by comparing against a Mercator control, which is now a test: a projected sheet must request the same DEM zooms as the same document without `crs` |
| C27 | deck has no single accessor vocabulary, and the wrong guess renders plausibly | `PathLayer` and `LineLayer` declare `getColor`/`getWidth`; `GeoJsonLayer`, `PolygonLayer` and `ScatterplotLayer` declare `getLineColor`/`getLineWidth`; `ArcLayer` declares `getSourceColor`. Reading only the GeoJSON names exported every path layer as a black hairline — deck's own defaults, faithfully applied, and nothing like the authored sheet. The serializer tries each family's names in order, enumerated from the registry rather than remembered, and a test pins each one |
| C28 | A serializer that throws loses the sheet, not the row | an authored expression that fails on one feature must cost that feature, exactly as it does in the renderer, which catches accessor errors itself. Otherwise a document that draws on screen refuses to export, and the author has no way to see which row did it. The vector path had this tolerance from the start and the text path did not; the asymmetry surfaced the first time a fixture had a wrong expression |
| C29 | Most of this library's maps have no GeoJSON geometry at all | `<om-layer type="ScatterplotLayer" get-position="[$lng,$lat]">` over flat rows is the house style, and those coordinates exist ONLY as a compiled accessor's return value. A serializer reading `row.geometry` emitted a correctly-formed, entirely blank sheet for every one of them, with no error anywhere — found by the first fixture whose only layer was authored that way. Geometry now falls back to the positional accessors (`getPolygon`, then `getPath`, then a source/target pair, then `getPosition`), richest first |
| C30 | Freezing a frame whose projection has not resolved must REFUSE | a projected live frame has no corners until proj4 lands, and they are not merely unknown — they are about to change. Freezing there would place the sheet by corners that were wrong, and a sheet placed wrong looks exactly like a sheet placed right, which is the failure this document exists to avoid. `freeze()` returns false and writes nothing; the caller waits for `ready` |
| C31 | A signed distance field needs a half-cell correction, or every buffer is too wide | transforming from one side only, or from both without the correction, biases every non-zero level outward by half a cell. The zero crossing stays right, so a *validity* check passes and only the thing anyone actually draws is wrong. Diagnosed from a maximum vertex error of exactly 1.000 cell widths — noise is never round (§5) |
| C32 | Marching-squares segments cannot be chained by direction | the sixteen cases only agree on orientation if every one of them was written to, including the two saddles where "agree" is itself ambiguous. A start→end chainer broke each contour into a dozen fragments — a dashed vignette, which reads as a broken field rather than broken bookkeeping. Matching at EITHER endpoint removes the class |
| C33 | `contour` sources geometry, so two of the stage's own rules invert | its layer legitimately has ZERO rows (the transform fills them, as `dot-density` replaces them), and zero rows otherwise means "not fetched yet"; and it is the one step that FETCHES, which made the whole chain async. Both are stated at the seam rather than special-cased downstream |
| C34 | A probe viewport must copy the LIVE view's `flipY` | deck's `OrthographicViewport` defaults to `flipY: true`; the plane view renders `flipY: false`. A probe built without it returned the frame's corners vertically MIRRORED — graticule labelled 50° at the bottom, north arrow pointing south, a frozen sheet placed inverted — while the map on screen stayed perfectly correct. It survived an entire phase of tests because those compared corners to themselves, where a flip cancels. It took composing a real plate to see |
| C35 | `blend="multiply"` multiplied the shade into the HEIGHTFIELD | the composite branch was written for the raster path, where the layer's texture is a colormap. On the tiled layer that texture is the r32float heightfield — height in red, nothing in green or blue — so a multiply-blended relief painted whole sheets RED. `composite` now has three modes, because the two entry points genuinely do not sample the same thing, and the third emits the shade alone for the GL blend to apply |
| C36 | A sourcing chain's cache has nothing stable to key on | the transform cache is a WeakMap keyed by the source data, which is right for a layer that has some. `contour` has none — its rows are the empty placeholder, and `[]` is a fresh array every parse — so every reconcile missed and re-ran, re-fetching every DEM tile. 112 requests where the cover is 16. It anchors on the layer's own identity instead |
| C37 | A warped tile cover is one tile short at the corners | a tile's extent is a lng/lat rectangle whose image in the plane is a CURVED quadrilateral, so the tiles covering a plane rect's lng/lat box do not quite tile the rect — and the shortfall is where curvature is greatest, at the corners. It presented as an unshaded wedge with every selected tile loaded: a cover honestly computed and geometrically short. One tile of margin, and a test that samples the whole boundary rather than the four corners |
| C38 | Every failure path here was only ever exercised with inputs that succeed | review found nine defects and the pattern behind them is one sentence: the phases tested the happy path of each seam and the unhappy path of none. An unresolvable `crs` left the map HANGING (deck is never built, so `isReady()` stays false, `om-map-ready` never fires and the page's own `await` never returns); `this.deck!` dereferenced an undefined deck for the whole proj4 window; a frame's `pendingLiveCrs` cleared only on success, so one unresolvable CRS wedged it permanently. None of these needed a new mechanism to find — only a fixture that fails |
| C39 | A failed projection must NOT fall back to Web Mercator | tempting, because the page stays alive. Rejected: a sheet drawn in the wrong projection looks exactly like a sheet drawn in the right one, which is the failure class this entire document exists to avoid. Readiness settles so nothing hangs, the error is reported, and nothing is drawn |
| C40 | A serializer must carry deck's ACCESSOR defaults, because the registry does not | the registry materialises scalar defaults (`sizeScale: 1`) but never an accessor's (`getSize: 32`), so reading `sizeScale` as the size's fallback exported every unstyled label at `font-size="1"` — invisible in the file, correct on screen, and the declutter pass measured the same wrong number so nothing was suppressed either. `getPixelOffset` was dropped entirely, collapsing every offset label onto the symbol it labels. Both are the export disagreeing with the screen, which is the one property the serializer exists to hold |
| C41 | A LineString's coordinates are STRUCTURALLY a polygon ring | nothing in the coordinate tree can tell them apart, so `buffer` scanline-filled an open line as though its ends joined and seeded the field from a polygon present nowhere in the data. Measured on three sides of a square: 5 476 of 10 404 cells filled, and the square's own centre reported as 10 950 m INSIDE the phantom. Refused by geometry TYPE, which is the only thing that can distinguish them; unclosed polygon rings are CLOSED rather than rejected, because producers in the wild emit them and every other layer draws them |
| C42 | The controller is set in FIVE places, and four of them did not know about the plane | Deck creation plus `setDrawCapture`, `setDragPan`, `setMaxPitch` and `setMinZoom`, each building a `MapController` unconditionally — so the first draw-tool activation on a projected map swapped a Mercator controller onto an orthographic viewState, and `MapState`'s constructor asserts on one with no longitude. C20 recorded exactly this failure for Deck creation; it came back through the setters. One `currentController()` now serves all five, and `minZoom` gets the geographic→plane conversion `maxZoom` already had |
| C43 | A plane rect's extremes are not always on its boundary | edge-only sampling assumed a conic's extreme latitude sits mid-edge — true away from the apex, false for a sheet CONTAINING a pole (the pole is interior, and a 6 000 km polar plate's bounds bottomed out at −62.9° against a true −90°) and false across the ANTIMERIDIAN (longitudes wrap, min/max collapses to the whole world, the cover blows its budget and falls back three pyramid levels). Interior sampling plus longitude unwrapping fixes both. What it CANNOT fix: Web Mercator stops at ±85.05°, so a polar cap has no tiles at any zoom — a limit of the source, now stated |
| C44 | The vector serializer requires `basemap="none"`, like its neighbours | `captureBand` goes through `snapshot()`, which composites a MapLibre basemap into EVERY band — so a map ordered relief → roads → imagery exported the roads and then covered them with the second band's opaque basemap. Refused rather than repaired, because `<om-effect>` and `crs` already carry the same requirement and a third behaviour would be one more rule to remember. Imagery that bands correctly is an ordinary deck layer |
| C45 | A ceiling has to be sized against what is actually allocated | `signedDistanceField` holds 26 bytes per cell across five simultaneous arrays, so the 40 M-cell buffer ceiling was 1.04 GB — the tab-wedging it exists to prevent rather than a guard against it. 4 M cells is ~104 MB. The same arithmetic is worth doing wherever a guard is stated in units that are not bytes |

## 9. Phases

Each independently shippable, each with its own doc-sync per the repo checklist.

**Order is a recommendation, and one ordering decision is already made.** The warp
(Phase 6) carries the capability a cartographic sheet most wants — relief and contours
on a projected map — and it was originally last, behind the transforms and the
serializer, on the assumption that client-side reprojection was the riskiest thing
here. The measurement in Phase 6 says otherwise: sub-pixel at 8×8 subdivision, ~64
quads per tile. So **spike the warp immediately after Phase 1**, whose plane view is
its only prerequisite — the expensive question is already answered, and what remains is
a day of plumbing against a real projection. If the spike holds, running the warp ahead
of Phase 3 is reasonable: a projected sheet with relief is a more compelling first
release than a projected sheet without it, and the serializer does not care which order
it arrives in.

**Phase 0 — projection core — IMPLEMENTED 2026-09-23** (`src/projection.ts`). Unify `georef.ts`'s `CrsForward`
and `crs.ts`; forward/inverse/batch; local origin; `registerCrs`. Gate: fixtures for
BNG, UTM 32N, Albers 5070 and Swiss LV95 agree with proj reference values to 1e-6
relative, headless.

**Phase 1 — plane view — IMPLEMENTED 2026-09-23**, affine frame georef included. `<om-map crs>`; ingest projection; view swap; camera
translation; events; measure/scale bar/graticule checks; the limits table as
validator rules; affine frame georef. Gate (real GPU): an Albers US sheet with
`basemap="none"` — a known lng/lat lands within 1 px of the CPU prediction,
parallels visibly curve, `getCamera()` round-trips, no jitter at zoom 14 near
(500 000, 6 000 000), `snapshot({scale: 3.125})` renders at scale, and the manifest
validates with exactly the listed limits and no others.

**Phase 2 — transforms v1 — IMPLEMENTED 2026-09-23.** The `<om-transform>` seam, mm units, `simplify`,
`smooth`, `dot-density`. Gate: seed determinism at 1× and 4×; a transformed layer's
legend and `anchor="surface"` follow the new shape; and **the renderer and the
serializer receive identical transformed geometry**, asserted by hashing the coordinate
arrays rather than the IR — `LayerIR.props` holds compiled accessor *functions*, which
are not comparable, so "byte-identical IR" (as an earlier draft put it) is not a
property anything can test. Hash both paths: the shared in-process result, and a
re-parse of the same document, since the second is what proves a transform is the pure
function §5 claims and not quietly dependent on call order or state.

**Phase 3 — vector serializer v1 — IMPLEMENTED 2026-09-23.** Vector strategies, raster bands, effect policy,
style mapping, SSIM gate, text parity, CPU declutter, feature guard, bundle assertion.
Gate: the print-finish example and an Albers sheet round-trip within threshold; a map
that never asks for SVG never fetches the chunk; and the effect path is exercised both
ways — a sheet with a finish emits one raster band plus vector furniture and raises the
notice, the same sheet without the finish emits no band at all, and `effect-dpi`
demonstrably changes the band's pixel dimensions rather than only its scaling. The
trigger is pinned from both sides (§13.1): a map with a decluttering layer and no
finish must emit **vector**, and a map whose only finish arrived through
`setEffects()` must emit a **raster band**.

**All of it landed** (`e2e/serialize.spec.ts`, `src/serialize/`). SSIM between the GPU
capture and the browser-rasterised SVG measured **0.97** on a Mercator sheet and again
on the same document with `crs="EPSG:5070"`, against a threshold of 0.9 — with an empty
SVG as the negative control, which scores below it, so the gate is known to be able to
fail. `effect-dpi` 96 → 288 widens the embedded band by more than 2.5×, so it changes
pixels rather than scaling. The bundle assertion is stronger than "absent from the core
chunk": the serializer's symbols must appear in **exactly one** chunk, which also
catches the case where a future static import quietly duplicates it into two.

**Phase 4 — freeze to vector — IMPLEMENTED 2026-09-23.** `<om-frame>` stores an inline `<svg>`; print CSS,
bleed, crop marks, atlas; validator; downstream ticket for `nika-agent`'s exporter.
Gate: a frozen vector sheet opens with no runtime, prints at 300 dpi with crisp
linework, and its georef matches the live frame's to 1e-6.

**Landed as `frame.freeze({format})`** (`e2e/freeze-vector.spec.ts`). The no-runtime
claim is checked against the SAVED MARKUP on a page that imports nothing and defines no
custom elements: the picture is still there, the corners are still on the attribute, and
the stylesheet alone lays it out at the authored size. Corners round-trip to 1e-6
degrees and the frame's INTERIOR lands **3.0e-6 mm** from where the live frame put it —
the floor being the corners written with eight decimal places, about 1.1 mm of ground,
which is 0.02 mm of paper at 1:50 000.

Print needs no swap at all, and that is the point: `enterPrintMode` exists because a
WebGL canvas prints blank, and inline vector has no such problem. The CANVAS exporter
still needs pixels — `drawImage` cannot take an `<svg>` element — so a frozen vector
frame rasterises itself from its own markup at the export's resolution, which is a
different thing from being stored as a bitmap.

**Phase 5 — the raster-derived transforms — IMPLEMENTED 2026-09-23.** `contour` from DEM (Mercator), then
`buffer` with `repeat` + `fade` on the shared distance field (§5). The two are one
piece of machinery — rasterize, transform, iso-contour — so `contour` lands first and
`buffer` is a second threshold over it. Gate: the coastal vignette example; buffered
output within the measured error of analytic truth on a circle and a square fixture;
no self-intersection artefacts on a coastline fixture (which the method makes
structurally impossible, so the test is a guard against regressing to another one);
and a faded five-band vignette simplifies to a sane vertex count.

**And a real coastline at print resolution.** The error figures in §5 were measured
against synthetic shapes — a circle, a square, an L, and a pseudo-coastline built from
summed harmonics. The error model should carry over, since it is grid-proportional and
shape-independent except at sharp convex corners, but two things are only knowable
against real data: whether a genuine coastline's small islands and inlets survive
rasterization at the chosen cell size in numbers the author would accept, and what the
vertex count actually comes to once a fjorded shoreline is contoured rather than a
smooth analytic curve. Both decide whether the default grid resolution is right. So the
gate takes a real shoreline extract at 300 dpi and reports island survival, vertex
count before and after `simplify`, and the band's deviation from a reference offset —
with the numbers recorded in this document, replacing the synthetic ones as the
published figures.

**Phase 6 — raster in the plane: the warp — IMPLEMENTED 2026-09-23** (hillshade; `contour` waits for Phase 5). Lifts C3, and is the phase that decides
whether a projected sheet can carry relief at all.

The Mercator tiles covering the frame (`loadHeightfieldForBounds` already fetches and
decodes them seam-correctly) are drawn as **subdivided meshes** whose vertices are
projected on the CPU through `projection.ts`; the GPU interpolates the texture across
each warped quad. No projection math in GLSL — the same technique deck's `_GlobeView`
and MapLibre's globe use for raster tiles. The same warp pass is what a COG in another
CRS or a raster basemap needs in a plane view, so it is built once.

**Shade first, warp second** (§4a). The existing hillshade shader runs in the tile's own
grid, exactly as it does today, and the warp moves the *shaded* result. An earlier draft
had it the other way — warp heights into an offscreen plane-space heightfield, then
shade there — which needs a float render target, requires the plane's anisotropic scale
factors, and takes a gradient over resampled data, which is where a derivative finds the
resampler. Shading first needs none of that and changes no shader. `contour` gains more
still: march squares in the source grid and **project the resulting polylines**, which
is exact, rather than contouring a warped raster.

### How much subdivision, measured

The obvious fear about client-side reprojection is that a piecewise-bilinear warp is
too coarse. Measured — max deviation between the interpolated and the true projected
position, in output pixels, for an N×N subdivided Mercator tile:

| Projection | z=3, N=8 | z=5, N=4 | z=8, N=2 |
|---|---|---|---|
| Albers CONUS (5070) | 0.40 | 0.26 | 0.11 |
| British National Grid (27700) | 0.45 | 0.31 | 0.15 |
| Swiss LV95 (2056) | 0.34 | 0.28 | 0.14 |
| Lambert 93 (2154) | 0.34 | 0.28 | 0.14 |

Re-measured by the shipped harness (`src/plane-warp.test.ts`, headless, no GPU), which
samples strictly INSIDE each cell — the corners are exact by construction, so a sampler
that hit them would report zero and prove nothing. The same test asserts the 1/N² fall
and keeps an un-subdivided quad as its negative control: at z=3 that is 2.6 px, plainly
wrong, which is what makes 0.40 px mean something. Lambert 93 had to be added to the
bundled CRS table to measure it at all, so it is now authorable like the other three.

Error falls as 1/N², so it is **sub-pixel at 8×8 even at continental zoom** — 64 quads
and ~81 projection calls per tile, worst case, against a viewport of a few dozen tiles.
The geometric risk is not the risk.

**The subdivision criterion is projection curvature, not capture ratio.** An earlier
draft had the warp grid follow the capture ratio; that is a sampling concern, while
what actually drives subdivision is how much the projection bends across a tile, which
is a function of **zoom**. Capture ratio enters only through what "half a pixel" means,
and only as `N ∝ √ratio`. The rule is: subdivide until the deviation is under half an
output pixel, with the table above as the starting values.

### Two things that do not follow, corrected

*The per-tile apron stays, and is what makes the warp seamless.* An earlier draft had
it becoming unnecessary — one continuous texture, no tile boundaries. It does not
follow: while warping, pixels near a source tile's edge sample that tile near its edge,
and with clamp-to-edge they interpolate against nothing. Both sides of every source
boundary acquire a half-texel resampling kink, and a hillshade is a derivative, so it
finds exactly that. Sampling the apron-padded texture removes it. `composeApron` is
therefore reused on this path, not retired.

*Plane ground scale is not uniform, which is one more reason to shade before warping.*
An earlier draft treated it as uniform, dropping the cos φ correction. That holds for a
conformal projection and fails for an equal-area one — measured local scale factors for
Albers CONUS:

| latitude | k east | k north | anisotropy |
|---|---|---|---|
| 25°N (south edge) | 1.0128 | 0.9831 | 3.0% |
| 37°N | 0.9916 | 1.0066 | 1.5% |
| 49°N (north edge) | 1.0144 | 0.9867 | 2.8% |

Shading in the source grid sidesteps this entirely: the tile's own scale is already
known and already correct. The figures stand as the reason **not** to shade in plane
space — and if that order is ever revisited, the shipped shader takes `metresPerTexel`
as a **vec2** (added for the geographic-raster case), so the anisotropy is expressible
without a shader change.

### What is actually hard here

Not the geometry. Two structural things:

- **A third height-source path**, alongside tiled-Mercator and raster-in-its-own-CRS.
  The shader and the apron are shared, which is what keeps this honest — "one shader,
  one apron, every entry point" is the discipline that made relief coherent in the
  first place, and the warp must join it rather than fork it.
- **Per-tile source zoom.** A sheet spanning Alaska to Florida needs different Mercator
  source zooms at different latitudes to hold constant plane resolution, so the choice
  is per tile, not per frame.

Resampling twice also adds slight smoothing; the warp target's resolution follows the
capture ratio for the same reason the grain and the collision pass do.

Gate: an Albers US sheet with hillshade and contours matches a QGIS render of the same
DEM within threshold; no seam at any source-tile boundary; relief detail scales with
`snapshot({scale})`; the subdivision rule is asserted directly — deviation stays under
half an output pixel at z=3, 5 and 8, a headless test needing no GPU; and the azimuth
datum (§4a, §12.4) is visible in the output, with sheet-north illumination constant from
one edge of a CONUS sheet to the other and geographic-north demonstrably not.

**What the gate actually holds, and one item it does not.** Landed as
`e2e/plane-relief.spec.ts` against the shared synthetic DEM: the sheet inks and carries
relief; it is a DIFFERENT picture from the same document without `crs` (15.9 luminance
levels of 255); no source-tile boundary spikes out of the crowd; the document validates
clean; the azimuth datum changes the projected picture and changes the Mercator one by
EXACTLY zero, against a run-to-run noise floor of exactly zero. Plus the headless
subdivision assertions above.

Two substitutions, stated rather than quietly made. **A QGIS reference render** is not
in the harness; the Mercator control plays that role — same DEM, same camera, same sun,
one attribute apart — which catches a wrong projection but not a wrong projection
*library*, a risk `projection.ts`'s own definitional-anchor fixtures carry instead.
**"Relief detail scales with `snapshot({scale})`" is not asserted at the pixel level**:
the Mercator control fails it identically, because a scaled capture returns before the
deeper tiles it just requested arrive, so measuring it would report on the fixture's
settling rather than on the warp. That claim is held by `captureZoomOffset`'s unit test,
`subdivisionFor`'s √ratio term, and the tile-zoom parity test — which is the part the
warp can actually get wrong, and did (C26).

**Phase 6b — native-CRS pyramids (deferred until asked for).** `TileMatrixSet` from
the registry: where a provider serves tiles already in the target grid (OS Terrain in
BNG, swisstopo in LV95) they would be consumed directly, with no warp and no second
resample. This was Phase 6's "Tier 1" and is now separated and deprioritised, because
the measurement above changed its value: it is a whole alternative tiling scheme whose
only advantage over the warp is avoiding one resample, for the handful of national
grids where such a pyramid exists — and the warp is general, covers every projection,
and is cheap. Worth building when a user asks for a specific grid by name; not worth
building on speculation. (It remains the route to #2 step 2's "tiles within 1 px of
QGIS" acceptance, if that is ever wanted literally.)

**Phase 7 — surfaces and release.** Examples, `docs/`, README, skill + `llms.txt`,
`html-data.ts`, `dev/build-public.ts` + `npm run test:public`, architecture
traceability, CHANGELOG, the rewritten non-goals line, downstream pins with the
remotion battery dispatched **before** the pin moves.

## 10. Acceptance (the document-level bar)

- [ ] A sheet in Albers or BNG with curved graticule, smoothed coastline, dot-density
      thematic layer and a coastal vignette, frozen to an editable vector frame, opens
      with no runtime and prints crisp at 300 dpi.
- [ ] The same document renders identically in the interactive frame and in the
      vector frame within the SSIM threshold, raster bands included — **labels
      excepted**, and deliberately: the serializer declutters on the CPU while the
      preview declutters on the GPU, so the two legitimately keep different label sets
      (C5, §13.2). The comparison masks label glyphs; that exception is the one place
      this bar is not "identical", and it is a decision rather than a tolerance.
- [ ] Every limit is a validator error with a fix; nothing is silently inert.
- [ ] No new eager weight: three lazy chunks — transforms, serializer, warp — each
      pinned by a "never downloads it" browser test and a bundle assertion.
- [ ] Stories and `seek()` on a projected map need no document changes.
- [ ] `onlymap-remotion`'s battery passes on a projected, transformed story.

## 11. Non-goals

- A second interactive renderer (§1).
- GPU shader projection — #2 step 4, still gated on live CRS switching.
- Globe — #2 step 3, unchanged.
- SVG picking or interaction; the vector frame is output, not a UI.
- Hyphenation, bidi, or paragraph typography in labels.
- **Exact polygon offsetting** — a measured setback, a catchment, any buffer whose
  *area* is the answer. `buffer` here is an ornament (§5); the boundary is
  queryability, not the arithmetic, and it is the same boundary shaded relief was
  admitted under.
- Sheet annotations (callouts, leaders, connectors) — a separate design (`<om-arrow>`),
  cartograph-only and independent of this plan.

## 12. Open questions (maintainer input)

1. **Font policy for vector frames:** embed via `@font-face` when a URL is known and
   otherwise carry the family name, or convert every glyph to a path? Proposed: embed
   when known, family otherwise, outline-to-path as an explicit option.
2. *(Resolved — see §6.)* **Effects on a vector sheet.** The map frame rasterises as
   one band at its own `effect-dpi`; the sheet's furniture stays vector; a dev notice
   names the trade. SVG filters were ruled out on print reliability, effect
   decomposition shelved as a possible later optimisation for pointwise-only chains,
   and per-layer scoping identified as a live-renderer feature rather than an export
   policy. The one thing left to pick is the **default** for `effect-dpi`: 300 matches
   the sheet and keeps files small; 600 keeps fine type good and roughly quadruples the
   embedded bytes. Proposed: **600**, on the grounds that anyone exporting vector is
   exporting for print quality, and a surprising file size is easier to discover and
   fix than surprising soft type.
3. *(Resolved — taken as proposed, and open to being overturned.)* **What scale do
   millimetre transforms resolve against?** (§5 Units, C16.) The third candidate
   shipped: a **declared reference scale**. A frame supplies its own from the georef; a
   live map declares `reference-scale="1:50000"` (or `"50m"`, the ground metres one
   millimetre stands for); a map with neither gets a validation error the moment a
   transform asks for millimetres, naming the fix. The two rejected options both fail
   quietly — freezing at the initial scale reveals over-simplified geometry on zoom-in,
   and per-zoom-bucket re-running puts geometry work on the pan path and destroys the
   cache key. **Ground units are the escape hatch that keeps this from being a wall:**
   `tolerance="50m"` needs no scale and says exactly what it means, which is what makes
   the millimetre error an error rather than an obstacle. This decision was taken
   without maintainer input so the phase could proceed; it is cheap to reverse, because
   the scale enters at exactly one place (`groundMetres`) and the cache key already
   carries it.
4. *(Resolved — taken as proposed, and open to being overturned.)* **Which north does
   `sun-azimuth` mean on a projected sheet?** (§4a, C17.) **Sheet north by default,
   `sun-datum="geographic"` as the opt-in.** Shading runs in the source tile's own grid,
   where up IS geographic north, so sheet north is a per-tile rotation of the authored
   azimuths by the grid convergence — applied where the uniforms are built, not in GLSL,
   because it is a property of where the tile sits on the sheet rather than of a
   fragment. Measured against the plane rather than by EPSG code
   (`planeGridConvergence`), so a CRS registered as a bare pair of functions answers it
   too. The swing is ±17° across Albers CONUS, ±4° on British National Grid, and exactly
   zero in Mercator — where the attribute is therefore inert, and the validator says so.
   Like §12.3 this was taken without maintainer input so the phase could finish; it is a
   default flip to reverse.

*Resolved since the first draft:* the buffer-library question (vendor a clipper vs
write the narrow subset) is answered by scoping `buffer` as an ornament and building it
on a distance field — no library, no licence review, no self-intersection class at all
(§5).

## 13. Adjacent designs, deconflicted

Two other designs are in flight against this codebase — **layer extensions**
(decluttering, masking, pattern fills, offset lines) and **sheet annotation arrows**.
They were written independently and they touch this one in six places. Recording the
interactions here so none of them is discovered by a failing gate.

### 13.1 The rasterise trigger is a post-process pass, by type

The sharpest one, and it has a wrong answer on each side.

`CollisionFilterExtension` installs a map-level effect *by itself* — its
`initializeState` calls deck's `_addDefaultEffect`, and deck resolves
`userEffects.concat(defaultEffects)`. So the moment decluttering ships, **a map with no
finish at all still has an effect in deck's resolved array.** Rasterise on "deck has
effects" and every map with decluttered labels silently exports as a bitmap — the
vector feature disabled by an unrelated one, with no error and no notice.

The obvious correction — "rasterise only when the document contains an `<om-effect>`
element" — is wrong the other way. `MapController.setEffects()` takes deck `Effect`
instances directly and outranks the document's chain while set, so a programmatic
author supplying a genuine post-process pass would get vector output with the finish
silently missing. Same class of failure, opposite direction.

**The test is the effect's type, not its provenance.** Verified against the pin:
`PostProcessEffect` is the only class that runs a shader pass over the finished frame,
and `CollisionFilterEffect`, `MaskEffect` and `LightingEffect` are each standalone
classes, none of them subclasses of it. So `instanceof PostProcessEffect` over the
resolved chain admits exactly the cases that have no vector equivalent — the
`<om-effect>` chain and a programmatic `setEffects` — and excludes exactly the ones that
do: collision (the CPU declutter pass, §13.2), masks (`<clipPath>`, §13.4), and
lighting, which shades layers rather than treating the frame.

Pin it both ways: a map with decluttering and no finish must emit vector; a map whose
only finish arrived through `setEffects` must emit a raster band.

*Known edge, stated rather than engineered around:* a bespoke `Effect` passed to
`setEffects` that post-renders without extending `PostProcessEffect` is not detected.
Nothing the library produces does that, and the dev notice names what was emitted, so
the failure is visible rather than silent.

The same fact qualifies a sentence already shipped in the effects guide —
`setEffects([])` no longer means "no effects run" once a decluttering layer is present.

### 13.2 Decluttering: two algorithms, and which one is authoritative

§6 has the serializer run its own CPU greedy pass, because deck's collision map is
resolution-dependent and its survivors are not queryable (C5). The extensions design
reaches the same fact from the other side and treats a preview/plate divergence as a
*contract problem* rather than an accepted cost.

Both cannot be right, and the honest reading is that **this document was internally
inconsistent**: it claimed the interactive and vector frames render identically while
specifying two different decluttering algorithms. Acceptance (§10) now states the
exception explicitly and masks labels from the comparison.

That leaves a real choice, and it belongs to whichever design lands second:

- *Accept the divergence* — GPU collision is the preview, the CPU pass is print truth,
  and the two may keep different labels. Cheapest, and defensible because the print
  pass is the better algorithm.
- *Make the CPU pass authoritative for both* — the preview asks the same code the
  serializer does. Exact parity, at the cost of doing placement on the CPU every frame.

Proposed: **accept the divergence, and say so in both places**, revisiting only if the
measurement the extensions design plans for its own phase 0 shows the label sets
differing by more than a couple of items on a real sheet.

### 13.3 Millimetres-on-paper is one question asked three times

`<om-effect>` answered it for uniforms, where re-resolving per frame is free. This
document asks it again for geometry (§5 Units, §12.3), and the extensions design asks
it a third time for fill patterns, which deck anchors in **world** space — a pattern
authored in metres silently changes size between screen and sheet.

One answer serves all three, and §12.3's proposal is it: a **declared reference scale**,
supplied by a frame, declared on a live map, and a validation error where neither
exists. Patterns are the easy case — the scale is a prop, re-derived per frame like a
uniform — and geometry is the hard one, because a transform runs once at ingest. Both
should read the same declared value rather than each inventing a rule.

### 13.4 Mask layers need a serializer strategy

The extensions design ships masking, where a layer carries `operation: "mask"`, draws
nothing, and clips others. §6's strategy table has no row for that, and the layer is
not `visible: false`, so a naive walk would emit its geometry as artwork.

SVG maps it exactly: a mask layer becomes a **`<clipPath>`**, referenced by the layers
it masks. Better than the raster fallback, and worth stating before the table is
implemented. Deck caps masks at four; SVG does not, so the cap is inherited from the
live renderer rather than imposed by the serializer.

### 13.5 Arrows compose, and the plane view improves them

Sheet annotation arrows are furniture: they live outside the map frame, so they stay
vector even when §6 rasterises the frame, and the freeze-to-vector work (§7) does not
disturb them. Their geographic anchors resolve through the frame's `FrameGeoref`, which
is exactly what §7 keeps unchanged.

The plane view makes them **better**, which nobody should have to rediscover: an
orthographic frame's corners are an affine map of the plane (§4), so a geographic
anchor on a projected sheet is exact rather than homography-approximated. Arrows
anchored to features are one of the clearer beneficiaries of Part A.

### 13.6 The shared follow-up has one owner

Label candidate positions, leader lines and text on a path appear in both designs — as
explicit non-goals of the extensions work ("placement logic, not extension work") and
as the natural home of this document's CPU declutter pass (§6). They are the same
follow-up, and it belongs to the **placement pass**, not to extensions. Recorded so it
is not scheduled twice or dropped by both.
