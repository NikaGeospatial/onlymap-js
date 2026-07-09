# OnlyMapJS Patterns

Use these patterns as starting points. Replace data URLs, layer ids, fields, centers, and style values with the user's domain.

## Minimal Point Map

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>OnlyMapJS map</title>
  <script type="module">
    import "onlymapjs";
    import "onlymapjs/onlymapjs.css";
  </script>
  <style>
    html, body { margin: 0; height: 100%; }
    deck-map { display: block; height: 100vh; }
  </style>
</head>
<body>
  <deck-map center="[-122.42, 37.77]" zoom="11" basemap="maplibre" validate>
    <deck-layer id="points" type="ScatterplotLayer"
                data="./points.json"
                label="Points" color="#1f9e89"
                get-position="[$lon, $lat]"
                radius="6" radius-units="pixels"
                pickable></deck-layer>
    <deck-widget type="legend" position="bottom-right" title="Layers"></deck-widget>
    <deck-widget type="zoom-controls" position="top-right"></deck-widget>
  </deck-map>
</body>
</html>
```

## Click Popup

```html
<deck-layer id="quakes" type="ScatterplotLayer"
            data="./quakes.json"
            get-position="[$lon, $lat]"
            get-fill-color="scale($magnitude, sequential, ['#fee8c8','#b30000'], domain=[0,8])"
            get-radius="$magnitude * 2"
            radius-units="pixels" pickable></deck-layer>

<deck-overlay id="quake-detail" anchor-from="selection" anchor-offset="bottom-center" visible="false">
  <div><b>{{place}}</b><br />M {{magnitude}}</div>
</deck-overlay>

<deck-behavior on="click" layer="quakes" action="show-overlay" target="quake-detail"></deck-behavior>
```

## Hover Tooltip

```html
<template id="point-tooltip">
  <div><b>{{name}}</b><br />Value: {{value}}</div>
</template>
<deck-behavior on="hover" layer="points" action="show-tooltip" template="#point-tooltip"></deck-behavior>
```

## Choropleth GeoJSON

```html
<deck-layer id="regions" type="GeoJsonLayer"
            data="./regions.geojson"
            label="Regions" color="#3388ff"
            get-fill-color="scale($rate, sequential, ['#eff3ff','#08519c'], domain=[0,100])"
            get-line-color="[40, 40, 40]"
            line-width-min-pixels="1"
            filled stroked pickable></deck-layer>
```

For GeoJSON, `$rate` reads `feature.properties.rate`.

## Filtered Dashboard

```html
<deck-layer id="quakes" type="ScatterplotLayer"
            data="./quakes.csv"
            get-position="[$longitude, $latitude]"
            get-fill-color="scale($mag, sequential, ['#ffffcc','#800026'], domain=[0,8])"
            filter-field="mag" filter-range="[0, 8]"
            radius="5" radius-units="pixels" pickable></deck-layer>

<deck-widget type="filter" layer="quakes" field="mag" position="top-left"></deck-widget>

<deck-widget type="vega-lite" layer="quakes" watch="viewport" position="bottom-left" title="Magnitude">
  <script type="application/json">
    {
      "mark": "bar",
      "encoding": {
        "x": { "bin": true, "field": "mag", "type": "quantitative" },
        "y": { "aggregate": "count", "type": "quantitative" }
      }
    }
  </script>
</deck-widget>
```

## Custom Stats Widget

```html
<deck-widget position="top-left">
  <div id="stats"></div>
  <script type="deck/widget">
    this.watch = ["data:quakes", "viewport", "selection"];
    this.render = (ctx) => {
      const s = ctx.stats("quakes", "magnitude", { scope: "viewport" });
      const selected = ctx.selection ? ctx.selection.object.place : "none";
      this.$("#stats").textContent = `${s.count} in view; max ${s.max ?? "—"}; selected ${selected}`;
    };
  </script>
</deck-widget>
```

## Dense Labels with PopupLayer

```html
<deck-layer id="labels" type="PopupLayer"
            data="./places.json"
            layout="badge"
            min-zoom="10"
            get-position="[$lon, $lat]"
            get-text="$name"
            get-color="$category === 'A' ? [0, 120, 255] : [255, 120, 0]"
            pickable></deck-layer>
```

Use `PopupLayer` instead of many `<deck-overlay>` elements for labels/badges at scale.

## WebSocket Fleet

```html
<script type="module">
  import { DeckMap } from "onlymapjs";
  import "onlymapjs/onlymapjs.css";

  DeckMap.registerSource("fleet", {
    decode: (m) => m.type === "position"
      ? { id: m.id, lon: m.lon, lat: m.lat, heading: m.heading, speed: m.speed }
      : null
  });
</script>

<deck-layer id="vehicles" type="ScatterplotLayer"
            data="wss://example.com/fleet" source="fleet" key="id" flush="250ms"
            get-position="[$lon, $lat]"
            transition="get-position 300ms"
            radius="5" radius-units="pixels" pickable></deck-layer>
```

## Polled REST Fleet

```html
<script type="module">
  import { DeckMap } from "onlymapjs";
  DeckMap.configureData({ headers: { Authorization: `Bearer ${token}` } });
</script>

<deck-layer id="drivers" type="IconLayer"
            data="/api/fleet.json" refresh="5s"
            get-position="[$lon, $lat]"
            get-angle="-$heading"
            pickable></deck-layer>
```

## Draw/Sketch Map

```html
<deck-layer id="sketch" type="GeoJsonLayer" data="draw:sketch"
            label="Sketch"
            get-fill-color="[80, 140, 255, 90]"
            get-line-color="[40, 90, 220]"
            point-radius-min-pixels="6"
            line-width-min-pixels="3"
            stroked filled pickable></deck-layer>

<deck-widget type="draw" target="sketch" position="top-left"
             modes="point line polygon" save="both"
             autosave="onlymapjs-sketch"></deck-widget>
```

## Story/Tour

```html
<deck-overlay id="intro" anchor="[-122.42, 37.77]" visible="false">
  <div>Welcome</div>
</deck-overlay>

<deck-story id="tour" interrupt="pause">
  <deck-step duration="2s" action="fly-to" center="[-122.42, 37.77]" zoom="12" curve></deck-step>
  <deck-step duration="1s" action="show-overlay" target="intro" parallel></deck-step>
  <deck-step duration="2s" populate layer="points"></deck-step>
</deck-story>

<deck-widget type="player" story="tour" position="bottom-left"></deck-widget>
```

## 3D Models

```html
<deck-map center="[-122.399, 37.79]" zoom="15.5" pitch="55" bearing="20" basemap="maplibre">
  <deck-layer id="assets" type="ScenegraphLayer"
              scenegraph="./asset.glb"
              data="./assets.json"
              get-position="[$lon, $lat]"
              get-orientation="[0, $heading, 90]"
              get-scale="[$width, $height, $depth]"
              lighting="pbr" pickable></deck-layer>
</deck-map>
```
