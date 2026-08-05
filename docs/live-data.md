# Live data — streams, polling, and authenticated endpoints

A live map is a layer whose `data` keeps changing. OnlyMapJS supports the two transports real fleet/telemetry backends actually expose, behind the same manifest surface — accessors, widgets, filters, and tooltips work identically on both, and **accessors never recompile when data updates** (only the `data` reference changes; the reconciler's fingerprints stay put).

## Choosing a transport

| Your backend exposes… | Use | Semantics |
|---|---|---|
| A WebSocket pushing per-entity updates | `data="wss://…"` | **upsert by key** — entities move in place |
| A REST endpoint returning current state | `data="/api/…" refresh="5s"` | **snapshot replace** — each poll is the new truth |

Rule of thumb: delta/event feeds → WebSocket; materialized "where is everyone right now" endpoints → polling. (SSE is not supported yet — ask if you need it.)

## WebSocket streams

```html
<om-layer id="ships" type="IconLayer"
            data="wss://stream.example/feed" source="ais" key="mmsi" flush="250ms"
            get-position="[$lon, $lat]" get-angle="-$cog" ...></om-layer>
```

- **`key`** declares entity identity: each message *moves* its entity rather than appending a new one. Without a key, an **array** message replaces the whole snapshot (full-snapshot feeds); keyless object messages are dropped with a warning.
- **`flush`** (default `250ms`) coalesces message bursts into one snapshot push per interval — widgets and the GPU see one update per flush, not one per message.
- **Reconnects** are automatic, with exponential backoff (1s → 15s).
- **Host-relative URLs** (`wss:/feed`) resolve host *and* scheme from the page — handy for same-origin bridges.

### Decoding your message format — `registerSource`

The transport is generic; your domain format lives in a plugin:

```js
import { OmMap } from "@nika-js/onlymap";
OmMap.registerSource("ais", {
  // optional: sent on every (re)connect — subscription/auth handshakes
  onOpen: (send) => send(JSON.stringify({ APIKey: "...", BoundingBoxes: [...] })),
  // raw message (JSON-parsed when parseable) → entity object(s), or null to ignore
  decode: (m) => m?.MessageType === "PositionReport"
    ? { mmsi: m.MetaData.MMSI, lon: m.Message.PositionReport.Longitude, /* … */ }
    : null,
});
```

Register the plugin in the same module script that imports the library (registration is also tolerated late — plugins resolve lazily — but same-task is the tidy order). Runnable example: [`examples/maps/transport-logistics/bay-area-shipping.html`](../examples/maps/transport-logistics/bay-area-shipping.html), which speaks aisstream.io's real message format against a simulated feed.

## Polling (`refresh`)

```html
<om-layer id="drivers" type="IconLayer"
            data="/api/fleet.json" refresh="5s"
            get-position="[$lon, $lat]" ...></om-layer>
```

- Each poll **replaces the snapshot** — the endpoint's response is the new truth. If your endpoint returns deltas, you want the WebSocket path instead (validation warns if you combine `refresh` with a `wss:` URL).
- **Failures don't blank the map**: a failing refresh keeps the last good snapshot and keeps polling, warning once per outage and once on recovery. The *initial* load settles `om-map-ready` even on error.
- Interval floor is 250ms. Works for Arrow (`.arrow`) URLs too — re-fetched and re-parsed per poll.

Runnable example: [`examples/maps/transport-logistics/san-francisco-last-mile.html`](../examples/maps/transport-logistics/san-francisco-last-mile.html) — 20 drivers polled at 1s from an **auth-protected** endpoint.

## Authenticated endpoints — `configureData`

Private APIs need credentials, and credentials must never appear in manifest markup (the manifest may be agent-generated, and attributes are visible DOM). Configure requests programmatically instead:

```js
import { OmMap } from "@nika-js/onlymap";

OmMap.configureData({ headers: { Authorization: `Bearer ${token}` } });
// or per-URL:
OmMap.configureData({ headers: (url) => url.startsWith("/api/") ? { Authorization: `Bearer ${token}` } : undefined });
// or take over entirely (signing, retries, proxies):
OmMap.configureData({ fetch: myFetch, credentials: "include" });
```

This applies to **every** Data Layer request: initial loads, polling refreshes, and Arrow files. WebSocket auth needs no equivalent — put the token in the URL or send it from the plugin's `onOpen`.

## How updates propagate (both transports)

Every flush/poll takes the same path a resolved fetch takes: a **new data reference** enters the layer IR → the reconciler hands it to deck.gl, which re-uploads geometry without recompiling any accessor → `data:<layerId>` watch tokens fire, so widgets (stats panels, charts) re-render once per update. `om-map-ready` resolves after the *first* load for polling; for streams it resolves immediately (a stream never "finishes" — don't wait for a first message to consider the map ready).

Known limitation: sockets and poll loops are keyed by URL and live for the page — removing the layer stops the data being *read*, not the connection.

## Testing live layers

In the [headless harness](testing.md), mock the transport: `vi.stubGlobal("fetch", ...)` for polling (readiness waits for your mock), or `vi.stubGlobal("WebSocket", ...)` for streams. The library's own test suites are the reference patterns — including asserting *movement* (fixed entity count, changing coordinates) rather than just presence.
