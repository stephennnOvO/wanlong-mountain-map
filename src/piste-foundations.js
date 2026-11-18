// Trim foundation walls against the surface actually used by the snow mesh.
// The ungraded DEM can sit above the floor or leave a gap after a local cut.
if (pisteGrading) {
  const field = pisteGrading.field;
  const levels = window.__FINAL_CROSSFALL_PATCH__?.siteLevels || {};
  for (const site of facilityGrounds.filter((s) => s.kind === 'summit' || s.kind === 'lodge')) {
    const level = levels[site.owner];
    const facility = summitFacilities.find((f) =>
      site.kind === 'lodge' ? f.id === 'summit-cafe' : 'summit-' + f.sourceId === site.owner,
    );
    const group = facility?.group;
    if (Number.isFinite(level) && group) {
      const adjustment = level - site.top;
      group.position.y += adjustment;
      group.updateWorldMatrix(true, true);
      site.base += adjustment;
      site.top = level;
      site.bounds.setFromObject(group);
      facility.bounds.copy(site.bounds);
      site.bounds.getCenter(facility.center);
      for (let i = solidVolumes.length - 1; i >= 0; i--)
        if (solidVolumes[i].owner === site.owner) solidVolumes.splice(i, 1);
      registerSolids(group, site.owner);
      if (site.slab) site.slab.position.y += adjustment;
    }
    if (site.wall) {
      const geometry = site.wall.geometry,
        vertices = geometry.attributes.position;
      for (let i = 0; i < vertices.count; i += 2) {
        vertices.setY(i, site.top);
        vertices.setY(
          i + 1,
          Math.min(site.top - 0.015, field(vertices.getX(i), vertices.getZ(i)) - 0.12),
        );
      }
      vertices.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }
  for (const mesh of buildings.children.filter((m) => m.userData.retainingCore)) {
    const vertices = mesh.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i += 4) {
      for (const offset of [2, 3]) {
        const id = i + offset;
        vertices.setY(
          id,
          Math.min(vertices.getY(i) - 0.015, field(vertices.getX(id), vertices.getZ(id)) - 0.12),
        );
      }
    }
    vertices.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  }
  for (const site of hotelDisplaySites.filter((s) => s.kind === 'summit' && s.surfaceMesh)) {
    const geometry = site.surfaceMesh.geometry,
      vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        z = vertices.getZ(i);
      vertices.setY(i, inPolygon(x, z, site.footprint) ? site.top : field(x, z));
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
// Picking ribbons must follow the final shared surface, including earthworks
// and park geometry. They were initially constructed against the source DEM.
if (pisteGrading)
  for (const trail of trails.filter((t) => t.mapped && t.mesh)) {
    const geometry = trail.mesh.geometry,
      position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++)
      position.setY(i, displayGroundHeightAt(position.getX(i), position.getZ(i)) + 0.06);
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
// These estimated DEM footings conflict with adjoining groomed traverses.
// Keep the reviewed rope, sheaves, tower plan position and mast type; only
// rebuild the ground end against the final surface, before static batching.
const terrainFollowingPylonIds = new Set(['2-7', '9-10', '6-14', '5-13']);
if (pisteGrading)
  for (const post of liftGroup.children.filter(
    (g) =>
      g.userData.kind === 'pylon' &&
      terrainFollowingPylonIds.has(g.userData.liftId + '-' + g.userData.index),
  )) {
    const data = post.userData,
      rt = lifts.find((l) => l.id === data.liftId).runtime;
    const old = pylonDetailRecords.find((r) => r.liftId === data.liftId && r.index === data.index);
    if (!old?.foot) continue;
    const referenceFoot = old.foot.slice(),
      p = rt.cablePoint(data.t);
    const foot = new V(p.x, displayGroundHeightAt(p.x, p.z) - 0.4, p.z);
    if (Math.abs(foot.y - referenceFoot[1]) < 0.0001) continue;
    const owner = 'pylon-' + data.liftId + '-' + data.index;
    let hadProtectionPad = false;
    post.traverse((m) => {
      if (m.userData.pylonProtection) hadProtectionPad = true;
    });
    for (let i = solidVolumes.length - 1; i >= 0; i--)
      if (solidVolumes[i].owner === owner) solidVolumes.splice(i, 1);
    post.traverse((m) => {
      if (m.geometry && m.geometry !== pylonWheels) m.geometry.dispose();
    });
    post.clear();
    detailPylon(post, rt, p, foot);
    // Preserve the original equipment configuration rather than reclassifying
    // the support against the updated piste geometry.
    if (hadProtectionPad) {
      const pad = box(2.4, 2, 2.4, redMat, foot.x, foot.y + 1.35, foot.z, post);
      pad.rotation.y = Math.atan2(rt.dir.x, rt.dir.z);
      pad.userData.pylonProtection = true;
    }
    registerSolids(post, owner);
    const record = pylonDetailRecords.find(
      (r) => r.liftId === data.liftId && r.index === data.index,
    );
    record.referenceFoot = referenceFoot;
    record.groundAdjustmentM = foot.y - referenceFoot[1];
    record.protectionPadRetained = hadProtectionPad;
  }
// Keep the other reviewed masts, sheaves, numbering and XYZ untouched when excavation
// exposes the original footing. These narrow concrete bases are solid objects,
// not raised snow islands or replacement tower types.
const gradingFoundations = new THREE.Group(),
  gradingFootingMaterial = material('#8d9692', { roughness: 1 });
gradingFoundations.name = 'excavation-footings';
liftGroup.add(gradingFoundations);
if (pisteGrading)
  for (const record of pylonDetailRecords) {
    const p = record.foot;
    if (!Array.isArray(p)) continue;
    const [x, y, z] = p,
      rt = lifts.find((l) => l.id === record.liftId)?.runtime;
    const side = rt?.side || new V(1, 0, 0),
      dir = rt?.dir || new V(0, 0, 1),
      half = record.mast === 'lattice' ? 1.65 : 1.25;
    const ground = [];
    for (const a of [-1, 0, 1])
      for (const b of [-1, 0, 1])
        ground.push(
          displayGroundHeightAt(
            x + side.x * a * half + dir.x * b * half,
            z + side.z * a * half + dir.z * b * half,
          ),
        );
    const bottom = Math.min(...ground) - 0.18,
      top = y + 0.08;
    if (top - bottom < 0.35) continue;
    const foundation = box(
      half * 2,
      top - bottom,
      half * 2,
      gradingFootingMaterial,
      x,
      (top + bottom) / 2,
      z,
      gradingFoundations,
    );
    foundation.rotation.y = Math.atan2(dir.x, dir.z);
    foundation.userData = {
      kind: 'excavation-footing',
      liftId: record.liftId,
      index: record.index,
      originalFoot: p.slice(),
      bottom,
      top,
    };
  }
registerSolids(gradingFoundations, 'excavation-footings');
// Lamps were created before grading. Ground every instance and its glow in
// one pass; only the decorative lamp bases follow the new surface.
