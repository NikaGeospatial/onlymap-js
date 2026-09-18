/**
 * Generates the GeoParquet test fixtures in this directory. The committed
 * `.parquet` files are binary and can't be eyeballed in a diff, so this script
 * is how they're made and re-made.
 *
 * The writer (`hyparquet-writer`) is NOT a normal devDependency — it's only
 * needed to regenerate fixtures, so install it just for the run:
 *
 *   npm i -D hyparquet-writer@0.16.1
 *   node dev/data/gen-parquet-fixtures.mjs
 *   npm remove hyparquet-writer
 *
 * Fixtures produced:
 *   sample-points.parquet    3 Point cities, GZIP row groups. GZIP is NOT
 *                            hyparquet's built-in codec (snappy is), so this
 *                            fixture forces decode through hyparquet-compressors
 *                            — proving that dependency is actually exercised.
 *                            → columnar transpose.
 *   sample-polygons.parquet  2 Polygons with an `id` column, SNAPPY → feature
 *                            rows + RFC 7946 id hoist.
 *   sample-nogeo.parquet     plain table, no `geo` metadata → structured error.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parquetWriteBuffer, geojsonToWkb } from "hyparquet-writer";

// The writer ships only a SNAPPY compressor; supply GZIP (Node zlib) so a
// non-snappy fixture exists. Parquet's GZIP codec is standard gzip.
const GZIP_COMPRESSORS = { GZIP: (bytes) => gzipSync(bytes) };

const HERE = dirname(fileURLToPath(import.meta.url));
const out = (name, buf) => {
  writeFileSync(join(HERE, name), Buffer.from(buf));
  console.log(`${name}: ${buf.byteLength} bytes`);
};
const geoMeta = (types) =>
  JSON.stringify({ version: "1.1.0", primary_column: "geometry", columns: { geometry: { encoding: "WKB", geometry_types: types, crs: null } } });

// --- points (ZSTD) → columnar transpose ---
const pts = [
  { city: "San Francisco", pop: 873965, coord: [-122.4194, 37.7749] },
  { city: "Paris", pop: 2103000, coord: [2.3522, 48.8566] },
  { city: "Tokyo", pop: 13960000, coord: [139.6917, 35.6895] },
];
out(
  "sample-points.parquet",
  parquetWriteBuffer({
    columnData: [
      { name: "city", data: pts.map((p) => p.city), type: "STRING" },
      { name: "pop", data: pts.map((p) => p.pop), type: "INT32" },
      { name: "geometry", data: pts.map((p) => geojsonToWkb({ type: "Point", coordinates: p.coord })), type: "BYTE_ARRAY" },
    ],
    kvMetadata: [{ key: "geo", value: geoMeta(["Point"]) }],
    codec: "GZIP",
    compressors: GZIP_COMPRESSORS,
  }),
);

// --- polygons (SNAPPY) → feature rows + id hoist ---
const polys = [
  { id: 10, name: "West", ring: [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]] },
  { id: 20, name: "East", ring: [[3, 0], [5, 0], [5, 2], [3, 2], [3, 0]] },
];
out(
  "sample-polygons.parquet",
  parquetWriteBuffer({
    columnData: [
      { name: "id", data: polys.map((p) => p.id), type: "INT32" },
      { name: "name", data: polys.map((p) => p.name), type: "STRING" },
      { name: "geometry", data: polys.map((p) => geojsonToWkb({ type: "Polygon", coordinates: [p.ring] })), type: "BYTE_ARRAY" },
    ],
    kvMetadata: [{ key: "geo", value: geoMeta(["Polygon"]) }],
    compression: "SNAPPY",
  }),
);

// --- plain table, no geo metadata → structured error ---
out(
  "sample-nogeo.parquet",
  parquetWriteBuffer({
    columnData: [
      { name: "city", data: pts.map((p) => p.city), type: "STRING" },
      { name: "pop", data: pts.map((p) => p.pop), type: "INT32" },
    ],
  }),
);
