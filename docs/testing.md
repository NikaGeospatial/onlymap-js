# Testing pages built with OnlyMapJS

Maps built on raw deck.gl are famously hard to test: deck.gl needs a real WebGL2 context, jsdom is ruled out entirely, and most teams end up with a handful of slow, flaky browser tests — or nothing. OnlyMapJS is designed so that **almost everything about your map page is testable in your ordinary test runner, in milliseconds, with no browser and no GPU.**

This guide is the complete workflow. It assumes a page like this (a manifest in an HTML file you deploy):

```html
<!-- public/dashboard.html -->
<om-map center="[-122.42, 37.77]" zoom="11">
  <om-layer id="quakes" type="ScatterplotLayer" data="./quakes.json"
              get-position="[$lon, $lat]"
              get-fill-color="scale($magnitude, sequential, ['#fee8c8','#b30000'], domain=[0,7])"
              filter-field="magnitude" filter-range="[0, 10]" pickable></om-layer>
  <om-overlay id="detail" anchor-from="selection" visible="false">
    <div><b>{{place}}</b> — M {{magnitude}}</div>
  </om-overlay>
  <om-behavior on="click" layer="quakes" action="show-overlay" target="detail"></om-behavior>
  <om-widget id="stats" position="top-left"> ... </om-widget>
</om-map>
```

## The three tiers

What decides where a test belongs is the heaviest thing the code under test needs: **nothing**, **a DOM**, or **a GPU**.

| Tier | Question | Needs | Speed | Rough share of your tests |
|---|---|---|---|---|
| 1 | Is my surrounding logic right? | bare Node | ms | as much as you have |
| 2a | Is my manifest valid, and did its *meaning* change? | fake DOM (happy-dom/jsdom) | ms | 2–3 tests |
| 2b | Does my page *behave* right? | fake DOM | ms | **the bulk** |
| 3 | Does it actually render and pick? | real browser (Playwright) | seconds | 2–5 tests |

## Setup (once)

```bash
npm i -D vitest happy-dom @playwright/test
```

```jsonc
// package.json
"scripts": {
  "test": "vitest run",          // tiers 1–2: every commit
  "test:e2e": "playwright test"  // tier 3: PR / nightly
}
```

**Test the real page file, not a copy.** Read the deployed HTML into your tests so there is one source of truth:

```ts
// test/manifest.ts
import { readFileSync } from "node:fs";
export const PAGE = readFileSync("public/dashboard.html", "utf8");
```

## Tier 1 — your own logic (bare Node)

Whatever surrounds the map — data transforms, URL builders, config generation. Nothing OnlyMapJS-specific, except one inherited guarantee: `import "@nika-js/onlymap"` is **side-effect-safe in Node** (element registration no-ops outside a browser), so shared modules that import the library never break your test runner.

## Tier 2a — static: validate + lock the meaning

```ts
// test/manifest.test.ts
// @vitest-environment happy-dom
import { OmMap } from "@nika-js/onlymap";
import { PAGE } from "./manifest";

it("manifest is valid", () => {
  const result = OmMap.validate(PAGE);
  expect(result.errors).toEqual([]); // on failure: structured entries, each with a `fix` instruction
});

it("manifest meaning is locked", () => {
  expect(OmMap.snapshotIR(PAGE)).toMatchSnapshot();
});
```

`snapshotIR` resolves the manifest through the real pipeline (schema, attribute resolution, accessor compilation) into JSON-safe descriptors where **accessors appear as behavioral fingerprints**. Any edit that changes what the map *means* — an expression, a filter range, layer order — shows up as a snapshot diff in code review. Refactors that don't change meaning produce no diff.

## Tier 2b — behavioral: `mountForTest`

This is where most of your tests should live. The harness mounts your real page **headlessly**: no deck.gl instance, no canvas — but everything else runs for real, including the projection math (deck.gl's `WebMercatorViewport` is pure math, no WebGL).

```ts
// test/dashboard.test.ts
// @vitest-environment happy-dom
import "@nika-js/onlymap";
import { mountForTest, type TestHarness } from "@nika-js/onlymap";
import { PAGE } from "./manifest";

let h: TestHarness;
afterEach(() => h?.unmount());

it("clicking a quake opens the detail popup", async () => {
  h = await mountForTest(PAGE);
  await h.pick({ layer: "quakes", featureId: "us7000abcd" });   // or { index: 3 }; type: "click" | "hover" | "drag"
  const popup = h.map.querySelector("#detail")!;
  expect(popup.getAttribute("visible")).toBe("true");
  expect(popup.shadowRoot!.textContent).toContain("M 6.5");     // open shadow roots — plain DOM assertions
});

it("the magnitude filter narrows what widgets see", async () => {
  h = await mountForTest(PAGE);
  await h.emit("filter-layer", { layer: "quakes", field: "magnitude", range: [5, 10] });
  expect(h.map.querySelector("#stats")!.shadowRoot!.textContent).toContain("12 events");
});

it("panning away empties viewport-scoped widgets", async () => {
  h = await mountForTest(PAGE);
  await h.setView({ center: [30, 30], zoom: 4 });               // pitch/bearing supported too
  expect(h.map.querySelector("#histogram")!.shadowRoot!.textContent).toContain("0");
});
```

The harness API: `pick` (synthetic picks fed through the exact code path real deck.gl picks take — columnar layers pick object-less by index, exactly like live), `clearSelection` (hover-off; runs the tooltip auto-hide path), `emit` (any action, same payload contract as `ctx.emit`/`data-emit`), `setView`, `layers()` (the live IR), `flush`, `unmount`. Every verb settles the library's internal batching before resolving — **you never write a sleep**.

**Remote data:** mock `fetch` and the harness waits for it via the readiness signal:

```ts
vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => rows })));
h = await mountForTest(PAGE);                 // resolves after the mocked fetch settles
```

A *failing* fetch also settles readiness (the layer is just empty) — `mountForTest` never hangs on a bad URL.

**What's real at this tier:** validation, accessor execution, `ctx.stats`/`data`/`dataInViewport`, declarative + viewport filtering, behaviors → actions, overlay anchoring/culling/interpolation (real Mercator math), widget reactivity, XSS escaping, columnar row materialization — **and the free-plan license gates** (5 layers / 25k rows per layer), which apply in headless tests exactly as in production so a passing suite can't hide a gated page. If your page legitimately exceeds the free limits, configure your license key in test setup — keys are publishable and verify **offline**, so CI needs no network or secrets vault: `OmMap.configureLicense("om_live_…")`. Gate violations surface as errors on the validation stream (`om-validation-error` / the `validate` attribute), naming the limit.
**What isn't:** pixels, GPU attribute recompute, basemap compositing, and CDN-loaded widgets (`vega-lite` is browser-only — assert its *data* here via `ctx.stats`, its rendering at tier 3 if at all). Telemetry is also silent here — headless maps never report.

## Tier 3 — visual: Playwright

Keep this thin — two to five tests — because the logic is already covered below. The library gives you three tools that remove the usual flakiness:

1. **`await mapEl.ready`** — resolves when the renderer initialized *and* the first reconcile ran *and* every declared `data` URL settled. Never `waitForTimeout`.
2. **`mapEl.projectInternal([lng, lat])`** — derive click/hover pixels from the map's own projection instead of hardcoding coordinates.
3. **Typed lookups** — `document.querySelector("om-map")` is fully typed (no casts) once the library is imported anywhere in your typechecked graph.

```ts
// tier-3 Playwright spec (see package.json test:e2e)
import { test, expect } from "@playwright/test";

test("dashboard renders and real picking works", async ({ page }) => {
  await page.goto("/dashboard.html");
  await page.evaluate(() => document.querySelector("om-map")!.ready);

  // Derive the pixel from data the page actually loaded — datasets change.
  const target = await page.evaluate(() => {
    const map = document.querySelector("om-map")!;
    const quake = (map.getLayers().find((l) => l.id === "quakes")!.data as { lon: number; lat: number }[])[0];
    return map.projectInternal([quake.lon, quake.lat]);
  });
  const box = (await page.locator("om-map").boundingBox())!;
  await page.mouse.click(box.x + target![0], box.y + target![1]);

  await expect(page.locator("#detail").getByText(/M \d/)).toBeVisible(); // locators pierce open shadow roots
});
```

For more patterns — settle-by-observation screenshot polling for repaint assertions, hover-candidate loops for overlapping geometry, paint-order probes — the library's own end-to-end suite is written as the reference recipe for exactly these.

## The one rule about distribution

**Don't re-test tier-2 facts at tier 3.** If the popup's content is asserted in the harness, the e2e test only needs to prove the click-through-real-pixels path works once. Teams that ignore this end up with a slow suite that duplicates a fast one — and then stop running the slow one.

## Agents

Everything above applies to AI agents generating map pages, with one addition: the loop is `OmMap.validate(html)` (is it well-formed? each error carries a `fix`), then `OmMap.snapshotIR(html)` (what does it *mean*? diff against intent), then optionally `mountForTest` to verify interactions — all headless, all deterministic. See [`llms.txt`](../llms.txt).
