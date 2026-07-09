# 3D assets on the map — the GLB pipeline

OnlyMapJS renders 3D models **in geographic context**: buildings, equipment, vehicles — anything you can place at a longitude/latitude. The architecture rule that makes this simple is the same one the library applies to data everywhere:

> **Domain 3D formats stay upstream; the manifest ingests web standards.**
> IFC, CAD, mesh formats → convert on your server to GLB. GLB (binary glTF) and 3D Tiles → the manifest renders directly. (2D vector formats — GeoJSON, CSV, Shapefile, KML, GeoArrow — load directly too; see the README's data-formats table.)

## The manifest half (this library)

`ScenegraphLayer` instances a glTF/GLB model at each data row — the model loads and parses automatically (no loader wiring, no three.js, no scene setup):

```html
<deck-map center="[-122.399, 37.79]" zoom="15.5" pitch="55" bearing="20" basemap="maplibre">
  <deck-layer id="towers" type="ScenegraphLayer"
              scenegraph="./building.glb"
              data="./sites.json"
              get-position="[$lon, $lat]"
              get-orientation="[0, $heading, 90]"
              get-scale="[$width, $height, $depth]"
              lighting="pbr" pickable></deck-layer>
  <deck-behavior on="hover" layer="towers" action="show-tooltip" template="#site-tooltip"></deck-behavior>
</deck-map>
```

Everything else composes as usual: picking works on models (the hover tooltip above), so do filters, widgets, behaviors, and the [testing story](testing.md).

Things worth knowing:

- **glTF is Y-up; the map is Z-up.** The roll of `90` in `get-orientation="[pitch, yaw, roll]"` stands a Y-up model upright — the standard idiom. Yaw is your heading field.
- **`get-scale` is in model space** `[x, y, z]` — for an upright Y-up model that's `[width, height, depth]` in meters (if the model is unit-sized).
- **`lighting="pbr"`** shades models by their glTF materials; the default is flat.
- **One model, many instances.** `ScenegraphLayer` draws the *same* GLB at every row. Different models per row means one layer per model — or, at city scale, 3D Tiles (below).
- Runnable example: [`examples/scenegraph.html`](../examples/scenegraph.html) (its `box.glb` is a placeholder — a stand-in for the pipeline below).

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
<deck-layer id="city" type="Tile3DLayer" data="https://example.com/tileset.json"></deck-layer>
```

Upstream converters exist for IFC/CityGML → 3D Tiles (e.g. Cesium ion, `py3dtiles`, FME). Same rule: convert upstream, ingest the standard.

## Scope boundary, stated honestly

OnlyMapJS is for assets **in geographic context** — models on a map, camera pitching down at the world. It is not a model *inspector*: orbiting freely around a single non-geo-referenced model (the classic three.js/CAD-viewer use case) is a different product with a different camera. If your models have no real-world coordinates and never will, a plain glTF viewer is the right tool; the moment they belong somewhere on Earth, this pipeline is.
