# COGLayer v2 — design (issue #13, targeting 0.7.0)

_Status: IMPLEMENTED (2026-09-02, ships in 0.7.0) — all six phases landed as
designed; the one deviation is recorded inline (the auto-window overview
fallback samples the COARSEST overview, `overviews[overviews.length - 1]`,
because upstream's list is finest-first). Grounded against the 0.6.26 tree and
the actually-bundled
dep versions (`@developmentseed/deck.gl-geotiff` 0.7.0, `deck.gl-raster`
0.7.0, `@developmentseed/geotiff`), not the ticket's 0.3.x-era assumptions.
Written 2026-09-02._

## What the deep-read changed about the ticket

The ticket's implementation plan predates three upstream facts that make the
work smaller and the design better:

1. **`fetchTile` already decodes EVERY band.** `RasterArray` carries all
   samples (band-separate or interleaved); today we throw away everything but
   band 0 / the first three. Band selection is therefore a re-slice of data
   we already hold — not a refetch.
2. **`CompositeBands` exists upstream** (deck.gl-raster 0.7.0): a GPU module
   with four texture slots and an `ivec4 channelMap` uniform, plus
   `buildCompositeBandsProps`. Band → channel routing is a *uniform*.
3. **Paletted rasters already render** in the unstyled path:
   `inferRenderPipeline` reads `colorMap`/`photometric` from `cachedTags` and
   routes through `photometricInterpretationToRGB` (`parseColormap` in
   `@developmentseed/geotiff`). Item 5 shrinks to "don't break it + legend".

Also confirmed: `geotiff.gdalMetadata` is parsed per band at open
(`STATISTICS_MINIMUM/MAXIMUM/MEAN/STDDEV/VALID_PERCENT` — gdal-metadata.js),
and `cachedTags` exposes `bitsPerSample`/`sampleFormat`/`samplesPerPixel` —
so `rescale="auto"` and the bit-depth auto-route are header reads, no pixel
pass. No stretch/gamma module exists upstream; we write one (the module
contract is ~40 lines — `LinearRescale` is the template: `fs` uniform block,
`inject fs:DECKGL_FILTER_COLOR`, `uniformTypes`, `getUniforms`).

## The load-bearing design decision: retained decode + lazy band textures

One decision serves three ticket items at once (bands, identify, auto-route):
**`OmTileData` retains the decoded `RasterArray` CPU-side for the tile's
cache lifetime**, and band textures are created LAZILY from it.

```
getTileData (module-level, stable identity — NEVER changes per ticket item 1)
  └─ fetchTile → RasterArray (all bands, already decoded)
     OmTileData {
       array: RasterArray            ← retained (identify + band switches)
       bandTextures: Map<int, Texture> ← lazy, per selected band
       width/height/byteLength/nodata/colormapTexture
     }

renderTile(data, props)   ← re-runs on every new layer instance (restretch,
  └─ ensureBandTextures(data, bands)   band switch, stretch/gamma edit)
  └─ pipeline: CompositeBands(channelMap ← bands)
               → FilterNoDataVal (raw values, unchanged ordering)
               → LinearRescale
               → StretchGamma (NEW module; identity when linear/γ=1)
               → Colormap | (reversed) — single-band only
```

Consequences, in order of importance:

- **A `bands` change never refetches or re-decodes.** The ticket's central
  constraint ("bands must mint a distinct getTileData identity, deliberately
  invalidating the tile cache") is dissolved, not implemented: the new
  instance's `renderTile` uploads any missing band texture from the retained
  array and updates `channelMap`. The tile cache, the HTTP cache, and the
  decode work all survive. Acceptance criterion 1 gets *stronger*: nothing
  short of a `src` change refetches.
- **Identify is a free rider.** The pick samples the retained array —
  no second fetch, no GPU readback (open Q1 resolved below).
- **VRAM discipline:** textures for bands no longer referenced by the current
  `bands` are destroyed at `ensureBandTextures` time (keep = selected set
  only); `onTileUnload` destroys every entry plus drops the array reference.
  Worst-case steady-state VRAM equals today's (≤4 r32float textures ≈ one
  rgba32float); the new CPU cost is the retained arrays, bounded by deck's
  existing tile cache and released on eviction exactly like textures today.

`extractSingleBand`/`packFirstThreeAsRgba` are subsumed by
`extractBand(arr, i)` (both layouts, Float32 widening preserved). The
single-band path uploads one `r32float` and routes `channelMap = [0,0,0,-1]`
(gray replicate) into Colormap — the current visual result, one pipeline
instead of two texture formats.

## Attribute grammar (per the ticket, with resolved semantics)

| Attribute | Values | Semantics |
|---|---|---|
| `bands` | `"4"` or `"[4,3,2]"` | 1-based (GDAL convention). Single = colormap-eligible; triple = RGB composite. Absent = today's defaults (band 1 / first three). |
| `rescale` | `"auto"` | Window(s) from per-band GDAL stats tags — a composite gets TRUE per-band windows (decision above). Tags absent → sample the coarsest overview (one small read), dev-notice that the window is data-derived. Explicit `min`/`max` always win. |
| `min` / `max` | number or triple | A number broadcasts to every selected band; a triple (`min="[0,0,0]"`) gives per-band windows, positionally matching the `bands` triple. Validation: triple lengths must match a `bands` triple. |
| `stretch` | `linear` (default) \| `log` \| `sqrt` | StretchGamma module, applied to the rescaled [0,1] value. `log` uses `log(1+9x)/log(10)` (bounded, monotone, no −∞ at 0). |
| `gamma` | number > 0 | `pow(x, 1/gamma)` in the same module. Validation error at ≤ 0. |
| `reverse` | bare | Colormap uv-flip prop (the sprite has no reversed rows — flip `u` in the Colormap lookup; small fork of the module if upstream's lacks the prop). |
| `identify` | `"off"` | Opt out of CPU array retention (memory-tight embeds). Default on. |

Bit-depth auto-route (the "my COG is blank" fix): at class init read
`bitsPerSample`/`sampleFormat`; if not uint8 and NO styling attrs are
authored, enter the styled pipeline anyway with `rescale="auto"` semantics
and emit the dev-panel notice verbatim from the ticket. uint8 keeps the
untouched unstyled fast path — including paletted sources
(`colorMap` present → never auto-route; upstream renders the palette).

## Identify (ticket item 4)

`OmCOGLayer.identify(lngLat)` walks the currently-cached tiles for the
best-zoom tile containing the coordinate (tile bounds are known to the
TileLayer), converts to fractional uv, samples ALL bands from the retained
array, and returns `{ values: number[], bands: number[], nodata: boolean }`.
Runtime wiring follows the established schema-flag pattern
(`carriesTileset` precedent): a `carriesRasterIdentify` flag makes
runtime-core enrich the pick path — when a click/hover resolves over a
COG/Zarr layer with no vector object, `selection.raster` carries the
identify result and `{{raster.value}}` / `{{raster.values}}` interpolate in
overlays/tooltips. Float64 sources: values surface as the Float32 the
pipeline holds; the readout notes original dtype (ticket's documented cost).

## Structured errors (ticket item 6)

The #39 work built the exact channel this needs: parse-time entries via
`ParseManifestOptions.report` → `reportRuntimeErrorInternal` →
`om-validation-error`/validate panel. Raster failures are RUNTIME (fetch/
header time, inside the lazy chunk), so raster.ts gets an error classifier
around GeoTIFF open + tile fetch, reported through a runtime-core-injected
callback (the `onTilesetLoad` compose-not-clobber pattern):

- CORS: `TypeError` from fetch with zero response → the ticket's CORS
  message verbatim (fix string included).
- Non-COG: header lacks tile structure/overviews → warning + `rio cogeo`
  fix string. Layer keeps rendering (slow full reads) — warning, not error.
- Band out of range: `bands` vs `samplesPerPixel` at init → error naming the
  source's band count; layer falls back to defaults rather than blanking.

Static validation (validation.ts): `bands` shape, `colormap`+triple warning,
`min ≥ max`, `gamma ≤ 0` — messages verbatim from the ticket.

## Decisions (maintainer-settled 2026-09-02)

- **Auto-route: APPROVED.** Behavior change accepted — confined to unstyled
  non-8-bit sources that render broken today. Known trade acknowledged: the
  stale-stats-tags case moves from obviously-broken to subtly-wrong-with-a-
  notice; the dev-panel notice names the derived window so it stays
  inspectable, and authored `min`/`max` is the standing remedy.
- **Entitlements: EXEMPT.** COG Range traffic joins every other tile stream
  outside `maxFetchBytes`; the gate's rule ("row-data loads, not tile
  streams") gets written into the architecture doc's license section.
- **Identify: retain by default, `identify="off"` opt-out — SAME DEFAULT ON
  MOBILE.** No native-side default flip (web/native parity is the product
  stance); instead the onlymap-native docs/llms guidance RECOMMENDS
  `identify="off"` on raster layers for memory-tight WebViews.
- **`reverse`: fork the Colormap module** (tiny, pinned dep, no upstream
  contact) rather than the sprite-doubling alternative.
- **deck/luma pin: DOES NOT MOVE in 0.7.0.** Decided consciously at the one
  version boundary where it could.
- **Pipeline: UNIFY.** Single-band sources route through CompositeBands too
  (slot-0 gray replicate) — one pipeline, every feature written once. The
  parachute is pre-authorized: phase 1 acceptance pixel-compares the
  existing single-band fixtures against 0.6.26 on Metal-ANGLE, and a
  failure there retreats to the dedicated single-band path without redesign.
- **Per-band rescale windows: PINNED, BUT SHIP IN 0.7.0.** Not a follow-up
  ticket — the same release. `min`/`max` accept a number (broadcast to all
  bands) OR a triple (`min="[0,0,0]" max="[3000,8000,3000]"`, positionally
  matching a `bands` triple); `rescale="auto"` on a composite resolves TRUE
  per-band windows from per-band stats (the min-of-mins merge hack is
  DELETED from the design, not deferred). Mechanism: a PerBandRescale
  module variant (vec4 min/max uniforms) replacing LinearRescale when bands
  is a triple — scalar sources keep the upstream module.

## Open questions — recommendations

1. **Identify cost:** retain by default. The array is already allocated by
   decode; retention converts a GC into a cache-lifetime hold, bounded by the
   existing tile cache and freed on the existing eviction hook. Re-fetch-per-
   pick buys idle memory back at the cost of latency + a second Range-request
   path to maintain. `identify="off"` is the escape hatch (one boolean, drops
   the reference after texture upload).
2. **Entitlements:** exempt, explicitly. Tile streams are self-limiting and
   already exempt for TileLayer/MVTLayer/Tile3DLayer — the fetch gate's rule
   becomes "row-data loads, not tile streams", stated in the license section
   of the architecture doc. Counting COG bytes would gate panning, which no
   tier intends. (Telemetry MAY count bytes later for observability; not
   entitlements.)
3. **Index mode:** out of scope, as the ticket leans — but note the retained-
   decode design lands ALL its plumbing (multi-band textures + CompositeBands
   are exactly what `index="ndvi"` needs; the follow-up becomes one shader
   module + a preset table).

## Phases (each independently green; ~1–1.5 weeks total)

1. **Retained decode + lazy band textures + `bands`.** Rework OmTileData,
   `extractBand`, CompositeBands pipeline, VRAM lifecycle; schema row;
   ir-diff needs NO band special-case (props flow through updateTriggers as
   uniforms). Unit: extraction across both layouts + dtype matrix
   (uint8/uint16/int16/float32 fixtures); harness: snapshotIR mapping.
2. **StretchGamma + PerBandRescale modules + `reverse` + validation
   rules.** Two small forked/authored GPU modules; min/max triple grammar;
   pipeline ordering tests (nodata → per-band rescale → stretch → colormap).
3. **`rescale="auto"` + bit-depth auto-route + dev notice.** Header reads,
   legend feed (`deriveRasterLegendSpec` gets the resolved window),
   coarsest-overview fallback sampler.
4. **Identify + pick wiring.** Layer method, `carriesRasterIdentify`
   enrichment, `selection.raster`, tooltip interpolation, `identify="off"`.
5. **Palette legend + guard.** Paletted sources never auto-route; legend
   class rows when used-entry count ≤ 12 (matches classify legend cap), else
   single swatch.
6. **Errors + doc-sync + e2e.** Classifier + report channel; README, skill
   syntax.md, llms.txt, html-data + attributes.json regen, arch doc,
   `dev/examples` raster page extension + build-public allowlist,
   CHANGELOG at the 0.7.0 bump. e2e: band composite non-blank & differs
   from default; CORS URL → structured error with live canvas; identify
   click returns a plausible DEM value.

Zarr note: phases 1–3 land in `raster-pipeline.ts`/shared shapes where
possible; ZarrLayer inherits stretch/gamma/reverse for free (same
RasterStyle), while `bands`/identify stay COG-only in v2 (Zarr's variable
model differs — its `select` already plays the role).

## Non-goals (unchanged from the ticket)

Server-side tiling, band math/spectral indices (follow-up), NetCDF/HDF5,
raster analysis. No deck.gl/luma bump — 0.7.0 is the version where the pin
COULD move per the deps contract, but nothing here needs it; don't spend the
coordination budget.
