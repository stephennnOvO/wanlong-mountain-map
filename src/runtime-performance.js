// Keep source parts for geometric audits; batch only the render representation.
// Rope-aligned grips and upright cabins must remain separate transform groups.
for (const rt of liftRuntimes) {
  const groups = new Map();
  for (const part of rt.parts) {
    const key = part.mesh.material.uuid + ':' + !!part.mesh.geometry.userData.ropeAligned;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(part);
  }
  rt.renderParts = [];
  for (const parts of groups.values()) {
    const positions = [],
      normals = [],
      uvs = [],
      overviewPositions = [],
      overviewNormals = [],
      overviewUvs = [];
    for (const part of parts) {
      const source = part.mesh.geometry,
        g = source.index ? source.toNonIndexed() : source.clone();
      g.translate(0, part.y, 0);
      positions.push(...g.attributes.position.array);
      normals.push(...g.attributes.normal.array);
      uvs.push(...g.attributes.uv.array);
      g.dispose();
      const size = source.userData.nominalSize,
        offset = source.userData.vehicleOffset;
      const simple = size
        ? new THREE.BoxGeometry(...size)
        : source.index
          ? source.toNonIndexed()
          : source.clone();
      if (size) simple.translate(offset[0], part.y, offset[2]);
      else simple.translate(0, part.y, 0);
      const low = simple.index ? simple.toNonIndexed() : simple;
      overviewPositions.push(...low.attributes.position.array);
      overviewNormals.push(...low.attributes.normal.array);
      overviewUvs.push(...low.attributes.uv.array);
      if (low !== simple) low.dispose();
      simple.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.userData.ropeAligned = parts[0].mesh.geometry.userData.ropeAligned;
    const overview = new THREE.BufferGeometry();
    overview.setAttribute('position', new THREE.Float32BufferAttribute(overviewPositions, 3));
    overview.setAttribute('normal', new THREE.Float32BufferAttribute(overviewNormals, 3));
    overview.setAttribute('uv', new THREE.Float32BufferAttribute(overviewUvs, 2));
    overview.userData.ropeAligned = g.userData.ropeAligned;
    const mesh = new THREE.InstancedMesh(g, parts[0].mesh.material, rt.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.userData = { kind: 'lift', id: rt.lift.id };
    liftGroup.add(mesh);
    pickables.push(mesh);
    rt.renderParts.push({ mesh, y: 0, detailGeometry: g, overviewGeometry: overview });
  }
  for (const part of rt.parts) {
    part.mesh.removeFromParent();
    const i = pickables.indexOf(part.mesh);
    if (i >= 0) pickables.splice(i, 1);
  }
}
// Use box silhouettes only while a whole carrier is smaller than 10 screen
// pixels. Close views and riding retain every rounded panel and interior part.
let vehicleDetailCheck = -Infinity;
function updateVehicleDetail(now) {
  if (now - vehicleDetailCheck < 250) return;
  vehicleDetailCheck = now;
  const pixelScale =
    (renderer.domElement.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
    camera.zoom;
  for (const rt of liftRuntimes) {
    const dx = rt.b.x - rt.a.x,
      dy = rt.b.y - rt.a.y,
      dz = rt.b.z - rt.a.z;
    const t = clamp(
      ((camera.position.x - rt.a.x) * dx +
        (camera.position.y - rt.a.y) * dy +
        (camera.position.z - rt.a.z) * dz) /
        (dx * dx + dy * dy + dz * dz),
      0,
      1,
    );
    const distance = Math.max(
      1,
      Math.hypot(
        camera.position.x - rt.a.x - dx * t,
        camera.position.y - rt.a.y - dy * t,
        camera.position.z - rt.a.z - dz * t,
      ),
    );
    const low = state.mode === 'orbit' && (5.5 * pixelScale) / distance < 10;
    if (rt.overviewDetail === low) continue;
    rt.overviewDetail = low;
    for (const part of rt.renderParts)
      part.mesh.geometry = low ? part.overviewGeometry : part.detailGeometry;
  }
}
