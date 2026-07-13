# Basemaps

The `basemap` attribute on `<om-map>` selects what renders under your data layers. It accepts a **preset name**, a **MapLibre style URL**, `"maplibre"` (the demo style), or `"none"` (standalone deck.gl canvas). No preset needs a token except the MapTiler ones.

```html
<om-map center="[-122.42, 37.77]" zoom="12" basemap="positron">
  …layers, widgets…
  <om-widget type="basemap-switcher" position="top-right"></om-widget>
</om-map>
```

## Built-in presets

| Name | Provider | Key | Notes |
|---|---|---|---|
| `liberty` | [OpenFreeMap](https://openfreemap.org) | none | Full-detail OSM vector style. No registration, no limits — production use invited. |
| `bright` | OpenFreeMap | none | High-contrast OSM vector style. |
| `positron` | OpenFreeMap | none | Ultra-clean light style — the classic dataviz backdrop. |
| `dark-matter` | [CARTO](https://github.com/CartoDB/basemap-styles) | none | Dark dataviz style. Attribution required (rendered automatically). |
| `voyager` | CARTO | none | Balanced light style with labels. |
| `osm` | [openstreetmap.org](https://operations.osmfoundation.org/policies/tiles/) | none | The classic raster look. **Policy-constrained**: donation-funded, no uptime guarantee; commercial apps should prefer a vector preset or a paid provider. |
| `maptiler-streets` / `maptiler-dataviz` / `maptiler-satellite` | [MapTiler](https://docs.maptiler.com/cloud/api/maps/) | **required** | Free tier available; the satellite preset is the one imagery option here. |
| `maplibre` | MapLibre demo tiles | none | Country-level outlines only — fine for smoke tests, not production. |

## Switching at runtime

The `basemap` attribute is **live** — write it and the map switches in place, keeping the camera and every deck.gl layer:

```js
document.querySelector("om-map").setAttribute("basemap", "dark-matter");
```

Three equivalent surfaces, same as every action:

```html
<om-widget type="basemap-switcher" options="positron dark-matter liberty osm"></om-widget>
<button data-emit="set-basemap" data-basemap="dark-matter">Dark</button>
<om-behavior on="load" action="set-basemap" basemap="voyager"></om-behavior>
```

Omit `options` and the switcher lists every registered keyless preset. Switching between `none` and a basemap changes the renderer, so it remounts under the hood — still seamless (camera and layers carry over), just heavier than a style swap.

## MapTiler: keys and custom-edited styles

MapTiler keys are **publishable, origin-restricted client keys** — they belong in page source (restrict them to your domains in the MapTiler dashboard). Two ways to supply one:

```html
<om-map basemap="maptiler-dataviz" basemap-key="YOUR_KEY">
```
```js
OmMap.configureBasemap({ maptilerKey: "YOUR_KEY" });   // once, covers every maptiler-* preset
```

To **customize a basemap visually**, use MapTiler's Customize editor: pick a base style, edit colors/fonts/labels in the browser (it's editing MapLibre style JSON under the hood), save — you get a style URL for your edited style. Use it directly, or give it a name:

```html
<om-map basemap="https://api.maptiler.com/maps/YOUR_STYLE_ID/style.json?key=YOUR_KEY">
```
```js
OmMap.registerBasemap("brand", {
  style: "https://api.maptiler.com/maps/YOUR_STYLE_ID/style.json?key={key}",
  label: "Brand",
  requiresKey: "maptiler",
});
```

## Register your own

`OmMap.registerBasemap(name, preset)` takes any MapLibre style URL **or inline style object** — self-hosted styles, other providers, or JSON-level edits of a preset:

```js
const style = await (await fetch("https://tiles.openfreemap.org/styles/positron")).json();
style.layers.find((l) => l.id === "background").paint["background-color"] = "#f4efe9";
OmMap.registerBasemap("warm-positron", { style, label: "Warm Positron" });
```

Registered names show up in the switcher widget, validation, and (after `npx @nika-js/onlymap init` regeneration in your own tooling) autocomplete.

## Attribution

Map data providers require attribution — OSM, OpenFreeMap, and CARTO all carry it in their style sources, and OnlyMapJS renders MapLibre's compact attribution control automatically whenever a basemap is active. Preset-level `attribution` text is appended. If you render your own credits, opt out with `attribution="false"` on `<om-map>` — but make sure your replacement satisfies the provider's terms.

## Validation

A typo'd preset name or a keyed preset without a key is a **validation error** (the live map falls back to the demo style so it still renders): `OmMap.validate(html)` lists the registered names or the two key routes in the `fix`.

## React

Same contract on the adapter: `<OmMap basemap="positron" basemapKey="…">` — changing the `basemap` prop switches live (style-only changes keep camera + layers). There's no switcher widget in React; it's a `useState` + the prop. `set-basemap` is not dispatched on the programmatic front-end — use the prop or `controller.setBasemap(name)`.
