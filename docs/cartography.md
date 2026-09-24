# Cartography — projections, geometry transforms, vector export

> **Available in 0.10.0.** Four capabilities that only make sense together: a
> map drawn in a **real projection**, **geometry the data doesn't contain**,
> **vector output**, and a frozen sheet that stays editable. Everything here is
> a lazy chunk — a map that uses none of it downloads none of it.

```html
<om-map crs="EPSG:5070" reference-scale="1:6500000" basemap="none"
        center="[-96.8, 38.6]" zoom="3.8">
  <om-layer id="land" type="GeoJsonLayer" data="./countries.geojson">
    <om-transform type="simplify" tolerance="0.18mm"></om-transform>
    <om-transform type="smooth" iterations="2"></om-transform>
  </om-layer>
  <om-layer id="relief" type="HillshadeLayer" src="terrarium"
            sun-datum="sheet"></om-layer>
</om-map>
```

Runnable: [`examples/features/cartography/compose-an-atlas-plate.html`](../examples/features/cartography/compose-an-atlas-plate.html).

---

## The plane view — `crs=`

`crs` puts the whole renderer in a projection's plane. Parallels curve, an
equal-area projection is genuinely equal-area, and a state-plane sheet is drawn
in state plane rather than stretched from Web Mercator.

```html
<om-map crs="EPSG:5070" basemap="none" center="[-98, 39]" zoom="4">
```

Bundled: Web Mercator and plate carrée need nothing. British National Grid,
Swiss LV95, Albers CONUS, Lambert 93, RD New, the UTM zones and a dozen others
resolve through proj4, which loads only when a map asks for one. Anything else
takes `crs-def="+proj=…"`, or registers as a pair of functions:

```js
OmMap.registerCrs("EPSG:2154", "+proj=lcc +lat_0=46.5 …");
OmMap.registerCrs("MY:PROJECTION", { forward, inverse, units: "linear", metresPerUnit: 1 });
```

**The authored camera stays geographic.** `center` is lng/lat and `zoom` means
what it always meant, on a projected map as much as a Mercator one — so stories,
`seek()`, `getCamera()` and every state bridge keep working unchanged. Clicks
report lng/lat too, not plane metres, which matters because the measure tool
feeds those points to geodesic formulas and a projected metre in a geodesic
formula returns a confident wrong answer.

### What a projected map cannot do

Each is a validation error with a fix, never a silent no-op:

| Limit | Why | What to do instead |
|---|---|---|
| No MapLibre basemap | it is a second renderer with its own camera | `basemap="none"` — already required for print finishes and relief |
| No `terrain` | the 3D surface and its tiles are Mercator throughout | drop it, or use Mercator |
| No `pitch` / `bearing` | the projected view is planimetric | a print sheet is planimetric; rotate the frame in the layout |
| No H3 / S2 / geohash / quadkey layers | deck builds their geometry from a token, inside the layer | convert the cells to polygons and use a `GeoJsonLayer` |
| CRS fixed for the map's life | re-ingesting on a switch is a remount | author two maps |

**Relief works.** Both routes: `shading="hillshade"` on a DEM of your own has no
projection tie at all, and the global keyless `HillshadeLayer` re-indexes its
Mercator tiles from the plane's own geography and draws them as subdivided
warped meshes. Sub-pixel at practical subdivisions — measured at 0.40 output
pixels for Albers at z=3, falling as 1/N².

### Which north does the sun mean?

On a projected sheet, geographic north is not sheet-up. Across an Albers CONUS
plate the difference swings **34°** from one edge to the other.

- `sun-datum="sheet"` (the default) keeps the apparent light constant across the
  plate. This is what relief atlases do: light that rotates across a sheet reads
  as a mistake.
- `sun-datum="geographic"` is physically true — that slope really is lit from
  the north-west.

Inert on a Web Mercator map, where the two are the same direction, and the
validator says so rather than letting you wonder.

---

## Geometry transforms — `<om-transform>`

Children of an `<om-layer>`, applied in document order, in the **data stage** —
so deck, `anchor="surface"`, the legend and the vector exporter all see the same
geometry rather than each deriving its own.

```html
<om-layer id="coast" type="GeoJsonLayer" data="./coast.geojson">
  <om-transform type="simplify" tolerance="0.15mm"></om-transform>
  <om-transform type="smooth" iterations="2"></om-transform>
</om-layer>
```

| `type` | What it does |
|---|---|
| `simplify` | Douglas–Peucker at a `tolerance`. No vertex moves further than that. |
| `smooth` | Chaikin corner-cutting, `iterations="1"`–`6`. One pass removes the straight-segment look — the loudest "web map" tell there is. |
| `dot-density` | Scatters points inside polygons: `field="population" per="1000"`. Seeded, so a recorded story and a live map place the same dots. |
| `buffer` | Bands around a shape: `distance="0.9mm" repeat="5" fade`. The engraved shoreline of an old chart. |
| `contour` | Isolines marched off a DEM: `src="terrarium" bounds="[w,s,e,n]" interval="100m"`. |

### Millimetres on paper, and the scale they resolve against

Spatial knobs are **millimetres on the page**, for the same reason `<om-effect>`'s
are: a tolerance in metres silently changes the look between a screen and a
300 dpi plate.

Unlike an effect's knobs — uniforms, re-pointed per frame for nothing — geometry
runs **once at ingest**, so it cannot be re-resolved as the camera moves. A
millimetre therefore needs a scale you *declare*:

```html
<om-map reference-scale="1:50000">   <!-- or reference-scale="50m" -->
```

A cartograph frame supplies its own from its georeference. A map with neither is
a validation error naming the fix — never a tolerance that quietly means whatever
the current zoom happened to be. **Ground units need no scale**: `tolerance="50m"`
means fifty metres at every zoom and says so.

Tolerances are measured on the ground, not in degrees. A degree of longitude is
111 km at the equator and 56 km at 60°N, so simplifying raw degrees would thin a
Norwegian coastline twice as hard as an Ecuadorian one from the same number.

### `buffer` is an ornament, not a measurement

A coastal vignette is judged by eye; a 500 m setback is a number somebody acts
on. **The first is in scope and the second is not** — the same line shaded relief
drew between rendered texture and analytic product.

That decides the method. The shape is rasterised, an exact Euclidean distance
transform runs over it, and each band is a **threshold** of that one field — so
`repeat="5"` costs what one band costs, and the output cannot self-intersect,
because no polygon arithmetic ever happens.

The error is bounded and measured: **half a grid cell**, everywhere, corners
included. At 300 dpi on a 200 mm frame that is 0.042 mm against a 0.088 mm
hairline. Features thinner than a cell vanish at rasterisation, areas are
grid-accurate, and ring nesting is re-derived from the contour.

Asking for it as a setback is an error that names the alternative — compute it in
PostGIS or turf and load the result as data.

```html
<om-transform type="buffer" distance="0.9mm" repeat="5" fade></om-transform>
```

`fade` gives each band a `_bandOpacity` property, outermost faintest, which an
accessor can read: `get-fill-color="[125,155,173, $_bandOpacity * 165]"`. Bands
come out **outermost first**, so they stack correctly under a fill.

### `contour` declares its extent

`contour` is the one transform that *sources* geometry rather than rewriting the
layer's own — its layer legitimately has no data. It is also the one that
fetches, so its extent is declared rather than taken from the camera:

```html
<om-layer id="contours" type="GeoJsonLayer"
          get-line-width="$index ? 1.6 : 0.8" line-width-units="pixels">
  <om-transform type="contour" src="terrarium" zoom="10"
                bounds="[-105.95,39.42,-105.38,39.82]" interval="100m"></om-transform>
</om-layer>
```

Each line carries `elevation`, and `index` is true on every fifth contour — the
cartographer's heavier line. The interval is a ground height, never paper
millimetres, and writing `interval="2mm"` is an error saying so.

Not deck's `ContourLayer`, which contours point *density*.

**Columnar layers are out of scope** and say so: a columnar source is precisely
the case with no line or polygon geometry, so a transform on one is an error
naming the layer rather than a silent no-op.

---

## Labels that follow their line — `TextOnPathLayer`

A river's name runs along the river; a range's along the range. It is the oldest
label convention there is, and deck has no layer for it.

```html
<om-layer id="rivers" type="TextOnPathLayer"
          get-path="$path" get-text="$name" get-size="10"
          get-color="[52,84,112]" font-family="Georgia, serif"
          letter-spacing="1.4" offset="5" placement="middle">
  <script type="application/json">[
    {"name":"Rio Grande","path":[[-106.6,35.1],[-104.7,29.4],[-97.4,25.9]]}
  ]</script>
</om-layer>
```

| Attribute | |
|---|---|
| `get-path`, `get-text` | the line and the words. Either without the other is a validation error — each is silently inert alone |
| `get-size`, `get-color`, `font-family`, `font-weight` | as any text |
| `letter-spacing` | extra tracking in pixels. Letter-spaced names are a convention, not a flourish: an ocean or a range is conventionally tracked across its own extent |
| `offset` | perpendicular pixels; positive sits to the **left** of the line's direction |
| `placement` | `start`, `middle` (default) or `end` along the line |
| `max-labels` | ceiling on emitted glyphs |

**It reads left to right whichever way the line was drawn.** A path's direction
is an accident of how the data was digitised, and a label following a
right-to-left line comes out upside down and mirrored — so the layer flips the
path when it needs to. `start` and `end` flip with it, because they mean a place
on the line rather than a direction.

**A name that does not fit is dropped**, not compressed and not run off the end.
That is what a cartographer would do, and it is the only option that never
leaves a label pointing at nothing.

**Placement happens in screen pixels**, so it is recomputed as the camera moves
— a glyph advance is a length in pixels while a path is a length in the world,
and only the current scale relates them. On a print sheet, where the camera is
fixed, it resolves once and stays put.

**The SVG export beats the screen here.** On the GPU this is one text instance
per glyph, because that is what a text layer can do. SVG has the real primitive,
so `snapshot({format: "svg"})` emits a single `<textPath>` — one editable word
still attached to the river's own path, rather than nine rotated characters.

---

## Vector export — `snapshot({ format: "svg" })`

```js
const svg = await map.snapshot({ format: "svg", onNotice: (n) => console.log(n.message) });
```

Returns the SVG as **text** (`as: "blob"` for a file). The walk is per layer:

| Layer | Emitted as |
|---|---|
| Polygon / path / point layers | `<path>` / `<circle>` with the style the accessors resolve |
| `TextLayer` | real `<text>`, after a CPU decluttering pass |
| Rasters, tiles, 3D, aggregations | a **raster band** as `<image>`, at the right stacking position |

The result is a hybrid — vector linework over placed relief — which is not a
fallback but how cartographic production has always worked.

**It needs `basemap="none"`**, the same requirement `<om-effect>` and `crs`
already carry. A MapLibre basemap is a second renderer whose output is raster
tiles; compositing it into every band would paint it over the vector linework
above it. Imagery that exports correctly is an ordinary deck layer — a
`TileLayer` of raster tiles bands in the right stacking position.

**Consecutive raster layers merge into one band**; a vector layer between two of
them keeps them apart, because stacking order is the one thing an exporter must
not quietly rearrange.

### A print finish rasterises the frame

A post-process pass treats the *finished frame*, so there is no "some layers":
a sheet carrying a finish exports its map as one raster band, and the exporter
says so through `onNotice` rather than letting you discover it at a print shop.

`effectDpi` (default **600**) is the band's own resolution, independent of the
sheet's — it changes the band's pixel dimensions, not its scaling. Almost
everything survives print rasterisation; type does not, and linework only just,
so this is the knob that decides whether a 6 pt label is good.

A decluttering layer does **not** trigger this. The test is whether a real
post-process pass is running, not whether deck has any effects — a label layer
installs one of its own.

### Decluttering, and why the exporter runs its own

`CollisionFilterExtension` decides survivors on the GPU, in a framebuffer sized
from the canvas — so which labels it kept depends on the capture ratio, and the
exporter cannot ask. It runs a deterministic CPU pass by priority instead. Deck's
collision stays the interactive preview; the CPU pass is the print truth.

### Guards

Geometry is clipped to the frame before emission, which also removes the
giant-path problem. Past a feature budget the result carries a notice offering
`simplify`.

---

## Freeze a frame to vector

```js
await document.getElementById("main").freeze({ format: "svg" });
```

The frame becomes `mode="static"`, placed by the same `crs` + `corners` it
already reported, with an inline `<svg>` where the `<img>` used to be. The
georeference model does not change: a frozen frame is a picture plus four
corners, and that was true before vector and stays true after.

A frozen sheet is a **document, not an application** — it opens with no runtime,
no network and nothing defining its custom elements, and the stylesheet alone
lays it out at the authored size. Print needs no swap either: a browser prints
inline vector natively at whatever resolution the printer has.

`freeze({ format: "raster" })` stores the PNG it always did.

It returns `false` and writes nothing when the frame has no georeference to
freeze at — a projected frame still resolving its CRS has corners that are about
to change, and a sheet placed by those would look exactly like one placed right.

---

## Bundle cost

Nothing here is in the eager graph. The projection core loads with the first
`crs`; proj4 only for a CRS with no closed form; the transform primitives with
the first `<om-transform>`; the serializer with the first
`snapshot({format: "svg"})`. A bundle assertion pins the last one: its symbols
must appear in exactly one chunk.

## Not implemented yet

- **Masking relief to land.** Clipping one layer to another's geometry is
  layer-extension work; until then a global DEM shades the sea too.
- **Native-CRS tile pyramids.** Where a provider serves tiles already in the
  target grid, they would be consumed directly with no warp. Deferred until
  asked for.
- **`contour` in a plane view** inherits the DEM's Mercator grid for its
  marching pass. The polylines project exactly, so the lines are right; what is
  Mercator is the sampling.
- **An analytic `buffer`.** A deliberate non-goal — see above.
