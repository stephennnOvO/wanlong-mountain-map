// Keep all source instances available for contact/picking tests. Only the
// submitted instance lists are compacted, using the same geometry and matrix.
function initializeSceneSpatialCulling({ scene, camera, forest, treeData, liftRuntimes }) {
  const sourceTrees = forest.children.filter((mesh) => mesh.isInstancedMesh);
  if (!treeData.length || !sourceTrees.length) return;
  const display = new THREE.Group();
  display.name = 'Visible tree instances';
  display.visible = false;
  scene.add(display);
  const treeMeshes = sourceTrees.map((source) => {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, source.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (source.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(source.instanceColor.array.length),
        3,
      );
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    mesh.receiveShadow = source.receiveShadow;
    mesh.frustumCulled = false;
    display.add(mesh);
    return { source, mesh };
  });
  const bins = new Map(),
    point = new THREE.Vector3();
  treeData.forEach((tree, i) => {
    const key = Math.floor(tree.x / 500) + ',' + Math.floor(tree.z / 500);
    if (!bins.has(key)) bins.set(key, { box: new THREE.Box3(), indices: [] });
    const bin = bins.get(key),
      margin = tree.w * 1.25 + 1;
    const trunkMid = sourceTrees[0].instanceMatrix.array[i * 16 + 13],
      ground = trunkMid - tree.h * 0.18;
    bin.box.expandByPoint(point.set(tree.x - margin, ground - 1, tree.z - margin));
    bin.box.expandByPoint(point.set(tree.x + margin, ground + tree.h * 1.4 + 1, tree.z + margin));
    bin.indices.push(i);
  });
  const treeBins = [...bins.values()];
  const liftBoxes = liftRuntimes.map((rt) => {
    const bounds = new THREE.Box3();
    for (const coord of rt.lift.geo || []) {
      const [x, z] = projectGeo(coord);
      bounds.expandByPoint(point.set(x, 0, z));
    }
    bounds.expandByPoint(rt.a);
    bounds.expandByPoint(rt.b);
    // Include the catenary, both turnarounds and the full hanging envelope.
    // The generous vertical margin protects the end spans even in steep areas.
    bounds.min.y = Math.min(rt.a.y, rt.b.y, ...rt.towerY) - 60;
    bounds.max.y = Math.max(rt.a.y, rt.b.y, ...rt.towerY) + 24;
    bounds.min.x -= 14;
    bounds.max.x += 14;
    bounds.min.z -= 14;
    bounds.max.z += 14;
    return { bounds, parts: rt.renderParts };
  });
  const frustum = new THREE.Frustum(),
    projectionView = new THREE.Matrix4(),
    masked = [];
  const stats = { totalTrees: treeData.length, drawnTrees: treeData.length, culledLifts: 0 };
  let cachedBins = [];
  const mask = (object, view) => {
    masked.push([object, object.layers.mask]);
    object.layers.mask &= ~view.layers.mask;
  };
  function updateTrees(visibleBins, total) {
    const indices = visibleBins.flatMap((bin) => bin.indices);
    for (const { source, mesh } of treeMeshes) {
      const sourceMatrix = source.instanceMatrix.array,
        target = mesh.instanceMatrix.array;
      const fromColor = source.instanceColor?.array,
        toColor = mesh.instanceColor?.array;
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j];
        target.set(sourceMatrix.subarray(i * 16, i * 16 + 16), j * 16);
        if (toColor) toColor.set(fromColor.subarray(i * 3, i * 3 + 3), j * 3);
      }
      mesh.count = total;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, total * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, total * 3);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  const before = scene.onBeforeRender,
    after = scene.onAfterRender;
  scene.onBeforeRender = function (renderer, world, view, ...rest) {
    before.call(this, renderer, world, view, ...rest);
    display.visible = false;
    stats.drawnTrees = forest.visible ? treeData.length : 0;
    stats.culledLifts = 0;
    // Preserve complete casters while rebuilding shadows; cached shadow frames
    // can cull the main camera without removing offscreen shadow casters.
    if (
      view !== camera ||
      (renderer.shadowMap.enabled &&
        (renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate))
    )
      return;
    frustum.setFromProjectionMatrix(
      projectionView.multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse),
    );
    if (forest.visible) {
      const visibleBins = treeBins.filter((bin) => frustum.intersectsBox(bin.box));
      const total = visibleBins.reduce((sum, bin) => sum + bin.indices.length, 0);
      if (total < treeData.length * 0.78) {
        if (
          total &&
          (cachedBins.length !== visibleBins.length ||
            visibleBins.some((bin, i) => bin !== cachedBins[i]))
        ) {
          updateTrees(visibleBins, total);
          cachedBins = visibleBins;
        }
        for (const { source, mesh } of treeMeshes) {
          mask(source, view);
          mesh.visible = source.visible;
        }
        display.visible = total > 0;
        stats.drawnTrees = total;
      }
    }
    for (const { bounds, parts } of liftBoxes) {
      if (!parts || frustum.intersectsBox(bounds)) continue;
      for (const part of parts) mask(part.mesh, view);
      stats.culledLifts++;
    }
  };
  scene.onAfterRender = function (...args) {
    for (const [object, layers] of masked) object.layers.mask = layers;
    masked.length = 0;
    display.visible = false;
    after.apply(this, args);
  };
  return stats;
}
