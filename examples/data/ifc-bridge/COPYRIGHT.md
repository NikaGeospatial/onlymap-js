# Infra-Bridge — buildingSMART IFC 4.3 PCERT sample scene

Source: https://github.com/buildingSMART/Sample-Test-Files/tree/main/IFC%204.3.2.0%20(IFC4X3_ADD2)/PCERT-Sample-Scene

Licensed under the Creative Commons Attribution 4.0 International License
(CC-BY 4.0): https://creativecommons.org/licenses/by/4.0/

(C) buildingSMART International Ltd.

## Files

- `Infra-Bridge.ifc` — the ORIGINAL source model, unmodified, kept for reference.
- `model.glb` + `tileset.json` — converted output rendered by the example.
- `metadata.json` — the property table, mirrored as a sidecar so a page can
  enumerate features (the runtime resolves properties only for the picked
  feature; see the example's header comment).

## Modifications

The `.ifc` is byte-identical to the source. The converted 3D Tiles output is a
derived work: geometry triangulated and grouped one primitive per material,
per-element feature IDs added as `EXT_mesh_features`, an
`EXT_structural_metadata` property table added, and the tileset re-georeferenced
to San Francisco (the source placement is EPSG:32760 coordinates in open ocean near the antimeridian).

