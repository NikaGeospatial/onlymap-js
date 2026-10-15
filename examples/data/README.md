# Example data

Sample datasets used by the OnlyMapJS examples. They exist to make the examples
runnable and are not part of the library.

**These files are not covered by the repository licence.** Each keeps the terms
of the source it came from. Where those terms require credit, the example that
uses the data renders it on the map — if you copy a file into your own project,
carry the credit with it.

## Attribution

**Natural Earth** — country outlines and populated places, including the British
National Grid copies under `gb-grid/` (converted with GDAL). Public domain.
`london-great-circles.json` is computed, not sourced: great-circle paths from
London to eleven Natural Earth cities, sampled every 1.5°.

**geoBoundaries** — `singapore-region-countries.geojson` carries Singapore's
outline from the geoBoundaries ADM0 release (simplified), which derives from
the Urban Redevelopment Authority's planning boundaries; ODbL. The Johor and
Riau coasts in the same file are Natural Earth 10m, cut to the region.

**U.S. Geological Survey** — earthquake feeds. Public domain.

**NOAA** — tropical cyclone tracks (IBTrACS) and the Storm Prediction Center
tornado database. Public domain.

**NASA** — night-lights imagery from GIBS / VIIRS Black Marble. Public domain;
NASA requests acknowledgement.

**AWS Terrain Tiles** — elevation samples derived from SRTM and ASTER. Public
domain.

**World Resources Institute** — the Global Power Plant Database v1.3 and the
spatial-index cell files binned from it. © World Resources Institute,
CC BY 4.0.

**3DBAG** — Dutch 3D building models. © 3DBAG (3dbag.nl), CC BY 4.0.

**Copernicus DEM**, via the Open-Meteo elevation API — trail elevations.
CC BY 4.0.

**OpenStreetMap** — Alpine summits, huts, trails and borders around Zermatt;
the Singapore rail network; and road-snapped routes generated with OSRM.
© OpenStreetMap contributors, ODbL.

**buildingSMART International** — the IFC/BIM sample models under
`ifc-clinic/`, `ifc-duplex/`, `ifc-bridge/` and `ifc-utm-scale/`.
© buildingSMART International Ltd., CC BY 4.0. Each directory carries its own
`COPYRIGHT.md` naming the exact source file, licence, and any modifications —
that per-directory record is the authoritative one for BIM assets, and any new
model added here must ship with one.

ODbL asks that a publicly distributed derived database stay under ODbL. That
applies to the OpenStreetMap-derived files here, not to OnlyMapJS.
