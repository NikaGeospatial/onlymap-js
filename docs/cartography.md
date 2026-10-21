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

### Data in a local grid — `crs` on a layer

`crs` on `<om-map>` chooses the plane the MAP is drawn in. `crs` on an `<om-layer>` says
what the layer's DATA is in, and the data is converted to longitude/latitude when it
loads — so a British National Grid shapefile and an SVY21 CSV can sit on a Mercator map
or on any projected one. A file that names its CRS needs nothing (a shapefile `.prj`, a
FlatGeobuf or GeoParquet header, a legacy GeoJSON `crs` member); a declaration overrides
the file:

```html
<om-map crs="EPSG:27700" basemap="none" center="[-2.5, 53.5]" zoom="5">
  <om-layer id="sites" type="GeoJsonLayer" data="./sites-bng.shp"></om-layer>       <!-- .prj read -->
  <om-layer id="wells" type="ScatterplotLayer" data="./wells.csv" crs="EPSG:27700"
            get-position="[$easting, $northing]" radius-units="pixels" get-radius="5"></om-layer>
</om-map>
```

The bundled table covers every WGS84, ETRS89, NAD83 and GDA UTM zone and the common
national grids; any other EPSG code is fetched once from `https://epsg.io/<code>.proj4`
(`OmMap.configureCrs({ online: false })` turns that off). Coordinates too large to be
degrees with no CRS anywhere are a diagnostic, not a layer in the ocean. Datum shifts are
the standard seven-parameter ones — good to a few metres; correction grids such as OSTN15
are not shipped.

### What a projected map cannot do

Each is a validation error with a fix, never a silent no-op:

| Limit | Why | What to do instead |
|---|---|---|
| No MapLibre basemap — except `positron`, `liberty` and `bright` | it is a second renderer with its own camera | an OpenFreeMap preset (below), or `basemap="none"` plus an image `TileLayer` for a raster basemap |
| No terrain or 3D tile layers (`TerrainLayer`, `Tile3DLayer`), and no `.pbf` `TileLayer` (use `MVTLayer`) | deck indexes their tiles from a Mercator viewport | image tiles, `HillshadeLayer` and `MVTLayer` are taught the plane (below) |
| No `terrain` | the 3D surface and its tiles are Mercator throughout | drop it, or use Mercator |
| No clip box (`clip-box-min`/`clip-box-max`) | its corners are placed with Mercator arithmetic, so on a plane it cuts every layer away | drop it, or use Mercator |
| No `pitch` / `bearing` | the projected view is planimetric | a print sheet is planimetric; rotate the frame in the layout |
| No H3 / S2 / geohash / quadkey layers | deck builds their geometry from a token, inside the layer | convert the cells to polygons and use a `GeoJsonLayer` |

**Most national grids are drawn by the GPU.** Transverse Mercator (British
National Grid, NZTM, SVY21, every UTM zone), Albers (CONUS, Australia), Lambert
Conformal Conic (Lambert-93) and Lambert Azimuthal Equal Area (LAEA Europe) are
projected per vertex in the shader: the layers keep their longitude/latitude,
and placement agrees with proj4js to a quarter of a pixel at any zoom. Other projections — the Swiss
and Dutch oblique grids, for instance — draw on the CPU as before, as do the few
layer types that bin points themselves (`HexagonLayer`, `GridLayer`,
`ContourLayer`, `GreatCircleLayer`).
`OmMap.configureCrs({ gpuProjection: false })` puts every projected map on the
CPU path; set it before maps mount.

**A geographic CRS as the sheet.** `crs="EPSG:4326"` (or any geographic system: NAD83,
ETRS89, a `+proj=longlat` definition) draws as plate carrée — one scale in degrees on both
axes, so a degree of longitude is drawn 1/cos(latitude) times its ground width. That is how a
desktop GIS draws an unprojected layout, and a cartograph copying a QGIS or ArcGIS sheet in
EPSG:4326 needs exactly that (0.0014 mm off the layout's corners at 60°N, where Web Mercator
was 57 mm off). The validator says so as a warning, with the stretch at your `center`; for a
map meant to be read at scale, use a projected CRS.

**Across the seam.** A conic is a cone cut open along the meridian opposite its central
one, and a Transverse Mercator wraps there too. A polygon or line that crosses that meridian
(Russia on a CONUS map) is cut there before drawing, so it never reaches across the sheet;
each piece keeps the feature's properties, so picks and popups are unchanged. The same holds
for a polygon or path read from flat rows (`get-polygon="$polygon"` on a CSV): a row that
crosses becomes one row per piece, each carrying every field of the original.

**Vector tiles on any grid.** `MVTLayer` works on every projected map. Each tile
is cut to its own edge, projected into the plane once and triangulated in a
background worker, then drawn as plain plane coordinates — so panning a
vector-tile layer costs what it does in Web Mercator, and a tile never blocks
the page while it arrives. A live `crs` switch rebuilds the cached tiles for the
new projection without fetching them again.

**A vector basemap.** `basemap="positron"`, `"liberty"` or `"bright"`
on a projected map renders OpenFreeMap's vector tiles — the same
tiles those presets use in Web Mercator — in the plane, in each preset's own
colours: land, water, land cover, parks, buildings, roads, rail and national and
regional boundaries. No labels yet: text on a projected map would need live
decluttering. The map credits OpenFreeMap, OpenMapTiles and OpenStreetMap itself,
as it does for any basemap it picks. Switching `basemap` recolours it in place;
switching `crs` keeps it, and dropping `crs` hands the preset back to MapLibre in
Web Mercator.

**`crs` is live.** Change it on a mounted map — the attribute, the `set-crs` action
(`{ crs: "EPSG:27700" }`, or `{ crs: "mercator" }` for Web Mercator), `MapController.setCrs`,
or React's `crs` prop — and every layer re-projects in place: no refetch, no reparse, no
remount, and the camera stays where it was. A story step can switch the sheet's
projection, and undo restores it. A CRS that cannot resolve is reported and the map
stays as it was. Between two grids the GPU draws (above), a switch re-projects
nothing: no layer is rebuilt, and tiled layers keep the tiles they have — only
polygon fills are triangulated again, in the new plane, so their triangles tile
the shape the shader will draw. Onto any
other projection the layers are re-projected on the CPU — about a quarter of a
second for a million line vertices on a real GPU; in a browser with no GPU, which
emulates the drawing too, about 2 s for 100 000 and 18 s for a million.

**Relief works.** Both routes: `shading="hillshade"` on a DEM of your own has no
projection tie at all, and the global keyless `HillshadeLayer` re-indexes its
Mercator tiles from the plane's own geography and draws them as subdivided
warped meshes. Sub-pixel at practical subdivisions — measured at 0.40 output
pixels for Albers at z=3, falling as 1/N².

**Image tiles work too**, so a raster basemap is a layer. Any `TileLayer` whose
`data` is an image template (`.png`, `.jpg`, `.jpeg`, `.webp`) is re-indexed and
warped the same way, and lands where the sheet's projection puts it — measured
within 0.7 px of `map.project()` on British National Grid and Albers sheets:

```html
<om-map crs="EPSG:27700" basemap="none" center="[-2.5, 54.5]" zoom="5">
  <om-layer id="base" type="TileLayer" tile-size="256" max-zoom="14"
            data="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"></om-layer>
  <om-widget type="attribution" position="bottom-right"
             text="Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 &amp; 2017)"></om-widget>
</om-map>
```

The basemap does not switch for you: `basemap="satellite"` on a projected map is
still an error, and its fix is the preset's own tiles written as this layer.
**The credit is yours to show.** The map credits only the basemaps it picks; tiles
you name in a `TileLayer` are credited by you, as above.

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

## A globe — `projection="globe"` (preview)

```html
<om-map projection="globe" basemap="satellite" center="[-20, 30]" zoom="1.6">
  <om-layer id="cities" type="ScatterplotLayer" data="./cities.json"
            get-position="[$lon, $lat]" get-radius="4" radius-units="pixels"></om-layer>
  <om-overlay anchor="[-0.1278, 51.5074]"><div>London</div></om-overlay>
</om-map>
```

Zoomed out, the Earth is a sphere you can spin. Zoom in and it becomes the
ordinary flat map, with nothing to switch. It is the view for things that span the
planet — flight routes, global datasets, the poles — which Web Mercator stretches
out of shape.

**Nothing else changes.** Layers are written as for a flat map, data stays
longitude/latitude, and `center`/`zoom` mean what they always did.

**It needs a basemap.** MapLibre draws the sphere and deck.gl draws the layers
over it, from MapLibre's camera. Measured: the two agree to within half a pixel at
every zoom, including zoom 10–12, where the globe turns into the flat map.

**It is live.** Set or remove `projection` on a mounted map, or use the
`set-projection` action (`{ projection: "globe" }` / `"mercator"`). Camera and
layers carry over, and a basemap switch keeps the globe.

**What changes for interaction.**
- **Overlays hide on the far side.** An `<om-overlay>` anchored to a point on the
  far side of the planet hides, rather than floating over the near side.
- **A click in space has no coordinate.** Clicking the space around the globe
  reports no coordinate (`om-map-point` carries `null`, `unproject()` returns
  `null`). It never reports the edge of the planet.
- **A globe is flat-on and north-up.** deck.gl's globe camera has no tilt or
  rotation, and a tilted globe put the layers off the basemap. So tilt and rotate
  gestures are off, and the camera levels out when the globe switches on.

### What a globe cannot do yet

Each is a validation error with a fix:

| Limit | Why | What to do instead |
|---|---|---|
| No `basemap="none"` | the deck-only globe is not built yet | any basemap preset |
| No `crs` | a sphere is not a plane | one or the other |
| No `terrain`, no `TerrainLayer` | deck.gl's globe has no terrain surface | a flat 3D map |
| No `pitch` / `bearing` | see above | — |
| No heatmap, hexagon, grid, screen-grid or contour layers | screen-space aggregation has no globe path | pre-aggregate to polygons (H3 cells draw) |
| No `TextLayer`, `IconLayer`, `TextOnPathLayer`, `PopupLayer` | deck.gl's globe culls glyphs and icons | `<om-overlay>` labels, or the basemap's own |
| No `ArcLayer` / `GreatCircleLayer` | arcs do not draw on deck.gl's globe | a `PathLayer` through points along the route |
| Not in a cartograph frame | a frame is a flat, georeferenced sheet | a flat or projected map |

Clustered layers draw their bubbles, but not their counts, which are text; the
validator warns. The measure tool's on-map labels are text too, so they do not
show on a globe. SVG export already refuses any MapLibre basemap, the globe
included. Stories are not yet checked on a globe: `seek()` interpolates a flight
along the flat map's arc, so a recorded flight can differ from the live one.

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
| `pickable` | clickable like any layer: a click or hover reports the **row** the label spells, so a `{{name}}` popup shows that river's fields (0.11.6) |

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
- **The globe without a basemap**, and text, icons and arcs on a globe (see
  "What a globe cannot do yet").
