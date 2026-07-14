# OnlyMapJS Validation And Testing

Use this reference when a user asks to debug, validate, review, or test an OnlyMapJS page.

## Static Validation

Use `OmMap.validate(htmlString)` before finalizing agent-written maps.

```ts
import { OmMap } from "@nika-js/onlymap";

const result = OmMap.validate(html);
if (!result.valid) {
  console.log(result.errors);
}
```

Errors and warnings have:

```ts
{
  severity: "error" | "warning",
  element: "om-layer#quakes",
  attribute: "get-position",
  message: "...",
  fix: "..."
}
```

Treat `fix` as the direct instruction to apply.

Common validation failures:

- Self-closing custom elements cause bad DOM nesting. Use explicit closing tags.
- Missing layer `id`.
- Unknown layer `type`.
- Missing required accessor such as `get-position`.
- `scale()` missing explicit `domain=`.
- Unknown attributes from camelCase or typos.
- `js` full-JS accessor block on columnar/Arrow data.
- `filter-field` without `filter-range`.
- Inline handlers in widget/overlay content.
- Story steps containing child elements.

## Snapshot IR

Use `OmMap.snapshotIR(html)` to inspect what a manifest means without WebGL or network.

```ts
expect(OmMap.snapshotIR(html)).toMatchSnapshot();
```

The snapshot contains resolved layer descriptors. Accessors appear as behavioral fingerprints, so expression changes show up in diffs without serializing functions.

## Headless Behavior Harness

Use `mountForTest` for most interaction tests.

```ts
// @vitest-environment happy-dom
import "@nika-js/onlymap";
import { mountForTest } from "@nika-js/onlymap";

const h = await mountForTest(`
  <om-map center="[-122.42, 37.77]" zoom="11">
    <om-layer id="points" type="ScatterplotLayer" get-position="[$lon, $lat]" pickable>
      <script type="application/json">
        [{ "id": "p1", "name": "A", "lon": -122.42, "lat": 37.77 }]
      </script>
    </om-layer>
    <om-overlay id="detail" anchor-from="selection" visible="false">
      <div>{{name}}</div>
    </om-overlay>
    <om-behavior on="click" layer="points" action="show-overlay" target="detail"></om-behavior>
  </om-map>
`);

await h.pick({ layer: "points", featureId: "p1" });
expect(h.map.querySelector("#detail").shadowRoot.textContent).toContain("A");
```

Harness operations:

- `h.pick({ layer, featureId | index, type })`
- `h.clearSelection()`
- `h.emit(action, payload)`
- `h.setView({ center, zoom, pitch, bearing })`
- `h.layers()`
- `h.story(id).advance(ms)`
- `h.story(id).seek(ms)`
- `h.unmount()`

Use `vi.stubGlobal("fetch", ...)` for URL data and `vi.stubGlobal("WebSocket", ...)` for streams.

Free-plan license gates (5 layers, 25k rows per layer) apply in headless tests exactly as in production — gated layers emit errors on the validation stream instead of rendering. If the page under test legitimately exceeds the limits, call `OmMap.configureLicense("om_live_…")` in test setup; keys verify offline, so CI needs no network. Telemetry never fires from headless maps.

## Browser/E2E Testing

Use Playwright only for pixels, real GPU picking, basemap composition, or asset rendering.

Wait for readiness:

```ts
await page.evaluate(() => document.querySelector("om-map").ready);
```

Project data coordinates to click pixels:

```ts
const p = await page.evaluate(() => document.querySelector("om-map").projectInternal([-122.42, 37.77]));
const box = await page.locator("om-map").boundingBox();
await page.mouse.click(box.x + p[0], box.y + p[1]);
```

Do not use sleeps. Wait for `ready`, DOM state, screenshots, or `expect.poll`.

## Debugging Checklist

1. Is every OnlyMapJS custom element explicitly closed?
2. Does every layer have `id` and a valid `type`?
3. Are attributes kebab-case?
4. Is the data shape compatible with the accessor? Prefer `$field`.
5. Does every `scale()` include `domain=`?
6. Are behaviors pointing at existing `layer`/`target` ids?
7. Is `pickable` present where click/hover behaviors are expected?
8. Are credentials configured through `OmMap.configureData`, not markup?
9. Is the relevant CSS imported when using MapLibre basemaps?
10. Is a story step setting state rather than toggling ambiguous state?
