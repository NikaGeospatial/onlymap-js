# Cartographs — print-composition pages

> **Available in 0.8.0.** This document is the
> normative element/attribute reference for the `@nika-js/onlymap/cartograph` entry
> (issue [onlymap-js#41](https://github.com/NikaGeospatial/onlymap-js/issues/41)).
> **Phases 0–4 are implemented**: the page, static AND live georeferenced frames, the
> locator inset, scale bar, north indicator, derived legend, graticule, colour-vision
> simulation, shapes, images, text with tokens, atlas iteration, the validator, print-DPI
> export and printing, and the URL triggers. Consumers:
> [nika-agent#68](https://github.com/NikaGeospatial/nika-agent/issues/68) (whose §2 defers
> to this document) and qgis2carto.

A **cartograph** is a standalone HTML file describing a printed page of maps: a page in
millimetres carrying placed map frames (live `<om-map>` mounts or georeferenced rasters)
and cartographic furniture — legend, scale bar, north indicator, graticule, text, shapes,
images — plus atlas iteration. It prints
to PDF at true page size via CSS `@page` and exports PNG/JPEG at print DPI through
`renderCartograph()`.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script type="module" src="https://unpkg.com/@nika-js/onlymap@0.8.0/dist/cartograph.standalone.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/@nika-js/onlymap@0.8.0/dist/cartograph.css">
</head>
<body>
<om-cartograph cartograph-id="cg-lot-12" format="cartograph/2" size="A4" theme="minimal"
          title="Lot 12 — parcel survey" attribution="© Survey Dept 2026">

  <om-text id="title" kind="title" x="10" y="8" w="150" h="12">{{title}}</om-text>

  <!-- A georeferenced raster. The CORNERS place it, not the pixels. -->
  <om-frame id="main" mode="static" x="10" y="24" w="190" h="190"
            crs="EPSG:3857" corners="[[103.80,1.32],[103.82,1.32],[103.82,1.30],[103.80,1.30]]"
            style="left:10mm;top:24mm;width:190mm;height:190mm">
    <img src="lot-12.png" alt="">
  </om-frame>

  <om-scalebar id="bar" for="main" x="10" y="222" w="70" h="9" kind="double" units="metric"></om-scalebar>
  <om-north id="north" for="main" x="186" y="220" w="14" h="18" kind="rose"></om-north>
  <om-text id="credit" kind="attribution" x="10" y="240" w="190" h="6">
    1:{{frame.main.scale}} · {{frame.main.crs}} · {{attribution}}
  </om-text>
</om-cartograph>
</body>
</html>
```

## Ground rules

- **Millimetres everywhere.** Every placed element carries `x y w h` in mm from the page's
  top-left, plus `rotation` (degrees clockwise), `z` (stacking override — document order is
  z-order by default), `locked` (editor-only, inert), `hidden` (skipped in render and print).
  CSS defines 1mm ≡ 96/25.4 px, so screen preview and print agree by construction.
- **Attributes are the source of truth.** The runtime re-asserts inline mm styles from the
  placement attributes on every change. Producers should ALSO write those inline styles
  (as in the example above) so the page positions correctly with JavaScript disabled; the
  validator raises an **error** if the two ever disagree.
- **`kind`, never `style`.** Every discriminator — text role, shape type, scale-bar style,
  north-indicator style, graticule style — is spelled `kind`. `style` is the global HTML
  attribute the runtime writes placement into, so a discriminator living there would be
  erased on the first render.
- **One package, zero cost to maps.** The cartograph is a separate build entry; the core map
  bundle does not grow, and a cartograph whose frames are all static never loads the map
  runtime at all (CI-enforced by `dev/assert-bundle-cdn-safe.mjs`).
- **Themes are CSS.** `theme=` selects a set of `--om-carto-*` custom properties (`default`,
  `dark`, `sepia`, `blueprint`, `minimal`); a user theme is a `<style>` block overriding the
  same properties. Furniture reads its **computed** colour, so an exported PNG matches the
  screen without a second theme table.

## Elements

The authoritative attribute lists (with editor IntelliSense) are generated from
`src/cartograph/schema.ts` into `onlymapjs.html-data.json`.

| Element | Purpose | Status |
|---|---|---|
| `<om-cartograph>` | Page root: `cartograph-id`, `format="cartograph/2"`, `size` (A5–A0/Letter/Legal) or `width`/`height` (mm), `orientation`, `theme`, `title`, `attribution`; print controls `bleed`, `crop-marks`, `safe-zone`, `dpi`, `flatten`, `color-profile`; `cvd`; `allow-url-actions` | implemented |
| `<om-frame>` | A placed map. `mode="static"`: a georeferenced `<img>` child placed by `crs` + `corners`. `mode="live"` (the default): mounts `<om-map>` from `src=` or an inline child with the frame's own `center/zoom/bearing/pitch`; `overview-of` draws another frame's footprint | implemented |
| `<om-text>` | Text block — `kind` (title/text/attribution), `font-size` (pt), `weight`, `align`, `font`, `color`, `bg`; body may use `{{tokens}}` | implemented |
| `<om-scalebar>` | Scale bar — `for`, `units` (metric/imperial/nautical), `segments`, `segment-length`, `kind` (single/double/line/ticks) | implemented |
| `<om-north>` | North indicator — `for`, `kind` (arrow/rose). Direction is derived from the frame's georeference | implemented |
| `<om-shape>` | `kind` (rect/ellipse/line/arrow), `fill`, `fill-opacity`, `stroke`, `stroke-width`, `radius` | implemented |
| `<om-image>` | Logo or photo — `src`, `fit` (contain/cover/fill) | implemented |
| `<om-legend>` / `<om-legend-row>` | Derived legend — `for`, `title`, `columns`, `derived`; rows computed from the frame's layers, never stored. Children are overrides (`layer`, `match`, `label`, `hide`, `order`, `color`, `shape`), or literal rows when `derived="false"` | implemented |
| `<om-graticule>` | Coordinate grid — `for`, `crs`, `interval`/`-x`/`-y`, `kind` (solid/cross/markers), `labels`, `format` (`dms`). Geographic by default; a projected `crs` draws that projection's grid | implemented |
| `<om-atlas>` | One page per feature — `for`, `layer`, `filter`, `sort`, `filename`, `page-name`. Frames follow with `atlas-fit="feature"` + `atlas-margin` | implemented |

## Georeferencing

Both frame modes expose one interface, so no piece of furniture needs to know which kind of
frame it is attached to:

```ts
interface FrameGeoref {
  crs: string;
  corners: [LngLat, LngLat, LngLat, LngLat];  // tl, tr, br, bl — always lon/lat
  widthMm: number; heightMm: number;
  degenerate: boolean;
  project(lngLat): { xMm, yMm } | null;
  unproject(xMm, yMm): LngLat | null;
  groundMetersPerMm(): number;
}
```

**The homography is fitted in the frame's CRS plane, never in raw lon/lat.** A map image is
a projective transform of its own projection plane; it is *not* a projective transform of
longitude/latitude, because Mercator's `y = R·ln(tan(π/4+φ/2))` is nonlinear in latitude. A
fit in degrees reproduces the four corners exactly and misplaces everything between them —
on a frame spanning 40° of latitude, the centre lands ~11 mm out on an A4 page. So:

```
project(lngLat) = H · crsForward(lngLat)
```

`crsForward` is closed-form for EPSG:3857 (spherical Mercator) and EPSG:4326 (plate carrée,
where the forward *is* identity — which is why a naive lon/lat fit happens to be correct for
equirectangular rasters and wrong for everything else). Any other projected CRS resolves
through the core's lazy proj4; `crs-def="+proj=…"` covers CRSs the library does not bundle.

`corners` are authored in lon/lat in tl, tr, br, bl order, so a producer never needs proj4
to place a frame. Longitudes are unwrapped around the first corner, so an
antimeridian-crossing frame fits a continuous plane. A collinear or coincident quad is
`degenerate`: furniture refuses to draw rather than drawing something wrong, and the
validator raises an error.

## Live frames

A live frame mounts the real map runtime with the FRAME's own camera:

```html
<om-frame id="main" x="10" y="24" w="150" h="150"
          center="[103.81, 1.31]" zoom="14" bearing="0" pitch="0"
          src="../maps/map-abc.html"></om-frame>

<!-- A second frame on the same map, wider, drawing the first one's footprint. -->
<om-frame id="locator" x="165" y="24" w="35" h="28"
          center="[103.81, 1.31]" zoom="9" src="../maps/map-abc.html"
          overview-of="main" overview-stroke="#e63946"></om-frame>
```

- **The frame's camera wins.** The referenced document's own `center`/`zoom` are ignored,
  which is what lets the same map appear twice on one page at different extents.
- **Corners come from the camera**, through the same `WebMercatorViewport` the renderer
  uses, so the furniture agrees with the pixels. A view pitched past roughly 60° cannot be
  georeferenced as a quad — its top edge reaches the horizon — and the frame reports itself
  `degenerate` rather than inventing coordinates.
- **`src=` documents are adopted, not injected.** The fetched subtree is rebuilt element by
  element: `<script>` blocks are dropped except the inert `application/json` ones that carry
  inline layer data, and `on*` handler attributes never survive. An inline `<om-map>` child
  is *not* sanitized — the author already owns that document. Cross-origin `src=` needs CORS.
- **The frame's keyline is an inset shadow, not a border**, so `w`/`h` is exactly the mapped
  extent. (A border would shrink the content box and put a silent ~0.3% error into
  everything derived from the georeference.)
- Frames expose `ready` (settling on success *or* failure) and fire `om-frame-ready` /
  `om-frame-error`; a failed frame shows a visible inline placeholder rather than an empty
  box, which on a printed page is indistinguishable from a design choice.

### Export and print resolution

`renderCartograph()` and `print()` capture each live frame through the core's
`snapshot({ scale })` — a genuine re-render at the target resolution, not an upscaled
screenshot. `scale` is absolute captured pixels per CSS pixel (300 dpi is `300/96`), so an
export is identical whatever screen composed it. The renderer is restored to display
resolution before the call resolves.

Printing goes through `cartographEl.print({ dpi })` (or `?print=1`), which swaps each live
canvas for a print-resolution `<img>` first and restores it on `afterprint`. This is
necessary, not decorative: a WebGL canvas prints blank or at screen resolution, because its
drawing buffer is not preserved and the print rasterizer never re-renders it. An unassisted
Ctrl+P therefore cannot produce a high-DPI page — the print dialog opens synchronously and
captures are asynchronous.

## The derived legend

`<om-legend for="main">` computes its rows from the frame's map at render time and never
stores them, so the legend cannot drift out of agreement with the map it describes.

Rows come from the mounted map's own IR (`getLayers()` → `meta.legend`, `meta.label`,
`meta.color`) — the same values the core's legend widget reads, so both legends describing
one map say the same thing. That is also why rows are NOT re-derived from the authored
colour attributes: `classify=` computes its class breaks from the *data*, and rasters
resolve their domain at load, so a static re-read would silently disagree for exactly the
layers whose symbology was computed rather than authored.

Swatch geometry carries meaning and follows the layer type: an area chip for polygons, a
bar for lines, a dot for points, a gradient for rasters. `<om-legend-row>` children are
overrides:

```html
<om-legend for="main" title="Legend" x="266" y="70" w="50" h="80">
  <om-legend-row layer="parcels" label="Zoning"></om-legend-row>
  <om-legend-row layer="parcels" match="residential" label="Housing"></om-legend-row>
  <om-legend-row layer="basemap-labels" hide></om-legend-row>
</om-legend>
```

`match=` targets one category or class entry, keyed on its **original** label — so
relabelling an entry does not break the reference to it. Categories beyond 12 collapse into
a "+N more" row. A static frame has no layers to derive from: there the producer writes
literal rows and sets `derived="false"` (the validator warns if a derived legend points at
a static frame).

## Graticules

`<om-graticule for="main">` draws a coordinate grid. With no `crs` it draws meridians and
parallels at whole degrees; give it a projected `crs` and it draws that projection's grid —
a UTM sheet's kilometre squares — resolving proj4 lazily, so a page that only wants degrees
never loads it. `interval` is in the grid's own units (degrees or metres), and an omitted
interval is chosen automatically on a 1-2-5 series.

Lines are **densified**, not drawn corner to corner: a straight line in one coordinate
system is a curve in another, and a two-point meridian would visibly bow away from the truth
on a wide or rotated frame. `kind` selects solid lines, crosses at the intersections, or
edge markers; `labels` places them outside (the default), inside, or not at all; and
`format="dms"` prints degrees-minutes-seconds.

## Colour-vision simulation

`cvd="deuteranopia"` (or `?cvd=`, boot-only) renders the whole page as a reader with that
condition sees it — a review aid for the moment before printing, when the palette can still
change.

`lintLegendColours(entries)` answers the question that matters: would any two legend entries
become indistinguishable? It simulates each of the four conditions and reports pairs whose
CIEDE2000 distance falls below 10, naming the worst condition. Pairs already too close for
normal vision are skipped — that is a different palette bug, and reporting it here would
send the author looking in the wrong place. The validator runs this over literal legend rows
automatically.

The matrices are Viénot, Brettel & Mollon (1999) applied in **linear** RGB. That combination
is load-bearing: the widely-copied matrices that operate on sRGB directly are invertible, so
no two colours ever map to the same output and a lint built on them can never report a
collapse at all.

## Atlas — one page per feature

The labour multiplier the format exists for: one sheet per parcel, per corridor segment,
per site, from a single authored page.

```html
<om-frame id="main" x="8" y="20" w="132" h="120"
          center="[103.81, 1.31]" zoom="13"
          atlas-fit="feature" atlas-margin="0.25"> … </om-frame>

<om-atlas for="main" layer="parcels" sort="lot" filter="$area > 500"
          filename="lot-{{atlas.lot}}-{{atlas.name}}" page-name="{{atlas.name}}"></om-atlas>
```

Seeking a page refits every frame with `atlas-fit="feature"` to that feature's bounds (padded
by `atlas-margin`), re-resolves `{{atlas.<field>}}` tokens, re-derives every scale bar — the
scale genuinely changes per page, so a bar sized for one sheet would lie on the next — and
fires `om-atlas-page`. The page element exposes `cartographEl.atlas` with `count`, `index`,
`current`, `seek(i)`, `next()`, `filenames()` and `pageName(i)`.

Three rules make an unattended N-page export trustworthy:

- **The map's own filtering applies.** A layer's declarative `filter`/`categoryFilter` hide
  features from the map, so paging over the raw rows would print sheets for features the map
  is not drawing. `filter=` on the atlas is an additional predicate in the **core expression
  language** — the same syntax `om-layer` filters use.
- **Pages are snapshotted when iteration starts**, so a streaming or polling layer cannot
  change the page count halfway through an export.
- **A layer with no local rows cannot drive an atlas.** Tiled and asset-backed layers keep
  their features on a server; that is a validation error, not an empty run.

`sort="lot"` / `"-lot"` (comma-separated for several keys) orders the pages, with features
missing the key last in **both** directions. `filename=` is a token pattern, sanitized for
the filesystem, and duplicates are suffixed so two features with the same name cannot
silently overwrite each other.

### Exporting an atlas

```ts
const { blob, filenames, pages } = await renderCartographAtlas(page, { dpi: 300 });
// blob is ONE zip; pass { page: 2 } for a single sheet (the ?page= host contract).
```

Pages render **sequentially through the one live map** — seeking moves the existing frames
rather than cloning the page. Cloning would mount a WebGL context per page, and browsers cap
live contexts at roughly 8–16, so an atlas of any real size would quietly start emitting
blank sheets. The result is a single ZIP because browsers block or prompt on a loop of N
downloads; entries are stored uncompressed, since PNGs are already compressed and a
compression library has no business in a bundle this size.

## Programmatic surface

```ts
import {
  renderCartograph, renderCartographAtlas,
  validateCartograph, validateCartographString,
  createFrameGeoref, buildScalebar, lintLegendColours, applyUrlActions,
} from "@nika-js/onlymap/cartograph";

// Export at print resolution. Static-only pages need no map runtime.
const { blob, widthPx, heightPx, dpi, warnings } = await renderCartograph(page, { dpi: 300 });

// Validate — the core's ValidationResult shape, so a host folds cartograph
// diagnostics into agent tool results with the code it already has for maps.
const { valid, errors, warnings: warns } = validateCartographString(html);
```

`renderCartograph` clamps to the browser's canvas budget rather than failing silently, and
reports the resolution it actually delivered in `dpi` plus a message in `warnings`. Rendering
the same static page twice produces byte-identical output on the same browser build
(cross-browser identity is not claimed — canvas PNG encoding is unspecified).

**Validation** is synchronous and headless (it needs a DOM implementation for `DOMParser`
in node — happy-dom or jsdom, exactly like the core's `validateManifestString`). Inline
`<om-map>` manifests are deliberately **not** deep-validated there, because delegating would
load the whole map runtime just to check a document. Hosts that already have the core loaded
use `await validateCartographDeep(root)`, which adds the inline manifests' own entries
prefixed with their frame (`om-frame#main > om-layer#roads: …`).

## Tokens

Resolved at render time, in order: atlas feature → frame → page.

| Token | Resolves to |
|---|---|
| `{{title}}` `{{attribution}}` `{{notes}}` | the matching `<om-cartograph>` attribute |
| `{{date}}` | today, ISO (`2026-09-08`) |
| `{{frame.<id>.scale}}` | that frame's representative-fraction denominator, e.g. `25 000` |
| `{{frame.<id>.crs}}` | that frame's CRS |
| `{{scale}}` `{{crs}}` | the sole frame's values — ambiguous (and warned) when the page has more than one frame |
| `{{atlas.<field>}}` | the current atlas feature's field, plus `{{atlas.index}}` and `{{atlas.count}}` |

Substitution is **text-node only**: a token value containing markup lands as text, never as
live DOM. Unknown tokens render literally and are reported by the validator.

## Host triggers (URL actions)

For hosts with no embedded browser (the QGIS plugin), the query string is the automation
surface. They are **opt-in**: a cartograph acts on them only when its root carries
`allow-url-actions`, so hosting a cartograph file does not expose drive-by print or download.

| Parameter | Effect |
|---|---|
| `?export=png&dpi=N` | waits for frames + fonts, renders, downloads. The fully automatable path. `format` may also be `jpeg`. |
| `?export=png&page=N` | one sheet of an atlas, **numbered from 1** like `{{atlas.index}}` and the page filenames. Errors on a page the atlas does not have, or on a cartograph with no `<om-atlas>` — a plugin driving a run sheet by sheet must not receive sheet 1 five times. |
| `?print=1` | waits, then opens the print dialog. Human-in-the-loop by nature — no host can drive a print dialog to a saved PDF unattended. |
| `?cvd=<type>` | boot-only colour-vision simulation; never persisted by an editor. |

All of them are ignored when the embedding page sets `data-om-host="editor"` on `<html>`.

## Printing

`<om-cartograph>` injects `@page { size: <w>mm <h>mm; margin: 0 }` from its own page box
(plus `bleed`, when set). **Chromium honors `@page size`, so print-to-PDF is true physical
size.** Firefox and Safari do not support the `size` descriptor and print to the selected
paper with scaling — a documented limitation, not a bug to work around. Furniture is SVG and
text in the DOM, so PDF text stays selectable text.

## Print-shop attributes

| Attribute | Effect |
|---|---|
| `bleed="3"` | Grows the printed sheet 3mm on every side. The page box stays the TRIM size, so a placed element's `x`/`y` are still measured from the trim corner; content is simply allowed to spill into the bleed, which is the point of it. |
| `crop-marks` | Trim marks at the four corners, drawn **in the bleed** — so it needs `bleed` to have anywhere to go (the validator says so). |
| `safe-zone="8"` | An on-screen guide showing where content risks being trimmed. **Never printed and never exported** — a guide on the deliverable is worse than no guide. |
| `flatten` | Print one raster instead of a page of text, SVG and images. Loses selectable text, so it is opt-in — but some print RIPs mishandle SVG or CSS filters, and a flattened sheet that prints correctly beats a vector one that does not. |
| `color-profile` | Informational tag only. The runtime never converts colour. |

## No-JS fallback

A static-only cartograph reads correctly with JavaScript disabled — iOS QuickLook, mail and
chat previews, file managers. `om-cartograph:not(:defined)` renders the page-shaped block;
static frames' `<img>` children, text and shapes show at the producer-written inline mm
positions; live-frame internals stay hidden. This mirrors `src/fallback.css`, including the
`@media (scripting:)` branches that stop a banner flashing during a slow load.

## Licensing and telemetry

On the free plan every cartograph carries a small foot credit — "Built with
OnlyMap by NIKA · free for non-commercial use" — injected at the page's
bottom-left. It is part of the free license's attribution condition, so it is
included in print and PNG export. Two ways it lifts:

- **Author your own credit.** Any `<om-text>` whose text mentions OnlyMap
  (e.g. `rendered with @nika-js/onlymap/cartograph` in an attribution line)
  satisfies the condition and suppresses the injected one — style it however
  the sheet needs.
- **A paid plan.** When a live frame's map runtime verifies a paid key, the
  credit is removed (a static-only page loads no runtime, so the credit
  stays; the map inside a live frame is what carries `license-key`).

Telemetry: a live frame's map beacon includes `cartograph` in its feature
census — same endpoint, nothing new sent. Static-only pages load no runtime
and send nothing.

## Non-goals

SVG export; multi-page non-atlas documents (`om-page` is reserved-inert); projections other
than Web Mercator on **live** frames; automatic label placement.
