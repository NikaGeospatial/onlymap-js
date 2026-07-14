# Telemetry

OnlyMapJS reports **one usage snapshot per map, per page load** — sent when a map reaches `ready` — and, separately, **errors caused by the library's own code**. This page documents exactly what is (and is not) collected, and how to turn it off.

> **Status: active.** Reports go to the first-party endpoint `https://om-api.nika.eco/v1/t` (never to a third-party domain from your pages). Disclosure lives in the license (LICENSE.md §11). Both opt-outs below are always honored.

## What a snapshot contains

The payload is **deployment-scoped**: it describes the page's use of the library, never the visitor.

```jsonc
{
  "event": "map_ready",
  "pageLoadId": "…",            // random UUID per page load — dedups retries; dies with the page
  "mapId": "…" | null,           // the authored map-id attribute (see below)
  "version": "0.2.3",
  "plan": "free", "keyId": null,
  "origin": "dashboard.example.com",   // hostname ONLY — never the path or query
  "frontend": "html",                  // html | react | programmatic
  "renderer": "maplibre" | "standalone",
  "dev": false,                        // true on localhost / *.local
  "layers": [ { "type": "ScatterplotLayer", "rows": 1200, "streaming": false, "refresh": false } ],
  "story": { "steps": 7 } | null,
  "widgets": ["legend", "basemap-switcher"],  // widget types only
  "draw": false, "undoRedo": false
}
```

What is **never** collected: page paths or URLs, your data or its contents, coordinates, IP addresses in the payload, cookies, or any persistent visitor identifier. `pageLoadId` is regenerated on every page load and cannot link visits. Snapshots are also never sent from `headless` maps, so test suites stay silent.

## Library-error reporting

Unexpected exceptions **from the library's own code** — never your page scripts, never other libraries (the stack must point into OnlyMapJS's own bundle), and never manifest/validation mistakes (those are surfaced to you in the dev error panel instead) — are reported so bugs get fixed:

```jsonc
{
  "event": "library_error",
  "pageLoadId": "…", "version": "0.2.3",
  "origin": "dashboard.example.com",       // hostname only
  "dev": false,
  "signature": "…",                         // hash of message + top frame — the grouping key
  "message": "…",                           // truncated; query strings stripped
  "frames": ["…"],                          // top library-code stack lines; query strings stripped
  "ua": "…"                                 // browser user-agent string
}
```

Stacks are scrubbed before sending: query strings are stripped from every URL (they can carry keys), and no manifest content, layer data, or accessor source is ever included. At most one report per distinct error per page load, capped at five per page. The same opt-outs below disable error reporting — one switch, no fine print.

## `map-id` — identifying the map, not the visitor

An optional authored attribute:

```html
<om-map map-id="0f2c6a1e-88f7-4c3e-9d41-7b1f3f9f2ab7" ...>
```

It identifies the **map artifact** — the same id on every visit by every visitor — so usage can distinguish "one popular dashboard" from "many different maps". It is the same category as an analytics measurement id in page source: author-controlled, nothing stored on the visitor's device. **Opt out by deleting or changing it**; it is never required, and validation never asks for it. The VS Code `!map` snippet generates one automatically.

## Opting out

```ts
OmMap.configureTelemetry({ disabled: true });   // global — kills usage snapshots AND error reports
```

```html
<om-map telemetry="off" ...>                    <!-- per map -->
```

Clearing the endpoint (`OmMap.configureTelemetry({ endpoint: undefined })`) is a third, equivalent switch: no endpoint, no network.

## The binding rules

These are design constraints, not promises of restraint:

1. **Telemetry never affects function.** Nothing in the library waits on, retries, or reacts to a report; sends are fire-and-forget (`navigator.sendBeacon`) and silent on failure. Error reporting can never itself throw into your page.
2. **No endpoint, no network.** The send layer is a no-op when the endpoint is cleared.
3. **Dev-context geography only.** Only `dev: true` reports (a developer's own localhost) are GeoIP-resolved at the server — to a country code, with the IP discarded unwritten. Production reports are never GeoIP'd and visitor IPs are never stored.
