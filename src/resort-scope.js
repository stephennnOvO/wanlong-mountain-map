// Keep a buffer around mapped ski runs, lodging and the local bike routes.
function createResortScope(bikePoints) {
  const points = [
    ...GEO.resortBoundary,
    ...trails.flatMap((trail) => trail.geo || []),
    ...hotels.map((hotel) => hotel.geo).filter(Boolean),
  ]
    .map(projectGeo)
    .concat(bikePoints);
  const buffer = Array.from({ length: 8 }, (_, i) => [
    120 * Math.cos((i * Math.PI) / 4),
    120 * Math.sin((i * Math.PI) / 4),
  ]);
  const polygon = hotelHull(points.flatMap(([x, z]) => buffer.map(([dx, dz]) => [x + dx, z + dz])));
  const center = new V();
  for (const [x, z] of polygon) {
    center.x += x / polygon.length;
    center.z += z / polygon.length;
  }
  const planes = polygon.map(([x, z], i) => {
    const [nextX, nextZ] = polygon[(i + 1) % polygon.length];
    const normal = new V(z - nextZ, 0, nextX - x).normalize();
    const plane = new THREE.Plane(normal, -normal.x * x - normal.z * z);
    return plane.distanceToPoint(center) < 0 ? plane.negate() : plane;
  });
  const contains = (x, z, padding = 0) =>
    planes.every(({ normal, constant }) => normal.x * x + normal.z * z + constant >= -padding);
  return { center, polygon, planes, contains };
}

function addResortBoundaryWall({ polygon, center }) {
  const positions = [],
    indices = [];
  for (let i = 0; i < polygon.length; i++) {
    const [x, z] = polygon[i],
      [nextX, nextZ] = polygon[(i + 1) % polygon.length];
    const segments = Math.ceil(Math.hypot(nextX - x, nextZ - z) / 8);
    for (let j = 0; j <= segments; j++) {
      // Keep the wall just inside the clipping plane to avoid rounding gaps.
      const px = lerp(lerp(x, nextX, j / segments), center.x, 0.00001);
      const pz = lerp(lerp(z, nextZ, j / segments), center.z, 0.00001);
      const k = positions.length / 3;
      positions.push(px, displayGroundHeightAt(px, pz) - 0.15, pz, px, -60, pz);
      if (j) indices.push(k - 2, k - 1, k, k, k - 1, k + 1);
    }
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  wall.setIndex(indices);
  wall.computeVertexNormals();
  mountain.add(new THREE.Mesh(wall, material('#aec1c6', { side: THREE.DoubleSide })));
}
