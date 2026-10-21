# Programmatic picking — `pickAt`, `pickRect`, `unproject`, `pickMode`

> **Status: IMPLEMENTED — released as 0.11.5** (2026-10-02). Architecture doc:
> dated entry 175 and the Selection section's "Programmatic picking". Target release: **0.11.5** (new public
> API, no breaking change). Driven by the element picker in `nika-agent`
> (`docs/element-picker.md` there), but shaped as the general "capture tool"
> hook the `om-map-point` event was the first half of. **This ships first**;
> the downstream picker is built against it from the start. Decided
> 2026-10-02: default `pickAt` radius 4px.
>
> Files touched: `src/runtime-core.ts`, `src/elements/om-map.ts`,
> `src/programmatic.ts`, a new `e2e/pick-api.spec.ts`. No new attributes, so
> `html-data` is unaffected.

Goal: let a consumer ask the map *what is at this pixel* and *what is inside
this rectangle*, and convert a pixel to a coordinate, without editing the
manifest, without changing what the map's own widgets and behaviours see, and
regardless of whether the author made the layer `pickable`.

```ts
const mapEl = document.querySelector("om-map")!;
mapEl.pickMode = "all";                          // while a picker tool is armed
const hit = mapEl.pickAt([x, y]);                // Selection | null, 4px radius
const hits = mapEl.pickRect({ x, y, width, height }, { maxObjects: 50 });
const lngLat = mapEl.unproject([x, y]);          // [lng, lat] | null
mapEl.pickMode = "authored";                     // on exit
```

---

## 1. What exists, and why it is not enough

- **No way to ask.** A pick happens only when deck calls `onHover`/`onClick`
  (`runtime-core.ts:1104-1134`), which build a `Selection` through
  `toSelection` (`selection.ts:92`) and `rasterSelectionAt`, then hand it to
  the element, which stores it privately (`om-map.ts`, `this.selection`). The
  only readers are widgets via `registerWidgetInternal` → `ctx.selection`,
  behaviours, and `MapController.getSelection()`/`watchPicks()`
  (`programmatic.ts:788-793`). `deck.pickObject` is called in exactly one
  place, for snapping (`runtime-core.ts:1493`).
- **Nothing is pickable unless the author says so.** `pickable` defaults to
  `false` on every schema (`layer-registry.ts:247, 276, 311, 330, 364, 555`).
  A consumer can flip it with the `set-pickable` action or
  `set-layer-attribute`, but that writes the manifest: undo history, autosave,
  a diff the author did not make.
- **Pixel → coordinate is one-way.** `ctx.viewport.project` and
  `MapController.project()` (`programmatic.ts:960`) exist; the reverse does not.
  The library unprojects internally (`runtime-core.ts:726, 2516, 2610`) and
  exposes one public unproject in the whole package: `om-frame.georef`, in
  sheet millimetres.
- **`om-map-point` is the precedent** (`om-map.ts:1623`): a public event with
  `{coordinate, kind}` added so "consumer capture tools the built-in draw
  widget doesn't cover (rectangle/circle AOIs) can subscribe". It gives a
  coordinate per pointer event, nothing about what is there. This design is
  the second half of that hook.

## 2. API

All three methods and the property exist on both the element
(`OmMapElement`) and `MapController`, with identical signatures. They are
**queries**: calling them does not update `ctx.selection`, does not fire
`om-map-point`, does not run `<om-behavior>` actions, and does not move the
hover cursor. A picker scanning under the pointer must not trigger the
author's `on="hover"` behaviours, and a `pickRect` over a thousand features
must not open a thousand popups.

### `pickAt(pixel, options?) → Selection | null`

```ts
pickAt(pixel: [x: number, y: number], options?: {
  /** Pixels around the point to search. Default 4 — what a finger or a
   *  mouse user expects from a picker; a 2px point at deck's default of 0 is
   *  missed. The click handler keeps deck's default, so authored behaviour
   *  is unchanged. */
  radius?: number;
  /** Restrict to these authored `<om-layer id>`s. Default: every layer. */
  layers?: string[];
}): Selection | null
```

`deck.pickObject({x, y, radius, layerIds, unproject3D})` → the same
`selectionFor` path the click handler uses (`toSelection` with the
`renderedLayerIds` reverse map, then `rasterSelectionAt` for COG pixels), so
the result is the ordinary `Selection` with `type: "click"`. `layers` maps
authored ids to rendered deck ids through `renderedLayerIds` (terrain, clip
and cluster suffixes). `unproject3D` follows deck's own pointer-pick rule
(`_shouldUnproject3D`: some live layer is `pickable: "3d"`). As first built it
was always `true`, which returned a meaningless z on flat maps and ran a depth
pass on every call — the click and the query disagreed about the same pixel.
As built, deck's prefix-matched `layerIds` is handled by filtering on the exact
authored id and looking past a wrong-layer closest hit with
`pickMultipleObjects`; in basemap mode the methods run through the
`MapboxOverlay`'s forwarded pick methods. On a cluster layer the
hit is the bubble (the composite's own object), as a click reports today.

### `pickRect(rect, options?) → Selection[]`

```ts
pickRect(rect: { x: number; y: number; width: number; height: number }, options?: {
  layers?: string[];
  /** Upper bound on returned objects. Default 100. */
  maxObjects?: number;
}): Selection[]
```

`deck.pickObjects({x, y, width, height, layerIds, maxObjects})`, each info
through `toSelection`. Raster layers are skipped here: a rectangle of pixel
values is not a selection list. Order is deck's (front to back). The cap is
the caller's protection against a dense layer; the method does not report how
many it left out, because deck does not know either.

### `unproject(pixel) → [lng, lat] | null`

`viewport.unproject(pixel)` on the current deck viewport: ground-plane math,
the same the runtime uses for its own geometry. `null` before the map is ready
or in headless mode. For a depth-aware coordinate, `pickAt` already returns
`coordinate` with `z` on a `pickable="3d"` hit; `unproject` stays the cheap
flat answer and says so in its doc comment.

`project` becomes public on the element too (it is `projectInternal` today,
`om-map.ts:1889`; `MapController` already has it).

### `pickMode: "authored" | "all"`

A **property**, not an attribute, so it is never serialised into the
manifest, never enters undo, and a headless render ignores it. Default
`"authored"`: nothing changes. While `"all"`, `buildLayers` forces
`pickable: true` on every layer it constructs. That makes **every** pick path
see every layer — not just `pickAt`, but hover, click, `pick-cursor` and
`ctx.selection` too. This is deliberate: a picker tool wants the whole map
pickable while it is armed, and splitting "pickable for queries" from
"pickable for the author's behaviours" would need a second picking pass or a
per-layer authored-flag check in `toSelection` for a distinction no consumer
has asked for. The doc comment says so, and the downstream picker sets it on
arm and restores it on exit.

Switching the mode calls the same relayout a layer attribute change does, so
deck receives new layer instances with the changed prop. No id suffix: unlike
terrain, clip or cluster, `pickable` is an ordinary prop deck updates in place.

## 3. Implementation

### `runtime-core.ts`

1. Field `pickMode: "authored" | "all" = "authored"` with a setter that
   schedules a layer rebuild.
2. In `buildLayers()` (`:1957`), after schema props are applied and before the
   terrain/clip merge, `if (this.pickMode === "all") props.pickable = true`.
   The Tile3D host already does `pickable: hostProps.pickable !== false`
   (`:1941`); the forced value flows through it unchanged. Cluster composites
   take `pickable` on the composite (`layers/cluster-layer.ts`), same path.
3. `pickAt`, `pickRect`, `unproject` as methods beside the snapping
   `pickObject` call (`:1493`), reusing `selectionFor` — lift it out of
   `pickCallbacks` into a private method so both callers share it. Return
   `null`/`[]` when `this.deck` is absent (headless) or the viewport is not yet
   built.
4. `layers` option → `layerIds` through the reverse of `renderedLayerIds`
   (collect every rendered id whose authored id is in the list, so a layer
   with a `#t3#cluster` suffix is still found).

### `elements/om-map.ts`

Public `pickAt`/`pickRect`/`unproject`/`project` delegating to `core`, and a
`pickMode` accessor pair. Typed in the same block as `snapshot()` and
`getLayers()` (`:1485, :1859`) so they land in `om-map.d.ts` next to the other
consumer methods. No event, no attribute reflection.

### `programmatic.ts`

The same four on `MapController`, beside `getSelection`/`watchPicks`
(`:788`). `setLayers` already rebuilds; `pickMode` reuses that.

### Out of scope

- `om-frame` gains nothing. A live frame's `mapElement` is a real `<om-map>`,
  so these methods are reachable there already; a static frame has `georef`.
  A millimetre-addressed `frame.pickAt(xMm, yMm)` is a one-liner on top of
  `georef.project` and can come when a cartograph consumer needs it.
- A lasso/polygon pick. deck has no polygon pick; a consumer can `pickRect`
  the bounding box and filter by `coordinate` against the polygon.
- A `pick-mode` attribute. Deliberately not offered; see §2.

## 4. Tests

`e2e/pick-api.spec.ts`, on a fixture with one `ScatterplotLayer` left at the
default `pickable=false`, one `pickable` `GeoJsonLayer`, and a
`<om-behavior on="click">` that increments a counter:

1. `pickMode` default: `pickAt` on a scatter point → `null`; on a GeoJSON
   feature → `Selection` with that `layerId`.
2. `pickMode = "all"`: the same scatter point → `Selection`; back to
   `"authored"` → `null` again. Assert the manifest DOM has no new or changed
   attributes after the round trip (`outerHTML` equal).
3. `pickRect` over the scatter data in `"all"` returns the expected count,
   respects `maxObjects`, and `layers: ["geojson"]` excludes the scatter hits.
4. `unproject(project(lngLat))` round-trips within 1e-6 at zoom 12, and
   returns `null` on an unready map.
5. Neither `pickAt` nor `pickRect` fires the behaviour counter, dispatches
   `om-map-point`, or changes `ctx.selection` as seen by a `watch="selection"`
   widget.
6. Cluster: with `cluster` on, `pickAt` in `"all"` still reports the
   **authored** layer id. (As built: terrain was left out — its DEM tiles need
   the network — and the `"authored"` / `"all"` / raster cases run in both
   renderer modes on a local basemap style.)

Unit: none as built — a headless map never builds deck layers, so the e2e
round trip (an unpickable layer answering only under `"all"`) is the check.

## 5. Doc sync for the release (per `CLAUDE.md`)

| Surface | Change |
|---|---|
| `README.md` | The `MapController` bullet (`:408`) and the element's method list: the four methods and `pickMode`, one paragraph |
| `skills/onlymapjs/SKILL.md` + `references/syntax.md:89-91` (the events / `snapshot()` paragraph, where consumer methods are listed) | A "query the map without editing it" rule: use `pickAt`/`pickRect`, set `pickMode` for a picker tool, never `set-pickable` from a tool that is not the author |
| `llms.txt` | Same rule, one bullet |
| `agent-map-library-architecture.md` | Traceability row "Programmatic picking (0.11.5)"; the Runtime Context API section gains the query methods; dated changelog line |
| `CHANGELOG.md` | 0.11.5 — Added: *Ask the map what is under a pixel or inside a rectangle, and turn a pixel into a coordinate, without touching the manifest* |
| Version homes | `package.json`, `src/version.ts`, CDN pins in `SKILL.md`, `references/syntax.md`, `docs/cartograph.md`; then `git grep -l "<old-version>"` per the instructions |
| Downstream | `onlymap-remotion`: dispatch `render.yml` with `onlymap-version=0.11.5` first (sequential runs), then bump both pins; `onlymap-native`: bump and `npm run test:parity`; `nika-agent`: the four homes and the two guard tests. Only `nika-agent` consumes the new API |

## 6. Open questions

- **`pickRect` and rasters.** Skipped above. If a consumer wants the pixel
  values inside a box, that is a `COGLayer` sampling method, not a selection
  list.
- **Should `pickMode = "all"` widen `pick-cursor`?** It will, since the cursor
  rides the hover pick. That seems right for a picker tool. Note it in the doc
  comment rather than suppress it.
