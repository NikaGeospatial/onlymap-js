# Load-paced ("clean") flyby — design, informed by the warm-tiles A/B data

> **Status: IMPLEMENTED** — `<om-story paced>`; `src/paced-flyby.ts` (pure
> driver) + `cameraAtTime`/`buildCameraLegs` in `src/tile-warm.ts`; see the
> architecture doc's dated entry 110.

Goal: a flyby where no frame ever shows unrefined tiles. Wall-clock runs
longer; output is clean by construction. (Monitor data: Google P3DT flight
needs ~970 fine tiles; pre-warming covered ~3% — pacing is the real cure.)

## Key architectural fact (why this is NOT just "pause the story clock")
Story fly-to steps dispatch ONE camera action with a duration; the camera
then animates inside deck/maplibre independent of story elapsed time.
Pausing the story clock does not hold the camera. The pace driver must own
the camera per frame.

## Design
`<om-story paced>` (or recorder option): a driver that replaces wall-clock
play with manual stepping:
1. Build the same camera keyframes tile-warm.ts extracts; interpolate with
   flyToViewport per step's own duration -> cameraAt(t) (pure; reuse
   sampleFlightViewports math, parameterized by t not sample index).
2. Loop: t += frameInterval (e.g. 1000/30). setViewInternal(cameraAt(t))
   (instant camera set — the harness setView path, not a transition), then
   story.seek(t) for non-camera actions (manualClock mode), then WAIT:
   every live tileset (core.getLiveTilesets) must report isLoaded() before
   advancing. rAF-align each advance.
3. om-paced-tick {t, waitedMs} event per frame -> the recorder (#16) hooks
   here; a progress UI can show "paused for tiles".
4. End: story "ended" state as normal; camera restore via existing capture.

## Gotchas recorded for the implementer
- Suppress interrupt="pause" gesture listeners during a paced run (GL tour
  precedent, already noted in #16).
- isLoaded() needs the CURRENT viewport selection to have been issued —
  after setViewInternal, wait one deck update (the om-tiles-warmed probe
  showed selection lags a frame; sleep(0)+rAF is enough).
- tile-warm's destination warming composes: warm first, then paced play
  waits far less.
- Tests: manualClock + fake tileset isLoaded toggling; e2e via the existing
  demo page + monitor (flight loads > 0 but zero frames advanced while
  !isLoaded — assert via om-paced-tick waitedMs sum > 0).
