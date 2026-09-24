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
- *Local origin is not optional.* Eastings near 500 000 and northings near 6 000 000
  jitter in fp32 at high zoom (#2 §0, "whoever builds it will hit this in the first
  hour"). The plane holds `(x − x₀, y − y₀)`; the origin is the map's initial centre,
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
| **`HillshadeLayer`** (and `contour` off its tiles) is Mercator-only until the warp lands — relief itself is not | `src/hillshade.ts` samples `{z}/{x}/{y}` Mercator tiles and states ground scale at the equator (`:320`); `shading="hillshade"` on a raster reads the file's own grid and has no such tie | Use a DEM of your own with `shading="hillshade"` (§4a — works from Phase 1), or wait for Phase 6's warp to restore the keyless path. Freezing relief from a Mercator frame is affine and sound only over small extents (C3b) |
| CRS fixed for the map's life | re-ingest on switch is a remount | author two maps |
| `flyTo` arcs are linear | `FlyToInterpolator` is Web Mercator only; the `LinearInterpolator` branch at `runtime-core.ts:2235` is the plane path | none needed |

### Relief on a projected sheet — available from Phase 1

The limits table says `HillshadeLayer` is Mercator-only, which reads as though a
projected sheet cannot carry relief. It can, and by the route a cartographer would
take anyway.

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

- **Picking, hover, draw, snapping** — screen-space; unchanged (#2 confirms).
- **Measure** — unproject to lng/lat, then the existing `geodesy.ts`. Never measure
  in projected metres: scale factor varies across a conic sheet.
- **Scale bar** — computed at the frame centre, the cartographic convention; the
  cartograph scale bar already resolves proj4 lazily for projected grids.
- **Graticule** — already reprojects and densifies (`docs/cartograph.md`); in a conic
  view it curves correctly with no new work. This is the first visible payoff.
- **Frame georef** — an orthographic frame's corners are an **affine** map of the
  plane, so `FrameGeoref { crs: "EPSG:5070", corners }` is exact and world-file-able:
  no homography, no pitch cap, no wrap. The continuous-Mercator georef work stays for
  Mercator frames.
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
| `<om-effect>` present | **the whole map frame** becomes one raster band at `effect-dpi` — a post-process pass treats the finished frame, and there is no vector equivalent (see below) |

Consecutive raster layers merge into one band. The "hybrid" is not a fallback: vector
linework over placed relief is how cartographic production has always worked.

### Effects: the whole frame rasterises, at a resolution you choose

An effect treats the **finished frame**, so there is no "some layers". Every layer is
beneath every effect, and a sheet carrying a finish exports its map frame as a single
raster band. Legend, crop marks, graticule labels and the rest of the sheet furniture
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
| C1 | fp32 jitter in projected metres | local origin, fixed per map, written into georef |
| C2 | `FlyToInterpolator` is Mercator-only | plane view uses the existing `LinearInterpolator` branch |
| C3 | `HillshadeLayer` samples Mercator `{z}/{x}/{y}` tiles, so **that layer** is Mercator-only | A limit on the keyless-global-tiles convenience, NOT on relief. `shading="hillshade"` on a raster is projection-independent already (§4a), so a projected sheet can carry relief from Phase 1. The warp (Phase 6) restores the keyless path; validation error with the fix meanwhile |
| C3b | Relief frozen from a Mercator frame into a projected sheet is an **affine approximation** | Sound over a city, wrong over a continent — the Mercator↔target difference is not affine. Bound the interim workaround by extent, or use a DEM in the sheet's own CRS (§4a) |
| C4 | Effects cannot be vectorised, and treat the whole frame, so there is no partial answer | the map frame becomes one raster band at its own `effect-dpi` (600 keeps fine type good), with a dev notice naming the trade. SVG filters ruled out on print reliability; decomposition shelved; per-layer scoping is a renderer feature, not an export policy (§6) |
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

**Phase 0 — projection core** (`src/projection.ts`). Unify `georef.ts`'s `CrsForward`
and `crs.ts`; forward/inverse/batch; local origin; `registerCrs`. Gate: fixtures for
BNG, UTM 32N, Albers 5070 and Swiss LV95 agree with proj reference values to 1e-6
relative, headless.

**Phase 1 — plane view.** `<om-map crs>`; ingest projection; view swap; camera
translation; events; measure/scale bar/graticule checks; the limits table as
validator rules; affine frame georef. Gate (real GPU): an Albers US sheet with
`basemap="none"` — a known lng/lat lands within 1 px of the CPU prediction,
parallels visibly curve, `getCamera()` round-trips, no jitter at zoom 14 near
(500 000, 6 000 000), `snapshot({scale: 3.125})` renders at scale, and the manifest
validates with exactly the listed limits and no others.

**Phase 2 — transforms v1.** The `<om-transform>` seam, mm units, `simplify`,
`smooth`, `dot-density`. Gate: seed determinism at 1× and 4×; a transformed layer's
legend and `anchor="surface"` follow the new shape; and **the renderer and the
serializer receive identical transformed geometry**, asserted by hashing the coordinate
arrays rather than the IR — `LayerIR.props` holds compiled accessor *functions*, which
are not comparable, so "byte-identical IR" (as an earlier draft put it) is not a
property anything can test. Hash both paths: the shared in-process result, and a
re-parse of the same document, since the second is what proves a transform is the pure
function §5 claims and not quietly dependent on call order or state.

**Phase 3 — vector serializer v1.** Vector strategies, raster bands, effect policy,
style mapping, SSIM gate, text parity, CPU declutter, feature guard, bundle assertion.
Gate: the print-finish example and an Albers sheet round-trip within threshold; a map
that never asks for SVG never fetches the chunk; and the effect path is exercised both
ways — a sheet with a finish emits one raster band plus vector furniture and raises the
notice, the same sheet without the finish emits no band at all, and `effect-dpi`
demonstrably changes the band's pixel dimensions rather than only its scaling.

**Phase 4 — freeze to vector.** `<om-frame>` stores an inline `<svg>`; print CSS,
bleed, crop marks, atlas; validator; downstream ticket for `nika-agent`'s exporter.
Gate: a frozen vector sheet opens with no runtime, prints at 300 dpi with crisp
linework, and its georef matches the live frame's to 1e-6.

**Phase 5 — the raster-derived transforms.** `contour` from DEM (Mercator), then
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

**Phase 6 — raster in the plane: the warp.** Lifts C3, and is the phase that decides
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
| Albers CONUS (5070) | 0.35 | 0.24 | 0.13 |
| British National Grid (27700) | 0.42 | 0.30 | 0.16 |
| Swiss LV95 (2056) | 0.30 | 0.29 | 0.14 |
| Lambert 93 (2154) | 0.30 | 0.28 | 0.14 |

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
3. **What scale do millimetre transforms resolve against?** (§5 Units, C16.) A sheet
   has one; a live map's changes on every zoom, and geometry cannot be re-resolved per
   frame the way an effect's uniforms can. Three candidates: resolve once at the map's
   initial scale and freeze (cheap, but zooming in reveals over-simplified geometry);
   re-run the data stage per zoom bucket, pyramid-style (correct, but puts geometry
   work on the pan path and breaks the cache key); or require a declared reference
   scale and make millimetre units a validation error where none exists. **Proposed:
   the third** — a frame supplies its own scale, a live map declares one, and
   "millimetres on paper" keeps meaning what it says. Settles before Phase 2 because it
   decides the caching key.
4. **Which north does `sun-azimuth` mean on a projected sheet?** (§4a, C17.) Geographic
   north is physically true; sheet north is what relief atlases do, because constant
   apparent illumination looks right and lighting that rotates across a plate reads as a
   mistake. The difference is ±17° across an Albers CONUS sheet and ±4° on British
   National Grid. Proposed: **sheet north by default, geographic as an opt-in**, applied
   per tile through the existing `gridConvergence()`. Needed only when the warp lands,
   but it is a cartographic call rather than a technical one, so it is worth making
   deliberately rather than by whichever is easier to implement.

*Resolved since the first draft:* the buffer-library question (vendor a clipper vs
write the narrow subset) is answered by scoping `buffer` as an ornament and building it
on a distance field — no library, no licence review, no self-intersection class at all
(§5).

## 13. Adjacent designs, deconflicted

Two other designs are in flight against this codebase — **layer extensions**
(decluttering, masking, pattern fills, offset lines) and **sheet annotation arrows**.
They were written independently and they touch this one in six places. Recording the
interactions here so none of them is discovered by a failing gate.

### 13.1 The rasterise trigger is the authored element, never deck's effect array

The sharpest one. `CollisionFilterExtension` installs a map-level effect *by itself* —
its `initializeState` calls deck's `_addDefaultEffect`, and deck resolves
`userEffects.concat(defaultEffects)`. So the moment decluttering ships, **a map with no
`<om-effect>` in it still has an effect in deck's resolved array.**

§6 rasterises the whole frame when an effect is present. If that test is implemented
against deck's resolved effects, every map with decluttered labels silently exports as
a bitmap — the vector feature quietly disabled by an unrelated one, with no error and
no notice. The trigger is therefore the **authored `<om-effect>` element in the
document**, and nothing else. Deck keeps its default effects in a separate list, so the
distinction is available; it just has to be used. A test should pin it: a map with
decluttering and no `<om-effect>` must emit vector.

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
