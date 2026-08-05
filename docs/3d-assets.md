# 3D assets on the map — the GLB pipeline

OnlyMapJS renders 3D models **in geographic context**: buildings, equipment, vehicles — anything you can place at a longitude/latitude. The architecture rule that makes this simple is the same one the library applies to data everywhere:

> **Domain 3D formats stay upstream; the manifest ingests web standards.**
> IFC, CAD, mesh formats → convert on your server to GLB. GLB (binary glTF), 3D Tiles and CityJSON → the manifest renders directly. (2D vector formats — GeoJSON, CSV, Shapefile, KML, GeoArrow — load directly too; see the README's data-formats table.)

## The manifest half (this library)

`ScenegraphLayer` instances a glTF/GLB model at each data row — the model loads and parses automatically (no loader wiring, no three.js, no scene setup):

```html
<om-map center="[-122.399, 37.79]" zoom="15.5" pitch="55" bearing="20" basemap="maplibre">
  <om-layer id="towers" type="ScenegraphLayer"
              scenegraph="./building.glb"
              data="./sites.json"
              get-position="[$lon, $lat]"
              get-orientation="[0, $heading, 90]"
              get-scale="[$width, $height, $depth]"
              lighting="pbr" pickable></om-layer>
  <om-behavior on="hover" layer="towers" action="show-tooltip" template="#site-tooltip"></om-behavior>
</om-map>
```

Everything else composes as usual: picking works on models (the hover tooltip above), so do filters, widgets, behaviors, and the [testing story](testing.md).

Things worth knowing:

- **glTF is Y-up; the map is Z-up.** The roll of `90` in `get-orientation="[pitch, yaw, roll]"` stands a Y-up model upright — the standard idiom. Yaw is your heading field.
- **`get-scale` is in model space** `[x, y, z]` — for an upright Y-up model that's `[width, height, depth]` in meters (if the model is unit-sized).
- **`lighting="pbr"`** shades models by their glTF materials; the default is flat.
- **One model, many instances.** `ScenegraphLayer` draws the *same* GLB at every row. Different models per row means one layer per model — or, at city scale, 3D Tiles (below).
- Runnable example: [`examples/features/terrain-3d/place-a-3d-model.html`](../examples/features/terrain-3d/place-a-3d-model.html) (its `box.glb` is a placeholder — a stand-in for the pipeline below).

## The pipeline half (your server)

A proven Python stack for BIM/CAD sources — convert once, serve the GLB as a static asset:

```python
# IFC (BIM) → GLB, e.g. behind a Flask endpoint or as a batch job
import ifcopenshell, ifcopenshell.geom   # parse IFC, extract geometry
import trimesh                            # mesh cleanup: merge, decimate, reorient
# assemble + write GLB via trimesh.exports or pygltflib
```

- **`ifcopenshell`** parses IFC and — importantly — can extract **geo-referencing** (`IfcMapConversion` / `IfcSite` coordinates), which is how a building lands at its real longitude/latitude instead of floating in local model space. Carry that lon/lat into your `data` rows.
- **`trimesh`** handles mesh processing: merging elements, decimation (web budgets: aim for well under ~1M triangles per model), re-centering the origin at the model's base so `get-position` anchors the ground point.
- **`pygltflib`** (or `trimesh`'s own exporter) writes the GLB.

Keep the conversion out of the browser: IFC parsing is heavy, and GLB is the interoperable boundary — the same asset works in three.js, Blender, or any glTF viewer, so the pipeline isn't coupled to this library.

## At city scale: 3D Tiles

Hundreds of unique buildings or full city models shouldn't ship as one GLB. The OGC **3D Tiles** spec (streamed, LOD-managed) is the format to target — `Tile3DLayer` is bundled and consumes it directly:

```html
<om-layer id="city" type="Tile3DLayer" tileset="https://example.com/tileset.json"></om-layer>
```

For LOD experiments, common loaders.gl tileset options have first-class attributes:

```html
<om-layer id="city" type="Tile3DLayer"
            tileset="https://example.com/tileset.json"
            maximum-screen-space-error="2"
            maximum-memory-usage="256"
            view-distance-scale="0.85"></om-layer>
```

Upstream converters exist for IFC/CityGML → 3D Tiles (e.g. Cesium ion, `py3dtiles`, FME). Same rule: convert upstream, ingest the standard.

## Semantic city models: CityJSON

3D Tiles is the right target for *visual* city models. It is the wrong one for **CityJSON**, because converting flattens the per-building semantics — and semantics are the whole reason municipal programmes publish it: the Netherlands' [3DBAG](https://3dbag.nl) (~10M buildings), Japan's [PLATEAU](https://www.mlit.go.jp/plateau/) (250+ cities), swisstopo, several German states. Rooftop-solar, shadow, zoning and noise studies all read those attributes.

So CityJSON is ingested natively — point `data` at it, no converter, in either of two rendering modes:

```html
<om-map center="[4.3679, 52.0029]" zoom="18" pitch="60" basemap="positron" lighting="daylight">
  <!-- Real per-surface geometry: one row per FACE, each at its own true
       height — a pitched LoD2.2 roof actually looks pitched. NO
       get-fill-color needed: it defaults to a ninja-viewer-style palette
       the decoder derives automatically (see "Default coloring" below). -->
  <om-layer id="roofs" type="SolidPolygonLayer"
              data="./9-284-556.city.json?om-surfaces=1"
              get-polygon="$polygon" full3d
              pickable></om-layer>
  <!-- This mode is unlit, so face edges need a companion PathLayer tracing
       `outline` (see "Visible edges in surfaces mode" below) — SolidPolygonLayer's
       own `wireframe` prop is a no-op here. -->
  <om-layer id="roof-outlines" type="PathLayer"
              data="./9-284-556.city.json?om-surfaces=1"
              get-path="$outline" get-color="[0, 0, 0]" width-min-pixels="1"
              pickable="false"></om-layer>
  <om-widget type="legend" position="bottom-right"></om-widget>
</om-map>
```

```html
<om-map center="[4.3679, 52.0029]" zoom="18" pitch="60" basemap="positron" lighting="daylight">
  <!-- Footprint extrusion: one row per BUILDING, flat-topped at a single
       derived height. Simpler, lit, terrain-aware. -->
  <om-layer id="buildings" type="GeoJsonLayer"
              data="./9-284-556.city.json"
              extruded get-elevation="$roof_height"
              get-fill-color="$b3_dak_type == 'slanted' ? '#d6604d' : '#4393c3'"
              filter-field="roof_height" filter-range="[0, 30]"
              pickable></om-layer>
  <om-widget type="legend" position="bottom-right"></om-widget>
</om-map>
```

Runnable, both modes toggled side by side: [`examples/features/terrain-3d/load-a-cityjson-model.html`](../examples/features/terrain-3d/load-a-cityjson-model.html).

### What you get

CityJSON stores a building as a soup of 3D surfaces — roof planes, walls, ground — each optionally tagged with a semantic type. That soup decodes to one of two shapes, chosen by the `data` URL:

- **Default — one GeoJSON `Polygon` per CityObject.** A 2D ground footprint plus heights measured off the real 3D geometry, rendered through `GeoJsonLayer`'s `extruded` + `get-elevation`: lit, pickable, GPU-filterable and terrain-aware. The tradeoff: extrusion is a flat-topped prism, so no matter how accurate the derived height is, this mode can never draw the actual shape of a pitched or hipped LoD2.2 roof.
- **`?om-surfaces=1` — one flat row per FACE**, for `SolidPolygonLayer` with `get-polygon="$polygon"` and `full3d`. `extruded` stays at its ordinary `false` default — no need to author it — since the height already lives in the geometry, not in an extrusion accessor. `polygon` carries that face's real rings (outer + holes) with the ORIGINAL per-vertex height kept as-is — not flattened to one number — so a sloped roof plane renders sloped and a near-vertical wall renders vertical. `full3d` IS required (deck's default is `false`): without it, earcut works in the flat xy plane, where a vertical polygon's projected area is ~zero and the face silently vanishes. The tradeoff: deck's solid-polygon vertex shader computes lighting only inside its `extruded` branch, so this mode is unavoidably flat-shaded — no shading from surface orientation. Each row also carries `surface_type` (`"RoofSurface"` / `"WallSurface"` / `"GroundSurface"` / undefined) for per-surface styling, `fill_color` (see below), `cityobject_id` to correlate faces back to their building, and the SAME derived metrics below as the footprint mode.

### Default coloring (surfaces mode)

A face needs no authored `get-fill-color` at all to look reasonable: `SolidPolygonLayer`'s curated schema defaults that accessor to a reserved `fill_color` field, and surfaces-mode rows populate it automatically — RoofSurface red, WallSurface white, Building blue, Water light blue, and so on. The palette is verified against the actual default colors [`cityjson-threejs-loader`](https://github.com/cityjson/cityjson-threejs-loader) (the rendering engine behind the [ninja](https://ninja.cityjson.org) reference viewer) ships, not guessed: its `defaults/colors.js` module's `defaultSemanticsColors` (keyed by semantic surface type — `RoofSurface`, `WallSurface`, `Window`, `Door`, …) wins when a face's `surface_type` is one of those; otherwise `defaultObjectColors` (keyed by CityObject type — `Building`, `Bridge`, `Railway`, `WaterBody`, `TINRelief`, …) covers object types with no semantic tagging at all; a neutral gray is the last resort. Author `get-fill-color` yourself to override it — an authored accessor always wins over the default, same as any other layer.

This convention (a `defaultExpr` on the `get-fill-color` `PropDescriptor`, resolved only when the attribute is absent) is format-agnostic, not CityJSON-specific: any data source that populates a row's `fill_color` field gets the same free default on `SolidPolygonLayer`. The plain `color="…"` shorthand overrides it too — anything you actually author beats the default, whichever way you write it.

### Row budget (surfaces mode)

Surfaces mode multiplies the row count by however many faces a building has: the 3DBAG tile in `examples/features/terrain-3d/load-a-cityjson-model.html` decodes to 120 rows as footprints and **3,940 rows** as surfaces — roughly 33×. That lands against the [free tier's](../README.md#free-tier--licensing) 25,000-row cap at around 750 buildings, where the footprint mode would still be nowhere near it. Past the cap the layer renders its first 25,000 rows — an arbitrary subset in source order, with a dismissible on-map notice — rather than going blank, so a slightly-too-big scene still draws. Because faces are emitted per building, the cut lands mid-building. To show a whole scene rather than part of one: pin a lower LoD with `?om-lod=` (1.3 is ~15× instead of ~33×), tile the source, or extrude footprints instead.

Face counts are long-tailed, so the building count you can fit is not predictable from the average: in that same tile the median building is 17 faces but the largest is 963 — one building, 24% of the tile's rows.

### Visible edges in surfaces mode

Surfaces mode is flat-shaded, so adjacent faces at similar heights (e.g. a LoD2.2 hip roof's planes) can be hard to tell apart by color alone. Each row carries an `outline` field — the same face's outer ring, flattened and closed — for exactly this: give a `PathLayer` `get-path="$outline"` and it traces real per-face edges. Always pair one with a surfaces-mode `SolidPolygonLayer`; deck's `wireframe` prop on `SolidPolygonLayer` only builds wireframe geometry when `extruded: true`, so it does nothing in this unextruded mode. Point the `PathLayer` at the same `data` URL (the cache is keyed by URL, so this doesn't cost a second fetch) and mirror the fill layer's `filter-field`/`filter-range` so filtered-out buildings' outlines disappear too.

The semantics still do work in both modes: they decide which surfaces count as roof, so these are real roof measurements rather than bounding-box numbers. Derived names win over a same-named source attribute, so manifests can rely on them.

| Property | Meaning |
|---|---|
| `roof_height` | **Area-weighted mean roof height above ground** — bind `get-elevation` to this in footprint mode |
| `eaves_height` / `ridge_height` | Lowest / highest roof point above ground |
| `ground_height` | Absolute elevation of the lowest point, in the file's vertical datum |
| `roof_area` | True 3D roof area in m² (not the footprint's) |
| `surface_count`, `lod` | Source geometry size, and which LoD was used (e.g. `"2.2"`) |
| `cityobject_id`, `cityobject_type`, `parent_id` | Identity and hierarchy |
| `polygon` *(surfaces mode only)* | This face's rings, `[[lng, lat, elevation], …]` per ring — bind `get-polygon` to this |
| `outline` *(surfaces mode only)* | This face's outer ring only, flattened and closed — bind a `PathLayer`'s `get-path` to this for visible edges (see above) |
| `surface_type` *(surfaces mode only)* | `"RoofSurface"` / `"WallSurface"` / `"GroundSurface"` / undefined, per face |
| `fill_color` *(surfaces mode only)* | Default per-face color (ninja-viewer palette) — `get-fill-color` reads this automatically when unauthored |

`roof_height` is area-weighted because a pitched-roof mesh carries many vertices along its eaves edge — an unweighted median measures ~1–2 m low, which renders as visibly squat buildings.

**Parents and parts:** geometry usually lives on `BuildingPart` children while attributes live on the parent `Building`. Rows are emitted for whatever carries geometry, with the parent's attributes inherited and `parent_id` kept — so `$oorspronkelijkbouwjaar` works on the feature (or face) you clicked.

### LoD, streaming, and coordinate systems

- **LoD** — the highest available is used (better footprints, real roof geometry to measure). Pin one with `data="./tile.city.json?om-lod=1.2"`; different values cache independently.
- **Surfaces mode** — `data="./tile.city.json?om-surfaces=1"` switches to the per-face `SolidPolygonLayer` rows above; combine with a LoD pin as `?om-lod=1.2&om-surfaces=1`. Like `om-lod`, it's a separate cache entry — one manifest can point a `GeoJsonLayer` at the plain URL and a `SolidPolygonLayer` at the `?om-surfaces=1` counterpart of the SAME file.
- **CityJSONSeq** — `.city.jsonl` is one JSON object per line (header, then a feature per line). Buildings appear *as they download*; nothing else changes, and both output modes stream. Recognized: `.city.json`, `.cityjson`, `.city.jsonl`, `.cityjsonl`, `.jsonl`, `.ndjson`, and the `application/city+json` content type. A `.jsonl` whose first line isn't a CityJSON header fails explicitly — claim it with `OmMap.registerFormat()` if it's some other newline-delimited format.
- **Reprojection** to lon/lat is automatic for the national grids these datasets ship in: **28992** and compound **7415** (Netherlands), **2056** (Switzerland), **25832**/**25833** and compound **5555**/**5556** (Germany), **6668**/**6697** and the plane-rectangular zones **6669–6687** (Japan), **31254**/**31255**/**31256** (Austria GK West/Central/East), **3414** (Singapore SVY21), plus 4326/3857. Axis order is handled per system — Japan's grids are northing-first and JGD2011 geographic is latitude-first, and CityJSON stores vertices in the CRS's own order. Any other code fails with an error naming it rather than placing the city silently in the wrong country; reproject upstream with `cjio input.city.json reproject 4326 save output.city.json`.

The decoder and proj4 are a lazy chunk — maps that never load CityJSON pay nothing, and proj4 is skipped entirely for files already in lon/lat.

### Not supported yet

Textures/materials (`appearance`) are ignored regardless of mode. `GeometryInstance` and point/line-only CityObjects produce no rows. CityJSON Extensions pass through as ordinary attributes without interpretation. Surfaces mode does not merge adjacent faces into one lit mesh — a normal-based lighting extension over the per-face geometry (so surfaces mode could be lit too) is a possible follow-on, not implemented.

## Scope boundary, stated honestly

OnlyMapJS is for assets **in geographic context** — models on a map, camera pitching down at the world. It is not a model *inspector*: orbiting freely around a single non-geo-referenced model (the classic three.js/CAD-viewer use case) is a different product with a different camera. If your models have no real-world coordinates and never will, a plain glTF viewer is the right tool; the moment they belong somewhere on Earth, this pipeline is.
