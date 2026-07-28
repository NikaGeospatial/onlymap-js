# React adapter — `@nika-js/onlymap/react`

Real components over the same engine as the HTML manifest. React never renders `om-*` elements — components feed a typed programmatic front-end, so there is no DOM contention with the library's reconciler. React ≥ 18 (`npm install @nika-js/onlymap react react-dom`).

## Rules that INVERT the HTML-manifest rules

- Props are **camelCase deck.gl props** (`getFillColor`, `radiusMinPixels`), not kebab-case attributes.
- Accessors are **plain JS functions**: `getFillColor={d => d.mag > 6 ? [214,40,40] : [252,191,73]}`. Never use `$field` expressions or `scale()` strings here; never add a `js` attribute (there is none).
- Interactions are **event handlers + state**, not `<om-behavior>`. Toggle a layer by rendering `visible={false}`; filter by changing `filterRange`. The state-mutating actions (`toggle-layer`, `show-overlay`, `fade`, story/draw actions) are not dispatched on this path — a console warning points back to props. Camera actions (`fly-to`, `zoom-to-feature`, `zoom-in`/`-out`), `pulse`, `populate`, and custom `OmMap.registerAction` handlers work via `emit`.
- Keep inline `data` references **stable across renders** (`useMemo`/`useState`) — data reactivity diffs by reference. deck.gl ignores accessor function identity; pass `updateTriggers={{ getFillColor: theme }}` when an accessor's *output* changes.
- Stories and the draw widget are HTML-manifest-only for now.

## Complete example

```tsx
import { useState } from "react";
import { OmMap, OmLayer, OmWidget, OmOverlay, useOmMap } from "@nika-js/onlymap/react";

function QuakeMap() {
  const [visible, setVisible] = useState(true);
  return (
    <OmMap center={[-119, 36]} zoom={5} basemap="maplibre" style={{ height: "100vh" }}>
      <OmLayer id="quakes" type="ScatterplotLayer" data="/quakes.csv" label="Earthquakes"
               visible={visible} pickable
               getPosition={(d) => [d.longitude, d.latitude]}
               getFillColor={(d) => (d.mag >= 6 ? [214, 40, 40] : [252, 191, 73])}
               radiusMinPixels={3}
               onClick={(sel) => console.log(sel.object)} />
      <OmWidget position="top-left"><StatsPanel onToggle={() => setVisible(!visible)} /></OmWidget>
      <OmOverlay anchorFrom="selection" layer="quakes">
        {(sel) => sel && <div className="card">M{sel.object.mag} — {sel.object.place}</div>}
      </OmOverlay>
    </OmMap>
  );
}

function StatsPanel({ onToggle }) {
  const ctx = useOmMap(["viewport", "data:quakes"]); // watch tokens re-render the component
  return (
    <div className="panel">
      {ctx.stats("quakes", "mag").count} quakes at z{ctx.viewport.zoom.toFixed(1)}
      <button onClick={onToggle}>Toggle</button>
      <button onClick={() => ctx.emit("fly-to", { center: [140, 38], zoom: 4, duration: 1200 })}>Japan</button>
    </div>
  );
}
```

## Component surface

- **`<OmMap>`** — `center`/`zoom`/`pitch`/`bearing` (initial; later changes move the camera, unchanged props never fight user panning), `basemap`, `headless`, `widgetStyle` (layout-token sugar, the `widget-style` attribute's twin: `"gap:10 opacity:0.9"` → `--om-widget-*` custom properties), `widgetsHidden` (hide-all: hides authored managed widget wrappers without removal, so widget state survives; provider attribution and the license badge stay visible in their slots), `widgetsFold` (default true; map-width responsive side drawers, set false to opt out), `onReady`, `onViewStateChange`, `onRuntimeError`. Give it a size via `style`/`className`. `ref` exposes the imperative `MapController` handle: `flyTo`, `setView`, `emit`, `getLayers`, `getSelection`, `injectPick`, `ready` (promise), `project`.
- **`<OmLayer>`** — `id` + `type` (any registered deck.gl layer type) + deck props. `data`: stable inline reference or URL string (full Data Layer: CSV/Arrow/Shapefile/KML formats, `ws(s)://` streams via `source`/`streamKey`/`flush`, `refresh` polling). `label`/`color` feed `ctx.layers`; `filterField`/`filterRange` = GPU filter; `onClick`/`onHover` receive the flattened picked object (`onHover(null)` = pointer left).
- **`<OmWidget>`** — positioning shell: `position` takes one of 8 managed slots (logical, RTL-aware: `top-start|top-center|top-end|center-start|center-end|bottom-start|bottom-center|bottom-end`; legacy corners `top-left` etc. alias) + arbitrary JSX. Same-slot widgets stack with flush edges and a shared gap; at map widths ≤640px they auto-fold into per-side drawers (`fold="never"` exempts an essential control); provider attribution joins `bottom-end` and the license badge joins `bottom-start` as in-flow members; `order={1}` sets deterministic in-slot ordering. `position="manual"` renders a plain block at the JSX site — note it sits inside OmMap's overflow-hidden box, so for UI OUTSIDE the map render your own element next to `<OmMap>` and drive the map via `useOmMap()`/the ref instead. (Automatic button-clustering of adjacent compact widgets, and collision-dim of slots under an open overlay, are HTML-lane only — in React, compose your own control group in JSX and dim via your own state.)
- **`<OmOverlay>`** — geo-anchored HTML with managed projection/tracking/culling. `anchor={[lng, lat]}` or `anchorFrom="selection"` (+ `layer` to scope which picks move it); children may be `(selection) => JSX`; `anchorOffset` (default `bottom-center`); `interactive={false}` for hover-following tooltips.
- **`useOmMap(watch?)`** — the same `ctx` contract HTML widget scripts get, typed: `layers`, `viewport`, `selection`, `emit`, `data()`, `dataInViewport()`, `stats()`. Watch tokens: `"viewport"`, `"selection"`, `"layers"`, `"data:<layerId>"`. Rides `useSyncExternalStore` (tearing-safe; `ctx` identity stable until a watched token fires).
- **`controller.getStore(token)`** — framework-free `{subscribe, getSnapshot}` per watch token (cached plain-data snapshots; viewport snapshots carry `origin: "user"|"programmatic"` for echo-free two-way binding). Use it to sync map state into Redux/MobX/Zustand/Jotai — recipes in docs/external-stores.md; never mirror row arrays into a store (use the `data:<id>` version stamp + `ctx.data()`).

## Testing (no browser, no GPU)

`<OmMap headless>` runs real projection math under jsdom/happy-dom:

```tsx
const ref = createRef<OmMapHandle>();
render(<OmMap ref={ref} headless><OmLayer id="pts" type="ScatterplotLayer" data={rows} getPosition={p} /></OmMap>);
await ref.current!.ready;
ref.current!.injectPick({ layerId: "pts", object: rows[0], index: 0, coordinate: [0, 0], pixel: [0, 0], type: "click" });
```

`injectPick` rides the same selection path as real GPU picks — `onClick`, `useOmMap(["selection"])`, and selection-anchored overlays all react. For browser e2e, expose the `ref` handle (e.g. on `window`) as the readiness/projection probe — a React page has no `<om-map>` element to await.
