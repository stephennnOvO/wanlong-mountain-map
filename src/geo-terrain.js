// Unexaggerated DEM mesh. Both axes and elevation use metre units.
const [xMin, zMin, xMax, zMax] = GEO.extent;
function insideExtent(p) {
  return p.x >= xMin && p.x <= xMax && p.z >= zMin && p.z <= zMax;
}
const terrainVertices = [],
  terrainColors = [],
  terrainUV = [],
  terrainIndices = [];
const terrainCold = new THREE.Color('#d1e1e6'),
  terrainWhite = new THREE.Color('#f2f5f1');
for (let j = 0; j < GEO.rows; j++)
  for (let i = 0; i < GEO.cols; i++) {
    const lon = lerp(GEO.bounds[2], GEO.bounds[0], i / (GEO.cols - 1)),
      lat = lerp(GEO.bounds[1], GEO.bounds[3], j / (GEO.rows - 1)),
      [x, z] = projectGeo([lon, lat]),
      y = GEO.heights[j * GEO.cols + i] / 10 - GEO.baseElevation;
    terrainVertices.push(x, y, z);
    terrainUV.push(i / (GEO.cols - 1), j / (GEO.rows - 1));
    const c = terrainWhite.clone().lerp(terrainCold, 0.1 + 0.08 * Math.sin(x * 0.002 - z * 0.001));
    terrainColors.push(c.r, c.g, c.b);
    if (i < GEO.cols - 1 && j < GEO.rows - 1) {
      const n = j * GEO.cols + i;
      terrainIndices.push(n, n + GEO.cols, n + 1, n + 1, n + GEO.cols, n + GEO.cols + 1);
    }
  }
const terrainGeo = new THREE.BufferGeometry();
terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainVertices, 3));
terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
terrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(terrainUV, 2));
terrainGeo.setIndex(terrainIndices);
terrainGeo.computeVertexNormals();
const terrain = new THREE.Mesh(terrainGeo, snowMat);
terrain.receiveShadow = true;
mountain.add(terrain);
const edge = [];
for (let i = 0; i < GEO.cols; i++) edge.push([lerp(xMin, xMax, i / (GEO.cols - 1)), zMin]);
for (let j = 1; j < GEO.rows; j++) edge.push([xMax, lerp(zMin, zMax, j / (GEO.rows - 1))]);
for (let i = GEO.cols - 2; i >= 0; i--) edge.push([lerp(xMin, xMax, i / (GEO.cols - 1)), zMax]);
for (let j = GEO.rows - 2; j >= 0; j--) edge.push([xMin, lerp(zMin, zMax, j / (GEO.rows - 1))]);
const cliffVertices = [],
  cliffIndices = [];
edge.forEach(([x, z], i) => {
  cliffVertices.push(x, heightAt(x, z) - 0.15, z, x, -60, z);
  if (i < edge.length - 1) {
    const n = i * 2;
    cliffIndices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
  }
});
const cliffGeo = new THREE.BufferGeometry();
cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffVertices, 3));
cliffGeo.setIndex(cliffIndices);
cliffGeo.computeVertexNormals();
mountain.add(new THREE.Mesh(cliffGeo, material('#aec1c6', { side: THREE.DoubleSide })));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), material('#dce7e8'));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -67;
ground.receiveShadow = true;
scene.add(ground);
const geoOverlay = new THREE.Group(),
  contours = new THREE.Group(),
  pathOverlay = new THREE.Group();
scene.add(geoOverlay, contours, pathOverlay);
// Contours are linearly interpolated from this same DEM; no added noise or synthetic relief.
// Current terrain contours are generated lazily after terrain refinement.
contours.visible = false;
const forestPolygons = GEO.forests.map((p) => p.coords.map(projectGeo));
const forestBounds = forestPolygons.map((polygon) => {
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const [x, z] of polygon) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return { polygon, minX, minZ, maxX, maxZ };
});
function inPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
function withinForest(x, z) {
  return forestBounds.some(
    ({ polygon, minX, minZ, maxX, maxZ }) =>
      x >= minX && x <= maxX && z >= minZ && z <= maxZ && inPolygon(x, z, polygon),
  );
}
// The visible forest boundary is derived from the rendered surface mask.
geoOverlay.visible = false;
