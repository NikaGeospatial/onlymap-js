# GPU projection — a bounded study before any fork

*Plan, 2026-10-12. Tracks onlymap-js #49 (split out of #2, "Layer 2"). Written after a
first rundown and a review of it; the review's corrections are folded in and credited
where they changed the plan. Status: Step 0 built (branch `feature/live-crs`); all four study
deliverables done (results at the end; code on branch `study/gpu-tmerc`). The
technical go/no-go criteria are met with one stated caveat; the decision now rests on
demand (D5).*

## What it is

Today a projected map (`crs=` on `<om-map>`) converts coordinates once, on the CPU,
when a layer's data loads, and draws plane metres through an orthographic view. GPU
projection would move that conversion into deck.gl's vertex shader, so every point is
projected on every frame.

**What that buys, and only this:**

1. **Vector tiles drawn in a projected plane at full speed** — deck's `MVTLayer` over
   OpenFreeMap/OpenMapTiles tiles, in a national grid or an equal-area projection, with
   crisp lines and labels at any scale. This is *not* MapLibre basemap presets on a
   projected map: MapLibre styles need MapLibre's renderer. It is vector tiles drawn by
   deck with an OnlyMap-authored style, so a `positron`-like look would be a new preset
   written against the same tiles.
2. **Live projection switching** — changing `crs` on a mounted map without reloading.
   The review showed this does *not* need the GPU (§2 below), which is why the plan
   builds it on the CPU first and the study's real question narrows to (1).

Everything else a projected map needs is already met: data in any CRS, warped imagery,
relief, picking, vector export (crs.md, 0.12.0).

## What was established (2026-10-12, against deck.gl 9.3.5 and the 0.12.1 checkout)

**deck's projection seam.** Every layer's vertex shader, every extension and the GPU
picking pass go through one function, `project_position`, in core's `project` shader
module. It branches on a `projectionMode` enum: Web Mercator, Mercator-with-offset
(deck switches to it above zoom 12, applying CPU-computed scale factors in the shader),
globe, and identity. Our plane uses identity today. The module is bound by object
reference (`project32` lists it as a dependency) and luma's dependency walk dedups by
name in favour of the dependency copy, so it cannot be substituted at runtime. The only
workable mechanism is a build-time patch, which must change **four** files: the GLSL
module, the mode constants, the viewport-uniform values, and the module's uniform
layout (`uniformTypes`, missed in the first rundown). OnlyMap creates its Deck with no
device options, so it runs WebGL only; the WGSL twin can stay untouched.

**Vector tiles do not hand the shader lng/lat.** `MVTLayer` in its default binary mode
gives tile-local coordinates with a per-tile matrix in Mercator world units (deck's
globe forces the slow GeoJSON mode for this reason). It also installs `ClipExtension`,
whose geometry mode projects two tile corners and keeps an axis-aligned box in common
space. In a plane a tile edge is curved, so seams would clip wrong in both directions.
Tile *selection* is solved: `plane-tileset.ts` already indexes Mercator tiles from the
plane's geography.

**Precision — corrected.** The earlier claim that fp32 "cannot resolve better than
5.7 m at a 6000 km northing" came from a defective helper in `plane-precision.test.ts`:
it doubles a step until a change shows, but its *starting* step already exceeds a float32
increment, so it returns the starting step. True float32 spacing:

| Magnitude | Claimed | Actual |
|---|---|---|
| 500 km easting | ~0.5 m | 0.03 m |
| 6000 km northing | ~5.7 m | 0.5 m |

The design conclusion survives — a local origin is still right, and at zoom 18 over
Britain a pixel is about 0.18 m, so 0.5 m is nearly three pixels — but these are storage
spacings, not bounds on a shader calculation's error, and they establish *that* a
high-zoom handover is needed, not *where*. The error of an in-shader series depends on
location, projection parameters, extent and output resolution. deck 9.3.5 ships
`fp64LowPart` but no fp64 projection module any more, so deck's low-precision position
component can only be consumed *linearly* (an affine offset) — which is exactly the
offset sub-mode, not a way to make a nonlinear series exact. The wrong 5.7 m figure is
also cited twice in carto-substrate.md (C1); deliverable 1 corrects all three places.

**Live switching needs no GPU.** `plane-layers.ts` keeps the source data and memoises
projected copies and accessor wrappers per (source, plane) pair; a new plane recomputes
them lazily with no refetch or reparse, at the measured 2.6 M vertices/s. The deck view
type is set from the plane at construction and can change through a prop update. The
remount on a `crs` change is a choice we made, not a constraint.

**Datum.** "Transverse Mercator supported" says nothing about a CRS's datum step. BNG's
registry definition uses a seven-parameter Helmert shift (good to a few metres; OSTN15
is deferred, crs.md §6.1). NAD27 is grid-based: a Helmert step is not a substitute, and
the first rundown was wrong to say so. GPU eligibility must describe the *whole*
transformation — family, datum method, units, custom definitions — with the CPU path as
the fallback whenever any part is unsupported.

## Decisions

- **D1 — Hybrid.** A CRS whose whole transformation has a shader implementation draws on
  the GPU; every other CRS keeps the CPU path that exists. One public API; the backends
  differ in documented performance, never in placement.
- **D2 — MVT first, styled basemap later.** `MVTLayer` on a plane is the proof; a vector
  basemap preset for projected maps is a follow-up with its own acceptance criteria for
  labels, collision and styling. MapLibre styles stay refused on a projected map.
- **D3 — Build the CPU live switch first**, regardless of the study's outcome (§ Step 0).
  It delivers use case 2 on its own and is the performance baseline the study needs.
- **D4 — The study is bounded and gated.** Roughly a week; no fork is started until the
  four deliverables below are in and the go/no-go criteria are met.
- **D5 — The demand trigger stays.** The issue deferred this behind a real request. The
  request here is the user's own choice to work on it; before the fork is taken on, the
  actual editor or dataset that needs vector tiles in a plane should be named, because it
  sets the scope of the preset work in D2.

## Step 0 — live `crs` on the CPU path (not part of the study)

Scope: `crs` on `<om-map>` becomes live, the way `projection="globe"` is. A change
builds a new plane frame, switches the deck view through props, and lets the memoised
projected copies and wrappers recompute on the next build. No refetch, no reparse, no
remount. The `crs-def` twin follows. A `set-crs` action (story-captured) and the
`MapController`/React twins follow the `set-projection` precedent.

Keep: validation's other plane limits; the warp meshes (they rebuild per tile from the
new frame); picking and export (they read the viewport).

Measure, as the study's baseline: wall-clock from attribute write to first settled frame
for a 10k-, 100k- and 1M-vertex layer, on a laptop GPU, with the camera held. These
numbers are the bar a GPU path must clear.

Tests: the existing plane suites run across a live switch (Albers → BNG → Mercator →
Albers) and must place every feature where a fresh mount of the final CRS places it.

### Step 0 — as built (2026-10-12, branch `feature/live-crs`)

`RuntimeCore.setCrs` resolves the new projection, adopts a plane with the current
centre as origin, swaps the deck View, controller and camera through props, rebuilds
the layers (the memoised copies and wrappers recompute for the new plane) and tells
overlays and widgets the viewport changed. Same Deck instance throughout. Surface as
planned: attribute, `set-crs` action (story-captured, undoable), controller option and
method, React props, IntelliSense. Two bugs found and fixed are in the architecture
entry (188): positional accessors' update triggers did not carry the plane, and history
never recorded `projection`.

**Baseline** — wall-clock from the attribute write to the first settled frame, headless
Chromium on this Mac, 640×480, under the determinism switch (`e2e/live-crs.spec.ts`):

| Layer | Mount | → Albers | → BNG | → Mercator |
|---|---|---|---|---|
| 10 lines × 1000 vertices (GeoJSON) | 1.6 s | 0.2 s | 0.2 s | 0.2 s |
| 100 × 1000 | 5.1 s | 1.8 s | 1.7 s | 1.5 s |
| 1000 × 1000 (1 M vertices) | 35 s | 18 s | 18 s | 17 s |
| 100 000 points (columnar) | 4.2 s | 2.0 s | 1.8 s | 1.7 s |

proj4 itself is about 0.4 s of the million-vertex switch (2.6 M vertices/s); the rest
is deck re-tessellating and re-uploading geometry that a shader projection would never
touch, since the uploaded data would not change. So the CPU switch is smooth to about
ten thousand vertices, a visible pause at a hundred thousand, and unusable at a million.
That is the bar for the go/no-go: the GPU path is worth its fork only for datasets past
the hundred-thousand-vertex mark, or for vector tiles.

## The study — four deliverables

1. **Corrected precision measurements.** Fix the helper (read adjacent float32 values
   directly), correct the three citations, then measure the thing that matters: the
   error of a Transverse Mercator forward series evaluated under fp32 emulation (and of
   the affine-about-origin approximation) against proj4js in double, over a grid of
   points across a real viewport, at zooms 4–20, for BNG at London and Albers at Denver.
   Output: error-vs-zoom curves per family and location, and the zoom at which each
   approach exceeds half a pixel at screen and at print (600 dpi) resolution.
2. **One GPU projection in a real production bundle.** The four-file patch for a single
   family (Transverse Mercator, BNG) applied through the Vite alias, proven in the dev
   server, the production bundle *and* the standalone bundle, with a guard test that
   diffs the patched files against the pinned originals so a deck bump cannot silently
   drop the patch. A `ScatterplotLayer` of known points must land on `map.project()`.
3. **Pixel-error measurements across the viewport.** The GPU placement against the CPU
   projection that picking and export use, at every pixel of a 1024-px view, at zooms
   4–20 and at a cartograph frame's 600 dpi capture. Stated tolerance: half a pixel on
   screen; a tenth of a millimetre on paper. This decides the handover rule, which is
   expected to depend on northing magnitude and extent, not family alone.
4. **Adjacent MVT tiles in a plane.** Two to four neighbouring OpenFreeMap tiles with
   buffered polygons and roads, drawn through the plane tileset with the tile-local
   branch and a clip that follows the tile's curved edges. Pass: no gaps, no duplicate
   edges, no seams at any zoom; a pick on a road reports the road; line widths match the
   same tiles on a Mercator map to a pixel.

Each deliverable is a test or a measurement script in the repo, not a note.

## Deliverable 1 — results (2026-10-12)

**Tooling.** `dev/tools/gpu-projection/model.mjs` ports proj4js 2.20.9's `etmerc`
(Transverse Mercator), `aea` (Albers) and seven-parameter datum step operation for
operation, with every intermediate value routed through a chosen arithmetic: double,
float32 with correctly rounded transcendentals (an optimistic shader), or float32 with
four ULP of transcendental error under a fixed-seed sign (a pessimistic one — the true
figure is a driver property that only deliverable 2's real GPU can give).
`measure-precision.mjs` places a 9×7 grid of points across a view, projects each with
proj4js in double (the CPU projection that picking and export use), and reports the
worst error of four candidates in pixels at zooms 4–20. `src/gpu-projection-study.test.ts`
guards it: the port reproduces proj4js to a nanometre in double, and its definitions
are the ones `crs.ts` bundles. The defective helper is fixed and its three citations
corrected (0.03 m / 0.5 m / 0.12 mm).

**Tolerances.** Half a CSS pixel on screen; a tenth of a millimetre on paper at a
600 dpi capture, which is 0.38 of a CSS pixel of the same view.

**Where each candidate fails** (two locations per CRS; two view sizes, the second a
4× capture of the first). A series' error is fixed in metres and so fails *from* a zoom
upward; a Taylor approximation's error grows with the view's ground extent and so fails
*up to* a zoom.

| Candidate | BNG London | BNG Lerwick | Albers Denver | Albers Miami |
|---|---|---|---|---|
| **1024×768 view** | | | | |
| series, fp32 optimistic | from z15 | from z13 | from z14 | from z14 |
| series, fp32 + 4 ULP | from z12 | from z11 | from z12 | from z13 |
| affine about the centre | up to z12 | up to z12 | up to z11 | up to z11 |
| quadratic about the centre | up to z6 | up to z6 | up to z6 | up to z6 |
| **4096×3072 capture** | | | | |
| series, fp32 optimistic | from z14 | from z14 | from z14 | from z14 |
| series, fp32 + 4 ULP | from z12 | from z11 | from z12 | from z13 |
| affine about the centre | up to z16 | up to z16 | up to z15 | up to z15 |
| quadratic about the centre | up to z9 | up to z9 | up to z9 | up to z9 |

(Print tolerance moves each boundary by at most one zoom; the full per-zoom tables
come from running the script.)

**What it says.**

1. **Precision does not block the fork, and the sub-mode design is confirmed** — but
   it must be second-order, not first. deck's own first-order offset is good only
   from zoom 12–13 on a screen and from zoom 16–17 at a 4× capture, which leaves a gap
   against the pessimistic series (safe to zoom 10–12). The second-order form, which
   deck already has the shape of (`commonUnitsPerWorldUnit2`), is good from zoom 7 on a
   screen and from zoom 10 at a 4× capture, overlapping the series everywhere measured.
2. **The handover is a rule in ground extent, not a zoom per family** — the reviewer
   was right. The quadratic form holds the tolerance while the view's half-extent is
   under about 100 km, whatever the zoom or resolution; the series holds while a pixel
   is coarser than about 24 m of ground (zoom 11 at mid-latitudes), whatever the
   location. Those two conditions overlap for any capture up to roughly 8000 pixels
   wide, which covers a 600 dpi A3 frame (6400 px) with margin and an A0 at 600 dpi
   (14 000 px) without. The rule for the implementation: project with the series while
   the pixel is coarser than the threshold, with second-order Taylor terms about the
   view centre below it; refuse, or fall back to the CPU, for a capture wider than the
   overlap allows.
3. **Location matters less than extent.** Lerwick, at a 1.2 Mm northing, loses one
   zoom of series headroom against London; Miami, outside both Albers parallels, gains
   one. The family-and-location spread is two zooms; the view-size spread is four.
4. **The optimistic/pessimistic gap is two to three zooms**, so deliverable 2 must
   measure the real GPU's transcendental error before the threshold is fixed.

**For the go/no-go:** the precision criterion is met on paper — a handover rule exists
that holds tolerance everywhere measured without fp64 emulation. It stays provisional
until deliverable 2 replaces the 4 ULP guess with a measurement.

## Deliverable 2 — results (2026-10-12, branch `study/gpu-tmerc`)

**Built.** One projection family — Transverse Mercator with a seven-parameter datum
step, i.e. British National Grid — in deck's `project` shader module, reached through
a build-time patch of four deck files (`src/plane-gpu/deck-patch/`: the mode
constants, the GLSL module, the module's uniform layout, the viewport uniforms). The
GLSL is proj4js's etmerc and datum arithmetic ported operation for operation from the
deliverable-1 model, so that model predicts this code. The patch is applied by
`dev/vite-plugin-deck-plane.mjs`, which swaps the four files by resolved path (an
alias cannot: deck imports them relatively), in two forms — a Rollup-side plugin for
every bundle that carries deck core (the main library, the standalone, the cartograph
standalone), and an esbuild plugin for Vite's dependency optimizer, because the dev
server serves deck from a pre-bundle the first form never sees. That second form was
found the hard way: in dev the shader ran unpatched, projection mode 5 matched nothing,
and every GPU-projected dot drew at the view centre (degrees read as plane metres).

The runtime side is small and behind an experimental `gpu-projection` attribute: a
`PlaneGpuView`/`PlaneGpuViewport` pair reporting the new mode and carrying the CRS's
uniforms (computed once in double from the `+proj=` definition, `tmerc-params.ts`), and
one branch in the layer build that skips the CPU copy and wrapper and hands the layer
its lng/lat with `coordinateSystem: LNGLAT`. Warp layers (relief, imagery) keep their
CPU meshes and go through the mode's cartesian path unchanged.

**Guarded.** `src/plane-gpu/deck-patch.test.ts` strips the marked blocks from each
patched copy and asserts byte equality with the pinned deck file, so a deck bump fails
there instead of silently dropping the patch, and the uniform names must appear in the
same order in the layout and the GLSL block.

**Proven in all three places.** `e2e/gpu-tmerc.spec.ts`, on Chromium's Metal backend:
the dev bundle, picking through the same shader (every dot picks at its projected
pixel), and the built standalone bundle (`dist/onlymap.standalone.js`, loaded by the
fixture in place of source). The production library bundle carries the shader too
(the marker string is in its chunk).

**Measured — the real GPU against the float32 model.** Nine dots across an 800×600
view over London, worst distance from `map.project()` (proj4js in double):

| Zoom | GPU, measured | Model: series fp32, correctly rounded | Model: + 4 ULP trig error | CPU path |
|---|---|---|---|---|
| 4 | 0.00 px | 0.0004 px | 0.003 px | 0.00 px |
| 8 | 0.00 px | 0.007 px | 0.04 px | 0.00 px |
| 12 | 0.12 px | 0.13 px | 0.86 px | 0.00 px |
| 14 | 0.77 px | 0.41 px | 2.5 px | 0.00 px |
| 16 | 2.00 px | 2.02 px | 9.3 px | 0.00 px |
| 18 | 7.12 px | 6.90 px | 54 px | 0.01 px |
| 20 | 21.1 px | 21.2 px | 221 px | 0.02 px |

**What it says.**

1. **The real GPU tracks the correctly-rounded model, not the pessimistic one.** At
   zooms 16–20 the measured error matches the optimistic prediction to within a few
   percent; the 4 ULP transcendental budget was an order of magnitude too gloomy on this
   hardware (Apple GPU, Metal). The one divergence is zoom 14 (0.77 px measured against
   0.41 px predicted), which is the dot-centroid method's own noise floor meeting a
   sub-pixel error, not a trig effect.
2. **The series handover is zoom 13 for BNG at London,** not 10–12: the shader holds
   half a pixel through zoom 13 and fails from 14. With deliverable 1's second-order
   offset holding from zoom 7 on screen and 10 at a 4× capture, the overlap is three to
   six zooms. Precision does not block the fork.
3. **The patch mechanism works and is checkable**, but it is two plugins and four
   vendored files, and the dev-server form was the part nobody would have thought of
   until it failed. That is the maintenance cost the issue warned about, now with a
   shape.
4. **Not measured here:** other GPUs (an Intel integrated part, a Windows ANGLE/D3D
   backend) — the 4 ULP figure may be real somewhere, and the handover rule should
   carry a margin for it; and the second-order sub-mode itself, which this prototype
   does not implement.

## Deliverable 3 — results (2026-10-12)

**Built first, because the measurement needs it:** the second-order sub-mode deliverable 1
recommended, in the shader. The viewport computes, in double and per draw, the expansion
of the projection about the view centre (constant term relative to the shader's float32
origin, Jacobian, the two Hessians — `quadraticAbout` in `plane-gpu-view.ts`), and the
shader evaluates `P0 + J·d + ½ dᵀH d` with `d` built from deck's high AND low position
parts, so it keeps the precision a float32 longitude alone cannot. **The handover rule**:
the series while an output pixel covers 8 m or more, the expansion below — output pixels,
so a 600 dpi capture hands over six zooms earlier than the screen. 8 m is deliverable 2's
measured series error (1–2.3 m) held under a third of a pixel.

The patch is now generated, not hand-edited: `dev/tools/gpu-projection/gen-deck-patch.mjs`
rebuilds the four files from the pinned originals, and fails on an anchor a deck bump
moved. It went from nine plane uniforms to fourteen.

**Measured** (`e2e/gpu-viewport-error.spec.ts`): a 9×7 grid of dots edge to edge across an
800×600 view — corners are where an expansion about the centre is worst — at London and
Lerwick, eleven zooms from 4 to 20, on screen and at a 600 dpi capture (×6.25, 5000×3750).
Tolerance half a pixel on screen, a tenth of a millimetre on paper (2.36 output pixels).

| | Worst on screen (tol. 0.5 px) | Worst at 600 dpi (tol. 2.36 px) |
|---|---|---|
| London, zoom 4–20 | 0.12 px (zoom 11–12, series) | 0.04 px |
| Lerwick, zoom 4–20 | 0.29 px (zoom 12, series) | 0.10 px |
| zoom 14–20, both, expansion | ≤ 0.025 px | ≤ 0.05 px |

Without the expansion the series alone was 0.8 px at zoom 14 and 21 px at zoom 20; with it,
zoom 20 matches the CPU path's own 0.02 px. **The rule holds the tolerance everywhere
measured.** The thinnest margin is the series just above the handover (Lerwick, 0.29 of
0.5 px), which is where a GPU with worse transcendentals than this one would fail first; a
production version should either measure a second GPU family or move the threshold to
16 m, which costs nothing (the expansion is exact to a thousandth of a pixel there too).

## Deliverable 4 — results (2026-10-12)

**Built.** `PlaneMVTLayer` (`src/plane-gpu/plane-mvt-layer.ts`): deck's MVTLayer asked for
lng/lat GeoJSON tiles, drawn through the plane tileset, with `PlaneClipExtension` cutting
each tile back to its own edge. deck's own clip uses an axis-aligned box in common space,
right in Mercator and wrong in a plane; but a Web Mercator tile is an lng/lat rectangle in
any projection, so the new clip tests each FRAGMENT's interpolated lng/lat against the
tile's lng/lat bounds (half-open), which follows the curved edge exactly. No globe
pretence (deck decides its MVT mode by asking whether the viewport is a globe, and faking
that would also change polygon tessellation).

**Measured** (`e2e/gpu-mvt.spec.ts`, `e2e/mvt-fixture.ts`): synthetic MVT tiles encoded with
pbf, each carrying a 256-unit buffer like real tiles, cut from one semi-transparent park
polygon and one semi-transparent road that cross dozens of tile edges (35–49 tiles per
view). Composited over white, the park interior must be one colour (a doubled buffer is
darker, a gap is white) and the road core must not be off-colour more often than on deck's
own Mercator path. The test is shown able to fail: the same page with the clip off.

| zoom | Clip off: off-colour park px | Clip on | Mercator (deck's own path) | Road width plane / Mercator |
|---|---|---|---|---|
| 11.5 | 32 150 of 286 000 | **121** of 397 000 (0.03%) | 0 | 15.65 / 15.78 px |
| 13 | 59 620 of 372 000 | **24** of 465 000 (0.005%) | 0 | 5.62 / 5.60 px |

A pick on the road reports the road at five points across tile edges. Diagnostics clean.

**The caveat.** Not zero: a few dozen single pixels on tile edges are claimed by neither
tile, because the two tiles' triangles interpolate lng/lat a hair differently at the shared
edge. Deck's Mercator path shows none. The production fix is known and cheap — cut each
tile's polygons to the exact tile edge on the CPU when the tile loads (densified, in lng/lat),
so both neighbours rasterise the SAME edge vertices and the rasteriser's own rules make the
seam watertight; the fragment clip then only has to trim line buffers. Not built here.

## Go / no-go — status after the study (2026-10-12)

| Criterion | Status |
|---|---|
| A handover rule that holds tolerance everywhere measured (D3) | **Met** — worst 0.29 of 0.5 px on screen, 0.10 of 2.36 px at 600 dpi |
| Vector tiles render seam-free (D4) | **Met with a caveat** — 0.005–0.03% seam pixels; fix path known |
| The patch guard works in all bundles (D2) | **Met** — dev server, main bundle, standalone; generator + byte-equality guard |
| No fp64 emulation needed | **Met** — deck's low position part suffices |
| A named dataset or editor that needs it (D5) | **Open** — the user's call |

The cost side, now measured rather than guessed: two plugins (one for bundles, one for the
dev server's pre-bundle, which nobody would have predicted), a 14-uniform extension of
deck's projection block, four vendored files regenerated by a script on every deck bump,
and a clip extension. The benefit side: a projected map that switches projection with no
re-tessellation (the CPU baseline is 1.7 s at 100k vertices, 18 s at 1M) and vector tiles in
any Transverse Mercator plane. Lambert Conformal Conic, Albers and LAEA would each be one
more GLSL function and one more parameter packer.

## Go / no-go after the study

**Go** if all of: the CPU switch baseline is visibly short of smooth for the named
dataset *or* vector tiles are the named need; deliverable 3 finds a handover rule that
holds the tolerance everywhere measured; deliverable 4 renders seam-free; and the patch
guard works in all three bundles.

**No-go** if any of: the affine sub-mode cannot hold tolerance without fp64 emulation we
would have to write; clipping curved tile edges needs changes beyond the clip extension's
public surface; or no dataset is named. In that case the issue stays open with the
study's numbers attached, and Step 0 ships on its own.

## Implementation (branch `feature/gpu-projection`, from 2026-10-12)

Go was given on the study's numbers. Phases, each landing with its tests green on BOTH
GPU backends — a real GPU (`--use-angle=metal` locally) and headless Chromium's default
SwiftShader, which is what CI and onlymap-remotion render with (the `gpu-metal` and `gpu-swiftshader` Playwright projects run each GPU spec on both):

| Phase | Scope | Status |
|---|---|---|
| 1. Backend robustness | Own trig in the shader; exact vector-tile fill seams | **Done** |
| 2. Default backend | GPU path on for eligible CRSs with no attribute; registry eligibility; existing plane suites run on it | **Done** |
| 3. Live switching | GPU CRS → GPU CRS by uniforms alone; anything else via Step 0's rebuild | **Done** |
| 4. Families | Lambert Conformal Conic, Albers, LAEA — one GLSL function and one packer each | **Done** |
| 5. Extensions and basemap | Mask, path style, collision, data filter audited; a keyless vector basemap preset | **Done** |
| 6. Release | README, skill, llms.txt, architecture doc, CHANGELOG | |

### Phase 1 — as built

**SwiftShader's trig is not float32-accurate.** The study's sweeps ran on Metal. On
SwiftShader the same sweeps failed by metres; a probe of the GLSL builtins against
correctly-rounded float32 found `sin`/`cos`/`tan` up to 3 175 ULP off for the arguments
the series uses (Metal: 1–2 ULP), and `sinh`/`asinh` cancelling near 0 on both. `atan`,
`exp`, `log` and `sqrt` were accurate on both. So the generator now writes its own: a
Cody–Waite reduction by π/2 with Cephes minimax `sin`/`cos`, `tan` from those, a series
for `sinh` below |x| = 0.5, and proj4's own `asinhy` form via `log1p`. The projection
source is rewritten to call them mechanically (`ownMath` in `gen-deck-patch.mjs`), so the
GLSL still reads as the transcription of proj4js's `etmerc`. After: the viewport sweep
passes on SwiftShader with worst 0.167 px at 600 dpi, and Metal is unchanged.

**Vector-tile fills are cut on the CPU.** Deliverable 4's caveat, fixed as proposed, with
one finding: only FILLS can be cut. A line has width, so a line cut at the edge ends in a
cap square to the line and its two halves overlap in a wedge (road off-colour went from
deck's level to 14–35%); a polygon outline drawn from the cut polygon would trace the tile
edge. So each tile draws as two layers: its polygon fills cut to the tile's exact lng/lat
edge at load (`tile-cut.ts` — Sutherland–Hodgman, with the cut run along the edge densified
on a lattice that depends only on the edge, so neighbours emit identical vertices), and
everything else from the uncut tile behind `PlaneClipExtension`, which is exact for lines,
points and outlines.

| zoom | Park px off-colour, Metal | SwiftShader | Deck's own Mercator, SwiftShader |
|---|---|---|---|
| 11.5 | **0** (study: 121) | 2 | 159 |
| 13 | **0** (study: 24) | 0 | 0 |

The road check was also wrong for a seam test: it compared total off-colour road pixels to
Mercator's, but most of those are the path's own joint overlaps — 447 of 475 lie 5 px or
more from any seam — and how many show depends on the backend (Mercator: 850 on Metal, 52
on SwiftShader). It now compares the off-colour rate within 1.5 px of a seam to the rate on
the rest of the road: plane ≤ 0.023 on both backends (limit 0.05), tile clip off 0.64
(must exceed 0.2).

### Phase 2 — as built

**Eligibility travels with the projection.** `resolveProjection` keeps the `+proj=` string
it built a proj4 projection from (`Projection.definition`), and the runtime asks
`planeGpuUniforms` of that — so an authored `crs-def`, a registered string and an online
lookup are decided exactly like a bundled code, and the study's static import of the whole
CRS table into the main bundle is gone. The packer now takes `+proj=utm` (as proj4js does:
the zone's Transverse Mercator), the Bessel and International ellipsoids, and a shift-free
`+datum` (WGS84, NAD83): 33 of the bundled grids and every formulaic UTM zone, each held to
proj4js within a millimetre by `deck-patch.test.ts`. Validation cannot await, so
`gpuDrawsCrs` answers from what it knows synchronously — an authored or registered
definition, a UTM zone, or `GPU_BUNDLED_CODES`, a list a test holds equal to the table.
`OmMap.configureCrs({ gpuProjection: false })` turns the path off.

Since the review pass (2026-10-14) the packer accepts only the `+proj=` parameters it
implements and refuses the rest — a sphere (`+R`), `+to_meter`, `+axis` — rather than drawing
them on WGS84 in metres. It takes a custom ellipsoid (`+a` with `+b` or `+rf`, derived as
proj4js derives it) and a prime meridian (`+pm`, named or in degrees), which folds into the
central meridian because proj4js takes it off the longitude after the datum step. EPSG:2062
(Madrid 1870) is the case that found it: before, the shader drew it about 3.7° of longitude
off; now it is held to proj4js within a millimetre with the rest.

**Not every layer type.** On a GPU plane a layer gets lng/lat and `coordinateSystem:
LNGLAT`, which is right only for a type that projects every vertex through deck's `project`
module and does no projection arithmetic of its own. `e2e/gpu-parity.spec.ts` draws one
layer of each of 15 types on BNG at zoom 11, by the shader and by the CPU, on both backends,
and compares ink centroids (whole picture and per cell), ink mass per cell, colour and
picks; a 1 px shift of the CPU picture is the control. Worst whole-picture offset 0.39 px
(TripsLayer, SwiftShader) against the shader's 0.5 px tolerance; picks identical.

| Type | Path | Why |
|---|---|---|
| Scatterplot, GeoJson, Path, Polygon, SolidPolygon, Line, Text, Column, Trips, ScreenGrid, MVT | shader | parity holds on both backends |
| Hexagon, Grid, Contour | CPU | they bin points in the view's own coordinates — degrees under the shader (99% of the picture differed) |
| GreatCircle | CPU | deck interpolates the great circle with builtin trig: exact on Metal, 1.9 px off on SwiftShader |
| Heatmap | CPU | parity held, but deck clamps its bounds to ±360°/±85° when the data is lng/lat, while it reads them from the view in plane metres; the clamped bounds never contain the screen, so it rebuilt its 2048² weight texture every frame (198 ms a frame panning on Metal, 16.6 ms by the CPU path) |
| everything else | CPU | not yet measured |

A CPU-path layer under the GPU view is drawn by the patch's Cartesian branch, the one the
warp meshes already use, so the two coexist in one map. ArcLayer is left out of the spec:
it draws next to nothing on a plane by either path, a gap of its own.

**Vector tiles follow the plane.** Validation allows `MVTLayer` wherever `gpuDrawsCrs` says
so; the runtime, which knows exactly, leaves an MVT layer out with one reported error on any
plane it finds CPU-drawn (an online-only code validation could not judge). *Superseded by
"Vector tiles off the main thread" below: vector tiles no longer depend on the shader, and
draw on every plane.*

### Phase 3 — as built

**Already true by construction.** A shader-drawn layer's data is lng/lat whatever the
plane, so nothing about it depends on which shader plane is current: a switch between two
of them changes the view's uniforms and nothing else. Measured with deck's own counters
(`e2e/live-crs.spec.ts`): UTM 14N → 15N → NAD83/UTM 14N with 100 000 line vertices, zero
layer updates and zero attribute updates; onto Albers, the CPU path re-projects. *Since
2026-10-14 one exception: a polygon FILL is triangulated in the plane and so triangulated
again for a new one — see "Polygon fills are triangulated in the plane" below; the spec holds
the lines-only case at zero and the polygon case to the fill's own handful of attributes.*

**The Step 0 baseline was SwiftShader's.** The 0.2 / 1.7 / 18 s figures were taken in the
default Playwright project, which has no GPU; there the drawing is emulated and dominates
every switch, on either path (shader → shader at 1M vertices: 18 s too). On Metal:

| 1M line vertices | Switch, wall clock to a settled frame |
|---|---|
| shader plane → shader plane | ~50 ms (three frames; no work) |
| CPU plane → CPU plane | ~230 ms (the projected copy) |

**A latent tiled-layer bug, fixed.** deck builds a TileLayer's tileset once and ignores a
later `TilesetClass`, and a tile's `bbox` is set once, at creation. So after any live switch
— Step 0's CPU switches included — a tiled layer kept selecting through the old plane and
culling cached tiles by their old extent. Invisible so far only because the new plane's
origin is the view centre, where the old plane is nearly right, and because the per-plane
class's new identity happened to flag a prop change that re-meshed image tiles.
`PlaneTilesetBinding` now gives each tiled layer one class for life, re-pointed on a switch;
the tileset culls by each tile's extent in the current plane; and the plane is an explicit
`renderSubLayers` trigger for image tiles and hillshade. `e2e/live-crs-tiles.spec.ts` holds
image tiles (CPU and shader planes) and vector tiles (shader planes) to a fresh mount after a
switch, with no tile fetched again.

### Phase 4 — as built

**Four families.** The shader is a datum step, then a dispatch on `planeOrigin.w` over
transcriptions of proj4js's etmerc, aea, lcc and laea (all four laea modes). The six
parameter uniforms became `planeP0`–`planeP5`, each family packing its own constants,
computed in double from the definition by `projection-params.ts`. Bundled grids now drawn:
the Transverse Mercator/UTM set plus 5070, 3577 (Albers), 2154 (LCC) and 3035 (LAEA).

**Float32 shaped the formulas.** A conic's `rh − rh1·cos θ` subtracts two radii of about
10 000 km, which float32 holds to a metre; and every family returned absolute plane
coordinates, often millions of metres, before the view origin was subtracted. Now each
family returns the position relative to the view origin (false origin minus view origin,
in double, as one offset); Albers takes `rh − rh1 = a(q − q0)/(s0 + s)` and LCC
`rh − rh1 = −rh·expm1(ns(log ts − log ts0))` exactly; the conics' `1 − cos θ` is
`2 sin²(θ/2)`; and qsfnz's logarithm is `log1p`. A float32 model of Albers at Seattle:

| Albers at Seattle, float32 model | Worst error |
|---|---|
| proj4js's formulas | 3.9 m |
| with `log1p` | 2.0 m |
| reformulated, origin-relative | 1.6 m (the Transverse Mercator floor) |

**The handover moved to 16 m per output pixel.** The sweep had only tested whole zooms;
at quarter zooms it found the conic and LAEA series on SwiftShader reaching the half-pixel
tolerance just above an 8 m handover (0.52 px, Albers at Seattle, z12.5). At 16 m the series
stops a zoom earlier, where its metres are half the pixels; the expansion is good to a
thousandth of a pixel for views up to ~100 km across, which 16 m per output pixel stays
inside even at 600 dpi.

| Sweep, worst over z4–z20 incl. quarter zooms around the handover | Metal | SwiftShader |
|---|---|---|
| BNG (London, Lerwick) | 0.12 px | 0.17 px |
| Albers CONUS (Kansas, Seattle) | 0.12 px | 0.17 px |
| Lambert-93 (Paris, Brest) | 0.12 px | 0.00 px |
| LAEA Europe (Frankfurt, Lisbon) | 0.12 px | 0.24 px |

Tolerance: 0.5 px on screen, 2.36 px at 600 dpi.

**A dev-server trap.** Vite keeps its pre-bundled deck until its dependency hash changes,
and the hash sees the optimiser's esbuild plugin by NAME only — so a regenerated patch was
served as the old one, and the old shader read renamed uniforms as zeros. The plugin's
name now carries a hash of the patched files.

### Phase 5 — the extension audit, as built

Each extension the library mounts, as a case in `e2e/gpu-parity.spec.ts` — the same layer
with the extension on, drawn by the shader and by the CPU, on both backends:

| Extension | Authored as | Result |
|---|---|---|
| `PathStyleExtension` | `dash` | matches (offset ≤ 0.24 px, picks identical) |
| `DataFilterExtension` | `filter-field`/`filter-range` | matches (≤ 0.06 px, picks identical) |
| `ClipBoxExtension` | `clip-box-min`/`-max` on the map | **draws nothing on a projected map, by either path** |
| `CollisionFilterExtension`, `MaskExtension` | — | not used by the live map (`declutter` is the SVG exporter's own CPU pass) |

The clip box places its `[lng, lat, elevation]` corners with deck's CPU `projectPosition`,
which under a plane view takes degrees for metres — the box lands nowhere near the data and
every layer is cut away. Present since projected maps shipped (0.10), so not a GPU
regression; a projected map now refuses it with a validation error and a fix, like terrain.
A geographic clip on a curved plane is a feature of its own, if anyone asks.

### Phase 5 — the vector basemap, as built

Decided with the user: the existing OpenFreeMap presets (`positron`, `liberty`, `bright`)
simply work on a projected map the GPU draws — no new names — and the first version is
geometry only (no labels: text on a projected map would need live decluttering).

- **Tiles.** OpenFreeMap's, read from its TileJSON once per session (its paths carry a
  dated version that rotates); the loader decodes only the geometry layers.
- **Drawing.** `PlaneBasemapLayer` (`src/plane-gpu/plane-basemap.ts`) is the plane's
  vector-tile layer drawing each tile as three sublayers: fills cut to the tile's edge in
  OpenMapTiles' stacking order (land cover, land use, parks, water, aeroways, buildings),
  road casings, then every line. Colours are each preset's own, taken from its style; the
  land is its background, which the plane view clears to.
- **Renderer.** On a projected map an OpenFreeMap preset no longer starts MapLibre:
  `initRenderer` diverts it to the deck plane. `setBasemap` recolours in place; `setCrs`
  keeps it between planes, and remounts to MapLibre when `crs` is dropped (and back).
- **Credit.** The map picks this basemap, so it credits it: OpenFreeMap, OpenMapTiles,
  OpenStreetMap in the managed attribution slot, and from `attributions()`.
- **Limits.** On a plane the CPU draws, validation refuses the preset and the runtime
  draws without it, saying why. Other MapLibre presets stay refused on projected maps.

Tested by `e2e/plane-basemap.spec.ts` against a served TileJSON and synthetic OpenMapTiles
tiles: the preset's land, water and park colours, the credit, a recolour, a switch to
Albers, the hand-over to MapLibre and back, and the refusal on the Swiss grid.

### Vector tiles off the main thread (2026-10-14)

User report: an `MVTLayer` lagged on a GPU plane. Measured on the debugger's shortbread tiles
(Metal, 1400×900): Mercator held 16.7 ms a frame at z5.2 and z8; BNG idled at 55 and 69 ms,
with main-thread blocks of up to 1.4 s while panning. Three costs, two of them the design's:

1. *Selection* — the plane cover's one-tile ring was drawn wholesale (deck culls tiles only
   when picking): 30 tiles where Mercator draws 12. Fixed first (ring tiles kept only when their
   plane extent meets the view), which also exposed and fixed a live-switch bug (the same camera
   in two origin-relative planes is an equal viewport) and folded warp cells.
2. *The shader* — deck's PathLayer projects three points per vertex, so on a GPU plane every
   line vertex ran three Transverse Mercator projections (plus BNG's datum step) every frame.
3. *Tile arrival* — each tile was decoded to GeoJSON, cut and triangulated on the main thread,
   where Mercator's MVTLayer gets binary, pre-triangulated tiles from its worker.

**The pipeline.** `src/plane-vector/`: `build.ts` decodes one tile (loaders.gl's parser), cuts
it to the tile's edge in lng/lat (`tile-cut.ts`), projects it ONCE into the plane, triangulates
it, and packs loaders.gl's binary feature collection in origin-relative plane coordinates;
`worker.ts` runs it in an inline worker (the plane crosses as data — a proj4 source or a
built-in code, and the origin — and the converter is the same arithmetic as
`projectionFromDefinition`); `client.ts` pools two workers and falls back to the main thread
for a plane registered as functions or where no worker can start. `PlaneMVTLayer` fetches each
tile's bytes, builds them for the current plane, and draws the collections with deck's
GeoJsonLayer in binary mode and `coordinateSystem: CARTESIAN` — no per-vertex projection left,
and nothing in it needs the shader patch, so vector tiles and the OpenFreeMap presets now draw
on CPU-drawn planes too. A tile keeps its bytes: a live `crs` switch (or a recolour that
reorders a basemap's lines) rebuilds it without refetching, drawing nothing for that tile until
the rebuild lands rather than geometry in the old plane. The basemap's selection and stacking
order travel to the worker as data (`Classify`), so sorting and casing selection happen there too.

**Everything is cut, nothing is clipped per fragment.** The first design cut fills but clipped
lines, because a cut line's caps overlapped its neighbour's. deck's default cap is in fact flat
— only a round cap reaches past the end — so cut lines meet exactly; `CutEndsExtension` drops a
round cap at a CUT end (flags per vertex from the build). Discarding at flat ends opened a
one-pixel gap at every cut; the extension acts only when `capType` is round. Polygon outlines
are the original rings cut as lines. Fills are triangulated in the PLANE, so a fill follows
its projected outline: triangulated in lng/lat (an intermediate version), a triangle's straight
edges are chords of curves, and far from the meridian an ocean covered Canada. Triangulating
in the plane made slivers along nearly straight tile edges, which SwiftShader filled across
the seam (220 doubled park pixels in the gpu-mvt spec); the cutter now keeps an edge's lattice
only where the edge visibly bows in the plane (`bowedEdges`, a decision both neighbours make
the same way), which brought that to 1.

**Past the domain.** Two failures, both found on a BNG map at zoom 2.5 over 84°W, where the
view reaches the pole and the tile cover spans every longitude. A point is placed only if it
round-trips (`placesFaithfully`: projected and inverted, it comes back) — the guard against a
projection laying its far side over its near side. And a projection's image can TEAR: past 90°
from its meridian a Transverse Mercator splits along the equator and runs to infinity near
±90°, so a Pacific tile's ocean drew triangles across the tear that covered Canada. A tile
whose 9×9 sample grid shows a step out of all proportion to the rest gets a tear test per
segment (a continuous image's steps shrink under subdivision; across a tear one stays as long
as the whole): a line breaks there, a polygon with a torn edge is dropped, and an image tile's
warp cell with an edge 20× the mesh's median is left out. Tiles with no tear pay nothing. A feature keeps one id
across its pieces and collections, so a pick or `highlightedFeatureId` addresses the feature;
a picked feature's coordinates are lng/lat, read back from the plane only when asked for.

**Measured** (Metal, the debugger's vector tiles alone): z5.2 — Mercator 16.6 ms idle, BNG 16.7,
the Swiss grid (CPU plane) 16.7; z8 — Mercator 20.1, BNG 20.1, Swiss 17.9; no main-thread task
over 50 ms panning on Mercator or BNG (one of 69 ms on the Swiss grid). Seams: gpu-mvt holds
on Metal and SwiftShader at z11.5 and z13 (road seam excess 0.015 on both; doubled park
pixels at seams 1 on SwiftShader). The worker chunk is lazy: 68 KB gzipped, loaded the first time vector tiles
draw on a plane.

### Polygon fills are triangulated in the plane (2026-10-14)

Found on the debugger at BNG z2.56 over Canada, once the basemap drew right: every country
showed fans of overlapping and missing triangles. deck triangulates a lng/lat polygon in the
flat space it will draw it in — `viewport.projectFlat`, Web Mercator's — so the triangles tile
the drawn shape; on the plane view that call is the identity, so earcut ran on degrees, and
the shader then projected only the corners. Far from the meridian a triangle's straight edges
in the plane are chords of long curves, and the fan no longer tiles. The CPU path never had
this: it triangulates its plane-metre copy.

The patch gains a fifth file, deck layers' `solid-polygon-layer.js`: where it picks the
tessellator's `preproject`, a layer with `_planePreproject` (every polygon-bearing layer the
runtime builds on a GPU plane: SolidPolygonLayer directly, PolygonLayer and GeoJsonLayer
through their fill sublayer's `_subLayerProps` slot) triangulates with it, and one without
falls back to `viewport.planePreproject` — the same projection, for a layer built outside the
runtime. Two things made the explicit prop necessary rather than the viewport alone: deck
re-creates layer instances every render, so a closure planted at `initializeState` over
`this.props` kept the plane the layer was FIRST built for, and the viewport a layer sees during
a live switch is still the previous one (deck activates the new viewport on the next frame).
So the plane is passed into every `updateGeometry` — the tessellator merges its options there
— and a plane switch triggers one through `updateTriggers.getPolygon` (which a GeoJSON layer
with no polygon in it does not get, keeping its zero-cost switch). One preprojector per plane,
memoised, so a rebuild changes no prop. A point the plane cannot place stays NaN for earcut:
the shader puts that vertex nowhere and the GPU drops its triangles, as before.

Measured (`gpu-parity.spec.ts`, world-countries on BNG at z2.56 over 84°W, shader vs CPU):
whole-picture offset 0.001 px, worst cell 0.01 px, ink Δ0.00% on Metal, 0.01% on SwiftShader;
after a live switch to UTM 33N the picture is a fresh mount's (offset < 0.5 px; it was 2.1 px
with the stale closure). A switch with the fixture's land polygons: the GeoJsonLayer and its
fill update, ≤ 8 attributes; without them, zero.

### GeoJSON is cut at the projection's seam (2026-10-15)

Found on the debugger: Albers CONUS over Canada, the countries layer drew wedges over Hudson
Bay and the Arctic — by the shader and by the CPU path alike (parity held: 0.0008 px). A conic
is a cone cut open along the meridian opposite its central one (84°E for CONUS Albers), and a
Transverse Mercator wraps there too. Every vertex has a place, but a segment between two
vertices either side of that meridian is drawn as a chord across the whole sheet: Russia,
which spans 84°E, reached from one edge of the cone to the other. The tile pipeline already
cut tiles to their edges; GeoJSON data had no cut.

`src/plane-seam.ts` cuts polygons and lines at the seam before either path draws them — the
antimeridian cut, with the seam standing in for ±180°: longitudes are unwrapped about the
central meridian, each ring clipped to every 360° band it reaches (tile-cut's ring clipper), each
cut vertex moved a centimetre into its piece's own side — exactly 180° from the central
meridian proj4 puts a point on one fixed edge of the cone, which brought the chord back for the
other piece — holes shifted by whole turns into their outer ring's
span, and the pieces put back as a MultiPolygon (a line as a MultiLineString) in the feature's
own place, with its properties, so picking and accessors see the same row. The seam is a
function of `lon_0` alone (`seamOf`, from the plane's definition: aea, lcc, tmerc, utm; LAEA
has a point antipode, not a seam, and a registered function none this knows), so the result is
memoised per data object and seam: two planes with the same central meridian share one array
— a UTM 14N → NAD83/UTM 14N switch still updates nothing — and a feature that never reaches
the seam is untouched by identity, which is every feature of a regional map. Applied on the
GPU path as the layer's data, and on the CPU path before `projectData`. Geometry reached
through a positional accessor over flat rows (`get-polygon`, `get-path`) is cut too
(`cutRowsAtSeam`): deck takes one polygon or path per row, so a row that crosses becomes one
row per piece — a shallow copy carrying its piece under a symbol key, invisible to JSON,
`Object.keys` and `{{field}}`, every field intact — and the accessor is wrapped once (one
wrapper per function, so `projectProps` and deck see a stable reference) to read the piece
first. Memoised per data, accessor and seam; rows that do not cross are the same objects, and
the array itself when none does, so such layers keep their zero-update switch. Picks report the
piece-row, whose fields are the original's; `info.index` counts pieces. Checked (`gpu-parity.spec.ts`): the
Arctic Ocean north of Canada and the middle of Hudson Bay carry no ink on either path, and
Canada is still filled.

## If go — implementation outline (written before the study; superseded by the phases above)

- A `PLANE` projection mode with uniforms for family, ellipsoid, projection parameters,
  Helmert terms and the origin; branches for lng/lat input and for tile-local input
  (undo the Mercator tile transform, then project); the affine sub-mode above the
  measured handover, with Jacobian uniforms computed on the CPU in double.
- A plane viewport reporting the new mode and projecting through proj4js on the CPU
  side, so picking, export and overlays agree with the GPU to the stated tolerance.
- The registry entry gains a GPU-eligibility description (family, datum method, units);
  `plane-layers.ts` skips copies and wrappers for eligible CRSs and is unchanged for the
  rest. Extensions checked one by one: mask (own viewport, must carry the mode), path
  style (size function is neutral outside Mercator), collision and data filter (no
  positions).
- `MVTLayer` allowed under `crs=` for eligible CRSs; a curved-edge clip; then one keyless
  vector basemap for projected maps as an OnlyMap-styled layer set.
- Families in order of demand: Transverse Mercator, Lambert Conformal Conic, Albers,
  Lambert Azimuthal Equal Area. Grid datum shifts stay on the CPU (crs.md §6.1).

## Out of scope

A MapLibre style renderer; WGSL; grid-based datum shifts on the GPU; anything that
changes placement between the two backends.

## Downstream

- **onlymap-remotion** drives stories frame by frame through `seek()`; a live `crs`
  switch inside a story is a new case for its determinism battery.
- **nika-agent** vendors llms.txt and the attribute table; a live `crs` is a skill-level
  change there (the cartograph rule currently says a projected map is authored once).
