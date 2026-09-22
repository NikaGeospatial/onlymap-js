# Hillshade / shaded relief — design (shipped in 0.9.1)

## The tracker situation

There is **no open hillshade issue**. All 45 issues on the public mirror were read
(title, body and comments); the only place hillshade appears anywhere in the tracker
is issue **#13 — COGLayer v2**, which is `CLOSED / COMPLETED`, and which names it in
the *Non-goals* line:

> Raster analysis (hillshade/slope — app territory).

The nearest **open** issue is **#23 — Terrain GPU viewshed + point-to-point
line-of-sight**, which shares this feature's DEM machinery without sharing its
purpose. So the reconciliation below is against those two: a closed decision that
currently says *no*, and an open ticket that owns the same substrate.

---

## Reconciling #13's "no" with the cartographic "yes"

#13 was written from a **raster-analysis** framing: a user brings a DEM COG, and the
library derives a queryable product from it — slope in degrees, aspect classes,
numbers you identify and legend. That is app territory, and it still is.

Cartography wants a different thing that happens to use the same arithmetic:
**shaded relief as rendered texture**. Nothing is queried, nothing is classified,
nothing is reported. It is styling output, in exactly the sense that `classify` and
the raster colormap are styling output while statistics are not. The library already
draws its line there.

| | #13's hillshade (out) | Cartographic hillshade (in) |
|---|---|---|
| Output | numbers per cell (slope°, aspect) | pixels |
| Queried by `identify` | yes | no |
| Needs the user's own DEM | yes | no — a named keyless global source |
| Lives in | an analysis toolbox | the render pipeline |

**Resolution:** the non-goal in #13 stands as written. This feature does not
contradict it, because it ships no analytic product. If slope/aspect *values* are
ever wanted, that is still a separate ticket and still probably app territory.

The one line worth adding to #13's record, if it is ever reopened: the boundary is
**queryability**, not the arithmetic.

## Reconciling with #23 (viewshed / LOS)

#23's implementation plan item 2 is "DEM read-back". That work is **already done** —
it landed for cut/fill volumetrics:

- `src/terrain-sample.ts` — `tilePixel()` slippy-tile math, one-shot elevation query.
- `src/terrain-heightfield.ts` — bulk tile loader with a per-tile timeout, `elevationAt()`.
- `src/volumetrics.ts` — `sampleBilinear()`, seam-correct, pure, worker-shareable.
- `src/terrain.ts` — `DECODERS` (`terrarium`, `mapbox-rgb`), `registerTerrain`, three presets
  including the keyless AWS terrarium default.

Hillshade and #23 therefore **share a substrate and diverge above it**:

| | Hillshade | #23 viewshed |
|---|---|---|
| Sampling | GPU, in the fragment shader, per tile texture | CPU (`terrain-heightfield`) for LOS; depth pass for viewshed |
| Needs `terrain=` active | **no** — works at pitch 0 on a flat sheet | yes, hard requirement |
| deck seam | a layer + a raster module | a `LayersPass` fork in `buildEffects()` |
| Coverage honesty | tile pyramid, same as any raster | must clamp to loaded-tile coverage |

Shared, and worth doing once: **decode correctness** (below), the unexaggerated-height
rule (`terrain-exaggeration` is a display transform; neither feature may read through
it), and the lazy-chunk discipline.

**Nothing here blocks or is blocked by #23.** The only thing hillshade takes off
#23's plate is half of its item 2, and it hardens it.

## Not a mode of `terrain=`

`terrain="…"` means a 3D surface: it replaces the active basemap, changes what the
camera means, and is meaningless at pitch 0. A print sheet wants a flat shaded raster
that composes *underneath the data layers like any other layer*. Same decoders,
different rendering contract — folding them together would make both harder to
explain. Hillshade is a **layer**.

That also buys the cartographic property that matters most: a layer draws inside
deck's own framebuffer, so it lands in `snapshot()` and **under `<om-effect>`** — where
a MapLibre basemap composites beneath the effect pass and stays untreated (the exact
case `validateEffectEl` already warns about). Shaded relief that the print finish
cannot reach would be worth very little.

---

## Two entry points, one shader

1. **`<om-layer type="HillshadeLayer">`** over `{z}/{x}/{y}` RGB-encoded DEM tiles —
   the cartographic path. Keyless and global — no key, no account, no data of the
   author's own — reusing `DECODERS` and the `registerTerrain` presets as sources,
   named through `src` (open question 2).
2. **`shading="hillshade"` on `COGLayer` / `ZarrLayer`** — the author's own DEM, in
   float, composing with the existing `stretch` / `gamma` / `colormap` chain so a
   hypsometric tint under relief is one layer, not two.

> **Corrected after phase 2.** This section originally said both entry points would
> compile to one module inside `src/raster-pipeline.ts`. They do not, and the reason
> is worth recording. That pipeline's modules inject at `DECKGL_FILTER_COLOR`, which
> is **pointwise** — a module there receives `color`, not the means to sample its
> neighbours. Hillshade is the first *neighbourhood* module anyone has wanted in it,
> and a neighbourhood module must own a sampler and a texel size. So the shipped
> module lives in `src/hillshade.ts`, declares its own sampler through `fs:#decl` and
> binds it through `getUniforms` — exactly how upstream's own `CompositeBands` binds
> `band0`–`band3`, and what frees it from any host layer's declaration order.
>
> The GLSL is therefore already host-agnostic, which is what phase 4 needs: the COG
> path supplies a different texture and a different texel-to-metres factor, not
> different arithmetic. What phase 4 still has to solve is **ground scale**, which
> the tile path gets free from Web Mercator and a COG does not.

```html
<!-- cartographic: keyless relief under everything else -->
<om-map center="[7.65, 45.98]" zoom="9" basemap="none" validate>
  <om-layer type="HillshadeLayer" src="terrarium"
            sun-azimuth="315 45 135" sun-elevation="45" z-factor="1.4"
            opacity="0.55"></om-layer>
  <om-layer id="trails" type="GeoJsonLayer" data="./trails.geojson"></om-layer>
  <om-effect preset="vintage"></om-effect>
</om-map>

<!-- the author's own DEM, relief over a hypsometric tint, one layer -->
<om-layer type="COGLayer" src="./dem.tif" colormap="terrain" shading="hillshade"></om-layer>
```

Illumination reuses `scene-lighting.ts`'s convention exactly — **azimuth ° clockwise
from north, elevation ° above the horizon** — so `sun-azimuth` on a hillshade and
`lighting-sun-azimuth` on the map mean the same number. It does **not** auto-inherit
the map's lighting (silent coupling between a 3D scene light and a 2D raster is the
kind of thing that is impossible to debug from markup); see open question 1.

## Multi-directional is a list, not a boolean

`sun-azimuth` takes **one to four azimuths**, and `sun-weight` optionally takes the
matching blend weights (defaulting to equal). One value is a single light; three is
Swiss-style relief. There is no `multi-directional` boolean, and this is a tiering
rule rather than a style preference:

> a preset must be expressible in the tier below it … If a preset ever needed
> something the op tier could not express, the op tier would be the thing to fix.
> — `src/post-process/presets.ts`

A boolean that blends azimuths the author cannot otherwise name would be exactly
the violation that comment exists to prevent: capability reachable only from the
shorthand. The list is the Tier 1 surface; `multi-directional` may return later as
a *named seeding* of it — `sun-azimuth="315 15 75 135"` under a word — the way
`lighting="daylight"` only seeds `lighting-ambient` / `lighting-sun`, and
`preset="vintage"` only seeds an op list that `expandPreset` will hand back. If it
does, it ejects the same way.

For cartography this is also the better surface on its own terms: the whole point
of multi-directional relief is that the azimuths are *chosen* for the terrain —
which is a tuning job, not a toggle.

---

## The five things that will actually bite

1. **Decode precision.** Neither `terrain-sample.ts:45` nor `terrain-heightfield.ts:62`
   passes `{ premultiplyAlpha: "none", colorSpaceConversion: "none" }` to
   `createImageBitmap`, and both then read through a canvas 2D context. For a point
   elevation query a ±1 LSB error is sub-metre noise nobody sees. Hillshade
   **differentiates neighbouring samples**, so the same error becomes visible banding
   across a whole slope. Fix at every site; #23's LOS half inherits the fix. Lossy-
   recompressed DEM tiles are unusable for the same reason and warrant a dev notice.
2. **Tile-edge seams.** A derivative needs a one-pixel halo from the neighbouring
   tile. Without it, every tile boundary draws a dark grid line — the single most
   recognisable way a hand-rolled hillshade looks broken. Either sample a 1px overlap
   or bind neighbour textures; decide in phase 2, test for it explicitly.
3. **Resolution.** The DEM tile zoom must follow the **capture** pixel ratio, or a
   300 dpi plate renders mushy relief at screen resolution. This is the same class of
   bug as the pixel-keyed grain that `<om-effect>` solved with millimetres; bind to
   the existing `withCapturePixelRatio` seam in `runtime-core.ts`.
4. **Latitude.** Web Mercator ground metres per pixel scale with cos(latitude). A
   fixed z-factor makes relief flatten toward the equator and exaggerate toward the
   poles. Scale the horizontal step per tile by cos φ.
5. **One light looks like a web map.** Swiss-style relief blends two to four azimuths.
   Single-light shading is what every slippy map already ships and is precisely the
   look we are trying to get away from. Blended azimuths are a quality feature, not a
   nicety — which is why they are an authorable list and not a boolean (above).

---

## Phases

Each phase is independently green and independently shippable, with its own doc-sync
per the repo checklist.

**Phase 1 — decode correctness (shared with #23). — IMPLEMENTED 2026-09-21.**
`src/dem-decode.ts` is now the single decode path: exact-byte `createImageBitmap`
options into an opaque, fixed-colour-space canvas, with `fetchDemTile` used by both
`terrain-sample.ts` and `terrain-heightfield.ts`, and the RGB→metres arithmetic
shared as `volumetrics.ts`'s `decodeElevationRgb`. A lossy DEM source warns once per
host. Pinned by `src/dem-decode.test.ts`, which asserts the decode OPTIONS rather
than a picture — a unit test cannot prove a browser skipped colour management, only
that every site asked it to.

**Phase 2 — the module and the layer. — IMPLEMENTED 2026-09-21.** The hillshade GPU module in
`raster-pipeline.ts`; `HillshadeLayer` over `{z}/{x}/{y}` RGB DEM tiles resolving
`src` through `getTerrain()` presets (`src="terrarium"`) or a raw URL + `decoder`,
exactly as `parseTerrainAttrs` already does. `src` is **required** — see open
question 2. Single light, greyscale. Registered through `layer-registry`'s `loadClass` seam so the shader chunk is lazy and
core pages are unaffected (CI size check). e2e: renders non-blank, differs from a flat
raster, **no tile-boundary seam**, and a map without a hillshade never fetches the chunk.

**Phase 3 — cartographic quality. — IMPLEMENTED 2026-09-21.** Multi-azimuth `sun-azimuth` / `sun-weight` (2–4
lights blended), `z-factor`, the cos φ correction, and capture-ratio-aware tile zoom.
Verify at capture scale against a 300 dpi plate, and under each `<om-effect>` preset.

**Phase 3b — composition. — IMPLEMENTED 2026-09-21 as `blend="normal|multiply"`.** Multiply alone FAILED acceptance criterion 1 (a multiply layer over an empty sheet multiplies against nothing and draws nothing), so it is a two-valued attribute local to this layer rather than a baked constant. No general `blend=` surface was opened.

**Original note.** Opacity alone greys the fills
above the relief; the cartographic answer is a multiply blend. But **there is no
blend-mode surface in this library today** — nothing in `attribute-resolution.ts` or
`layer-registry.ts` exposes deck's layer `parameters`, so this is not a knob on a new
layer, it is a new authoring concept with no precedent to follow. Two honest options:
bake the multiply into the hillshade module itself (narrow, ships with phase 3, no
general surface promised), or open a real `blend=` attribute for layers in general
(wider, and a design of its own). **Proposed: bake it**, and let a general `blend=`
arrive when a second layer type asks for it. Do not let a general blend surface ride
in on this feature unannounced.

**Phase 4 — the author's own DEM. — IMPLEMENTED 2026-09-22.** `shading="hillshade"` on `COGLayer`/`ZarrLayer`, sharing the GPU module and the apron with the tiled path. Ground scale comes from the geotransform + CRS units and is ANISOTROPIC for a geographic source. Relief runs LAST (after the colormap, not before it: earlier would hand the ramp a shade value and paint the hillshade in viridis). `identify="off"` is overridden while shading is on, and the validator says so.

**Original note.** `shading="hillshade"` on `COGLayer` / `ZarrLayer`,
running the same module on the float band path, ordered after nodata filtering and
before the colormap so hypsometric tint and relief compose. Validation messages for
"shading on a multi-band source" and "shading without a single band selected".

**Phase 5 — surfaces and release. — IMPLEMENTED 2026-09-21** (example page, `docs/hillshade.md`, README section, skill + `llms.txt`, `html-data.ts` regeneration, `dev/build-public.ts` allowlist, architecture entry 148). Remaining: CHANGELOG at the version bump, and the downstream pins. Example page under
`examples/features/styling/`, `docs/hillshade.md`, README feature row, skill +
`llms.txt`, `html-data.ts` regeneration, `dev/build-public.ts` allowlist +
`npm run test:public`, architecture traceability + dated entry, CHANGELOG, then the
downstream pins.

## Acceptance criteria

- [ ] Relief renders from `src="terrarium"` with **zero author-supplied DEM data** and
      no API key, at pitch 0, on a `basemap="none"` sheet.
- [ ] No tile-boundary seam at any zoom, pinned by a browser test that samples across
      a known boundary.
- [ ] A 300 dpi `snapshot({scale})` shows relief detail proportional to the scale, not
      an upscaled screen-resolution image.
- [ ] Shading is visibly affected by `<om-effect>` passes — it is inside deck's frame,
      not beneath it.
- [ ] Three-azimuth shading is distinguishable from single-light in a pixel test, and
      reordering the azimuth list changes the result.
- [ ] **One shader, not one image.** Both entry points run the same GPU module with the
      same uniforms — pinned by a unit test on the module, not a pixel diff between the
      two paths. They will *not* match pixel-for-pixel on the same area and should not
      be asked to: the tile path is integer-encoded height in Web Mercator at a tile
      zoom, the COG path is float bands in the source CRS at the source resolution, so
      pixel ground size, reprojection and nodata all differ before the shader runs.
- [ ] Hillshade chunk is lazy; core/2D pages unaffected (CI size check).
- [ ] No analytic product is exposed — no slope/aspect values, no identify integration.

## Non-goals

- **Slope / aspect as queryable values** — #13's non-goal, unchanged.
- **Viewshed / line-of-sight** — #23, which this neither implements nor blocks.
- **Replacing `terrain=`** — the 3D surface is a different contract and stays as is.
- **Sky-view factor / ambient occlusion relief** — a heavier multi-sample technique;
  revisit only if multi-azimuth shading proves insufficient.
- **A general `blend=` attribute for layers** — phase 3b bakes multiply into this one
  module rather than opening a blend surface the whole layer registry would then owe.
- **Server-side relief tiles** — client-side is the differentiator, as with COG.

## Status

**All six phases implemented; staged for 0.9.1.** What remains is publishing
and the downstream pins (`onlymap-native`, `onlymap-remotion`), which per the
repo checklist must be proved against the candidate before their pins move.

## Open questions (maintainer input)

1. **Does hillshade inherit the map's sun?** Proposed: no. Same vocabulary and
   convention as `lighting-sun-*`, but an independent value, with an explicit opt-in
   (`sun="lighting"`) deferred until someone asks.
2. **Is the keyless terrarium source the default for a bare `<om-layer type="HillshadeLayer">`?**
   Proposed: **no — require `src`**, with `src="terrarium"` as the keyless one-word
   answer. The precedent cuts this way: every keyless default in this library is still
   *named* by the author (`basemap="positron"`, `terrain="terrarium"`). Keyless-first
   means "no key and no account", not "no attribute" — and an element that reaches AWS
   with nothing written on it is a network call the markup does not show. The cost of
   the rule is one word; the benefit is that `src` always says where the heights came
   from, which is also what the legend needs to credit.
3. **Stacking.** Auto-place relief beneath all data layers, or strictly honour
   document order as every other layer does? Proposed: document order — the rule is
   already universal here, and an exception costs more than it saves.
