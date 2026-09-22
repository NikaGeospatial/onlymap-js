# Shaded relief — `HillshadeLayer`

> **Available in 0.9.1.** `<om-layer type="HillshadeLayer">` shades a DEM on
> the GPU. It is a layer, so it obeys document order, lands in `snapshot()`,
> and sits under `<om-effect>`.

```html
<om-map center="[7.65, 45.98]" zoom="9" basemap="none">
  <om-layer id="relief" type="HillshadeLayer" src="terrarium"
            sun-azimuth="315" sun-elevation="45"></om-layer>
</om-map>
```

That is the whole minimum: keyless global tiles, no data of your own, and it
works at pitch 0 on a flat sheet.

Runnable: [`examples/features/styling/shade-the-terrain.html`](../examples/features/styling/shade-the-terrain.html).

## Why this is a layer and not `terrain=`

`terrain="terrarium"` means a **3D surface**. It replaces the active basemap,
changes what the camera means, and is meaningless at pitch 0.

Shaded relief is the other thing: a **flat raster** that composes underneath
your data like any other layer. Same DEM decoders, different rendering
contract. Folding them together would make both harder to explain.

Being a layer also buys the property that matters most for print. A layer
draws inside deck's own framebuffer, so relief is captured by `snapshot()` and
**treated by `<om-effect>`**. A MapLibre basemap composites *beneath* deck and
stays untouched by a print finish — relief that behaved that way would be
worth very little on a sheet you intend to print.

## Sources

`src` takes a registered terrain preset or a raw tile template.

| `src` | |
|---|---|
| `terrarium` | AWS Open Data, keyless, global |
| `mapterhorn` | keyless, global |
| `https://…/{z}/{x}/{y}.png` | your own tiles — needs `decoder` |

```html
<om-layer id="relief" type="HillshadeLayer"
          src="https://example.com/dem/{z}/{x}/{y}.png"
          decoder="mapbox-rgb"></om-layer>
```

`decoder` is `terrarium`, `mapbox-rgb`, or `{rScaler, gScaler, bScaler, offset}`
JSON — the same vocabulary `terrain-decoder` uses. A raw template with no
decoder is a validation warning rather than a guess, because reading
Mapbox-encoded heights as terrarium produces smooth, plausible relief that is
wrong by a factor of about 25.

**`src` is required**, even though the default source needs no key. Every
keyless default in this library is still named by the author —
`basemap="positron"`, `terrain="terrarium"` — because keyless means *no key and
no account*, not *no attribute*. An element that reaches a public tile host
with nothing written on it is a network call the markup does not show.

> DEM tiles must be PNG or lossless WebP. Heights live in the RGB bytes, so a
> lossy codec invents terrain; a lossy source logs one warning per host.

## The sun is a list

```html
<om-layer id="relief" type="HillshadeLayer" src="terrarium"
          sun-azimuth="315 45 135" sun-weight="3 1 1"></om-layer>
```

`sun-azimuth` takes **one to four** azimuths, ° clockwise from north. One is
the single light every slippy map already ships. Two to four blended is
Swiss-style relief, which fills the dead black a single light leaves on
away-facing slopes. `sun-weight` gives one weight per azimuth (equal if
omitted); the weights are normalized for you.

There is deliberately **no `multi-directional` boolean**. A shorthand must
never reach capability the tier below it cannot express — the same rule that
makes an `<om-effect>` preset nothing but a saved op list. Multi-directional
relief also wants its azimuths *chosen for the terrain*, which is a tuning
job rather than a toggle.

Azimuth and elevation use `scene-lighting`'s convention exactly, so
`sun-azimuth` here and `lighting-sun-azimuth` on the map mean the same number.
They are **not** coupled: a 3D scene light silently driving a 2D raster is the
kind of thing that is impossible to debug from markup.

## Knobs

| Attribute | Default | |
|---|---|---|
| `src` | *(required)* | preset name or `{z}/{x}/{y}` template |
| `decoder` | `terrarium` | required with a raw template |
| `sun-azimuth` | `315` | 1–4 azimuths, ° clockwise from north |
| `sun-weight` | equal | one weight per azimuth |
| `sun-elevation` | `45` | ° above the horizon, exclusive of 0 and 90 |
| `z-factor` | `1` | vertical exaggeration |
| `blend` | `normal` | or `multiply` |
| `opacity` | `1` | |
| `max-zoom` | the preset's | the provider's real tileset cap |
| `zoom-offset` | `0` | sharper relief than the view asks for |

Every illumination knob is a **uniform**. Moving the sun, deepening the relief
or changing the blend rebuilds no tile and fetches nothing.

## Composing with your data

By default relief draws as its own greyscale image, so it works as the base of
a sheet. Put it first and it sits under everything:

```html
<om-layer id="relief" type="HillshadeLayer" src="terrarium"></om-layer>
<om-layer id="parks" type="GeoJsonLayer" data="./parks.geojson" color="#93c47d"></om-layer>
```

With fills above it, `blend="multiply"` makes relief read **through** them
rather than greying them out — the terrain shows in the parks' own green
instead of flattening it:

```html
<om-layer id="parks" type="GeoJsonLayer" data="./parks.geojson" color="#93c47d"></om-layer>
<om-layer id="relief" type="HillshadeLayer" src="terrarium" blend="multiply" opacity="0.6"></om-layer>
```

`multiply` needs something beneath it: multiplying against an empty sheet
draws nothing, which is why `normal` is the default.

## What it gets right

**No tile seams.** A hillshade is a derivative, so a fragment at a tile edge
needs a neighbour that lives in a different tile. Clamping there instead
collapses the gradient and draws a pale grid over the whole world — the most
recognisable way a hand-rolled hillshade looks broken. Each tile is decoded
with a one-pixel apron taken from its eight neighbours, so there is no edge
case in the shader at all. The neighbours are nearly free, because a
neighbour is almost always a tile the map is drawing anyway.

**Latitude.** Web Mercator's ground metres per pixel fall off with cos φ, so a
fixed step flattens relief toward the equator and exaggerates it toward the
poles. The correction is applied per fragment, not per tile.

**Print resolution.** The DEM tile zoom follows the capture pixel ratio, so a
300 dpi plate renders relief at plate resolution instead of upscaling the
screen image. This is the same class of problem the millimetre knobs solve for
`<om-effect>`.

**Exaggeration is display-only.** `terrain-exaggeration` scales the *rendered*
3D surface; this layer never reads through it, so relief and a measured
elevation always agree about the ground.

## Relief from your own DEM

`shading="hillshade"` on a `COGLayer` or `ZarrLayer` shades the raster you
already have, using the same illumination attributes:

```html
<om-layer id="dem" type="COGLayer" src="./dem.tif"
          shading="hillshade" sun-azimuth="315 45 135" z-factor="1.4"></om-layer>
```

Runnable: [`examples/features/rasters/shade-your-own-dem.html`](../examples/features/rasters/shade-your-own-dem.html).

Pair it with a colormap and you get the thing this entry point exists for — a
**hypsometric tint with relief through it, as one layer rather than two**:

```html
<om-layer id="dem" type="COGLayer" src="./dem.tif"
          colormap="terrain" shading="hillshade"></om-layer>
```

Relief runs last in the styling chain, after the colormap, so it *multiplies*
onto the tint rather than replacing it. Without a colormap there is nothing to
tint, so relief is drawn on its own.

It reads **one band as elevation** — the first selected band. A `bands` triple
is a false-colour composite, where "the elevation band" is not a question with
an answer, and the validator says so.

Ground scale comes from the file's own geotransform and CRS, so it is right
whether your DEM is in UTM metres, state-plane feet or degrees. A geographic
(lng/lat) source is the interesting case: its pixel is **not square on the
ground**, because a degree of longitude shrinks with latitude while a degree of
latitude does not. That correction is applied for you.

> **`identify="off"` does not save memory here.** Relief reads neighbouring
> pixels on the CPU to keep tile edges seamless, so the decode is retained even
> with that flag set. The validator points it out rather than letting the flag
> look like it worked. Drop `shading` if you need the memory back.

## Bundle cost

None, unless you use it. The schema (for validation and IntelliSense) is in
the core bundle; the layer, the tile loader and the GLSL are a separate chunk
fetched only when a map actually has relief — pinned by a browser test.

## Not implemented yet

- **Slope and aspect as queryable values.** Deliberately out of scope: this
  feature ships rendered texture, never an analytic product. The boundary is
  queryability, not the arithmetic.
- **Sky-view factor / ambient occlusion relief**, a heavier multi-sample
  technique worth revisiting only if blended azimuths prove insufficient.
