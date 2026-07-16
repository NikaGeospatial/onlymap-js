# Registering an external layer class

`OmMap.registerLayer` makes any deck.gl layer class a first-class manifest
type: validation, IntelliSense generation, and attribute resolution all read
the same schema the built-ins use. This page is the recipe for bringing a
layer class the library doesn't bundle — a community layer, a company shim, a
composite that wraps a whole data pipeline.

## Rule 1: build on `@nika-js/onlymap/deck`, never on your own deck.gl

OnlyMapJS bundles deck.gl (it has zero runtime dependencies). If your class
extends a `@deck.gl/*` copy you installed yourself, it belongs to a
**different class hierarchy** — two `Layer` base classes, two luma.gl
runtimes — and fails inside the bundled renderer. The `deck` subpath
re-exports the bundled classes, so your shim extends the exact objects the
core renders with:

```js
import { CompositeLayer, TileLayer, BitmapLayer } from "@nika-js/onlymap/deck";
```

Available: `Layer`, `CompositeLayer`, `LayerExtension`, `WebMercatorViewport`,
`COORDINATE_SYSTEM`, `GeoJsonLayer`, `ScatterplotLayer`, `IconLayer`,
`BitmapLayer`, `TileLayer`, `Tile3DLayer`, `SimpleMeshLayer`,
`ScenegraphLayer` — plus authoring types (`LayerProps`, `DefaultProps`,
`UpdateParameters`, `PickingInfo`, `LayersList`; typechecking against them
needs `@deck.gl/core` as a dev dependency).

## Rule 2: functions ride `static defaultProps`, not attributes

HTML attributes are strings — function-valued props (`renderSubLayers`,
`getTileData`, load callbacks) are inexpressible by design. Put them on a
thin subclass; deck.gl's own defaultProps merge delivers them to every
instance:

```js
class CogLayer extends CompositeLayer {
  static layerName = "CogLayer";
  static defaultProps = {
    renderTile: { type: "function", value: renderTile },
    onRasterLoad: { type: "function", value: () => {} },
  };
  renderLayers() {
    /* compose TileLayer/BitmapLayer from the subpath here */
  }
}
```

## Rule 3: the schema wires attributes to deck props

```js
import { OmMap } from "@nika-js/onlymap";

OmMap.registerLayer({
  type: "CogLayer",
  deckClass: CogLayer,
  props: [
    // deck's URL prop is `data`, but OnlyMapJS reserves the `data` attribute
    // for its own loader — alias it, and the layer class fetches for itself
    // (the built-in Tile3DLayer `tileset` attribute uses the same trick).
    { attr: "src", kind: "scalar", deckProp: "data", type: "string", required: true },
    // JSON attributes and dot-path descriptors compose: the JSON sets the
    // object, later dot-paths merge into it.
    { attr: "load-options", kind: "scalar", deckProp: "loadOptions", type: "json" },
    { attr: "max-error", kind: "scalar", deckProp: "loadOptions.cog.maxError", type: "number" },
    { attr: "opacity", kind: "scalar", deckProp: "opacity", type: "number", default: 1 },
    { attr: "visible", kind: "scalar", deckProp: "visible", type: "boolean", default: true },
    // accessor-kind props get the full expression language:
    // { attr: "get-color", kind: "accessor", deckProp: "getColor" },
  ],
});
```

Then the manifest just works:

```html
<om-layer id="rast" type="CogLayer" src="https://example.com/landcover.tif"
          max-error="16" opacity="0.9"></om-layer>
```

## Rule 4: register before the manifest mounts

Registration after mount does not retrigger reconciles — an unknown-type
layer is warn-skipped until the next DOM mutation. Call `registerLayer` at
module top level (the `registerSource`/`registerFormat` convention), before
the `<om-map>` connects.

## Verifying without a GPU

`OmMap.snapshotIR(html)` resolves your registered type through the same
pipeline the live reconciler runs — assert the aliased URL lands on
`props.data`, dot-paths nest, functions appear as `[function]` — in plain
jsdom/happy-dom, no WebGL.

## The programmatic alternative

On the `MapController` front-end (and the React adapter), `props` passes
function values directly — no subclass needed. The subclass recipe exists so
the **manifest** front-end can express what attributes can't.
