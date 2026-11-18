// WGS84 ellipsoidal ECEF -> local east/north tangent plane. West is +X, north is +Z.
const ELLIPSOID_A = 6378137,
  ELLIPSOID_E2 = 6.6943799901413165e-3,
  DEG = Math.PI / 180;
const ORIGIN_LON = GEO.origin[0] * DEG,
  ORIGIN_LAT = GEO.origin[1] * DEG;
function ecefAt(lon, lat) {
  const s = Math.sin(lat),
    n = ELLIPSOID_A / Math.sqrt(1 - ELLIPSOID_E2 * s * s);
  return [
    n * Math.cos(lat) * Math.cos(lon),
    n * Math.cos(lat) * Math.sin(lon),
    n * (1 - ELLIPSOID_E2) * s,
  ];
}
const ORIGIN_ECEF = ecefAt(ORIGIN_LON, ORIGIN_LAT);
function projectGeo(c) {
  const p = ecefAt(c[0] * DEG, c[1] * DEG),
    dx = p[0] - ORIGIN_ECEF[0],
    dy = p[1] - ORIGIN_ECEF[1],
    dz = p[2] - ORIGIN_ECEF[2];
  return [
    Math.sin(ORIGIN_LON) * dx - Math.cos(ORIGIN_LON) * dy,
    -Math.sin(ORIGIN_LAT) * Math.cos(ORIGIN_LON) * dx -
      Math.sin(ORIGIN_LAT) * Math.sin(ORIGIN_LON) * dy +
      Math.cos(ORIGIN_LAT) * dz,
  ];
}
function unprojectGeo(x, z) {
  const east = -x,
    X =
      ORIGIN_ECEF[0] -
      Math.sin(ORIGIN_LON) * east -
      Math.sin(ORIGIN_LAT) * Math.cos(ORIGIN_LON) * z,
    Y =
      ORIGIN_ECEF[1] +
      Math.cos(ORIGIN_LON) * east -
      Math.sin(ORIGIN_LAT) * Math.sin(ORIGIN_LON) * z,
    Z = ORIGIN_ECEF[2] + Math.cos(ORIGIN_LAT) * z,
    r = Math.hypot(X, Y);
  let lat = Math.atan2(Z, r * (1 - ELLIPSOID_E2));
  for (let i = 0; i < 6; i++) {
    const n = ELLIPSOID_A / Math.sqrt(1 - ELLIPSOID_E2 * Math.sin(lat) ** 2);
    lat = Math.atan2(Z + ELLIPSOID_E2 * n * Math.sin(lat), r);
  }
  return [Math.atan2(Y, X) / DEG, lat / DEG];
}
