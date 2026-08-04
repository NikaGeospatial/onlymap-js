# Georeferenced image overlays

`ImageOverlay` places a geotagged drone JPEG on the map. It is the OnlyMapJS-owned preprocessing path over deck.gl's `BitmapLayer`: the browser reads EXIF/XMP, computes an axis-aligned WGS84 footprint, bakes the camera yaw and upside-down roll correction into the pixels, then renders the processed image at those bounds.

## Direct manifest use

```html
<om-map center="[103.85, 1.29]" zoom="18" pitch="45">
  <om-layer id="survey-photo"
            type="ImageOverlay"
            src="./DJI_0123.jpg"
            georeference="exif"
            opacity="0.8"></om-layer>
</om-map>
```

The JPEG must contain finite GPS latitude/longitude, positive `RelativeAltitude`, image dimensions, `GimbalYawDegree`, and `GimbalPitchDegree`. `GimbalRollDegree` defaults to zero. Focal length comes from EXIF; it is never guessed.

Known DJI/Parrot cameras use the bundled sensor database. The release path has been verified in Chromium against original DJI FC300S and M30T photos, including M30T files carrying the 180° roll correction. For another camera, supply the physical sensor dimensions and, if EXIF lacks it, focal length:

```html
<om-layer id="survey-photo"
          type="ImageOverlay"
          src="./survey.jpg"
          georeference="exif"
          sensor-width-mm="13.2"
          sensor-height-mm="8.8"
          focal-length-mm="8.8"></om-layer>
```

The source follows `OmMap.configureData({ headers, credentials, fetch })`, so authenticated image endpoints use the same request policy as data URLs. `map.ready` waits for EXIF resolution. A failed image is omitted and logged with an actionable error rather than constructing an invalid `BitmapLayer`.

## Persist once, reconstruct cheaply

For collaborative maps or saved manifests, preprocess once and upload the returned image. Store its bounds and metadata beside the new URL:

```js
const resolved = await OmMap.resolveImageOverlay(file);
const imageUrl = await upload(resolved.image);

const savedLayer = {
  src: imageUrl,
  bounds: resolved.bounds,
  metadata: resolved.metadata
};
```

Reconstruct with explicit bounds:

```html
<om-layer id="survey-photo"
          type="ImageOverlay"
          src="./processed/0123.png"
          bounds="[103.841,1.286,103.845,1.290]"
          metadata='{"cameraAssetId":"0123"}'></om-layer>
```

Explicit bounds bypass fetching and EXIF parsing. The source may therefore be the processed PNG returned when rotation was required, or an unchanged JPEG when it was not. Do not also set `georeference="exif"`; validation warns because bounds win.

The React/programmatic twin uses the same camel-case props:

```tsx
<OmLayer
  id="survey-photo"
  type="ImageOverlay"
  src="./survey.jpg"
  georeference="exif"
  sensorWidthMm={13.2}
  sensorHeightMm={8.8}
/>
```

## Accuracy boundary

This patch intentionally matches the proven PlanetGPT stage-1 approach: a flat-ground pinhole-camera estimate, a pitch-adjusted center approximation, baked yaw/roll, and an axis-aligned bounding box. It is suitable for visualization, not surveying or measurement. Terrain relief, lens distortion, camera calibration, antimeridian-crossing footprints, and a perspective-correct four-corner projective footprint are not modeled. Pre-orthorectified imagery should use explicit bounds, while large orthomosaics belong in a Cloud-Optimized GeoTIFF through `COGLayer`.
