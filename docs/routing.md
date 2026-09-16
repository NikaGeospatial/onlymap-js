# Routing & tracking — Route and Tracking layers

Two curated layer types cover the "show me the way / show me where it is" pair: `type="Route"` draws a styled A-to-B route (casing, colored line, origin/destination markers), and `type="Tracking"` renders one moving entity that glides smoothly between position updates. Both expand into ordinary deck.gl `PathLayer`/`IconLayer` instances internally — there is no new rendering path, and every normal layer attribute (`pickable`, `opacity`, `visible`, …) works unchanged.

## Route

Two authoring paths, mutually exclusive (`geometry` wins outright if both are present; validation warns):

```html
<!-- You already have the path — resolves synchronously, no network -->
<om-layer id="trip" type="Route" follow="fit-route"
          geometry='{"type":"LineString","coordinates":[[-122.42,37.77],[-122.41,37.79]]}'></om-layer>

<!-- A provider computes the path — resolves asynchronously -->
<om-layer id="trip" type="Route" follow="fit-route" provider="osrm"
          origin="[-122.4194,37.7749]" destination="[-122.4130,37.7805]" profile="driving"></om-layer>
```

- `geometry` — a GeoJSON LineString. Distance is derived locally (great-circle); duration is unknowable without a speed model, so it stays `NaN`.
- `origin` / `destination` (+ optional `waypoints`, `profile="driving|walking|cycling"`) — resolved via the `RoutingProvider` registered under `provider`'s name. A changed input (a live attribute edit, an undo, a story step) re-resolves, aborting any in-flight request.
- `color` / `casing-color` style the line (defaults `#2563eb` / `#0f172a`).
- `follow="fit-route"` fits the camera to the route once it resolves — no manual `flyToBounds`.
- **Tail modes** — link the route to a `Tracking` layer with `progress-from="<tracking-layer-id>"` and pick how the traveled portion renders with `tail`:
  - `tail="none"` — **client view**: only current position → destination renders; the traveled line and the origin pin disappear behind the rider. What a customer waiting on a delivery should see.
  - `tail="dim"` — **operator view**: the traveled portion darkens (about 35% brightness of `color`, or set `tail-color`) while current position → destination keeps the live color.
  - default (`full`) — the whole route in one color; the split is ignored.

  The split point is the tracking marker's *interpolated* position, projected onto the nearest point of the route line (real GPS fixes sit off the line), advancing per frame with the glide — not per fix. Before the first fix arrives, the whole route renders as remaining.

Re-routing is just attribute writes — see the gallery's **Compute a Route** example, where two map clicks set new endpoints and everything downstream (reconcile, provider round-trip, camera re-fit) is ordinary library machinery.

### Reading a resolved route back — `om-route-resolved`

Whenever a Route layer resolves — direct `geometry` or a provider round-trip alike — the map dispatches **`om-route-resolved`** (the `om-tileset-load` pattern): `detail = { layerId, route }`, where `route` carries the normalized `geometry`, `distanceMeters`, `durationSec`, `legs`, and the fitted `bounds`. That's how a page reads a provider-computed route without re-fetching it:

```js
mapEl.addEventListener("om-route-resolved", (e) => {
  const { layerId, route } = e.detail;
  // route.geometry.coordinates, route.distanceMeters, route.durationSec …
});
```

`MapController` mirrors it as the `onRouteResolved(layerId, route)` option. The event fires again on every re-resolve (a changed `origin`/`destination`, an undo, a story step). The gallery's **Delivery Riders** simulation and **Compute a Route** readout card both run entirely on this surface — no page-side fetching or adapter-to-UI plumbing.

## Registering a provider

```js
import { OmMap } from "@nika-js/onlymap";

OmMap.registerRoutingProvider("osrm", {
  async computeRoute({ waypoints, profile }, opts) {
    const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/${profile ?? "driving"}/${coords}?geometries=geojson&overview=full`,
      { signal: opts?.signal },
    );
    if (!res.ok) throw new Error(`OSRM: HTTP ${res.status}`);
    const json = await res.json();
    if (json.code !== "Ok" || !json.routes?.[0]) throw new Error(`OSRM: ${json.code ?? "no route"}`);
    const r = json.routes[0];
    return {
      geometry: r.geometry, distanceMeters: r.distance, durationSec: r.duration,
      legs: r.legs.map((l) => ({ distanceMeters: l.distance, durationSec: l.duration })),
    };
  },
});
```

The contract is small on purpose: `computeRoute({waypoints, profile}, {signal}) → Promise<{geometry, distanceMeters, durationSec, legs?}>`. Honor the abort signal (a superseded or unmounted layer cancels its request), and throw on failure — errors surface through the layer's structured error channel, never silently.

OSRM's public demo server is keyless and fine for light interactive use — not production traffic. For production, self-host OSRM or swap the base URL for a keyed engine.

### Other engines

Because the adapter owns its own `fetch`, every auth shape works with no library involvement — publishable keys in query params, keys in headers, or a proxy base URL hiding a secret key behind your own backend. The per-engine differences are geometry encoding and unit quirks:

| Engine | Adapter notes |
|---|---|
| OSRM (self-hosted, FOSSGIS) | The recipe above, verbatim — `geometries=geojson` is native |
| Mapbox Directions | Same dialect: base URL `/directions/v5/mapbox/{profile}`, add `access_token` (publishable, referrer-restrictable) |
| OpenRouteService | POST `/v2/directions/{profile}/geojson`, key in `Authorization` header; geometry arrives as GeoJSON |
| GraphHopper | Pass `points_encoded=false` for raw coordinates; `time` is **milliseconds** — divide by 1000 |
| Valhalla / Stadia | Output is polyline6 (decode it, ~20 lines) — or use Valhalla's OSRM-emulation endpoint and reuse the OSRM adapter |
| Google Routes v2 | Can return `GEO_JSON_LINESTRING`; needs `X-Goog-Api-Key` + the mandatory `X-Goog-FieldMask` header, and `duration` is a string (`"213s"`). **Check Google Maps Platform display terms first** — they restrict showing Google route data on non-Google maps |
| HERE v8 | Geometry is HERE's bespoke flexible polyline — use their OSS decoder package |

Provider-specific extras (avoid tolls, departure time, truck attributes) live in your adapter's closure — the manifest surface stays the universal `origin`/`destination`/`waypoints`/`profile`.

The `"nika"` provider is registered by default as the manifest's default `provider` value, but its endpoint is a placeholder until NIKA's routing service ships — it fails with a clear error pointing here rather than hanging. Register your own under any name, including `"nika"` to override it.

## Tracking

```html
<om-layer id="rider" type="Tracking" get-position="[$lng,$lat]"
          follow="follow" interpolate-ms="1200"
          data="wss://feed.example/rider" source="my-decoder" key="id"></om-layer>
```

- **Position data is ordinary layer `data`** — a `wss://` stream (see [live-data.md](live-data.md)), a polled `refresh` endpoint, inline JSON your script replaces, anything. There is no separate tracking-subscription API; the newest (last) row is "the" position.
- `bearing-field` (default `"bearing"`) names a plain data field — degrees clockwise from north — that rotates the arrow marker. On a GeoJSON row it reads `properties.<field>`; on a flat row, `<field>` directly.
- `interpolate-ms` (default `1000`) makes the marker **glide** between two fixes instead of jumping — driven by the same per-frame channel the story effects use, so no re-render or accessor recompute per frame. Bearing interpolates the short way around (350° → 10° sweeps through 0°). `prefers-reduced-motion` collapses the glide to an instant move.
- `follow="follow"` eases the camera toward each new fix over the same duration, so camera and marker arrive together.
- `color` / `size` style the marker; `icon="arrow|car|motorcycle"` picks its shape (default arrow) — every shape is drawn nose-up and baked in `color`, so bearing rotation and per-rider tinting apply identically. Unknown names fall back to the arrow (validation warns).

One entity per layer in v1 — for a fleet, use one `Tracking` layer per vehicle: the glide interpolation is keyed per layer, so several riders animate independently at once (the gallery's **Delivery Riders** example runs three along real OSRM routes). Beyond a handful, drop down to a plain `IconLayer` over a keyed stream with `transition="get-position 300ms"` for the glide (the live AIS shipping example's pattern) — hundreds of entities in one layer.

## Current limits (stated, not discovered)

- Congestion coloring and route alternatives are not implemented — within each tail segment the line is one solid style.
- Route metadata has no `ctx` watch token yet — but the `om-route-resolved` event (below) delivers each resolved route to the page, which covers the common cases.
- `Tracking` renders one entity per layer; multi-entity fleets on one layer are a documented follow-on.
