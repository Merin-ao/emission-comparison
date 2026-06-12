/**
 * Deterministic dummy AIS positions — the FINAL fallback for the nearby radar,
 * used only when a vessel has no live AIS fix, no data-lake noon-report position,
 * and no noon-report fixture. Guarantees any asked vessel still plots on the scope.
 *
 * Pure + stable: the same IMO always maps to the same spot, so the radar doesn't
 * jump between calls. A non-centre vessel is placed at a deterministic distance
 * (biased toward the centre, spread to ~300 nm) and bearing around the centre, so
 * a smaller asked range shows fewer blips and a larger range reveals more.
 *
 * NOT used when a real position is available — see `realPositionFor` in
 * handlers/get-vessel-widgets.ts.
 */

type LatLon = { lat: number; lon: number };

const RAD = Math.PI / 180;
const MOD = 100003; // prime, keeps the two hashes decorrelated

// Two stable pseudo-random values in [0, MOD) derived from an IMO.
const hashes = (imo: number): [number, number] => {
  let x = Math.abs(Math.trunc(imo)) >>> 0;
  x = (x * 2654435761) >>> 0;
  const a = x % MOD;
  x = (x * 40503 + 0x9e37) >>> 0;
  const b = x % MOD;
  return [a, b];
};

// Stable open-water base position for a centre vessel that has no real fix.
const dummyCentre = (imo: number): LatLon => {
  const [a, b] = hashes(imo);
  return { lat: (a / MOD) * 100 - 50, lon: (b / MOD) * 300 - 150 };
};

// Stable position for a non-centre vessel with no real fix, offset from `centre`.
// Distance is biased small (squared fraction) so several dummies fall inside a
// modest range, then spread out toward ~300 nm.
const dummyOffset = (centre: LatLon, imo: number): LatLon => {
  const [a, b] = hashes(imo);
  const frac = a / MOD;
  const nm = 5 + frac * frac * 295;
  const brg = (b / MOD) * 360;
  const dLat = (nm * Math.cos(brg * RAD)) / 60;
  const dLon = (nm * Math.sin(brg * RAD)) / (60 * Math.max(0.2, Math.cos(centre.lat * RAD)));
  return { lat: centre.lat + dLat, lon: centre.lon + dLon };
};

export { dummyCentre, dummyOffset };
export type { LatLon };
