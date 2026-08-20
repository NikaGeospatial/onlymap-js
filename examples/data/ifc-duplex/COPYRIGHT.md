# Duplex Apartment — buildingSMART community sample

Source: https://github.com/buildingsmart-community/Community-Sample-Test-Files/tree/main/IFC%202.3.0.1%20(IFC%202x3)/Duplex%20Apartment

Licensed under the Creative Commons Attribution 4.0 International License
(CC-BY 4.0): https://creativecommons.org/licenses/by/4.0/

(C) buildingSMART International Ltd.

## Files

- `Duplex_A_20110907.ifc` — the ORIGINAL source model, unmodified, kept for reference.
- `model.glb` + `tileset.json` — converted output rendered by the example.
- `metadata.json` — the property table, mirrored as a sidecar so a page can
  enumerate features (the runtime resolves properties only for the picked
  feature; see the example's header comment).

## Modifications

The `.ifc` is byte-identical to the source. The converted 3D Tiles output is a
derived work: geometry triangulated and grouped one primitive per material,
per-element feature IDs added as `EXT_mesh_features`, an
`EXT_structural_metadata` property table added, and the tileset re-georeferenced
to San Francisco (the source placement is local model coordinates with no geographic reference).

