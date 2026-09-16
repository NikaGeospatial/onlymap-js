# RESOLVED — per-feature trace link failure was schema-default array aliasing

Root cause (found by birth-tagging arrays + in-browser constructor
instrumentation): schema descriptors carry deck's own defaultProps values,
and the defaults pass assigned container defaults (`extensions: []`) BY
REFERENCE — one shared array per layer type, mutated by every layer's
extension push. A trace temp that verifiably skipped filter wiring still
built with a DataFilterExtension from the polluted shared array; with the
extra attributes the temp TripsLayer's pipeline exceeded the vertex-
attribute budget on Metal-ANGLE and failed to link ("Too many attributes
(instancePickingColors)") — traces swept their clock invisibly. Parse
order decided the pollution, hence the non-determinism, and hence
"the story-map example traces fine" (no categorical filters there).

Fix: `cloneDefault` — schema defaults assigned by value in BOTH front-ends
(attribute-resolution + programmatic). Regression tests pin independence
of per-layer extensions arrays in both lanes. The trace-temp filter-skip
and rounded-cap variant from the investigation are kept as hardening.
Verified: zero link errors across full probe runs; outlines draw visibly
(dev/.probe-atlas-draw1.png).
