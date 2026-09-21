# Changelog

All notable changes to `@nika-js/onlymap`, newest first. The full rationale for
each entry lives in the architecture doc's dated changelog; this is the concise,
version-by-version record.

Note: npm collapsed a few closely-spaced releases — the GPX/FlatGeobuf (0.5.4)
and GeoParquet (0.5.5) work shipped to npm together as **0.5.6**, so npm's
version list jumps 0.5.3 → 0.5.6. Each logical version is listed here regardless.

## 0.9.1 — 2026-09-21

### Added
- **A finish switcher you can drop on a map.** `<om-widget type="effects">` lists every preset plus Off, and picking one writes the document through `set-effect` — so a viewer's choice is undoable, travels in a story, and is there when the map is saved. The widget holds no state of its own, which means a hand edit or an undo moves the radio too.

### Fixed
- **A finish no longer bleeds colour into empty space.** Grain and tint were being applied to fully transparent pixels, so the texture spilled over whatever sat behind the map — the page background, most visibly. Transparent areas now stay transparent, and semi-transparent ones blend correctly.
- **The `newsprint` screen is legible on screen.** Its dot cell was sized for a press (0.55mm ≈ two pixels on a normal display), which read as noise and erased small symbols. It is coarser and lighter now; take `halftone-cell` back down when you are exporting at 300 dpi.

## 0.9.0 — 2026-09-21

### Added
- **Give a map a printed finish, in one attribute.** `<om-effect preset="vintage">` inside an `<om-map>` treats the rendered frame — warm paper and ink, a pressed edge, paper tooth, a soft vignette. Seven looks ship: `vintage`, `engraved`, `night`, `blueprint`, `riso`, `newsprint` and `muted` (which just calms a busy sheet, with no texture at all). Presets assume the map beneath them is styled to suit; a night plate still needs dark layers.
- **Turn the knobs instead, when a preset is nearly right.** Every look is built from named operations you can write yourself — `<om-effect op="grain" amount="0.07" size="0.12mm">` — and compose in document order: `tint`, `levels`, `saturation`, `posterize`, `vignette`, `grain`, `edges`, `blur`, `sharpen`, `halftone`. To start from a preset and change one thing, either override a single knob (`<om-effect preset="vintage" grain-amount="0.02">`) or ask for the preset as markup with `OmMap.expandPreset("vintage")` and edit it.
- **Or bring your own shader.** An `<om-effect>` carrying an inline `<script type="application/json">` shader module is handed to deck.gl untouched, so anything deck's own `PostProcessEffect` can do is available from the document — multiple passes included.
- **Looks survive the printer.** Sizes are in millimetres (`size="0.12mm"`), so the grain and ink on a 600 dpi export are the same physical texture you tuned on screen rather than four times finer.
- **`set-effect`** switches the finish live from a behavior or a widget button, and because it writes the document, undo/redo see it like any other edit. A story step can apply it; scrubbing back does not yet undo it.

### Notes
- An effect treats deck's own frame. With a MapLibre basemap, which is composited underneath, the data layers are treated and the basemap is not — the validator says so, with the fix.

## 0.8.4 — 2026-09-21

### Added
- **Keep the OnlyMap badge on a paid plan, if you want to.** Removing the attribution badge is something a commercial license *permits*, not something it requires — so `keep-badge` on `<om-map>` (or `OmMap.setKeepBadge(true)`) lifts the free-tier limits while still crediting OnlyMap. The badge then shows the credit without the "free for non-commercial use" sentence, which wouldn't describe a paid deployment. It has no effect on the free plan, where the badge is the license condition rather than a preference. The setting is page-level and can be changed after load; a cartograph's foot credit follows it, and `<om-cartograph keep-badge>` opts a print sheet in on its own.

## 0.8.3 — 2026-09-18

### Fixed
- **A cartograph frame zoomed far out now shows the world wrapping, like any web map, instead of an error.** Zoom out far enough and a frame covers more than the whole world; it used to give up at that point — no scale bar, north arrow, graticule or export, just an error note over the map. The frame now follows the map wherever it goes: the world repeats inside it, the graticule labels each copy correctly, and the scale bar measures the row it sits on. Nothing about the camera is changed or limited.
- **The north arrow, scale bar, graticule and locator inset now follow the map inside a frame.** Pan, rotate or tilt a live frame's map and, as soon as it settles, everything that describes that frame updates to the view on screen — the compass points at true north for what you're actually looking at, not for the camera the document was saved with. Freezing a frame captures that same view, so a frozen frame keeps the correct north too.
- **Cartographs saved zoomed-out or steeply tilted open and work again.** Documents that used to open onto an error render as authored, and the file is left exactly as it is.

### Changed
- **A frame no longer caps the tilt of the map inside it.** 0.8.1 introduced that cap, computed from the frame's shape; the underlying problem was the frame refusing views it could have handled, which is now fixed at the source. `max-pitch` on `<om-map>` remains as an author-set control.

### Added
- **`min-zoom` on `<om-map>`** floors how far a map can be zoomed out, the companion to `max-pitch`. Useful for keeping a kiosk or embedded map within its intended area. Neither is applied automatically.

## 0.8.2 — 2026-09-18

### Fixed
- **The tilt limit on a cartograph frame now actually holds.** 0.8.1 worked out how far each frame could tilt and then, on any map with a basemap, failed to tell the map about it — so the camera could still be pushed to a near-horizontal angle where the frame loses its georeference, and with it the scale bar, north arrow, graticule and export. It now holds on every map, and survives switching the basemap.
- **The limit follows the map instead of being fixed when the frame loads.** Zooming out makes a frame able to tilt less, not more; the ceiling now tightens and loosens as you move the map, rather than staying at whatever the frame was showing when it opened.

## 0.8.1 — 2026-09-18

### Fixed
- **A frame that used to show a captured image no longer shows it behind a live map.** Switching a cartograph frame back to live left its old capture drawing underneath, so the map appeared to have a ghost of itself behind it at low tilt. The capture is kept — switching back to static restores it — but it stays out of sight while the frame is live.
- **A frame can no longer be tilted past the point where it stops working.** Tilt far enough and a frame's top edge reaches the horizon, which leaves it with no georeference — and without that, no scale bar, no north arrow, no graticule and no export. The tilt now stops at whatever that frame can still handle, which depends on its shape and zoom: a wide frame tilts further than a tall one, and zooming in lets both tilt further.

### Added
- **`max-pitch` on `<om-map>`** caps how far a map can be tilted, in degrees. Useful for a kiosk or an embedded map that should stay roughly upright. It is applied to the controls, so an over-tilt is simply refused rather than snapping back after the fact.

## 0.8.0 — 2026-09-11

### Added
- **Cartograph: print-quality map layouts as HTML.** The new `@nika-js/onlymap/cartograph` entry renders standalone pages measured in millimetres — `<om-cartograph>` holding live or georeferenced-image `<om-frame>`s plus cartographic furniture: `<om-legend>` (derived from the live map's own symbology, including data-computed class breaks), `<om-graticule>`, `<om-scalebar>`, `<om-north>`, `<om-shape>`, `<om-text>`, `<om-image>`. Frames carry their own cameras, exports capture at true print resolution (300 dpi PNG or PDF at exact page size), and print-shop attributes (bleed, crop marks, safe zone, flatten) make the output press-ready. It is a separate lazy entry: the core bundle does not grow, and a static-only sheet never loads the map runtime. Guide: `docs/cartograph.md`. (#41)
- **Atlas: one page per feature.** `<om-atlas>` steps a cartograph through a layer's features — one sheet each, rendered sequentially through a single live map (so a hundred-page atlas can't exhaust the browser's WebGL contexts) — and exports the run as one ZIP. (#41)
- **Colour-vision checking.** `cvd="deuteranopia"` (and three more) simulates colour-vision deficiency across the whole page before it is printed, and the validator flags legend palettes that collapse under them. (#41)

### Changed
- **Free-plan cartographs carry a small foot credit** ("Built with OnlyMap by NIKA · free for non-commercial use") in print and export — the page counterpart of the map badge. Author your own OnlyMap credit in any text block and the injected one stays away; a paid key on a live frame's map removes it entirely. (#41)

## 0.7.6 — 2026-09-11

### Added
- **Recolour a 3D model from your data.** `ScenegraphLayer` takes `color="#22c55e"` for a flat tint, and `get-color="$status_color"` to tint each instance from a field — so one GLB can serve a whole fleet in red/amber/green instead of a separate tinted model file per state. The tint multiplies over the model's own texture and material rather than replacing them, so shading and detail survive. (`get-color` already worked but was undocumented; the `color` shorthand is new.)

### Changed
- **`color` on a `ScenegraphLayer` now tints the model, not just the legend.** It used to set the legend swatch alone. Remove it if you want the model's own colours left untouched; when both are set, `get-color` still wins.

## 0.7.5 — 2026-09-11

### Added
- **Share any map as one file: `npx @nika-js/onlymap export map.html`.** Writes a portable copy that opens on any computer — relative data is fetched and embedded with format detection preserved (GeoJSON, CSV, Arrow, FlatGeobuf, GeoParquet and friends), library references become pinned CDN tags, and a no-JS fallback is added if missing. Warns when embedded data is heavy, and says exactly which sources must stay network-hosted (tile streams, COGs, shapefiles) and why.

## 0.7.4 — 2026-09-04

### Changed
- **A lone side widget no longer folds into the drawer so early.** Widgets fold based on what actually shares their row now: the 640px fold width applies when a row (top, middle, or bottom) has widgets on more than one side, and drops to 416px when every occupied row is one-sided — so a single legend or control panel survives narrower maps before tucking away. Adding an opposing widget re-applies the wider threshold immediately.

### Fixed
- **The "requires JavaScript" banner no longer flashes during a slow load.** On modern browsers the stylesheet now distinguishes "JavaScript is off" from "still loading": with scripting available the fallback never appears during a normal boot (and only surfaces, with load-failure wording, if the library genuinely cannot load), while genuinely script-free contexts — file previews, email attachments — see the fallback instantly instead of after a delay.

## 0.7.3 — 2026-09-03

### Added
- **`pow` now means a power curve.** `scale(..., pow, ...)` requires a trailing `exponent=` (e.g. `exponent=2`); without one it silently produced a straight line — identical to the new `linear`, which is now the honest way to spell that. An exponent-less `pow` errors with both ways out named.
- **`linear` joins the scale() kinds.** A plain linear numeric ramp — the most common way to size points by a value — previously had no name (`sqrt`, `log`, `pow` existed, `linear` did not), which pushed authors toward guessing. `get-point-radius="scale($mag, linear, [4, 18], domain=[4.5, 7.8])"` now does exactly what it reads as.

### Fixed
- **A scale() whose kind doesn't match its range is now an error instead of an invisible layer.** `sequential` and `diverging` interpolate colors; given a numeric range like `[4, 18]` they silently produced black for every feature — a map of 641 earthquake points rendered at zero pixels with no warning anywhere. The mismatch is caught at validation time in both directions, and the message names the kind to use instead.

## 0.7.2 — 2026-09-03

### Fixed
- **A time or number filter whose data is still loading now works once it arrives.** The filter and time-slider widgets read their slider's range from the layer's data, but were only listening for structural changes — so if the data finished loading after the widget first drew, they never heard about it. The filter came up with an empty range and dragging it selected nothing; the time slider never appeared at all. Whether you hit this came down to which finished first, the data or the page, so the same map could work in one place and not another. Both widgets now follow their own layer's data.

## 0.7.1 — 2026-09-03

### Fixed
- **A misspelled or invented `<om-behavior action="...">` is now flagged instead of silently doing nothing.** An action the library does not recognise never ran — the manifest validated clean and the interaction was simply dead until someone clicked it. Validation now warns, names the action, and points at the right one (for a click popup that is `show-tooltip` or `show-overlay`). It stays a warning, not an error, because `OmMap.registerAction` may add the action later.
- **`identify="off"` now actually frees the memory it promised.** The docs said it drops the CPU-retained decode; it only skipped the pixel lookup while still holding every tile's full-band array. Off-mode now releases the array and reports its real GPU-side footprint, which is the difference that matters in a memory-tight WebView. The trade is honest: with the decode released, changing `bands` (or turning identify back on) refetches.

### Changed
- **The agent guide documents the `draw-*` actions.** `draw-mode`, `draw-commit`, `draw-cancel`, `draw-delete`, `draw-clear`, `draw-config` and `draw-save` drive the same sketch store a `data="draw:<target>"` layer reads, so a custom toolbar can replace the built-in draw widget entirely — they were implemented but missing from `llms.txt`. A test now keeps every built-in widget type and action named there, so the guide cannot fall behind the runtime again.

## 0.7.0 — 2026-09-02

### Added
- **Choose which bands of a GeoTIFF to display — including false-color composites.** `bands="4"` shows a single band through a colormap; `bands="[8,4,3]"` builds an RGB composite (the classic false-color vegetation view from a multispectral scene). Switching bands never re-downloads anything: every band is decoded once and kept, so flipping between views is instant. (#13)
- **DEMs and satellite scenes no longer render blank or black without hand-tuned min/max.** Non-8-bit rasters with no styling now stretch themselves automatically from the file's own statistics, so "my COG shows nothing" is gone — a console notice reports the window it derived. `rescale="auto"` requests the same treatment explicitly, and with a band triple each band gets its own window. Authored `min`/`max` always win, and both now accept per-band `[r,g,b]` triples. (#13)
- **Click a raster to read the pixel under the cursor.** A click or hover on a COG with no vector feature in the way now carries the pixel's values through the ordinary selection — `{{value}}` in an overlay shows the elevation under a click with zero extra wiring, and `{{band_1}}`…`{{band_n}}` address composites. `identify="off"` opts a layer out. (#13)
- **More control over how a raster looks:** `reverse` flips any colormap, `stretch="log"`/`"sqrt"` and `gamma` shape the display curve — all GPU-side, no re-downloads. Paletted GeoTIFFs (land-cover classifications) now render through their embedded color table and produce a proper classes legend. (#13)
- **Raster problems now say what's wrong instead of rendering nothing.** A server that refuses cross-origin Range requests, a plain non-cloud-optimized GeoTIFF, or a `bands` pick beyond what the file has — each surfaces as a structured validation error with a concrete fix, while the rest of the map keeps working. (#13)

### Fixed
- **Double-click zoom works again on maps without a basemap.** A click-reliability improvement for the drawing tools had silently disabled double-click zoom in standalone mode; it's back — zooms in about the point you clicked, shift-double-click zooms out.
- **The provider attribution no longer overlaps the license badge on narrow maps.** The bottom chrome now measures itself and stacks cleanly at any width, instead of colliding at phone sizes.

## 0.6.26 — 2026-09-02

### Added
- **Hovering an interactive feature now shows a pointer cursor.** The cheapest "this map is clickable" signal there is — recipients of a shared map no longer have to click at random to discover popups. `pick-cursor` on `<om-map>` customizes the cursor; `pick-cursor="none"` turns it off. (#33)
- **A runtime popup switch per layer.** The new `set-pickable` action (`{layer, pickable: true|false|"3d"}`) turns a layer's picking — and with it popups, tooltips, and hover behaviors — on or off from a button, behavior, or story step. It's undoable and rewinds on story scrub like every scene action. (#31)

### Changed
- **Hover no longer stalls the map on modest hardware.** Hovering over layers used to run a GPU hit-test on every mouse move — measured at over a second of freeze per move on integrated graphics with real data. Hover now tests once when the pointer comes to rest instead of continuously while it sweeps, which makes hover popups usable on the machines shared maps are actually opened on. Hover-follow UIs that want the old per-move behavior can opt back in with `hover-pick="continuous"` (or a throttle interval like `hover-pick="120"`); clicking is unaffected. (#31)

## 0.6.25 — 2026-09-02

### Fixed
- **Basemap text labels no longer disappear after the first zoom or pan.** Since 0.6.19, place names and street labels on any interactive basemap painted once and then vanished permanently on the first camera move (or any style layout change) — recordings and static maps were unaffected, which is how it slipped through. One misplaced option handed to the basemap engine sent its label-fade math into NaN; labels now persist through every interaction. Thanks to the detailed report in #40. (#40)

## 0.6.24 — 2026-09-01

### Changed
- **The attribution badge got a brand refresh and is easier to spot.** The lower-left badge on free-plan maps now uses NIKA's colors — a dark plum pill with cream text and a gold outline — instead of grey-on-white, and reads "Built with OnlyMap by NIKA. Free for non-commercial use." The "OnlyMap" and "NIKA" wordmarks are now clickable, leading to the npm package and nikaplanet.com respectively.

## 0.6.23 — 2026-08-27

### Fixed
- **Recorded flyby takes keep their basemap labels.** `onlymapjs record` (and paced story runs generally) captured moving frames before the basemap's place names and road labels had settled — takes came out fully labelled on the first frame and label-less the moment the camera started moving. Every paced frame now also waits for the basemap to settle, and enabling the recording switch after the map has booted now genuinely applies the zero-fade label mode it always claimed (previously that only worked when `data-om-recording` was authored in the markup).
- For exactly reproducible first frames, the stories guide now recommends authoring a start camera (`center`/`zoom` on `<om-map>`) — without one, the opening pose depends on when the camera is first captured.

## 0.6.22 — 2026-08-26

### Added
- **Scale-dependent visibility on every layer type.** `visible-zoom-range="[8, 14]"` hides a layer outside that zoom span (min inclusive, max exclusive — the standard minzoom/maxzoom convention), the everyday GIS pattern for keeping dense layers from swamping a zoomed-out view. Works on vector layers, not just tile layers; the layer stays in the legend and layer switcher while zoom-hidden. (#38)
- **A machine-readable attribute contract, `onlymapjs.attributes.json`.** Tools that generate OnlyMapJS markup can now validate attributes per layer type — the editor IntelliSense file is a flat union and could pass attributes the runtime rejects. The new file is generated from the same registry the runtime validates against, so the two can't drift; IntelliSense hovers now also say which layer types accept each attribute. (#38)
- **A silent-empty-layer class of mistake now warns.** A layer whose required position accessor resolves to nothing for every row — a `TextLayer` fed GeoJSON with no `get-position` being the reported case — previously rendered an empty map with a clean console. It now warns once with the exact fix, on the console and through the `validate` panel. Layers where the default genuinely works are untouched. (#39)

## 0.6.21 — 2026-08-26

### Added
- **Recordings now capture animations, not just end states.** Fade, pulse, trace, and populate steps animate frame-accurately in `onlymapjs record` output and paced story runs — a 2-second border trace draws itself on across 2 seconds of video instead of appearing fully drawn. Seeking a story under the recording switch lands mid-animation too (a half-drawn trace is just a scene), which external frame renderers rely on. One documented limit: the `trace follow` camera is skipped during recorded runs, since the paced route drives the camera.

### Fixed
- **On-map labels (`anchor="surface"`) now sit on the landmass they belong to.** Ring selection previously favored densely-digitized slivers and could even pick a hole; features without a usable anchor point no longer draw a stray label at null island.
- **The `trace follow` camera stays glued to the drawing tip.** It previously sampled the path by distance while the ink advanced by timestamps, so routes with dwells or slow legs pulled the camera away from the head; layers with several separately-timed paths no longer make the camera jump between them.
- **Blob-format snapshots are byte-stable again.** Stability comparison silently never matched for blob output, so exactly the format video renderers request lost its guarantee.
- **Seeking a story no longer overwrites fit-bounds or zoom-to poses between camera legs.**
- **Paid-license render exemption is scoped to real local browser pages** — it no longer applies in environments without a page location at all.

## 0.6.20 — 2026-08-26

### Fixed
- **Paid licenses now apply when rendering video locally.** A key restricted to your domains couldn't take effect on the local host that `onlymapjs record` (and external frame renderers) serve from, so paid features didn't apply to rendered output. A verified paid key is now honored in local render contexts; unkeyed usage is unchanged.
- **Rendered frames settle faster and more reliably over basemaps.** `whenSettled()` now keys off the basemap's own idle signal (camera done, tiles loaded, fades complete) instead of a polling approximation, and the recording switch takes effect before the first render (previously a startup race could leave label fade-in enabled during a take).

## 0.6.19 — 2026-08-26

### Fixed
- **Webpack-based apps can now bundle OnlyMapJS.** Next.js, Create React App, and plain-webpack builds failed outright on the package (webpack misread a fallback `data:` import inside the bundled loaders as a directory to enumerate). The emitted bundles now carry the `webpackIgnore` hints webpack needs, and a standing build check keeps it that way. No consumer action needed.
- **Rendered frames over a basemap are now deterministic.** `whenSettled()` waits for the basemap's own tiles as well as 3D tilesets, and under `data-om-recording` the basemap's label fade-in is disabled — so the same frame of a 2D basemap story renders byte-identically even on a warm page rendering frames out of order (previously the label layer could differ with playback history).

## 0.6.18 — 2026-08-25

### Fixed
- **A warning when a categorical filter can't do what it looks like it does.** deck.gl's GPU category mask holds at most 128 distinct values per dimension — filtering on a higher-cardinality field (e.g. country names over a world dataset) silently made the overflow rows vanish from the map while widget statistics still counted them. The library now warns, once per layer, naming the field and the ceiling, with the fix to use.
- **Trace animations no longer vanish on some machines.** Layer settings could leak between layers of the same type (a shared internal default was mutated in place), which could push a trace outline's GPU program over its attribute budget — the outline then silently never rendered. Defaults are now copied per layer.

### Added
- **Drive a story from an external video renderer (Remotion-class).** Three seams for frameworks that own the clock and ask for arbitrary frames: `mapEl.whenSettled()` (also on `MapController`) resolves once the map has genuinely finished drawing — the natural await for tests and screenshots too; `story.seek(t, { interpolateCamera: true })` lands mid-fly-to seeks on the real flight arc instead of snapping to the leg's end (this also fixes scrubbers); and the `data-om-recording` attribute is now a full determinism switch — camera moves land instantly, effect verbs jump to their end state, transitions and gesture interruption turn off, and `snapshot()` returns byte-stable captures. Acceptance-tested: the same frame renders byte-identically across separate page loads and out-of-order.
- **On-map annotations without popups**: `anchor="surface"` on a `TextLayer` (or any layer) anchors each row inside its own polygon — labels sit on the shapes themselves, no per-row coordinates authored; concave shapes get an always-inside placement.
- **Travel-map trace animations**: `<om-step action="trace" follow easing="ease-in-out">` — `follow` locks the camera to the line's drawing tip as it traces (the classic animated-travel-map move), and `easing` picks the clock curve (`linear`, `ease-in`, `ease-out`, `ease-in-out`).

## 0.6.17 — 2026-08-25

### Added
- **Sharp story flybys over 3D tiles.** `<om-story warm-tiles>` pre-loads every 3D tileset's tiles along the story's camera route in the background before playback, so fly-bys no longer pop in or refine from blurry to clear mid-flight. Also available as the `warm-tiles` action for one-off takes; per-layer `load-options='{"tileset":{"maximumMemoryUsage":512}}'` keeps more tiles cached for long routes.
- **Flawless flyby takes with `<om-story paced>`.** Where pre-loading isn't enough (very heavy scenes like Google Photorealistic 3D Tiles), a paced story holds each frame until the 3D tiles under the camera have fully sharpened before moving on — the flight takes longer to play, but no frame ever shows blurry tiles, which is exactly what a recorded take needs. Combine with `warm-tiles` to shorten the holds; each frame reports its wait through the new `om-paced-tick` event.
- **Record a story straight to video: `npx onlymapjs record map.html --out flyby.mp4`.** Plays the story load-paced in headless Chromium and writes an H.264/VP9 video in which every frame's 3D tiles are fully sharp — widgets, overlays, and provider attribution included. Uses ffmpeg when installed (otherwise you get the PNG frames plus the exact command to run); `--fps`, `--width/--height/--scale` (retina takes), `--story`, `--keep-frames`, `--timeout`, `--max-hold`. Frames captured before a deadline hit are kept for salvage instead of discarded. Custom recorders can hook the same seam with `storyEl.setPacedCapture(...)` — the story waits for your capture before advancing, so screenshots can never tear between frames.
- **`--gpu` makes recordings several times faster on heavy 3D scenes.** Headless Chromium renders on software GL by default, which slows every tile-refinement round; `--gpu` switches `onlymapjs record` to the machine's real GPU (measured ~3× shorter tile holds on a Google Photorealistic 3D Tiles take, identical output sharpness). Recommended whenever a recording holds long for tiles.
- **`paced-max-hold` on `<om-story>`** tunes how long a paced frame may wait for tiles before moving on (default 10s — the safety valve that keeps a dead tile server from freezing playback). Very heavy scenes can genuinely need longer per frame; raise it (e.g. `paced-max-hold="30s"`, or `--max-hold 30` when recording), or set `"none"` to wait unconditionally — the truly-no-blurry-frame mode for recorded takes.

### Fixed
- **Story fly-to steps written as `longitude="…" latitude="…"` now actually pan the camera.** Previously only the documented `center="[lng, lat]"` form moved the map (bare longitude/latitude were silently ignored by playback, though route pre-loading read them); both forms now work everywhere, and zoom-only fly-to steps are included in route pre-loading too.
- **Warm-up passes are sturdier.** Pre-loading now waits for tilesets that are still fetching their `tileset.json` instead of silently warming nothing; a partial warm on any tileset is reported as partial; overlapping warm passes no longer leave a tileset rendering coarser than authored; and `samples`/`budget` values written as attributes (strings) are honored.
- **Paced playback is sturdier too.** Pausing then seeking in the same breath no longer loses the camera position; a failing recorder capture pauses the story instead of wedging it; and a dead tile server on the final frame can always be escaped with pause — even under `paced-max-hold="none"`.

## 0.6.16 — 2026-08-24

### Added
- **Packaged mobile apps now identify themselves in usage telemetry.** `configureTelemetry({ platform, appId })` lets a native host (like `@nika-js/onlymap-native`) report the store app identity and platform instead of a meaningless embedded-WebView hostname. Web pages are unaffected; the same privacy rules apply.

### Fixed
- **A license key that cannot verify now says so on the page.** In a context without `crypto.subtle` (an insecure or misconfigured embed), key verification used to log only a console warning while the map silently ran in the free tier; it now also raises a structured validation error with a fix hint through the normal error channel.
## 0.6.15 — 2026-08-21

### Changed
- **Smoother interactive dragging on complex maps.** Dragging the measure or clip-box gizmos (and any other live animation) now rebuilds the scene once per frame instead of up to ~10 times — the same visual result with a fraction of the work, which shows up as steadier frame rates and lower battery drain on layer-heavy maps, especially in mobile WebViews.

## 0.6.14 — 2026-08-21

### Fixed
- **Dashed lines render again.** `dash="[4, 2]"` had been drawing solid lines since 0.6.2 — the terrain patch merge was unintentionally stripping every layer's extensions on flat maps (issue #36).
- **Filters visibly apply again on maps without terrain** — same underlying cause as the dash fix. Filter widgets and statistics were always correct; the map itself just wasn't hiding filtered-out features.
- **Maps built in code now match maps built in HTML.** Built-in defaults apply (e.g. BIM models are clickable by default), `{z}/{x}/{y}` tile URLs load as tiles instead of failing, legends generate automatically, and `classifyBy` now works in React.
- **`snap="false"` and `clip="false"` now opt a layer out**, matching what validation already accepted; `snap="off"` / `clip="off"` unchanged.

## 0.6.13 — 2026-08-20

### Fixed
- **Line/polygon completion now works on iOS WebViews** (issue #17) — iOS never synthesizes `dblclick` from a double-tap while touch handlers are active, so double-tap added two more vertices instead of committing (Android committed fine — platform-inconsistent). The draw controller now detects the tap pair itself (two touch/pen taps within 350ms and ~12px) and completes the shape; mouse input keeps the native `dblclick` path, and synthetic/programmatic picks (no `pointerType`) opt into nothing. Applies wherever the draw stack runs, including the measure widget's footprints.

### Added
- **Finish button on the draw toolbar** — an explicit, discoverable completion affordance (double-click/double-tap/Enter are conventions the user must already know); harmless no-op when nothing is pending.
- **`mapPoint(coord, kind, pointerType?)`** on the test harness — simulate a specific input modality (`"touch"`/`"pen"`/`"mouse"`) through the real pick path.

## 0.6.12 — 2026-08-19

### Added
- **Classified symbology** (issue #12) — `classify-by="magnitude" classify-scale="quantile|equal-interval|jenks" classify-classes="5" classify-ramp="viridis"` computes class breaks *from the data* at reconcile time, installs the fill-color accessor, and auto-generates the classes legend. Fourteen named ramps (matplotlib + ColorBrewer). An authored `get-fill-color`/`color` always wins (validation names the conflict); URL-backed layers classify when their data arrives; results are memoized per data reference so deck recomputes exactly when the classification genuinely changes. Mirrored on the programmatic front-end as `classifyBy`/`classifyScale`/`classifyClasses`/`classifyRamp`.
- **`time-slider` widget** (issue #18) — play/pause/scrub playback over a layer's numeric/epoch-ms time field: `<om-widget type="time-slider" layer="quakes" field="time" duration="20s" window="86400000" loop format="date">`. Drives the ordinary `filter-layer` action (cumulative from the domain start, or a sliding `window` in field units), so widget statistics stay coherent and undo/stories/external filter edits re-sync the thumb; date labels reuse the filter widget's `format`/`date-style`/`time-zone` contract.

## 0.6.11 — 2026-08-18

### Fixed
- **Tracking markers tween smoothly instead of jittering.** Two causes, both fixed: inline-JSON layer data is now reference-stable across reconciles (it was re-parsed into a fresh array every pass, so any unrelated manifest edit — another rider's fix, a story step — looked like a new position fix to every Tracking layer and snapped its glide to the endpoint; this also stops spurious `data:<id>` watch-token fires for every inline layer on every reconcile), and a glide interrupted by a genuinely new fix now resumes from the marker's **current animated position** rather than the previous fix's endpoint, keeping motion continuous under any fix cadence.

## 0.6.10 — 2026-08-18

### Added
- **`om-route-resolved` consumer event** — whenever a `Route` layer resolves (direct `geometry` or a `RoutingProvider` round-trip), the map dispatches `om-route-resolved` with `detail = { layerId, route }`, where `route` carries the normalized `geometry`, `distanceMeters`, `durationSec`, `legs`, and fitted `bounds`; re-fired on every re-resolve. `MapController` mirrors it as `onRouteResolved(layerId, route)`. This closes the "route metadata has no consumer surface" gap natively: the Delivery Riders simulation and the Compute a Route readout now run entirely on this event, with no page-side fetching or adapter-to-UI plumbing.

## 0.6.9 — 2026-08-18

### Added
- **Tracking marker shapes** — `icon="arrow|car|motorcycle"` on a `Tracking` layer picks the marker (default arrow, unchanged). All shapes are drawn nose-up and baked in the layer's `color`, so bearing rotation and per-rider tinting apply to every shape identically; unknown names fall back to the arrow with a validation warning. The Delivery Riders example now rides color-matched motorcycles.

## 0.6.8 — 2026-08-18

### Added
- **Route tail modes** — link a `Route` layer to its `Tracking` layer with `progress-from="<tracking-layer-id>"` and choose how the traveled portion renders: `tail="none"` (client view — only current position → destination renders, and the origin pin drops with the traveled line) or `tail="dim"` (operator view — the traveled portion darkens, `tail-color` overrides the default derivation, while current position → destination keeps the live color). The split point is the tracking marker's interpolated position projected onto the nearest point of the route line, advancing smoothly per frame with the marker's glide — not stepping per GPS fix. Default (`tail="full"`) keeps 0.6.7 behavior exactly. Validation warns on partial wiring: `tail` without `progress-from`, `progress-from` without a tail mode, `tail-color` outside `dim`, and a `progress-from` naming no layer.
- The **Delivery Riders** example shows the operator view (three dimmed trails growing behind the riders); the **Routing & Tracking** example shows the client view (the route line shrinks to what's ahead of the rider).

## 0.6.7 — 2026-08-17

### Added
- **Routing & tracking layer types** — `<om-layer type="Route" geometry='{"type":"LineString","coordinates":[...]}'>` draws a styled route (casing, colored line, origin/destination markers) from geometry you already have, resolving synchronously with no network call; `origin`/`destination` (+ `provider`, default `"nika"`, + optional `waypoints`/`profile`) resolve one asynchronously instead via a registered `RoutingProvider` (`OmMap.registerRoutingProvider`). `follow="fit-route"` auto-fits the camera once the route resolves. `<om-layer type="Tracking" get-position="[$lng,$lat]">` renders one moving entity with bearing-derived icon rotation (`bearing-field`, default `"bearing"`) that glides smoothly between position updates (`interpolate-ms`, default `1000`) instead of jumping; `follow="follow"` eases the camera along with it. Live position data arrives through the ordinary `data`/`source` mechanism — no separate tracking-subscription API. `Route`/`Tracking` expand into ordinary `PathLayer`/`IconLayer` instances internally, the same pattern `BIMLayer` already uses for `Tile3DLayer`.
- The bundled `nika` routing provider is registered by default so `type="Route"` works out of the box once NIKA's routing service exists — its endpoint is currently an **unverified placeholder** (no such backend is live yet); register a working provider with `OmMap.registerRoutingProvider(name, provider)` for anything that needs to resolve routes today, or author `geometry` directly.
- Two gallery examples: **Routing & Tracking** (direct-geometry route + a simulated live GPS feed gliding a tracking marker) and **Compute a Route** (click two points anywhere and a ~15-line page-script `RoutingProvider` adapter over OSRM's keyless public demo server computes the street-following drive — the click handler only writes `origin`/`destination` attributes; reconcile, the provider round-trip, and the camera re-fit are all library machinery). The OSRM adapter recipe also ships in the skill's syntax reference.

## 0.6.6 — 2026-08-14

### Added
- **Multi-dimension categorical GPU filtering** — `filter-category-fields='[{"field":"fuel","categories":["Coal","Gas"]},{"field":"region","categories":["West"]}]'` filters on up to 4 categorical fields at once, AND'd together and combinable with an active numeric filter (a row must pass every dimension of both kinds). `filter-category`/`filter-categories` (single dimension) keep working unchanged. The built-in `<om-widget type="filter">` now auto-renders a checkbox list (one per distinct value present in the data, with its row count) instead of a slider when its `field` is declared categorically — the mode is inferred from the layer's own filter, never a separate widget attribute. The React/programmatic front-ends get the equivalent `filterCategoryFields` prop.

### Fixed
- `ctx.stats`/`ctx.dataInViewport` now respect an active categorical filter (`filter-category`/`filter-categories`) — previously only numeric filters were coherence-rule-aware, so a chart could silently disagree with a categorically-filtered map.
- Story scrubbing and undo/redo now correctly restore an active categorical filter — previously `filter-category`/`filter-categories` weren't captured at all, so rewinding past a categorical `filter-layer` step silently dropped it.

## 0.6.5 — 2026-08-13

### Added
- **Multi-dimension GPU filtering** — `filter-fields='[{"field":"magnitude","range":[4,10]},{"field":"time","range":[…]}]'` filters on up to 4 fields at once (`DataFilterExtension`'s own ceiling), AND'd together (a row must pass every dimension). `filter-field`/`filter-range` (single dimension) keep working unchanged — `filter-fields` is additive, not a replacement. Place one `<om-widget type="filter" layer="…" field="…">` per dimension; the `filter-layer` action merges range updates onto the matching dimension instead of replacing the whole filter, so independent widgets never clobber each other. `ctx.stats`/`ctx.dataInViewport`'s filter-aware coherence rule applies the same AND-across-dimensions test CPU-side. The React/programmatic front-ends get the equivalent `filterFields` prop.

### Fixed
- `populate` on a layer with more than one authored filter dimension now sweeps the first and holds the rest at their authored range, instead of a type error.

## 0.6.4 — 2026-08-12

React Native core prerequisites. 0.6.3 was already tagged for release when this
work landed, so it carries its own version rather than redefining that one.

### Added
- **Descriptor-owned data transports**: fetches, polling loops, and WebSockets
  are shared by transport identity and reference-counted across active map
  owners. Layer removal or option changes release stale handles; map disposal
  releases all handles; `MapController.suspend()` and `resume()` provide an
  app-background lifecycle without discarding canonical descriptors. A release
  the owner means to reverse — `suspend()`, removing or re-pointing a layer —
  leaves its last rows as a cold snapshot, so resuming or re-adding repaints
  immediately instead of flashing empty; a permanent teardown (`destroy()`, an
  `<om-map>` leaving the document) keeps nothing.
- `releaseDataOwner(owner, {retain})` plus an optional `owner` argument on
  `descriptorToIR` — descriptor-owned transport lifetime for hosts that drive
  the IR directly instead of through `MapController`.
- **JSON-safe programmatic descriptors**: schema-declared accessor props may
  use restricted OnlyMap expression strings, and
  `snapshotDescriptorIR(descriptors)` produces deterministic, fetch-free IR
  snapshots for native/cross-process parity tests. The React layer adapter now
  exposes a pure descriptor conversion path and mirrors dashed-line options.
- **App-scoped packaged licenses**: signed license tokens may now declare exact
  native application identifiers in an `apps` claim, independently or together
  with web domains. Native hosts pass platform-derived identity to
  `configureLicense(key, {appId})`; page or bridge input must never supply it.
  Only the `domains` claim is pinned by the browser — `apps` is asserted by the
  host, so scope a native key by both where you can.

### Changed
- **Live transports no longer live for the page.** A `ws(s)://` socket, a
  `refresh` poll loop, and an in-flight `data` fetch previously outlived the
  layer that opened them; they are now stopped when their last descriptor owner
  releases them — layer removal, a change to `data`/`source`/`key`/`flush`/
  `refresh`, `MapController.destroy()`/`suspend()`, or an `<om-map>` leaving the
  document. Pages that relied on a connection surviving layer removal must keep
  the layer mounted (`visible="false"` does not release) or re-add it, which now
  repaints from the retained cold snapshot. Re-parenting a live `<om-map>` in
  the DOM does **not** drop its transports: the release is deferred a microtask,
  so a synchronous disconnect→reconnect keeps the socket open.
- The data cache is keyed by **transport identity** (URL plus live-source
  options) rather than URL alone. Two layers on the same URL still share one
  transport when their stream/poll options match, and now correctly get separate
  ones when they do not.

## 0.6.3 — 2026-08-12

### Fixed
- **Measure labels no longer render painted onto the terrain** (reported readability bug). The distance/area badges were `terrain="drape"`, and draping renders a layer INTO the terrain's own texture — so a badge came out flat on the ground, stretching and skewing with the slope and going edge-on to a pitched camera. They now use `terrain="offset"`, which keeps the badge a screen-facing billboard and only lifts its anchor to the surface, plus a 14px screen-space lift so a pill never reads as half-buried in a rise.
- **`PopupLayer`'s default terrain mode is now `offset` rather than `drape`**, for the same reason and following the rule the library already applied to 3D models: billboarded content anchors ON the surface instead of being painted onto it. This affects any `PopupLayer` under an active `terrain` that did not set the attribute explicitly; `terrain="drape"` still does the old thing for anyone who genuinely wants text painted onto the ground like a road marking.

### Added
- **The elevation profile marks the footprint's own corners.** `profileSeries` samples that ARE a drawn vertex now carry `vertexIndex` (0-based, in draw order; the closing sample back at the start carries the last index), and interpolated samples omit the field entirely so a Vega-Lite spec separates them with `isValid(datum.vertexIndex)`. The measure widget's built-in profile chart uses this: a clean line, a distinct point on each real corner with a `Vertex / Distance / Elevation` tooltip, and vertex 0 labelled **"1 · Start"** (the exact badge text used on the map) — replacing the old `point: true`, which dotted all ~50 interpolated samples equally and so said nothing about which points were corners. New `ProfilePoint` type, exported.
- **Direction badges on the map: `1 · Start` and `2`.** Two problems, one marker. The profile runs around a closed loop, so its chart has a leftmost point but the map had no cue for WHICH corner that was; and marking only the start is still ambiguous, because from that corner the ring could run either way and clockwise vs counter-clockwise produce mirror-image profiles. The first two vertices are badged in draw order — the minimum that fixes a direction, and a constant cost: one badge per vertex would grow the clutter precisely as a footprint got complicated enough to need the cue. Draw order IS the order the profile walks, so badge N and the chart's Vertex N are the same point by construction. The chart still marks every corner. Displayed 1-based; `ProfilePoint.vertexIndex` stays 0-based, being an array index. Shown only with `profile` on, and cleared with the footprint.
- **`resamplePathWithVertices(points, count)`** in `geodesy.ts` — `resamplePath`'s evenly-spaced curve with the path's own vertices merged in by distance and tagged, coinciding samples replaced rather than duplicated. This is what makes a profile addressable back to the geometry that produced it.

## 0.6.2 — 2026-08-12

### Added
- **Region 3D export** (issue #34 — ported from a sibling project's proven implementation): the `draw` widget's `export-3d` attribute adds an "Export 3D" button that clips loaded `Tile3DLayer`/`BIMLayer` triangle geometry to the drawn footprint (a plain 2D ring — no elevation picking involved) and downloads the result as a portable GLB (positions re-framed to a local coordinate frame at the footprint's own centroid, so it opens correctly in Blender/three.js/etc. without needing ECEF-scale support), or `export-3d="b3dm"` for the same mesh wrapped for Cesium/3D-Tiles pipelines (with a `_BATCHID` attribute + a feature table, namespaced per source tileset so two different tilesets' local batch ids don't collide). Reuses the existing `om-tileset-load` consumer event — its own doc comment already anticipated "tools (e.g. region export) that need the real tileset" — to resolve the live `Tileset3D` registry; no new picking/loader plumbing needed. Each triangle exports with its own source color (standard glTF `pbrMetallicRoughness.baseColorFactor`, baked as per-vertex `COLOR_0`) — no textures (BIM/IFC materials are flat colors, not textured meshes — dropped rather than carried for a case this library doesn't have). Region export also only pulls in currently-**visible** 3D Tiles/BIM layers — a layer hidden via `visible="false"` (or the `toggle-layer` action) is skipped, with distinct console warnings for "nothing loaded yet" vs. "everything loaded but hidden."
- **Clip box** (issue #34 — the geometric complement to the export above): a new `<om-widget type="clip-box">` widget plus `<om-map clip-box-min="[lng,lat,elev]" clip-box-max="[lng,lat,elev]" clip-box-invert clip-box-highlight>` scene-state attributes cut a real axis-aligned 3D box through the whole scene — every layer is clipped by default, opt a layer out with `clip="off"`. `clip-box-invert` shows what's outside the box instead of inside; `clip-box-highlight` dims clipped-out geometry instead of discarding it (a non-destructive preview — nothing disappears). Works on any layer type, including georeferenced `Tile3DLayer`/`BIMLayer` content (3D Tiles, IFC/BIM models) — cutting into a dense BIM scene, not just flat `GeoJsonLayer` extrusions, was the whole point. New `set-clip-box {min, max, invert?, highlight?}` action (`{clear: true}` removes the box); attribute-backed, so changes are undoable and story-steppable. v1 is axis-aligned only — rotated/oriented boxes are a documented follow-up. The clip box itself renders as a visible, draggable solid cuboid with a double-headed-arrow gizmo on each of its 6 faces (pointing along that face's own normal, pixel-locked size so it stays grabbable at any zoom) — drag a face to resize the box directly, gated behind an explicit "Show face gizmos" toggle so the handles don't sit on top of ordinary map panning when not in use.
- **`BIMLayer` now lands on real terrain, not just near it** (issue #34 Part B groundwork): a georeferenced IFC file's `IfcMapConversion.OrthogonalHeight` (its real absolute elevation) was computed but never applied to the rendered model — correct on a flat basemap (a local Z≈0 model sits right on a Z=0 ground plane), wrong once real `terrain` is active (the model stayed at Z≈0 while the real ground elevation at any inhabited location is essentially never 0, burying it inside the terrain mesh). `BIMLayer` now applies its own `OrthogonalHeight` automatically whenever terrain is active — no attribute to author — reusing the same `tilesetPlacementMatrix` ENU re-anchoring the BIM workbench's `ifc-loader` widget already used manually for models it loads via drag-and-drop.
- **Depth-aware picking (`pickable="3d"`) + a real z on hover/click**: any `pickable` layer can opt into deck's depth-pick render pass with `pickable="3d"` instead of a bare `pickable` — terrain now sets this on itself — so a click/hover's resolved coordinate carries a real 3rd (elevation) component instead of the ray∩z=0-plane guess a flat pick gives you. `ctx.selection.coordinate` (and `<om-overlay>`/`show-tooltip` template interpolation, now `{{z}}`) carries it through end to end; absent (not `0`) when no layer in the scene ran the depth pass for that pick.
- **New example: `examples/features/widgets/3d-snapping-cutting-tools.html`** (replaces the earlier `bim-snap-export-clip.html`) — region export, clip box, XY snapping, and z-aware hover picking together against the buildingSMART Medical-Dental Clinic (IFC 2x3, CC-BY 4.0), the same public sample the BIM workbench demo uses. A real multi-storey building is what these tools need: dozens of walls give the snap agents genuine corners and edges to lock onto, and a dense interior is the point of cutting a box through it. The clinic georeferences itself through `IfcSite` and declares no `OrthogonalHeight`, so the page authors `terrain="off"` — a model with no vertical datum placed over a real DEM renders buried inside the terrain mesh.
- **XY snapping** (issue #34 Part A): `<om-map snap="vertex edge midpoint" snap-tolerance="12">` refines a click/hover to the nearest vertex, edge, or edge midpoint of whichever feature deck already picked under the cursor — a two-stage design (deck's own pick narrows to one feature per frame for free; only that feature's own geometry is searched, on the CPU, when snapping is on), not a spatial index. Applies to every vector layer by default (`snap="off"` opts a layer out, mirroring clip box's own default) and to a `BIMLayer`'s own edge/crease overlay — its real wall corners/edges, converted from the model's local mesh coordinates back to real `[lng, lat]` automatically (`site-placement.ts`'s new `localOffsetToLngLat`, fed the model's own reported georeference). Vertex beats midpoint beats edge in range-conflicts. Space suppresses snapping momentarily; a "Snapped: …" tip shows which agent fired. New `src/snapping.ts` (pure resolver, 18 unit tests). XY only for now — a snapped vertex takes the matched feature's horizontal position; threading its exact elevation through the shared draw/measure position type is a documented follow-up.
- **"Flat target plane" toggle for volume measurement** (`base-surface="custom"` only) — now a real semantic switch, not a rendering preference. Default (toggle off): the target surface is the terrain itself offset by the dragged distance — a slope-parallel prism, volume = |offset| × area, pure cut OR pure fill, and exactly **zero at rest** (previously the readout reported "grade everything to the centroid's elevation" numbers before the gizmo was ever touched). Toggled on: the target is one genuinely level plane, per-cell integrated — mixed cut AND fill on sloped ground. Toggling re-integrates the cached grid, so the rendered prism and the reported numbers are always the same shape. The drawn footprint ring itself always hugs real per-vertex terrain in both modes — only the target face changes. Also fixes the flat prism's broken rendering (missing side walls, mis-triangulated caps): its wall quads are vertical polygons, which the default XY-plane earcut triangulates to zero triangles — the explicit prism now renders through its own dedicated `SolidPolygonLayer` with `full3d` (the exact CityJSON-surfaces recipe), instead of mode-flipping the live extruded layer. The prism's ground edge is now DENSIFIED (~192 perimeter samples, each with its own terrain elevation from the same commit-time batch) instead of using only the drawn corners — corner-only geometry drew straight bottom edges across every groove between vertices — and the terrain-draped footprint stays visible through fills as the prism's conforming interior ground face.
- **Real per-cell volumetric integration** (issue #35 — replaces the v1 flat single-elevation approximation): closing a volume footprint now bulk-loads the DEM tiles covering its bbox (`loadHeightfieldForBounds`, budget-capped with honest zoom coarsening), lays a metric grid over the polygon in a local tangent-plane frame at the ring centroid (cell size = the DEM's ground-sample distance at that latitude — never silently finer than the data; Web Mercator's sec²(φ) area distortion avoided by construction), fills it by scanline point-in-polygon, and integrates terrain-vs-base per cell with bilinear, tile-seam-correct sampling — all in a Web Worker (inline-blob, CDN-safe, same pattern as the COG decoder; synchronous fallback when workers are unavailable). One footprint on undulating ground now reports mixed Cut AND Fill simultaneously, each with a published ±error (per-cell `cellArea × 1.5 × GSD`, summed per side — quoted against the SOURCE's GSD, never the grid spacing), plus cell size, GSD, and a no-data fraction, all on the `om-measure` readout (`cellSizeM`/`gsdM`/`cutErrorM3`/`fillErrorM3`/`nodataFraction`) and in the widget panel (± on the Cut/Fill rows, Base surface/Cell size rows, an under-reporting warning when data is missing). Without terrain, the flat fallback still runs — with no error figures, since there'd be nothing honest to quote.
- **`base-surface` attribute on the measure widget** (issue #35 — "Multiple Base Surfaces"): `custom` (default) keeps the draggable gizmo's target plane — drag frames re-sum the cached per-cell grid synchronously (`reintegrateCustomBase`), so the numbers stay real integration all through the gesture; `triangulated` (Delaunay TIN over densely-resampled boundary elevations — the drone-survey stockpile default, following a pile's toe all the way around), `plane` (least-squares fit), and `lowest`/`highest`/`average` derive the base from the footprint's own boundary — stockpile-style: no gizmo, the volume reports immediately on close. Switching strategies re-integrates against cached tiles (no re-fetch). Validation warns on unknown strategies and on `base-surface` without `"volume"` in `modes`.
- **`terrain-heightfield.ts` is now bilinear and seam-correct**: `elevationAt` interpolates over the four surrounding DEM pixels — across tile boundaries, with the neighbor tiles a tile-edge point needs auto-prefetched — upgrading the elevation profile and vertex sampling for free (previously nearest-pixel). Missing corners renormalize rather than failing the whole sample.
- **Cut/fill volume measurement**: the `measure` widget gains a third mode, `modes="distance area volume"`. Outline a footprint (closes like `area` — double-click or Enter); while flat (no drag yet) it drapes onto the terrain surface exactly like the sketch preview that drew it, then a real 3D double-headed arrow gizmo (an orange cylinder shaft with a cone at each end, one inverted) appears at its centroid — drag it up to fill or down to cut, and it switches to a solid extruded prism at that instant. Reads out `cutMeters3`/`fillMeters3`/`netMeters3`/`totalMeters3` (Net signed fill−cut, Total unsigned cut+fill, each labelled with its own convention) alongside area/perimeter via the `om-measure` event. The gizmo is a FIXED SCREEN-PIXEL size (derived from the current zoom/latitude, not footprint- or drag-relative), so it stays a constant, grabbable size regardless of zoom or how far it's been dragged; the drag distance itself is unbounded — v1 has no real bulk elevation surface to derive a legitimate "how deep can this go" limit from, so there's nothing to clamp against. Requires `terrain` on `<om-map>` — validation warns when `volume` is authored with none. Cut/fill are computed by the real per-cell grid integrator (see "Real per-cell volumetric integration" below) — mixed cut AND fill within one footprint on undulating ground, not a flat single-elevation approximation.
- **Elevation profile, as a volume-mode `profile` attribute** (not a mode of its own): `<om-widget type="measure" modes="distance area volume" profile>` — closing a volume footprint also samples elevation around that same footprint's own perimeter (no separate line to draw) and dispatches it on the `om-measure` event's `profileSeries` field for a `dynamic-chart` widget to plot. Updates LIVE while still sketching, from the very first vertex — resampling immediately on each new vertex and, debounced (250ms), while just hovering the cursor around — not only once the footprint is closed. Validation warns if `profile` is authored without `"volume"` in `modes` (nothing for it to sample a perimeter around).
- **Cut/fill reporting factors** (`density`, `swell`, `shrink`, `deadband` — all volume-mode `measure` widget attributes). `cutMeters3`/`fillMeters3`/`netMeters3`/`totalMeters3` stay RAW geometric volumes — `deadband` (m³) zeroes out a figure below the threshold (drag noise near zero height), but `swell`/`shrink` never touch them, so these four keep answering "does this reach target elevation" regardless of what material's configured. `swell`/`shrink` (default 1×) instead populate two SEPARATE fields, `cutAdjustedMeters3`/`fillAdjustedMeters3`, on the standard Bank/Loose/Compacted earthworks convention: Adjusted Cut = raw × swell (loose/haul volume — excavating adds air voids, so it's bigger than the bank volume removed); Adjusted Fill = raw ÷ shrink (raw fill is already a compacted target-void volume, so the loose/borrow material actually needed is likewise bigger). `density` (t/m³ metric, lb/yd³ imperial) adds `cutMassKg`/`fillMassKg` — computed from the RAW volume, not the adjusted one, since swell/shrink change volume via air voids, not the actual mass of material; a second "adjusted tonnage" would misrepresent the same dirt as weighing differently depending on how it's packed. The widget's readout gets a separate "Material" section for the adjusted/tonnage figures, showing only when at least one of `density`/`swell`/`shrink` is actually configured — no separate on/off toggle, the attribute's presence is the opt-in. A new `stale` boolean on the readout flags the brief window between a footprint committing and its elevation sample resolving, so a consumer never mistakes a prior footprint's leftover numbers for current ones. Validation warns on a non-positive `density`/`swell`/`shrink`, a negative `deadband`, or any of the four authored without `"volume"` in `modes`.
- **`dynamic-chart` widget**: the same Vega-Lite rendering as the existing `vega-lite` widget, but data-driven by a live DOM event instead of a layer — `on="<event-name>"` + `series-field="<name>"` reads `event.detail[seriesField]` as the chart's data on every matching event and redraws at a fixed `width`. A feature "freezes" the chart for free by simply omitting that field on a later event (no separate pause API) — built for the elevation-profile attribute above (a feature that computes its own series live as the user draws and has no layer of its own to bind to), but intentionally generic (no elevation/measurement-specific code) so it's reusable for anything that needs a chart fed programmatically.
- **`geodesy.ts` gains `intermediate(a, b, fraction)` and `resamplePath(points, count)`**: `intermediate` is great-circle interpolation (spherical slerp) between two points; `resamplePath` walks a multi-segment polyline's cumulative length to place `count` evenly-spaced points along it — the elevation profile's sampling backbone. `midpoint()` is now defined as `intermediate(a, b, 0.5)` (same antimeridian-safe behavior, verified unchanged).
- **`terrain-heightfield.ts`: bulk terrain elevation sampling**, now wired to both volume mode's per-vertex/centroid sample and the elevation profile above. The existing `sampleTerrainElevation` is one network fetch per point — fine for volume mode's handful of footprint vertices, wrong for a profile's tens-to-hundreds of samples along a line. `loadHeightfield(points, terrain)` resolves every DEM tile the points touch, fetches and decodes each ONCE (deduplicated, in parallel, with an 8s per-tile fetch timeout), and returns a synchronous in-memory `elevationAt()` lookup — no further network access per sample. Tested entirely against synthetic, known-by-construction DEM tiles (no real ground-truth file needed or used), specifically covering the genuinely new risk vs. the single-point sampler: correctness across a tile SEAM.

### Fixed
- **The spacebar is no longer swallowed page-wide.** The snap-suppression key handler (`<om-map>`'s window-level `keydown`) called `preventDefault()` on the spacebar unconditionally — on every page containing a map, whether or not `snap` was configured, and regardless of what had focus. That broke space-to-scroll (the browser default, and how keyboard-only users page down) and space-to-activate on any focused `<button>`, including this library's own widget buttons. It is now gated on a snap resolver actually being configured, and skips space-activated controls (`button`, `summary`, `a[href]`, `[role=button]`, focusable elements) alongside the existing text-input guard. Snapping's own "hold Space to place a point without snapping" behavior is unchanged where snapping is on.
- **`clip="off"` (the clip box's documented per-layer opt-out) never worked.** It was published in the docs and offered by editor IntelliSense, but was not registered as a layer attribute — so it warned as an unknown-attribute typo, never reached the IR, and the clip box kept clipping the layer the author had explicitly opted out. `snap="off"` had a narrower version of the same problem: registered on only four vector layer types, so it was rejected on a `BIMLayer` — precisely the layer whose edge overlay snapping reads. Both are now registered on **every** layer type, matching their scene-wide defaults, and stripped before deck layer construction like the other OnlyMapJS-only props.
- **Snapping and clip-box attributes are now validated.** `snap`/`snap-tolerance` on `<om-map>` (an unrecognized agent, e.g. the plural `snap="vertices"`, silently left snapping off) and the per-layer `snap`/`clip` opt-outs (any value other than `"off"` is a silent no-op) now produce warnings naming the fix, closing the gap `snapping.ts`'s own doc comment already promised.
- **An antimeridian-crossing volume footprint silently reported 0 m³.** `loadHeightfieldForBounds` computed its tile span as `east - west`, which goes negative across ±180°; the span then passed the tile budget at max zoom and the cover loop produced no tiles at all, which the integrator read as "every cell is no-data." The span now wraps around the world and the cover collects tiles on both sides of the seam.
- **Region export could ship a deleted layer's geometry.** The visible-layer filter excluded a layer only when its `<om-layer>` existed *and* was `visible="false"`; a layer removed from the DOM fell through to *included*, and the tileset registry was append-only so it never aged out. Removal is now detected (and the registry entry dropped) while programmatically-built layers, which legitimately have no element, stay exportable.
- **Snapping no longer invents edges across a `MultiPoint`.** Its members were held in one shared ring, so the `edge`/`midpoint` agents snapped to segments between unrelated points — empty space where no geometry is drawn. Each member now gets its own ring; vertex snapping is unchanged.
- **`base-surface="triangulated"` no longer scales as cells × triangles.** The TIN evaluator tested every triangle's bounding box for every grid cell — ~1.4×10⁸ tests per integration at the 750k-cell budget. Triangles are now bucketed into horizontal bands (indexed by overlap, so a triangle spanning several bands is found from all of them) and a cell only tests its own band's. Results are unchanged.
- **The snap re-pick no longer rebuilds its layer-id list on every pointer move.** It is memoized against deck's layer-array identity, so the filter runs per layer-set change rather than per mousemove.
- **Region export yields a frame before its (synchronous, main-thread) clip and pack**, so the button's own click feedback paints instead of the tab appearing to ignore it. The work itself still blocks — it consumes live `Tileset3D` objects, which can't be handed to a worker the way the volumetrics integrator's decoded tile buffers can — and that limit is now stated in `docs/3d-assets.md`.
- **The "Snapped" tip anchors at the snapped point, at its real height**: the tip's overlay anchored at `[lng, lat]` with an implied z=0, so for an elevated vertex (a wall corner 400 m up) it rendered far from the visible point, drifting with camera pitch. `SnapResult` now carries the matched point's elevation and the tip anchors with it (the overlay's existing 3-component-anchor contract). The tip also hides (`clip-to-map`, opt-in per overlay) when its own box would spill past the map viewport — an overhanging absolutely-positioned box inflates the page's scrollable overflow, and the resulting scrollbar → map resize → reprojection loop was visible as view jitter.
- **`<om-map>` is now its own positioning context** (`position:relative` in the injected defaults layer): overlays and widget chrome are `position:absolute` children positioned in map pixels, and without it they resolved against whatever ancestor happened to be positioned — correct only on pages where that box coincided with the map's own. Author CSS still wins (same `@layer onlymap-defaults`).
- **XY snapping actually finds vertices now** — three independent faults fixed. (1) The resolver only understood GeoJSON-shaped picks, so flat-row layers (CSV/JSON + `get-position`-style accessors — most data) silently never snapped: the layer's own resolved accessors now synthesize the geometry (`get-polygon` → Polygon, `get-path` → LineString, `get-source/target-position` → LineString, `get-position` → Point). (2) Elevated vertices (a BIM model's wall corners) were projected to screen as if at ground level — hundreds of pixels from where they're actually seen, so never within tolerance: vertex elevations now carry through the screen-space tolerance test. (3) `BIMLayer`'s edge/crease overlay rendered at z≈0 regardless of terrain — buried the model's whole elevation below the mesh (and picked as phantoms where nothing visibly was): the outline now rides the same `OrthogonalHeight` placement as the mesh, via `coordinateOrigin`'s elevation component (the matrix is rotation+scale only and silently drops a z).
- **Clicks no longer "pass through" tall content onto the ground behind it**: with snapping on, a click/hover that picks nothing snappable but DOES hit a real (non-terrain) feature now resolves at that feature's own coordinate — depth-aware (`unproject3D`) when the 3D pick pass ran — instead of falling back to the original pick's ray∩ground point far behind a building.
- **Activating the clip box crashed every placed BIM/3D-Tiles sublayer** ("invalid latitude" on each mesh primitive, model gone until reload): `ClipBoxExtension` projected the box's world-anchored lng/lat corners through `Layer#projectPosition`, which applies the layer's own `modelMatrix` — a placed model's meters-scale ENU matrix — to the *input* before interpreting it as lng/lat. The matrix is now suppressed for the corner projection, and a degenerate frame falls back to drawing that layer unclipped (with a one-time console warning) instead of throwing — a draw-time throw makes deck drop the layer entirely.
- **The `draw`/`measure` widgets' own geometry was invisible under an active `terrain`**: every runtime-internal layer was unconditionally forced to `terrain="off"`, so a sketch/measurement's plain `[lng, lat]` vertices rendered at literal sea level — hidden below or behind a raised terrain mesh — instead of draping onto its surface. An internal layer's own explicit `terrain` attribute now wins over that default (other internal layers that never set one, like trace-temps, are unaffected); the shared draw-preview and measure's committed-geometry/label layers opt into `terrain="drape"`.
- **Double-click-to-close on a `draw`/`measure` polygon could silently fail to finalize, or reopen a stray one-vertex shape right after closing**: the native `dblclick` event (which triggers the close) can fire before deck.gl's own click-gesture recognition has settled, so the double-click's own two taps were unreliable as vertices and could arrive late as an independent, unwanted click. Closing now uses the already-reliable hover cursor position as the final vertex instead of depending on the taps, and a stray click landing within a small pixel radius of the just-used closing point is swallowed rather than starting a new shape (a real double-click's two physical taps rarely land at the bit-identical pixel, so this is a proximity match, not exact equality).
- **The volume gizmo could render with its shaft/bottom cone invisible or buried underground**: deck's default lit material shaded faces pointed away from the scene light near-black (fixed via unlit rendering), and the gizmo's rest position extended symmetrically below the surface, occluded by the terrain/fill (fixed by keeping its floor pinned above ground). It's now also sized relative to the footprint instead of a fixed constant, and the extruded prism renders with `wireframe` (vertical struts + top/bottom rings) for both fill and cut.
- **A cut's extruded prism was invisible, including its own starting footprint**: the whole thing sits entirely below the original ground, so the opaque terrain mesh fully occludes it from a normal view — the `wireframe` struts existed but were behind the terrain, and even the prism's own top face (at ground level) was unreliable to see, being nearly coplanar with the terrain mesh. The original footprint now stays visibly shaded (the same green as a fresh/at-rest footprint) throughout a cut; a dedicated depth-test-disabled line layer draws one vertical strut per footprint vertex from ground down to the cut depth plus the closed target-ring boundary at the bottom (unshaded, just an outline) — visible through the terrain, so a cut's shape and depth read visually instead of only through the numeric Cut readout.
- **The extruded volume's base could visibly float above or sink below the terrain on sides away from the footprint's center**: v1 samples one flat elevation at the centroid for the cut/fill math (unchanged, still documented as a v1 simplification — see issue #35), but the rendered base ring now additionally samples each vertex's own real ground elevation, so the footprint's corners hug the actual terrain instead of a single flat plane.
- **The volume readout could claim "sampling elevation…" while the footprint was still an open, unclosed preview**: that state is now distinguished from an actually-closed footprint awaiting its terrain sample; a 3+-vertex preview shows live area/perimeter (matching `area` mode) with no cut/fill numbers until the shape is genuinely closed.
- **Dragging the volume gizmo far enough could make the whole extrusion (and its target-ring boundary) vanish, and cutting kept the gizmo pinned at the original ground instead of tracking the excavation**: root cause was the gizmo's own shaft length scaling with `|heightOffsetM|` with no upper bound, pushing its Z far enough from the scene to plausibly lose float precision in deck's projection. Fixed at the source — the gizmo is now a FIXED SCREEN-PIXEL size regardless of drag distance or zoom (re-derived from the current zoom/latitude on every viewport change, not just on drag/commit) and tracks the current working face symmetrically on both sides (just above the fill top while filling, just below the cut floor while cutting, rather than staying pinned at the original ground). The drag distance itself is no longer clamped at all (an earlier footprint-scaled clamp, and later a flat numerical backstop, were both removed in turn — neither reflected real ground-truth depth, and the float-precision failure mode they guarded against is now fixed at its actual sources: the fixed-pixel gizmo above, plus the `farZMultiplier` fix below).
- **The gizmo became invisible while cutting, immediately after the fix above; then became noticeably smaller and self-occluded oddly when made visible again; then its elevation tooltip disappeared too**: tracking the cut floor means the gizmo (and its tooltip, anchored at the gizmo's own vertical midpoint) sits below ground the same way the cut prism/guide lines do, and was occluded by the opaque terrain mesh the same way they were before their own fix. Disabling depth-testing unconditionally (the first attempt) fixed the occlusion but broke the gizmo's OWN internal self-occlusion — with 3 separate mesh instances (shaft + 2 cones) and no depth test, whichever drew last simply painted over the others regardless of true depth, most visible at closer zoom. The depth-test bypass is now conditional (only while actually cutting, re-evaluated every frame) and shared by the tooltip; the gizmo's fixed size was restored to its original scale (an intermediate fix had shrunk it below what it always was, not just capped its growth at extreme drag distances), then later halved again on request now that its size is a deliberate, tunable constant, not a bug; and `PopupLayer` (the tooltip's underlying layer) gained the same `parameters` passthrough as its earlier `pixelOffset` addition, since depth-test toggling wasn't previously plumbed through the composite layer at all. The tooltip text is now also prefixed `"Elevation: "` so the number isn't ambiguous out of context.
- Added a simple always-on tooltip beside the volume gizmo showing the current drag magnitude as an absolute value (m/ft depending on units) — no more needing to check the widget panel to see how far you've dragged. Cleared by a real screen-pixel offset (a new `PopupLayer` `pixelOffset` override), not a world-space one — a fixed-meters gap shrinks to fewer screen pixels at low zoom than the badge needs, which caused a reported overlap with the gizmo mesh.
- **The gizmo, its target-ring boundary, and its tooltip could all disappear together at high zoom on a deep cut** — a different bug class than the earlier occlusion fixes above: deck's far clipping plane is computed in units that stay roughly constant across zoom levels, while a fixed real-world depth maps to a progressively larger clip-space distance the closer you zoom in, eventually falling outside the camera's view frustum entirely (culled, not merely hidden behind something). The standalone-mode view (the mode `terrain`, and therefore the volume tool, always runs in) now sets `farZMultiplier: 10` — the effective ceiling for this setting, since deck's own horizon-distance cap clamps any higher value to the same result.
- **`DrawController.deleteLast()` never notified observers**, unlike its sibling `clear()` — a controller watching a target (e.g. `measure` in volume mode) kept showing numbers for a shape that had just been deleted, with no later mutation guaranteed to correct them. Now mirrors `clear()`'s own `notify()` call.

## 0.6.1 — 2026-08-06

### Added
- **`ylorrd` joins the curated raster colormaps**: the ColorBrewer yellow→orange→red sequential ramp now renders a proper gradient in the legend (any sprite colormap always rendered on the map; only curated names get legend ramps) and is listed in the docs as the gentler alternative to `turbo`/`jet` for heat-like fields.
- **`selection-type` on `<om-overlay>`** (React: `selectionType` on `<OmOverlay>`): scope a selection-anchored overlay to one pick type — `"click"` or `"hover"`. Fixes the reported ghost-popup bug: a popup wired to open on click re-anchored *and re-interpolated its template* on every hover pick (deck fires hover on all pointer movement), so it followed the pointer onto other features and rendered their objects into the wrong template with blank fields — with no author-side workaround. With `selection-type="click"`, hover picks are inert; a click on empty space still dismisses (empty picks now carry the pointer-event type internally), while hovering empty space no longer does. Absent attribute keeps the old behavior. Validation warns on a typoed value and on `selection-type` without `anchor-from="selection"`; the test harness's `clearSelection()` gains a kind (`"hover"` default, `"click"` for empty-space clicks).
- **BIM / IFC support**: `BIMLayer` loads `.ifc` files entirely in the browser (web-ifc WASM, CDN-fetched + integrity-pinned on first use, never bundled) and renders them as 3D Tiles; per-element **feature picking** on `Tile3DLayer` (`pick-features`, EXT_structural_metadata property tables, texture-backed IDs included); declarative **isolate / hide / ghost** (`feature-filter-field` + `isolate-features`/`hide-features`/`ghost-features`) and **style-by-property** (`feature-color-by`/`feature-color-scale`/`feature-palette`); **multi-model federation** (`ifc-loader federate`) and an AABB **clash-detection overlay**; widgets `ifc-loader`, `ifc-browser`, `feature-inspector` (alias `ifc-inspector`), `ifc-clash`; IFC georeferencing via `IfcMapConversion` (UTM + non-UTM projected CRS, grid-convergence heading correction) with a structured warning when a model's placement can't be trusted.

### Changed
- **Explicit-terrain contract for georeferenced BIM**: the auto-terrain reaction — the library writing `terrain="mapterhorn"` onto the map at load time — was removed as a violation of the what-you-write-is-what-you-see contract. In its place, a model that actually resolves real-world elevation (`IfcMapConversion` + `OrthogonalHeight`) loading on a map with no `terrain` attribute raises a structured **error** through the validation channel (report-only, never a write; any authored value satisfies it, including an explicit `terrain="off"`). Checked at load time against the file's resolved facts, so flat models with no elevation data don't false-positive.
- Same contract for **basemap**: the `ifc-loader` widget no longer switches the map's `basemap` on/off as a side effect of a drop — `<om-map>` scene attributes are author-owned. A georeferenced model landing on a map with no basemap and no terrain raises a structured "no spatial context" warning instead.
- Widgets gained a `destroy` teardown hook; removing an `ifc-loader` (or its map) now releases all loaded-model resources.

### Fixed
- **`ZarrLayer` ignored `select` changes**: writing the `select` attribute (the documented animation path) re-rendered stale cached chunks instead of re-slicing — deck's `TileLayer` only refetches when `updateTriggers.getTileData` changes, and that trigger was never wired. Scrubbing or animating any non-spatial dimension now repaints; the store stays open and cached across frames. Also guards a first-paint race on the same path: the frame drawn right after a re-slice could rasterize the reprojection mesh incompletely and stick (nothing scheduled another frame on an idle map) — one extra redraw is now poked in after the tiles load.

## 0.6.0 — 2026-08-06

### Changed
- **Licensing gate reworked: free-tier caps apply only on hosted http(s) pages.** In a dev context — localhost/loopback, `file://`, any non-web scheme, or headless — every cap (5 layers / 25k rows / 20 MB) lifts entirely. The attribution badge stays in all contexts. The exemption is a technical convenience, not a license grant: commercial deployment (hosted or packaged) still requires a commercial key — enforcement for shipped apps is legal, not technical (LICENSE.md §3).

## 0.5.12 — 2026-08-05

### Added
- This `CHANGELOG.md` — a version-by-version record, shipped in the package and mirror.

### Fixed
- **`highlight-color` was silently inert** with the library's own `highlighted-id` / `highlight-feature` selection: the auto-derive compiled it to a function accessor, but deck's `highlightedObjectIndex` path only honors a plain color array — selections rendered in deck's default navy. It now resolves as a constant color (array or hex), which drives both the programmatic-highlight and hover-highlight paths.

## 0.5.11 — 2026-08-05

### Added
- **`ZarrLayer`** — Zarr / GeoZarr raster layer: chunked N-dimensional array data (climate/weather grids, datacubes) rendered on the GPU (`@developmentseed/deck.gl-zarr` + zarrita, a lazy chunk). `variable` + `select="time=0, …"` pick the slice; a GeoZarr store georeferences itself, a plain Zarr takes manual `bounds`/`crs`/`spatial-dims`; `min`/`max`/`colormap`/`nodata` and the legend reuse the COGLayer pipeline. `src` can point at any public, CORS-enabled remote store — no server setup.

## 0.5.10 — 2026-08-04

### Added
- **Dashed lines** — `dash="[6, 3]"` (or SVG-style `dash="6 3"`, plus `dash-justified`) on path-stroking layers (PathLayer/GeoJsonLayer/PolygonLayer/TripsLayer), wired through deck's `PathStyleExtension`.

## 0.5.9 — 2026-08-04

### Fixed
- Layers now render across the antimeridian and when zoomed out past a single world copy (standalone maps set `MapView({ repeat: true })`). Previously, data near ±180° or a wide zoomed-out view went blank.

## 0.5.8 — 2026-08-04

### Fixed
- **COGLayer** works from a CDN / cross-origin build. Its decode worker is now inlined as a same-origin blob and asset paths are relative (`base: "./"`); previously it rendered nothing on any built page served from a CDN (present since 0.5.2).

## 0.5.7 — 2026-08-04

### Added
- **`ImageOverlay`** — georeferenced drone-JPEG overlay: reads GPS/EXIF + DJI-XMP, computes a flat-ground WGS84 footprint, bakes yaw/roll. `OmMap.resolveImageOverlay(fileOrUrl)` preprocesses once for persistence; explicit `bounds` reconstructs without re-reading EXIF.

## 0.5.6 — 2026-07-31

### Added
- **Safe date formatting** — `formatDate($time, 'datetime', 'UTC')` turns epoch-millisecond/ISO fields into readable `get-text` labels without enabling arbitrary JavaScript; the built-in filter widget shares the contract.

## 0.5.5 — 2026-07-31

### Added
- **GeoParquet** data format (`.parquet` / `.geoparquet`) — cloud-native columnar vector: all-Point files stay columnar, lines/polygons become GeoJSON features; requires the `geo` metadata (WKB) and CRS84/EPSG:4326.

## 0.5.4 — 2026-07-30

### Added
- **GPX** (`.gpx`, waypoints/tracks/routes, `#fragment` part selection) and **FlatGeobuf** (`.fgb`, cloud-native binary vector) data formats.

## 0.5.3 — 2026-07-30

### Added
- **`measure` widget** — geodesic distance and area with live per-segment/total labels, a metric/imperial/nautical units toggle, and an `om-measure` readout event.

### Changed
- Validation flags a data-driven expression (`$field`, `scale()`, …) placed on a scalar attribute — the silent "invisible layer / black squares" trap.

## 0.5.2 — 2026-07-29

### Changed
- Made `om-map-point` (raw map click/hover capture) discoverable by task in the skill and `llms.txt`, steering agents away from poking deck.gl internals.

## 0.5.1 — 2026-07-29

### Added
- **Tiled layers** — `{z}/{x}/{y}` `data` templates for `TileLayer`/`MVTLayer` (raster templates get a built-in `BitmapLayer` sublayer; MVT self-renders with `get-*` accessors on decoded features).

## 0.5.0 — 2026-07-28

### Added
- **CityJSON / CityJSONSeq** ingestion — semantic 3D city models decoded to extruded footprints, or per-face surfaces with `?om-surfaces=1`; national coordinate grids reproject automatically.
- First-shot layout guardrail: a bare `<om-map>` with no author height still renders (injected `display:block` default + 400px floor + an actionable console warning when it still collapses).

### Changed
- The free-tier per-layer row cap now truncates to the first rows with a dismissible on-map notice instead of hard-dropping the layer.

## 0.4.x — 2026-07-22…27

### Added
- Managed, adaptive **widget layout**: eight logical `position` slots, same-slot stacking with shared gaps, compact-button clustering, automatic folding into drawers on narrow maps, and the `check-layout` CLI that audits a manifest's widget layout in headless Chromium.

### Fixed
- Post-publication review hardening across the layout and widget features.

## 0.3.x — 2026-07-16…

### Added
- Native **GeoTIFF / Cloud-Optimized GeoTIFF raster** layer (`COGLayer`) with `min`/`max` rescale and bundled colormaps.
- A full 3D scene from attributes: `terrain`, scene `lighting`, and canvas `snapshot()`.
- CDN-delivery posture: a single-file standalone bundle plus raw-file-CDN guidance.

## 0.2.x

### Added
- The v0.2 format registry: CSV/TSV (typed columns), Shapefile (+`.dbf`), KML, and Apache Arrow / GeoArrow (a columnar fast path).
- First public npm release of `@nika-js/onlymap`.

## 0.1.x

### Added
- The initial declarative core: `<om-map>` / `<om-layer>` / `<om-widget>` / `<om-overlay>` / `<om-behavior>`, the manifest reconcile loop, the `get-*` accessor expression compiler, and MapLibre basemaps — no build step, no imperative deck.gl code.
