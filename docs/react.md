# React

OnlyMapJS ships a first-party React adapter: **`@nika-js/onlymap/react`**. It gives you real components and a typed hook — no HTML strings, no `<om-*>` elements, no expression language:

```tsx
import { OmMap, OmLayer, OmWidget, OmOverlay, useOmMap } from "@nika-js/onlymap/react";

function Quakes() {
  const [visible, setVisible] = useState(true);
  return (
    <OmMap center={[-119, 36]} zoom={5} basemap="maplibre">
      <OmLayer id="quakes" type="ScatterplotLayer" data={features} visible={visible} pickable
               getPosition={d => [d.lon, d.lat]}
               getFillColor={d => (d.mag >= 6 ? [214, 40, 40] : [252, 191, 73])}
               onClick={sel => console.log(sel.object)} />
      <OmWidget position="top-left"><StatsPanel /></OmWidget>
      <OmOverlay anchorFrom="selection" layer="quakes">
        {sel => sel && <QuakeCard feature={sel.object} />}
      </OmOverlay>
    </OmMap>
  );
}

function StatsPanel() {
  const { stats, viewport, emit } = useOmMap(["viewport", "data:quakes"]);
  return <div>{stats("quakes", "mag").count} quakes at z{viewport.zoom.toFixed(1)}</div>;
}
```

## How it works (and why it can't fight React)

The core is one IR-centered reconcile engine with two front-ends. The HTML manifest (`<om-map>` + MutationObserver) is one; the React adapter rides the other — a **programmatic front-end** that turns typed descriptors into the same layer IR with no DOM manifest in between. React components never render `om-*` elements, so React's virtual-DOM ownership and the library's MutationObserver never meet. `<OmMap>` renders a wrapper `div` and hands the renderer a dedicated leaf `div` React never puts children in.

The same architecture means the two authoring surfaces share every contract: layer semantics, the action payload contract (`emit`), and the `ctx` shape (`useOmMap()` returns exactly what an HTML widget script receives as `ctx` — typed).

## The React way vs. the HTML way

| Intent | HTML manifest | React |
|---|---|---|
| Accessors | `get-fill-color="scale($mag, …)"` | `getFillColor={d => …}` — plain functions, no trust step |
| Interactions | `<om-behavior on="click" …>` | `onClick={…}` on `<OmLayer>` |
| Toggle / filter a layer | `toggle-layer` / `filter-layer` actions | state → `visible` / `filterRange` props |
| Widgets | `<om-widget type="legend">` / `<script type="om/widget">` | `<OmWidget>` + your JSX + `useOmMap()` |
| Popups/tooltips | `<om-overlay>` + `show-overlay` | `<OmOverlay>` (projection, rAF tracking, culling managed) |
| Highlight a feature | `highlight-feature` action | `highlightedObjectIndex` prop (deck.gl-idiomatic) |
| Stories / draw widget | `<om-story>` / `<om-widget type="draw">` | HTML-manifest only for now |

Actions that mutate manifest attributes (`toggle-layer`, `show-overlay`, `fade`, story/draw actions…) are deliberately **not dispatched** on the React path — you'll get a console warning pointing you at props/state instead. Camera actions (`fly-to`, `zoom-in`/`-out`, `zoom-to-feature`), channel effects (`pulse`, `populate`), and your own `OmMap.registerAction` handlers all work.

## Component reference

### `<OmMap>`

| Prop | Notes |
|---|---|
| `center` `zoom` `pitch` `bearing` | Initial camera; later prop changes move the camera (instant). While they're unchanged, user panning is never fought. |
| `basemap` | Same contract as the attribute — a preset name (`"positron"`, `"dark-matter"`, `"osm"`, …), a style URL, or omit for standalone deck.gl. Changing the prop switches live (camera + layers survive); `basemapKey` supplies the MapTiler key. See [docs/basemaps.md](basemaps.md). |
| `headless` | `true` or `{ width, height }` — no renderer, real projection math (tests under jsdom/happy-dom). |
| `onReady` | Renderer up + first commit + no data URL still loading. |
| `onViewStateChange` | Every camera change, with the current `CameraState`. |
| `onRuntimeError` | deck.gl-level failures in the structured validation shape. |
| `ref` | The imperative handle — a `MapController`: `flyTo`, `setView`, `emit`, `getLayers`, `injectPick`, `ready`. |

Give it a size (`style`/`className`) — it renders a `position: relative` div.

### `<OmLayer>`

`id` and `type` (any registered deck.gl layer type), plus:

- `data` — inline rows / GeoJSON / columnar **by stable reference** (memoize it — `data:<id>` reactivity diffs by reference), or a URL string. URLs get the full Data Layer: format detection (CSV, Arrow, Shapefile, KML…), `ws(s)://` streams (`source`, `streamKey`, `flush`), `refresh` polling.
- Any deck.gl prop in camelCase — accessors as plain functions. deck.gl ignores accessor *identity*, so pass `updateTriggers={{ getFillColor: theme }}` when an accessor's output changes.
- `label` / `color` — legend metadata (`ctx.layers`).
- `filterField` / `filterRange` (+ soft range, category) — GPU filtering, same wiring as the HTML attributes.
- `onClick` / `onHover` — picks on this layer, object already flattened/materialized. `onHover(null)` = pointer left.

### `<OmWidget>`

A positioning shell: `position="top-left|top-right|bottom-left|bottom-right"` + your JSX. Widgets sharing a corner stack; the shell re-enables pointer events over the map.

### `<OmOverlay>`

Anchored HTML at a projected coordinate, culled off-screen/behind-globe, tracked per frame outside React renders:

- `anchor={[lng, lat]}` — static, or `anchorFrom="selection"` (+ `layer="id"` to scope which picks move it).
- Children: static JSX, or `(selection) => JSX` to render the picked feature.
- `anchorOffset` — attachment point (default `bottom-center`).
- `interactive={false}` for hover-following tooltips (lets the pointer reach the canvas underneath).

### `useOmMap(watch?)`

Returns the typed `RuntimeContext`: `layers`, `viewport` (bounds/zoom/center/project), `selection`, `emit`, `data()`, `dataInViewport()`, `stats()`. The watch list re-renders the component when a token fires: `"viewport"`, `"selection"`, `"layers"`, `"data:<layerId>"`. No list = read-once (still gets fresh state on other re-renders).

## Testing

The headless mode works under React exactly like the HTML harness (no WebGL, real projection):

```tsx
const ref = createRef<OmMapHandle>();
render(<OmMap ref={ref} headless><OmLayer id="pts" type="ScatterplotLayer" data={rows} getPosition={p} /></OmMap>);
await ref.current!.ready;
expect(ref.current!.getLayers()).toHaveLength(1);
ref.current!.injectPick({ layerId: "pts", object: rows[0], index: 0, coordinate: [0, 0], pixel: [0, 0], type: "click" });
```

`injectPick` rides the same selection path as real deck.gl picks — `onClick`, `useOmMap(["selection"])`, and `<OmOverlay anchorFrom="selection">` all react to it.

## Install

```bash
npm install @nika-js/onlymap react react-dom
```

React ≥ 18 is an optional peer dependency — it's only loaded if you import `@nika-js/onlymap/react`. The adapter is a few KB of glue; the core is shared with the HTML entry, so using both surfaces on one page costs one core.

## Not in the adapter (yet)

- **Stories** as React components (a `<Story>`/timeline hook is on the roadmap) — an HTML `<om-story>` needs the HTML front-end.
- **The draw widget** — HTML front-end only for now.
- **Undo/redo** — manifest history is a DOM-front-end feature; in React your state (and its undo) belongs to the app. `ctx.history` reads `{ canUndo: false, canRedo: false }` here.
- Per-feature `trace` (it animates via runtime manifest elements) — whole-layer `trace` on a TripsLayer works.
- A `scale()` helper mirroring the expression language — use `d3-scale` or plain functions.
