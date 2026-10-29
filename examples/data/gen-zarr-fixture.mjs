/**
 * Generates the `sample.zarr` test/demo fixture from REAL data — a small slice
 * of ECMWF IFS ENS 2m-temperature (°C) forecast, re-chunked into a lightweight,
 * committable Zarr v3 store.
 *
 * The public source (Dynamical.org / source.coop) shards `[1,85,51,32,32]` — all
 * 85 lead-times × 51 ensembles in every spatial shard — which is great for
 * animating the forecast but decodes ~1.78 GB per tile for a single frame. So
 * this reads one region + a few lead-times ONCE here (Node) and writes a small
 * store chunked one frame at a time, which the browser can render trivially.
 *
 * The output is NOT GeoZarr-compliant; the demo georeferences it through the
 * manifest's manual `bounds`/`crs`/`spatial-dims`, exactly the path real-world
 * (non-GeoZarr) public Zarr needs.
 *
 * Run: node --max-old-space-size=4096 dev/data/gen-zarr-fixture.mjs
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as zarr from "zarrita";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "sample.zarr");
const SRC = "https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/dynamical/ecmwf-ifs-ens-forecast-15-day-0-25-degree/v0.1.0.zarr";

// Region: Europe + Mediterranean + N. Atlantic. Grid is lon -180 (col 0) → step
// +0.25, lat 90 (row 0) → step -0.25. Cols 600..880 = lon -30..40; rows 72..260
// = lat 72..25. LEADS lead-time indices 0..LEADS-1 (3-hourly → 0..21 h).
const LON0 = 600;
const LON1 = 880;
const LAT0 = 72;
const LAT1 = 260;
const LEADS = 8;
const W = LON1 - LON0; // 280
const H = LAT1 - LAT0; // 188
const bounds = [-180 + LON0 * 0.25, 90 - LAT1 * 0.25, -180 + LON1 * 0.25, 90 - LAT0 * 0.25]; // [west, south, east, north]

console.log("reading real ECMWF 2m-temperature slice…");
const store = await zarr.withConsolidatedMetadata(new zarr.FetchStore(SRC));
const root = await zarr.open.v3(store, { kind: "group" });
const arr = await zarr.open.v3(root.resolve("temperature_2m"), { kind: "array" });
// One read fetches each shard once and extracts all LEADS: [lead, y, x].
const slice = await zarr.get(arr, [0, zarr.slice(0, LEADS), 0, zarr.slice(LAT0, LAT1), zarr.slice(LON0, LON1)]);
const data = slice.data; // Float32Array, length LEADS*H*W, row-major (lead, y, x)
let min = Infinity;
let max = -Infinity;
for (const v of data) {
  if (v < min) min = v;
  if (v > max) max = v;
}
console.log(`read [${LEADS}, ${H}, ${W}] — range ${min.toFixed(1)}..${max.toFixed(1)} °C, bounds ${JSON.stringify(bounds)}`);

// Write a Zarr v3 store: temperature[lead_time, y, x], one frame per chunk.
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(join(ROOT, "temperature", "c"), { recursive: true });
writeFileSync(join(ROOT, "zarr.json"), JSON.stringify({ zarr_format: 3, node_type: "group", attributes: {} }, null, 1));
writeFileSync(
  join(ROOT, "temperature", "zarr.json"),
  JSON.stringify(
    {
      zarr_format: 3,
      node_type: "array",
      shape: [LEADS, H, W],
      data_type: "float32",
      chunk_grid: { name: "regular", configuration: { chunk_shape: [1, H, W] } },
      chunk_key_encoding: { name: "default", configuration: { separator: "/" } },
      fill_value: 0,
      codecs: [{ name: "bytes", configuration: { endian: "little" }}],
      attributes: { units: "degC", long_name: "2 metre temperature", source: "ECMWF IFS ENS via Dynamical.org" },
      dimension_names: ["lead_time", "y", "x"],
    },
    null,
    1,
  ),
);
const frameLen = H * W;
for (let t = 0; t < LEADS; t++) {
  const buf = Buffer.alloc(frameLen * 4);
  for (let i = 0; i < frameLen; i++) buf.writeFloatLE(data[t * frameLen + i], i * 4);
  mkdirSync(join(ROOT, "temperature", "c", String(t)), { recursive: true });
  mkdirSync(join(ROOT, "temperature", "c", String(t), "0"), { recursive: true });
  writeFileSync(join(ROOT, "temperature", "c", String(t), "0", "0"), buf);
}
console.log(`sample.zarr written: ${LEADS} frames of ${H}×${W} real temperature.`);
