# Point clustering as a layer toggle — design + implementation plan

> **Status: IMPLEMENTED — released as 0.11.0** (2026-09-30). Postpub still to
> do: downstream pins (nika-agent, onlymap-native, onlymap-remotion via
> `render.yml` first), the nika-docs page, and closing `onlymapjs #5`. Public
> tracking issue: `onlymapjs #5` ("Clustering as a layer toggle (`cluster`
> attributes on point layers), not a new layer type"). Architecture doc:
> dated entries 167–168 and the "Point clustering" section.
>
> Files: `src/cluster-index.ts` (pure engine wrapper), `src/cluster-options.ts`
> (descriptors + extraction), `src/layers/cluster-layer.ts` (the composite),
> `examples/features/layers/cluster-points.html`, `e2e/cluster.spec.ts`.

Goal: a point layer whose points merge into count bubbles where they would
collide on screen, and split back apart as the reader zooms in. One attribute
turns it on; the layer keeps its identity, data, symbology, picking, actions
and export behaviour.

```html
<om-layer id="quakes" type="ScatterplotLayer" data="quakes.csv"
  get-position="[$lon, $lat]" color="#e11" radius="4" radius-units="pixels"
  cluster="true" cluster-radius="50" cluster-max-zoom="14"
  cluster-properties="sum:mag,max:mag"
  get-cluster-radius="scale($sum_mag / $sum_mag_max, sqrt, [12, 40], domain=[0, 1])"
  get-cluster-fill-color="scale($max_mag, sequential, ['#fc0', '#c00'], domain=[3, 7])"></om-layer>
```

(`scale()` is `scale(value, type, range, domain=[…])` — the type unquoted, the
domain a named last argument; the expression compiler refuses anything else.)

Versions are assigned at release, not here. New syntax → a minor (pre-1.0).

---

## Decisions (settled; reopen only with a reason)

| # | Decision | Why |
|---|---|---|
| D1 | **Toggle, not a public `ClusterLayer` type.** `cluster="true"` on `ScatterplotLayer`, `GeoJsonLayer`, `IconLayer`. The internal deck class IS a `ClusterLayer` (`CompositeLayer`), swapped in by the reconciler. | Every library with a source/layer abstraction (MapLibre, OpenLayers, ArcGIS) chose the toggle; only marker-object libraries (Leaflet, Google) and menu UIs (kepler) ship a type. For an LLM author it is a one-attribute diff — a type switch means every point attribute has a second home and a rewrite that can drop attributes. (`onlymapjs #5`, survey table.) |
| D2 | **Engine: `supercluster` 8.x** (ESM, ~5 KB). Its only dependency, `kdbush`, is already in our tree via `maplibre-gl` and `@maplibre/geojson-vt`. | The deck.gl website example, MapLibre's GeoJSON source and Google's markerclusterer all run on it. Proven to 6M points. Writing our own buys nothing. |
| D3 | **Attribute names follow MapLibre's source options**: `cluster`, `cluster-radius` (50 px), `cluster-max-zoom` (16), `cluster-min-points` (2), `cluster-properties`. | The names a translated manifest already carries; the names a model has seen most. |
| D4 | **Cluster symbology is its own accessor family** (`get-cluster-radius`, `get-cluster-fill-color`, `get-cluster-line-color`, `get-cluster-label`) and the host layer's own `get-*` keep applying to UNclustered points, untouched. | ArcGIS nests a separate renderer inside `featureReduction` for the same reason: a bubble sized by count is not a point styled by attribute. |
| D5 | **Click on a cluster expands it by default** (`cluster-click="expand"`, opt out with `"none"`). | Google does it by default; MapLibre makes you wire `getClusterExpansionZoom` yourself and weaker models forget. Our own `fly-to` action does the camera. |
| D6 | **Leaf rendering v1 = visible-leaf subset per settled view.** Measure at 50K before anything cleverer. | Simple and correct. The known upgrade — a per-row `leafZoom` attribute driving `DataFilterExtension` so leaves never re-upload — must compose with the author's own `filter-*` dimensions (`filterSize` ≤ 4, `src/attribute-resolution.ts:400–570`), so it is not free. Do it only if the acceptance number is missed. |
| D7 | **Point-only in v1.** `cluster="true"` on a `GeoJsonLayer` whose features are not all Points/MultiPoints is a structured validation ERROR with a fix hint. Centroid clustering of lines/polygons (`cluster-geometry="centroid"`, ArcGIS-style) is a later opt-in. | Every engine surveyed is point-only; the two that accept other geometry reduce to centroids first. |
| D8 | **"Collide" = supercluster's radius test**, which is a screen-space overlap test for equal-size symbols. | True box collision for variable-size icons is what `CollisionFilterExtension` does — and it HIDES colliders rather than merging them (`docs/design/extensions.md`). Setting `cluster-radius` to the largest icon's radius covers the practical cases. |

---

## Verified facts the plan leans on

Checked against the working tree on 2026-09-30, not from memory.

1. **Curated schemas and registry flags.** `registerLayer({type, deckClass, props})` in
   `src/layer-registry.ts:223` (ScatterplotLayer), `:244` (GeoJsonLayer). Per-type
   capability flags live ON the schema — `carriesTileset`, `carriesRoute`,
   `warpsInPlane` (`:84–127`) — and runtime-core reads the flag rather than matching a
   type name (`routeHook`, `src/runtime-core.ts:1984`). Clustering gets the same
   treatment: a `clusters?: boolean` flag, never a name check.
2. **Instantiation site.** `new schema.deckClass({id, data, updateTriggers, ...props, ...hooks})`
   at `src/runtime-core.ts:2199`. This is the ONE place the class swap happens.
3. **Composite precedent.** `src/layers/tracking-layer.ts` — a `CompositeLayer` that
   receives `data` and the author's compiled `getPosition` accessor
   (`getPosition(row, {index, data})`) and renders sublayers via `getSubLayerProps`.
   `RouteLayer` and `PopupLayer` are the other two.
4. **Data shapes.** `LayerIR.shape` (`src/ir.ts:104`) is `"geojson" | flat rows |
   "columnar"`; `$field` compiles to `d.properties.field` for geojson and `d.field`
   otherwise (`src/expr/compile.ts:252–255`); columnar picks carry no object and the
   runtime materializes one from the columns (`src/selection.ts:11–17`).
5. **Universal attributes** (`filter-*`, `dash`, `classify-*`, `visible-zoom-range`) are
   resolved in `src/attribute-resolution.ts` outside `schema.props` and excluded from
   the unknown-attribute check by name sets (`FILTER_ATTRS :103`, `CLASSIFY_ATTRS :120`).
   `cluster-*` is NOT universal (three types), so it belongs in the schemas, not a
   name set — but the reconciler still has to strip it before deck sees it.
6. **Picks.** `pickCallbacks` (`src/runtime-core.ts:1092`) → `toSelection(info, …)` →
   `Selection {layerId, object, index, coordinate}` → `onSelectionChange` feeds
   `ctx.selection`, `<om-overlay>`, `<om-behavior>`. A cluster pick is just a pick
   whose `object` is the cluster row.
7. **Actions.** `registerAction("fly-to", …)` `src/actions.ts:1023`, `zoom-to-feature`
   `:1045`. `<om-behavior on="click" layer="…" action="…">` dispatches them.
8. **Validation.** `ValidationEntry {severity, element, attribute?, message, fix}`
   (`src/validation.ts:39`); every entry is an instruction, not a diagnosis.
9. **React.** `DESCRIPTOR_PROP_MAP` (`src/react/om-layer.ts:67`) is the ONE table of
   adapter-level props; everything else passes through as a deck prop. New
   adapter-level props go in that table and nowhere else.
10. **Row cap.** `maxRowsPerLayer` (`src/license.ts:61`) gates on the fetched rows —
    clustering changes nothing there; raw rows are what is counted.
11. **Determinism / export.** `transitions` are stripped in deterministic mode at build
    (`src/runtime-core.ts:2237`); the vector serializer walks rendered sublayers.
    Bubbles and count labels are ordinary `ScatterplotLayer`/`TextLayer` sublayers, so
    a cartograph frame captures whatever the frame's zoom clusters to, with no new
    serializer work.
12. **Prior art details worth copying.** deck.gl's website `IconClusterLayer`: rebuild
    the index only when data or scale changes; re-query only when `floor(zoom)`
    changes; `getLeaves(id, 25)` on click. Its weak spots we fix: it queries
    `[-180,-85,180,85]` (we query the padded viewport), it has no expansion zoom and
    no count label. Google's `SuperClusterViewportAlgorithm` shows the escape hatch
    for very large sets (cluster only what is on screen; clusters shift on pan) — a
    later `cluster-scope="viewport"` if anyone brings a million points.

---

## Architecture

```
<om-layer type="ScatterplotLayer" cluster="true" …>
        │ parse-manifest / descriptorToIR
        ▼
LayerIR { type:"ScatterplotLayer", props:{getPosition, getFillColor, …},
          cluster:{radius, maxZoom, minPoints, properties, click,
                   getClusterRadius, getClusterFillColor, …} }
        │ runtime-core buildLayers (:2199)
        ▼  schema.clusters && ir.cluster  →  class swap
new ClusterLayer({ id, data, updateTriggers, hostClass: ScatterplotLayer,
                   hostProps: {…the resolved host props…}, ...ir.cluster })
        │ renderLayers()
        ├─ hostClass  "leaves"    data = rows visible as single points, hostProps verbatim
        ├─ Scatterplot "bubbles"  data = cluster rows, get-cluster-* accessors
        └─ TextLayer   "counts"   data = cluster rows, getText = getClusterLabel
```

### `ClusterLayer` (`src/layers/cluster-layer.ts`)

State: `index: Supercluster | null`, `z: number`, `bbox`, `clusters`, `leaves`.

- `updateState({props, oldProps, changeFlags})`
  - Rebuild the index when `changeFlags.dataChanged`, or `getPosition`'s update
    trigger, or `radius` / `maxZoom` / `minPoints` / `properties` changed. Build:
    walk rows once through the compiled `getPosition`, produce
    `{type:"Feature", geometry:{type:"Point", coordinates}, properties:{i}}` where `i`
    is the row index (so leaves map back to the ORIGINAL row objects and the host's
    accessors and `$field` keep working). Rows whose position is not finite are
    skipped and counted (surfaces as a dev-panel warning, never a throw).
  - Re-query when the index changed, `floor(viewport.zoom)` changed, or the viewport
    bbox moved outside the last padded query bbox: `index.getClusters(paddedBbox,
    floor(zoom))`, split into `clusters` (features with `properties.cluster`) and
    `leaves` (row indices → original rows).
  - `shouldUpdateState` returns true on `viewportChanged` (the composite default only
    reacts to prop/data changes).
- `renderLayers()` — the three sublayers above. Cluster rows are re-shaped to the host
  data shape so the SAME expression compiler serves both families with no special
  case: geojson → a Feature with `properties: {cluster:true, count, …aggregates}`;
  flat → the row object; **columnar → a `ColumnarData` of the cluster fields**
  (`toHostShape`). The last is what lets a DOM-lane columnar accessor — compiled to
  read `data.columns.<field>[index]` — style a bubble unchanged. Leaves on a columnar
  host are sliced per column (`sliceRows`) for the same reason.
- `count_abbreviated` is always a STRING (`"12"`, `"1.2k"`): supercluster returns a
  number below 1k, and a TextLayer drops non-strings — every bubble under a thousand
  rendered without a count until this was pinned.
- `getPickingInfo({info, sourceLayer})` — a pick on the bubbles or counts sublayer
  returns the cluster row as `info.object` with `info.index` = its position in
  `clusters`; leaf picks pass through with the ORIGINAL row index (the host's index
  space, so `highlighted-id`, `zoom-to-feature`'s `featureId`, and columnar
  materialization keep working).
- `expansionZoom(clusterId)` and `leaves(clusterId, limit, offset)` — thin wrappers,
  used by the action and the programmatic API.

### Aggregation (`cluster-properties`)

`"sum:mag,max:mag,mean:depth,mode:type"` → supercluster `map`/`reduce`, one pass at
index build. Result names are `${op}_${field}` (`sum_mag`, `max_mag`, `mean_depth`,
`mode_type`), plus `count` and `count_abbreviated` always. Ops: `sum`, `min`, `max`,
`mean` (carried as sum+count, divided at read), `mode` (the dominant category — the
only sane way to "aggregate a colour": colour a cluster by its majority class, never
by averaging RGB; the host's own `get-fill-color` deliberately never runs on
clusters). An unknown op or a field absent from every row is a validation warning,
not an error (the map still renders). Reads go through `readNamedField`
(`src/feature-access.ts:13`) so `properties.` vs flat rows is handled once.

### Images on bubbles (0.11.1)

The user's ask: "a thumbnail of the first image in a collection from an aggregate,
cropped to a bubble". Three pieces:

- **`first:` aggregate** — the earliest member's value IN DATA ORDER, any type.
  Carried as `{v, i}` so a merge keeps the lower row index whatever order
  supercluster folds neighbours in; deterministic for the same data. A missing
  value on the earliest member yields the next one's.
- **`get-cluster-icon`** — an expression over the cluster fields. A URL becomes a
  circular thumbnail; a name becomes a glyph from `cluster-icon-atlas` /
  `cluster-icon-mapping` (or an IconLayer host's own atlas); an `{url, width,
  height}` object goes to deck as is. Thumbnails and atlas glyphs cannot share one
  IconLayer (auto-packing vs. atlas mode), so the composite draws a `-thumbs` and a
  `-glyphs` sublayer beside the `-bubbles` circles, which keep every bubble without
  an image. Picks on any of them resolve to the cluster (`circleClusterIndex` maps
  the circle subset back; icon rows carry their cluster index).
- **The crop** — `src/cluster-thumbs.ts`: deck's IconLayer draws rectangles and cannot
  clip, so the image is drawn once, cover-fit, into a 128 px canvas with a circular
  clip and a ring in the bubble's fill colour, and the data URL is handed to deck as
  an auto-packed icon. Cache key = (url, ring colour); a pending image leaves its
  bubble a circle and the layer asks deck for another `renderLayers` pass when it
  lands (`setNeedsUpdate` + `setNeedsRedraw`, with `thumbsVersion` as the icon
  sublayer's update trigger); a failed image (404, or a cross-origin image without
  CORS headers, which a canvas cannot read) is remembered so it is never retried.
  Loader and canvas are injectable, so the cache is unit-tested without a DOM.
- **Count labels** get an SDF outline so they stay legible over a light photo.
- **The count as a badge (0.11.2)** — `cluster-label-position` (centre / edge / corner: a
  `getPixelOffset` of ¾ of the bubble's radius, per cluster), `cluster-label-background`
  (TextLayer `background` + `backgroundBorderRadius` pill; the halo is dropped when a
  pill is set), `cluster-label-color`, `cluster-label-size`. `cluster-label="false"`
  still hides it.

Constraint to document everywhere: images need CORS — same-origin or
`Access-Control-Allow-Origin`. The rectangular icon has the same requirement (a
WebGL texture upload from a tainted image also fails), so cropping adds nothing new.

### Rescaling with zoom — per-zoom normalisation fields

A literal domain (`scale($count, [2, 1000], …)`) is right at z3, where clusters hold
thousands, and wrong at z11, where they hold five: every bubble collapses to the
minimum radius. `scale()` domains are compile-time literals (`src/expr/scale.ts:1–5`),
so the fix is not in the compiler. Instead the composite stamps normalisation fields
on every cluster row, and expressions divide by them:

| Field | Meaning |
|---|---|
| `zoom` | the integer zoom this cluster set was queried at |
| `count_max` | the largest cluster count ANYWHERE in the dataset at this zoom |
| `count_total` | total points in the dataset |
| `<agg>_max` / `<agg>_min` | the same per aggregate (`sum_mag_max`, `mean_depth_min`, …) |

`*_max`/`*_min` are computed once per integer zoom from a world-bbox query (at most
`maxZoom+1` of them, cached per z, milliseconds each). They are per-zoom-and-dataset,
NOT per-viewport, so a bubble's size is a function of `(count, zoom)` only — stable
under pan, adaptive under zoom. Viewport-relative normalisation would resize bubbles
as the reader scrolls and is rejected for that reason.

This makes the defaults self-normalising:

```
get-cluster-radius      scale($count / $count_max, sqrt, [12, 36], domain=[0, 1])
get-cluster-fill-color  host `color`, else '#3b82f6'   (flat by default; opt in below)
```

The biggest cluster at any zoom is 36 px and the rest scale by √share (area ∝ count).
Authors override with any expression over the same fields:

```html
get-cluster-radius="scale($sum_mag / $sum_mag_max, sqrt, [10, 40], domain=[0, 1])"
get-cluster-fill-color="scale($mean_depth, sequential, ['#fc0', '#60a'], domain=[0, 300])"
```

`$zoom` is there for hand-tuned formulas. Leaf points are untouched by all of this:
the host's `get-radius` (metres or pixels, as authored) applies to them as before.

### Public surface (schemas)

Added to the three curated schemas, `kind: "scalar"` / `"accessor"` with
`deckProp` set to the ClusterLayer prop name (they never reach the host class; the
reconciler routes them into `ir.cluster`):

| Attribute | Kind | Default | Notes |
|---|---|---|---|
| `cluster` | boolean | false | the toggle |
| `cluster-radius` | number (px) | 50 | MapLibre default |
| `cluster-max-zoom` | number | 16 | clusters exist up to and including this zoom |
| `cluster-min-points` | number | 2 | |
| `cluster-properties` | string | — | `op:field` list; ops `sum` `min` `max` `mean` `mode` |
| `cluster-click` | `expand` \| `none` | expand | D5 |
| `cluster-label` | boolean | true | count text on bubbles |
| `get-cluster-radius` | accessor | `scale($count / $count_max, sqrt, [12, 36], domain=[0, 1])` (px) | `defaultExpr`; self-normalising per zoom, see below |
| `get-cluster-fill-color` | accessor | the host's `color` shorthand, else `#3b82f6` | |
| `get-cluster-line-color` | accessor | `#fff` | |
| `get-cluster-label` | accessor | `$count_abbreviated` | `1.2k` style |

React: `cluster`, `clusterRadius`, `clusterMaxZoom`, `clusterMinPoints`,
`clusterProperties`, `clusterClick`, `clusterLabel` added to `DESCRIPTOR_PROP_MAP`;
`getCluster*` accessors pass through as ordinary props.

### Interaction

- `expand-cluster` action (`src/actions.ts`): payload `{layer, clusterId}` or a
  `Selection`; resolves `expansionZoom` and dispatches `fly-to` with the cluster's
  coordinate. Registered like `zoom-to-feature`.
- Default wiring: when `cluster-click="expand"`, a click selection whose object is a
  cluster dispatches `expand-cluster` from the same place `onSelectionChange` runs —
  no `<om-behavior>` needed. An authored `<om-behavior on="click" layer=…>` still
  fires too (it may open a popup with the aggregates).
- `<om-overlay>` templates see `{{cluster}}`, `{{count}}`, `{{sum_mag}}` etc. on a
  cluster pick, and the ordinary row on a leaf pick.
- Programmatic: `map.clusterLeaves(layerId, clusterId, limit?)` → original rows;
  `ctx.selection.object.cluster === true` to branch in widget scripts.

### Validation (`src/validation.ts`)

- `cluster="true"` on a type without the `clusters` flag → error, fix: "clustering is
  supported on ScatterplotLayer, GeoJsonLayer and IconLayer".
- `cluster-*` attributes without `cluster="true"` → warning ("these do nothing until
  `cluster=\"true\"`", the inert-attribute lesson at `attribute-resolution.ts:60`).
- GeoJsonLayer with non-point features → error, fix: "cluster only Point/MultiPoint
  data; split lines and polygons into their own layer" (D7). Checked where the data is
  in hand (parse-manifest / descriptorToIR), like `classify-*`.
- `cluster-radius` ≤ 0 or non-numeric, `cluster-max-zoom` outside 0–24,
  `cluster-min-points` < 2 → warnings with the accepted range.
- `cluster-properties` entries that don't parse as `op:field` or use an unknown op →
  warning listing the ops.
- `cluster-click` not `expand|none` → warning.

---

## Implementation plan — step by step

Each step ends green (`npx vitest run <file>` for the step's tests; the full suite at
the end of each phase). Never background vitest; run foreground, redirect to a file.
Phase 1 is shippable on its own; 2 and 3 are additive.

### Phase 1 — the layer clusters (core)

1. **Dependency.** `npm i supercluster@8` (+ `@types/supercluster` if 8.x lacks
   bundled types). Verify the standalone bundle grows by ≤ 10 KB
   (`npm run build`, compare `dist/onlymap.standalone.js` size against main's
   8,530,275 bytes). Verify `kdbush` deduplicates (one copy in
   `node_modules/.package-lock.json`).
2. **`src/layers/cluster-layer.ts`** — the CompositeLayer per the architecture above,
   with the index build, the viewport query, the three sublayers, `getPickingInfo`,
   `expansionZoom`, `leaves`. Keep it deck-only: no DOM, no runtime-core import.
   - Test `src/layers/cluster-layer.test.ts`: index built once for unchanged data
     across ten viewport updates (spy on `Supercluster.load`); clusters split as
     zoom rises; `minPoints` respected; leaf pick returns the original row and its
     original index; cluster pick returns `{cluster:true, count}`; aggregates
     `sum_*`/`max_*` correct on a hand-built 12-point fixture; rows with a
     non-finite position are skipped and counted; geojson-shaped and flat-shaped
     cluster rows both expose `count` to a compiled `$count` accessor; `mean_*` and
     `mode_*` correct on the fixture; `count_max`/`sum_mag_max` equal the true
     per-zoom maxima at z2 and z8 and are identical for two different viewports at
     the same zoom (pan-stable); the default radius expression yields 36 px for the
     largest cluster at every zoom.
3. **Registry.** `clusters: true` on ScatterplotLayer, GeoJsonLayer, IconLayer
   schemas + the attribute rows from the table above. `LayerSchema.clusters?:
   boolean` documented next to `carriesRoute`.
   - Test `src/layer-registry.test.ts`: the three types resolve every `cluster-*`
     attribute; a fourth type (e.g. `PathLayer`) reports `cluster` as unknown.
4. **IR + resolution.** `LayerIR.cluster?: ClusterOptions` (`src/ir.ts`). In
   `attribute-resolution.ts`, route the `cluster-*` props out of the deck prop bag
   into `ir.cluster` (accessors compiled through the SAME `accessorCache` path so
   they get update triggers; cluster accessors compile with the flat shape when the
   host is columnar). Both front-ends: parse-manifest (HTML) and `descriptorToIR`
   (programmatic/React) — one shared function, called from both.
   - Test `src/attribute-resolution.test.ts`: `cluster="true"` yields `ir.cluster`
     with defaults; no `cluster*` key leaks into `ir.props`; `get-cluster-radius`
     compiles and carries an update trigger; the React descriptor path produces an
     identical IR (the parity precedent in `react-adapter.test.tsx`).
5. **Class swap** at `runtime-core.ts:2199`: when `schema.clusters && ir.cluster`,
   instantiate `ClusterLayer` with `hostClass: schema.deckClass`, `hostProps:
   planeProps`, and `...ir.cluster`. Everything else in that spread (`placementProps`,
   zoom gate, band isolation, deterministic `transitions: undefined`) applies to the
   composite unchanged. On a projected (plane) map, cluster in the plane's
   coordinates: the composite receives already-projected `getPosition` output
   (`projectLayer`, `:2189`) and supercluster only needs a consistent 2-D space —
   confirm by test that a plane map clusters without NaN.
   - Test `src/runtime-core.test.ts`: a clustered IR builds a `ClusterLayer` whose
     `hostClass` is the schema class; the same IR without `cluster` builds the host
     class directly; toggling `cluster` at runtime swaps without changing the deck
     layer `id` (selection and `highlighted-id` survive).
6. **Validation** entries listed above, in `src/validation.ts` + the data-in-hand
   geometry check where `classify-*` runs.
   - Test `src/validation.test.ts`: one case per entry, asserting `fix` text.
7. **Phase gate.** `npm run test` (full suite, foreground, to a file), `npm run
   build`, `npm run test:public`. `e2e/cluster.spec.ts` drives
   `examples/features/layers/cluster-points.html` (21,337 power plants):
   bubbles + labels at z2, more leaves and fewer bubbles over Europe at z6, no
   console errors.
   **Measured (D6), 2026-09-30, headless Chromium, software GL:** thirty
   pan+zoom steps at z5–5.6 over the 21K rows, each timed across two animation
   frames (basemap tiles included): p50 **40 ms**, p95 46 ms — about 7 ms above
   the two-frame floor. The visible-subset path stands; the `leafZoom` filter
   stays deferred.
   **Plane maps (projected sheets)** render the layer unclustered with one
   console warning per layer: the index clusters in lng/lat and the plane draws
   in metres. Deferred, not designed around.

### Phase 2 — interaction and reach

8. **`expand-cluster` action** in `src/actions.ts` + the default `cluster-click`
   wiring in the selection path. Test: a click selection on a cluster dispatches
   `fly-to` with the expansion zoom; `cluster-click="none"` dispatches nothing;
   an authored `<om-behavior>` on the same layer still fires.
9. **Picks through the front-ends.** `<om-overlay>` template interpolation over a
   cluster pick (`{{count}}`, `{{sum_mag}}`); React `onClick(selection)` receives
   the cluster object; `map.clusterLeaves()` on `programmatic.ts` and the React
   controller. Tests in `template-interpolation.test.ts`, `react-adapter.test.tsx`,
   `programmatic.test.ts`.
10. **Legend / layer switcher.** `legend-spec.ts`: a clustered layer's legend shows
    the host symbology plus one "n points" bubble row so the legend explains the
    bubbles. Test in `legend-spec.test.ts`.
11. **Cartograph + determinism.** A frame at a fixed zoom captures a stable cluster
    set (index is deterministic; query is a pure function of bbox+zoom). Test: two
    `snapshot()` runs at the same view produce identical cluster rows; the vector
    serializer emits bubbles as circles and counts as text (`serialize/*.test.ts`).
12. **Phase gate** as in 7, plus the e2e page (`npm run test:e2e` if the suite has a
    layers page to extend).

### Phase 3 — doc-sync (per CLAUDE.md; same commit as the release)

13. `README.md` — clustering section under layers; the "Not implemented yet" line
    gains "centroid clustering of lines/polygons" and "viewport-scoped clustering".
14. `skills/onlymapjs/SKILL.md` (decision row: "many overlapping points → `cluster`")
    + `references/syntax.md` (attribute table + one example) + `references/react.md`;
    frontmatter `description` gains "clustering". `llms.txt` — the same facts, once.
15. `src/html-data.ts` + `npm run gen:html-data` — the eleven attributes on the three
    elements with descriptions; `html-data.test.ts` parity passes.
16. `agent-map-library-architecture.md` — traceability row ("Point clustering
    (`cluster` toggle)" → implemented), a design section pointing at this file, and
    the dated changelog entry.
17. Examples: `examples/features/layers/cluster-points.html` (HTML) and the React
    twin; entries in `dev/example-config.json` (`version` = the release that ships
    it — never a pin for an unpublished version, the site deploys ungated); add both
    to `dev/build-public.ts`'s allowlist; `npm run test:public`.
18. `CHANGELOG.md` entry (consumer-facing: "Overlapping points can now be clustered
    with one attribute…"), version bump in its six homes, `node
    dev/tools/announce-release.mjs --check`. Downstream after publish: `onlymapjs
    #5` closes with a comment; `nika-agent` skills get a "many points → cluster"
    rule; `onlymap-native` parity page; `onlymap-remotion` unaffected (clusters are a
    pure function of view + data).

### Deferred (write the issue, don't build)

- `leafZoom` + `DataFilterExtension` leaf path (D6) — only if step 7's number misses.
- `cluster-geometry="centroid"` for non-point GeoJSON (D7).
- `cluster-scope="viewport"` for >500K points (Google's viewport algorithm).
- ~~Custom cluster content (icon atlas per count bucket; `mapcn#28`)~~ —
  **shipped in 0.11.1** as `get-cluster-icon` + `cluster-icon-atlas`/`-mapping`
  and the `first:` aggregate, see "Images on bubbles" below.
- Tiled sources (`MVTLayer`, `TileLayer`) — server-side clustering, CARTO
  `ClusterTileLayer` shape.

---

## Acceptance (from `onlymapjs #5`, made testable)

- [ ] 50K-point ScatterplotLayer with `cluster="true"` and defaults: index built once
      per data change (spy-tested); pan/zoom at z5 stays ≥ 60 fps on the dev machine
      (number recorded above).
- [ ] Unclustered points render with the host's own `get-*` output byte-for-byte
      equal to the unclustered layer (snapshot test).
- [ ] Click-to-expand, cluster picking and cluster popups work in HTML and React.
- [ ] Non-point GeoJSON with `cluster="true"` → structured error with a fix.
- [ ] Attribute names match MapLibre's; docs, skill, llms.txt, IntelliSense updated.

## References

- `onlymapjs #5` — the public design issue (survey table, scope, non-goals).
- deck.gl website `examples/website/icon/icon-cluster-layer.ts` — the reference composite.
- `mapbox/supercluster` README — options, `map`/`reduce`, `getClusterExpansionZoom`.
- MapLibre style spec, sources → geojson: `cluster*` options and `clusterProperties`.
- `googlemaps/js-markerclusterer` — algorithm abstraction, viewport algorithm, default click-zoom.
- `docs/design/extensions.md` — why `CollisionFilterExtension` is decluttering, not clustering.
