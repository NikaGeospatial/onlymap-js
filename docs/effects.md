# Post-process effects — `<om-effect>`

> **Available in 0.9.0.** `<om-effect>` children of `<om-map>` **are** deck.gl's
> `effects` array. Document order is pipeline order, exactly as it is for
> `<om-layer>`.

A post-process pass runs over the *finished* frame: deck draws the map, then each
effect treats the resulting picture. That makes it the right tool for a **look** —
a printed finish, a duotone plate, a night treatment — and the wrong tool for
anything that needs to know about features, which belongs in a layer's accessors.

```html
<om-map center="[-98.5, 39.5]" zoom="4" basemap="none">
  <om-layer id="land" type="GeoJsonLayer" data="./countries.geojson" color="#2a3142"></om-layer>
  <om-effect preset="vintage"></om-effect>
</om-map>
```

Runnable: [`examples/features/styling/apply-a-print-finish.html`](../examples/features/styling/apply-a-print-finish.html).

## Three lanes, one per element

Each `<om-effect>` picks exactly one:

| Lane | Looks like | Use it when |
|---|---|---|
| Preset | `<om-effect preset="vintage">` | You want a finish and not a shader |
| Op + knobs | `<om-effect op="grain" amount="0.1" size="0.2mm">` | You want to compose or tune |
| Inline module | `<om-effect><script type="application/json">{…}</script></om-effect>` | You want raw GLSL |

The inline lane is the **1:1 deck surface** — deck gives you
`PostProcessEffect(module, props)` over an ordered array, and that is exactly what
is passed through, untouched. The other two lanes are convenience over it.

The module rides an `application/json` script on purpose: that is the one script
type a cartograph's adoption sanitiser keeps, so an effect survives into a print
sheet.

## Presets

`vintage`, `engraved`, `night`, `blueprint`, `riso`, `newsprint`, `muted`.

A preset is **a saved op list and nothing more**. Override a single knob with
`<op>-<param>`, the same shape `lighting-sun-azimuth` has:

```html
<om-effect preset="vintage" grain-amount="0.02"></om-effect>
```

To stop using the preset as a black box, eject it:

```js
OmMap.expandPreset("vintage")
// → '<om-effect op="tint" paper="#efe4c8" ink="#2b1b10" …></om-effect>…'
```

That string is the markup the preset stands for — paste it in place of the
`preset` attribute and tune the ops directly. (The validator's own fix strings
point you here when you misspell an override.)

## Ops

`kind` decides cost, not quality — see [Passes](#passes-and-cost).

### Pointwise (fuse together, one pass for any number of them)

| Op | Knobs (default) |
|---|---|
| `tint` | `paper` (#f3eee2), `ink` (#1a1612), `amount` (1), `keep-color` (1) |
| `levels` | `brightness` (0), `contrast` (1), `gamma` (1) |
| `saturation` | `amount` (1 — 0 greyscale, >1 boosted) |
| `posterize` | `levels` (6 — steps per channel) |
| `vignette` | `amount` (0.4), `radius` (0.65), `softness` (0.45) |
| `grain` | `amount` (0.06), `size` (0.12mm), `seed` (1), `mono` (1) |

### Neighbourhood (each costs its own pass — they sample their surroundings)

| Op | Knobs (default) |
|---|---|
| `edges` | `amount` (0.5), `width` (0.08mm), `color` (#1a1612) |
| `blur` | `radius` (0.2mm) |
| `sharpen` | `amount` (0.5), `radius` (0.1mm) |
| `halftone` | `cell` (0.6mm), `angle` (15deg), `amount` (1), `paper` (#ffffff) |

## Millimetres, not pixels

Every knob that describes a **size** is in millimetres, and a bare `px` value is a
validation error rather than a silent trap.

The reason is print. A grain keyed to device pixels is one device pixel at every
resolution — so on a 4× plate it renders four times finer than on screen, and the
look you approved quietly disappears exactly where it matters most. Millimetres
resolve against the live pixel density through a `pxPerMm` uniform, so a capture at
600 dpi re-points one number and keeps the same physical grain.

```html
<om-effect op="grain" size="0.12mm"></om-effect>   <!-- 0.12mm on screen AND on paper -->
```

Angles take `deg`. Unitless numbers are accepted for lengths and read as mm.

> **Resolution floor.** A cell smaller than one device pixel cannot be drawn, so
> very fine values clamp. At 1× (~3.8 px/mm) anything under ~0.26mm is at the
> floor; at 2× it is ~0.13mm. If a look must hold its exact physical size across
> display scales, keep spatial knobs above those values.

## Passes and cost

Consecutive **pointwise** ops compile into one fragment function and therefore one
GPU pass. A ten-knob colour chain costs a single pass. Only a **neighbourhood** op
starts a new one.

```html
<!-- ONE pass -->
<om-effect op="tint" ink="#102030"></om-effect>
<om-effect op="levels" contrast="1.2"></om-effect>
<om-effect op="grain" amount="0.08"></om-effect>

<!-- THREE passes: the halftone breaks the run -->
<om-effect op="tint" ink="#102030"></om-effect>
<om-effect op="halftone" cell="0.5mm"></om-effect>
<om-effect op="grain" amount="0.08"></om-effect>
```

Knobs stay uniforms rather than being baked into the shader, so a widget or a
story step can move one without recompiling anything.

## Inline shader modules

```html
<om-effect uniforms='{"strength": 0.4}'>
  <script type="application/json">
  {
    "name": "myEffect",
    "fs": "vec4 myEffect_filter(vec4 color, vec2 texSize, vec2 texCoord) { … }",
    "passes": [{ "filter": "myEffect_filter" }]
  }
  </script>
</om-effect>
```

Requirements: `name` (string), `fs` (string), and a non-empty `passes` array. Each
pass names a function that `fs` **must actually declare** — deck compiles a missing
one to an empty shader that draws nothing while reporting success, so the validator
checks it for you.

A module's `name` is its identity. If you edit the shader, change the name too, or
the renderer may keep the previous program.

## Changing effects at runtime

```html
<om-behavior on="click" action="set-effect" preset="night"></om-behavior>
```

`set-effect {preset}` writes one `<om-effect preset>` child — a plain document
mutation, so **undo/redo** see it like any other edit. Knob overrides ride as
`<op>-<param>` keys: `{ preset: "vintage", "grain-amount": 0.02 }`.
`{ preset: "none" }` removes it. A hand-composed op chain is left alone.

For a switcher your users can see, `<om-widget type="effects">` renders one radio
per preset plus **Off**, and emits exactly that action:

```html
<om-widget type="effects" position="top-right" title="Finish"></om-widget>
```

The widget holds no state. It writes the document and reads it back, so a hand
edit, an undo, or an agent changing the preset moves the radio too — the same
contract `<om-widget type="lighting">` follows.

> **Not story-rewindable yet.** A story step can apply a finish, but seeking back
> will not remove it: story rewind restores `<om-map>` attributes, and this action
> adds a child element. Element-level capture is a follow-up.

Programmatically, `MapController.setEffects(effects | null)` takes deck `Effect`
instances directly and outranks the document's chain while set; `null` hands the
chain back, and `[]` renders no effects at all.

## What the validator catches

`OmMap.validate` (and `<om-map validate>`) reports, each with a fix:

- an unknown `preset` or `op`;
- a knob that op does not have, and an override aimed at an op the preset lacks;
- a **pixel** value in a spatial knob;
- an inline module whose `passes` name a function its `fs` never declares;
- an `<om-effect>` that is not a direct child of `<om-map>` — nested deeper it is
  never applied;
- more than one lane on one element.

It also **warns** when the map has a MapLibre basemap: a pass runs over deck's own
framebuffer, so the basemap composites underneath and stays untreated. Use
`basemap="none"` and draw the base as layers when the finish should cover
everything.

## Bundle cost

None, unless you use it. Op metadata (for validation, IntelliSense and preset
expansion) lives in the core bundle; the GLSL is a separate chunk fetched only when
a map actually has an effect. A map with no `<om-effect>` never downloads the
shader library — pinned by a browser test.

## Not in 0.9.0

`lut` — a colour lookup image, the highest-leverage op and the most data-first. It
needs texture bindings, async asset loading and device lifecycle, so it gets its own
release rather than being crammed into this one.
