// Road drawing removed at the user's request. Keep empty diagnostic groups.
const resortRoads = [],
  accessRoadGroup = new THREE.Group();
accessRoadGroup.name = 'roads-disabled';
accessRoadGroup.visible = false;
scene.add(accessRoadGroup);
const magicCarpetReference = new THREE.Group();
magicCarpetReference.name = 'Source magic carpet ground reference';
scene.add(magicCarpetReference);
for (const child of [...pathOverlay.children]) {
  pathOverlay.remove(child);
  child.geometry?.dispose();
  child.material?.dispose();
}
pathOverlay.visible = false;
for (const f of summitFacilities) {
  const size = f.bounds.getSize(new V()),
    proxy = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(size.x, 10), Math.max(size.y, 8), Math.max(size.z, 10)),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
  proxy.position.copy(f.center);
  proxy.userData = { kind: 'landscape', id: f.guideId };
  scene.add(proxy);
  pickables.push(proxy);
}
// Valley labels describe the reference relief already built into the mesh.
// They appear only at useful detail scale, without implying surveyed entries.
for (const v of naturalValleys) {
  const c = v.samples[Math.round(v.samples.length * 0.52)];
  labelData.push({
    text: v.name + ' · 地形参考',
    p: new V(c.x, visibleTerrainHeightAt(c.x, c.z) + 9, c.z),
    guide: v.guideId,
    maxDistance: 1450,
  });
}
for (const f of summitFacilities.filter((f) => f.id !== 'summit-cafe'))
  labelData.push({
    text: f.name,
    p: f.center.clone().add(new V(0, 12, 0)),
    summitFacility: f.id,
    maxDistance: 900,
  });
