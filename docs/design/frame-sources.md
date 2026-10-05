# Frame sources — what a cartograph frame shows, and where

Design for `<om-frame>`'s source resolution: **one ordered mechanism** in place of a
live `src` with a bolted-on rescue, so a sheet renders correctly in the editor that
wrote it, in a browser that has never heard of the host app, and in an export.

**Versions are assigned at release, not here.** This first read as a minor — a new public
element plus a changed definition of frame readiness. It shipped as a PATCH (0.10.6),
because the readiness change turned out to affect no existing document: a frame with one
source has nothing to fall through to, so it behaves exactly as before, and there is a test
asserting it. What remains is purely additive. The rule this repo actually gates a minor on
— the bundled deck.gl/luma.gl pin moving — is untouched, and precedent agrees: 0.10.5
shipped two new attributes AND a changed default that altered how existing manifests
render, as a patch.

---

## 1. The observation this rests on

A generated A3 plate — Albers CONUS, relief, coastal vignette, curved river labels —
validated clean and rendered correctly in the host app's editor. Opened as a file it
showed a blank frame surrounded by correct furniture.

Tracing it gave a result that invalidates the obvious fix:

| step | outcome |
|---|---|
| `src="../maps/map-bd54….html"` from the cartograph's own directory | **resolves** — it is a real relative path |
| the map document loads | **succeeds** |
| its layers, on `nika-file://localhost/…` | fail — a host-registered protocol that exists only inside the app |
| its `basemap="none"` | nothing to fall back on |
| the frame | mounts a map with zero drawable layers and reports success |

### It fails two different ways, and only one of them is loud

The trace above is the file:// case. The host app's own PREVIEW fails differently, and
finding that out changed what the readiness test has to cover.

| context | `src` resolves? | outcome |
|---|---|---|
| opened from the cartograph's own directory | yes — a real relative path | map loads, layers fail on the host protocol → **silent blank frame** |
| the app's HTML preview, before it was fixed | on disk yes, in the URL no — the preview served the sheet through a scheme that percent-encoded its whole path into ONE URL segment, so `../maps/…` resolved to the scheme root | → **loud 404** |

Two symptoms that need different detection, and — as it turned out — two different root
causes. The loud one was never the sheet's fault: the host served it from a URL whose
whole filesystem path was one percent-encoded segment, so `../maps/…` resolved to the
scheme root and no relative reference of any kind could work. That is fixed in the host,
where it belongs (§10), and it is why the flat preview cache this section first blamed was
a red herring — the preview serves the ORIGINAL file, in its own directory.

The silent one is the real subject of this design, and the reason readiness cannot be
defined on loading.

A design that only handled the loud case would look correct in the preview, where it is
most often seen, and do nothing in the file the user actually sends to someone.

**The silent failure.** `showPlaceholder("load-failed")` never runs, because nothing
failed in the sense the frame checks for. A raster fallback hung off the error path —
the design this document replaced — would have sat unused while the sheet showed a blank
box. It would have been a mechanism that does not fire in the only case it exists for.

The generalisation matters more than the instance. Outside the host app the live path
does not *sometimes* fail; it fails essentially always, because both halves of it are
app-local: a relative path into the host's storage, and a custom protocol for the data.
So "fallback" misnames it. Outside the app a capture is not the rescue, it is the only
thing that can render, and a design that treats it as exceptional has the priority
backwards.

## 2. What is wrong with the current model

`src` names **one** source and assumes it works. Three contexts need three answers, and
today two of them are served by machinery outside the element:

- the editor, which has the app protocol and the sibling map — the live path;
- a stored file opened anywhere else — nothing;
- an export, where the host inlines the map, embeds its layer data, and deletes `src`.

The export path proves the point: it exists precisely because `src` cannot survive
leaving the app. It is a second resolution strategy implemented in the host rather than
in the element, which is why the element cannot degrade on its own.

## 3. The model: ordered sources

A frame declares its sources in priority order and takes the first that **renders**.

```html
<om-frame id="main" center="[-96, 38]" zoom="3.25">
  <om-source src="../maps/map-bd54….html"></om-source>
  <om-source src="captures/main@2x.png" corners="[[…],[…],[…],[…]]" crs="EPSG:5070"></om-source>
</om-frame>
```

- `src=` on the frame stays as shorthand for a single `<om-source src=…>`, so every
  existing document keeps working and the common case stays one line.
- **One attribute for both kinds: `src`.** A map document and a raster are both "where
  this frame's picture comes from", and two attribute names would make the author state
  a thing the file extension already says. The kind is read from the extension — `.html`
  is a map document, an image extension is a raster — and an unrecognised one is a
  validation error naming both, rather than a silent guess. `corners`/`crs` appearing on
  a source is what makes it georeferenced, which is orthogonal to its kind.
- **The frame states which source it settled on**, as an attribute reflecting the
  resolved index and a `om-frame-source` event. A capture shown silently is its own
  trap: an editor should be able to say "showing a capture from 12 March", and F6's
  concern about masking a broken map depends on the choice being visible.
- Order is document order. No scoring, no heuristics about the environment: a source
  either rendered or it did not, and the frame moves on.
- A raster source carries the georef that was true **when it was captured** — the same
  thing `freeze()` already stamps onto a frame — so furniture is correct even when the
  live map never loaded and its CRS is therefore unknowable. Deriving corners from the
  authored camera via `cornersFromCamera` was considered and is Mercator-only, so it is
  wrong for exactly the projected sheets this feature is for.

Each context then gets the right answer with no special case:

| context | resolves to |
|---|---|
| the editor | the live map |
| a stored file, opened anywhere | the capture — a correct picture, not a blank box |
| an export | the map inlined; no `src` to resolve |

## 4. The hard part: what "rendered" means

This is the whole design. "Loaded" is not enough — the failure above loaded fine.

A source has rendered when the frame can show something a reader would recognise as the
map. The proposed test, in order of preference:

1. **At least one drawable layer after settle.** The frame already awaits
   `mapEl.whenSettled?.({ timeout: 20_000 })`; the map already tracks layer readiness.
   Zero drawable layers after settle is observable, needs no cooperation from the map,
   and covers the `nika-file://` case exactly — every layer's fetch failed, so none is
   drawable.
2. A basemap counts as drawable. A map that is deliberately only a basemap is a
   legitimate frame, and `basemap="none"` is what made the instance above empty.
3. **Not** "every layer loaded". A sheet whose fifth layer 404s is degraded, not failed,
   and silently swapping it for a stale capture would be worse than showing it.

The bar is deliberately low — *something* drew — because the alternative is the frame
adjudicating cartographic quality, which it cannot do and should not try.

### The timing cost

A source that fails by rendering nothing costs a full settle before the next is tried,
up to the existing 20 s timeout. That is acceptable for the stored-file case, which is
one-shot, and invisible in the editor, where source 1 succeeds. It is not acceptable to
pay it on every frame of a paced flyby — but a flyby drives a live map, not a cartograph
frame, so the path is not shared.

## 5. Caveat register

| # | Caveat | Resolution |
|---|---|---|
| F1 | The failure has TWO shapes: silent from file:// (map loads, draws nothing) and, formerly, a loud 404 in the app preview, whose URL shape broke the relative `src`. A design fitted to the loud one looks right where it is most often seen and does nothing in the file that gets sent to someone | readiness is defined on drawable layers, not on load, so both shapes resolve to the next source. The loud shape was a HOST bug and is fixed there (§10) — which leaves the silent one as the case this design must carry, exactly as argued |
| F2 | A raster's georef cannot be derived when the live map never loaded, because its CRS comes from that map | the capture carries `corners` + `crs`, as `freeze()` already writes them |
| F3 | `cornersFromCamera` needs only the core module and the authored camera — tempting as a no-new-attributes answer | it builds a `WebMercatorViewport`, so it is wrong for any projected sheet, which is the case this serves |
| F4 | Validation forbids `corners`/`crs` on a LIVE frame, for good reason — a live frame derives them | the attributes move to `<om-source>`, where they describe that source rather than the frame |
| F5 | A failed source costs a full settle before the next is tried | one-shot contexts only; no cartograph frame is on a per-frame animation path |
| F6 | Ordered sources could mask a genuinely broken map in the editor, where the author wants the error | the editor is source 1 and reports its own failure; a later source is reached only after source 1 has demonstrably drawn nothing, and the frame should say which source it settled on |
| F7 | Captures go stale against the map they came from | out of scope here; a host that stores captures already versions them, and that is where staleness belongs |

## 6. Alternatives considered

**A raster hung off the error path.** The original proposal, and wrong: the failure it
exists for is silent, so it would never fire. Recorded because the reasoning is not
obvious until the resolution is actually traced.

**Always inline the map on write.** What export does, and it genuinely works — but it
duplicates the map into every sheet on every autosave, and gives snapshot semantics
where `src` deliberately gives live ones. Edits to the map would stop reaching the
sheet, which is the reason `src` exists.

**Detect the environment.** "Am I in the host app?" is not knowable from the element, and
a document that behaves differently depending on where it is opened is worse than one
that tries sources in a stated order.

## 7. Non-goals

- Deciding whether a capture is out of date. F7.
- Making `nika-file://` resolve outside its host. That is the host's protocol and its
  business; this design is about surviving its absence.
- Choosing a source by quality, resolution or size. Order is the author's statement of
  preference, and adding scoring would make the result depend on the environment again.

## 8. Acceptance

- A sheet whose live source draws nothing renders its capture, not a blank box — tested
  against the real failure: a map on a host-local protocol, loaded successfully, with
  zero drawable layers.
- A sheet whose live source works is unchanged, and pays nothing for the mechanism.
- Furniture is correct on whichever source won, which means `om-frame-view` fires on a
  source switch (see §9, `arrows.md`).
- An existing `src=` document renders identically, with no edit.
- The frame states which source it settled on, so a capture is never shown silently.

## 9. Decisions

1. **The frame reports which source it settled on.** An attribute plus an
   `om-frame-source` event. Silence would make a capture indistinguishable from a live
   map, and F6 depends on the choice being visible.
2. **One attribute, `src`, for both kinds**, with the kind read from the extension. Two
   names would restate what the filename already says, and a `type` buys extensibility
   that no third kind is asking for yet.
3. **Captures are relative paths in the stored document, embedded at export.** Keeps the
   stored file readable and diffable, and export already embeds rasters, so the split follows machinery that exists.

   The consequence must be stated rather than discovered: a stored cartograph is then
   **renderable in place, not portable**. Moving the file alone breaks its captures, the
   same way it breaks its `src` today. Export is what produces a file that survives
   being sent to someone. This belongs in the cartograph skill — the word "standalone"
   has already misled once, when it described a document whose head had no runtime.

## 10. Adjacent designs, deconflicted

- **`carto-substrate.md` §7 (freeze to vector)** — `freeze()` converts a live frame to a
  static one, writing `corners` + `crs`. This design reuses that georef contract for a
  raster source rather than inventing a second one; freeze remains the way a frame stops
  being live at all.
- **`arrows.md`** — NOT untouched, as a first pass assumed. It depends on furniture
  re-rendering when `om-frame-view` fires (`om-cartograph.ts:81`) and on the frame
  footprint `overview-of` computes (`om-frame.ts:452`). Settling on a different source
  changes the frame's georef, so **a source switch must fire `om-frame-view`** — an arrow
  or a graticule left on the previous source's georef is the same class of silent wrong
  output this design exists to remove. Added to the acceptance bar below.
- **`extensions.md`** — no interaction found; it names no frame and no source.
- **The host's preview URL** — a previewed page
  is now served with its path separators intact, so a relative `src` resolves against the
  sheet's own folder, and each document a frame names is approved on open. That removes
  the loud shape in F1 and is a prerequisite for `src` being meaningful in the app at all.
  It does nothing for a sheet opened outside the app, which is what §3 is for.
