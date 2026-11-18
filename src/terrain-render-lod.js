// Rendering tiles index the existing terrain attributes. The complete mesh
// remains the source for physics, elevation queries and precise ray hits.
function initializeTerrainRenderTiles({
  terrain,
  scene,
  renderer,
  geo,
  snowMaterial,
  resortScope,
  exactRendering = () => false,
}) {
  const source = terrain.geometry,
    vertex = source.getAttribute('position');
  const attributes = source.attributes,
    sourceIndex = source.index?.array,
    parent = terrain.parent;
  const refined = vertex.count === (2 * geo.cols - 1) * (2 * geo.rows - 1);
  const cols = refined ? 2 * geo.cols - 1 : geo.cols,
    rows = refined ? 2 * geo.rows - 1 : geo.rows;
  const fullCount = 2 * (cols - 1) * (rows - 1);
  if (
    !parent ||
    vertex.count !== cols * rows ||
    sourceIndex?.length !== fullCount * 3 ||
    source.groups.length ||
    source.drawRange.start ||
    source.drawRange.count < sourceIndex.length
  )
    return null;
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const n = j * cols + i,
        k = 6 * (j * (cols - 1) + i);
      if (
        sourceIndex[k] !== n ||
        sourceIndex[k + 1] !== n + cols ||
        sourceIndex[k + 2] !== n + 1 ||
        sourceIndex[k + 3] !== n + 1 ||
        sourceIndex[k + 4] !== n + cols ||
        sourceIndex[k + 5] !== n + cols + 1
      )
        return null;
    }
  const group = new THREE.Group();
  group.name = 'Terrain display tiles';
  const tiles = [],
    point = new THREE.Vector3(),
    worldSphere = new THREE.Sphere();
  const frustum = new THREE.Frustum(),
    viewProjection = new THREE.Matrix4();
  const xyz = vertex.array;
  const included = resortScope && new Uint8Array(vertex.count);
  if (included) {
    // Allow triangles that cross the boundary. The renderer clips them precisely.
    for (let i = 0; i < included.length; i++)
      included[i] = resortScope.contains(xyz[3 * i], xyz[3 * i + 2], 20);
  }
  function scopedIndices(indices, faceMap) {
    const selected = [];
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i],
        b = indices[i + 1],
        c = indices[i + 2];
      if (!included[a] && !included[b] && !included[c]) continue;
      selected.push(a, b, c);
      if (faceMap) faceMap.push(i / 3);
    }
    return new Uint32Array(selected);
  }
  function geometry(indices, box, sphere) {
    const g = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(attributes)) g.setAttribute(name, attribute);
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.boundingBox = box;
    g.boundingSphere = sphere;
    return g;
  }
  const stride = 80;
  for (let startZ = 0; startZ < rows - 1; startZ += stride)
    for (let startX = 0; startX < cols - 1; startX += stride) {
      const endX = Math.min(startX + stride, cols - 1),
        endZ = Math.min(startZ + stride, rows - 1);
      const box = new THREE.Box3();
      for (let z = startZ; z <= endZ; z++)
        for (let x = startX; x <= endX; x++) {
          box.expandByPoint(point.fromBufferAttribute(vertex, z * cols + x));
        }
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const width = endX - startX,
        height = endZ - startZ,
        indices = new Uint32Array(width * height * 6);
      for (let z = 0; z < height; z++) {
        const first = ((z + startZ) * (cols - 1) + startX) * 6;
        indices.set(sourceIndex.subarray(first, first + width * 6), z * width * 6);
      }
      const faceMap = included ? [] : null;
      const displayIndices = included ? scopedIndices(indices, faceMap) : indices;
      if (!displayIndices.length) continue;
      const full = geometry(displayIndices, box, sphere);
      const mesh = new THREE.Mesh(full, terrain.material);
      mesh.name = 'Terrain tile';
      mesh.receiveShadow = terrain.receiveShadow;
      group.add(mesh);
      const tile = {
        mesh,
        full,
        coarse: null,
        error: Infinity,
        startX,
        startZ,
        endX,
        endZ,
        width,
        faceMap,
        sphere,
        low: false,
      };
      tiles.push(tile);
    }
  function buildCoarse(tile) {
    const { startX, startZ, endX, endZ, width, sphere } = tile;
    if (width % 2 || (endZ - startZ) % 2 || width < 4 || endZ - startZ < 4) return;
    const indices = [];
    const edgeErrors = new Map();
    let error = 0;
    function edgeError(a, b) {
      const i = a % cols,
        j = Math.floor(a / cols),
        ix = b % cols,
        jx = Math.floor(b / cols);
      const di = ix - i,
        dj = jx - j;
      if (Math.abs(di) + Math.abs(dj) === 1 || (Math.abs(di) === 1 && di === -dj)) return 0;
      const key = Math.min(a, b) * vertex.count + Math.max(a, b);
      if (edgeErrors.has(key)) return edgeErrors.get(key);
      const x = xyz[a * 3],
        y = xyz[a * 3 + 1],
        z = xyz[a * 3 + 2];
      const dx = xyz[b * 3] - x,
        dy = xyz[b * 3 + 1] - y,
        dz = xyz[b * 3 + 2] - z;
      let bound = 0;
      function intersect(m, n) {
        if (m === a || m === b || n === a || n === b) return;
        m *= 3;
        n *= 3;
        const ex = xyz[n] - xyz[m],
          ez = xyz[n + 2] - xyz[m + 2],
          det = dx * ez - dz * ex;
        if (Math.abs(det) < 1e-10) return;
        const ux = xyz[m] - x,
          uz = xyz[m + 2] - z;
        const s = (ux * ez - uz * ex) / det,
          t = (ux * dz - uz * dx) / det;
        if (s < 0 || s > 1 || t < 0 || t > 1) return;
        const fineY = xyz[m + 1] + t * (xyz[n + 1] - xyz[m + 1]);
        bound = Math.max(bound, Math.abs(y + s * dy - fineY));
      }
      for (
        let r = Math.max(0, Math.min(j, jx) - 1);
        r <= Math.min(rows - 1, Math.max(j, jx) + 1);
        r++
      ) {
        for (
          let c = Math.max(0, Math.min(i, ix) - 1);
          c <= Math.min(cols - 1, Math.max(i, ix) + 1);
          c++
        ) {
          const n = r * cols + c;
          if (c + 1 < cols) intersect(n, n + 1);
          if (r + 1 < rows) intersect(n, n + cols);
          if (c + 1 < cols && r + 1 < rows) intersect(n + 1, n + cols);
        }
      }
      edgeErrors.set(key, bound);
      return bound;
    }
    const addFace = (a, b, c, x, z) => {
      indices.push(a, b, c);
      error = Math.max(error, edgeError(a, b), edgeError(b, c), edgeError(c, a));
      a *= 3;
      b *= 3;
      c *= 3;
      const dx = xyz[b] - xyz[a],
        dz = xyz[b + 2] - xyz[a + 2],
        ex = xyz[c] - xyz[a],
        ez = xyz[c + 2] - xyz[a + 2];
      const det = dx * ez - dz * ex,
        dy = xyz[b + 1] - xyz[a + 1],
        ey = xyz[c + 1] - xyz[a + 1];
      // The two piecewise planar surfaces can have maximum error only at
      // original vertices or where a coarse edge crosses a source edge.
      for (let j = Math.max(0, z - 1); j <= Math.min(rows - 1, z + 3); j++)
        for (let i = Math.max(0, x - 1); i <= Math.min(cols - 1, x + 3); i++) {
          const k = 3 * (j * cols + i),
            ux = xyz[k] - xyz[a],
            uz = xyz[k + 2] - xyz[a + 2];
          const s = (ux * ez - uz * ex) / det,
            t = (uz * dx - ux * dz) / det;
          if (s >= -1e-7 && t >= -1e-7 && s + t <= 1 + 1e-7) {
            error = Math.max(error, Math.abs(xyz[a + 1] + s * dy + t * ey - xyz[k + 1]));
          }
        }
    };
    for (let z = startZ; z < endZ; z += 2)
      for (let x = startX; x < endX; x += 2) {
        const a = z * cols + x,
          b = a + 2 * cols,
          c = a + 2,
          d = b + 2,
          mid = a + cols + 1;
        if (x !== startX && x + 2 !== endX && z !== startZ && z + 2 !== endZ) {
          addFace(a, b, c, x, z);
          addFace(c, b, d, x, z);
          continue;
        }
        // Both LODs retain every vertex along a tile seam. This ring follows
        // the full mesh winding and meets any neighbouring tile without gaps.
        const ring = [a];
        if (x === startX) ring.push(a + cols);
        ring.push(b);
        if (z + 2 === endZ) ring.push(b + 1);
        ring.push(d);
        if (x + 2 === endX) ring.push(c + cols);
        ring.push(c);
        if (z === startZ) ring.push(a + 1);
        for (let i = 0; i < ring.length; i++)
          addFace(mid, ring[i], ring[(i + 1) % ring.length], x, z);
      }
    if (!Number.isFinite(error)) return;
    tile.error = error + 0.02;
    const displayIndices = included ? scopedIndices(indices) : new Uint32Array(indices);
    if (displayIndices.length)
      tile.coarse = geometry(displayIndices, tile.full.boundingBox, sphere);
  }
  // Leave the full-detail tiles ready immediately. Build the optional
  // display meshes in small slices after the first frames.
  let nextCoarse = 0;
  function prepareCoarse(deadline) {
    const started = performance.now();
    do {
      buildCoarse(tiles[nextCoarse++]);
    } while (
      nextCoarse < tiles.length &&
      performance.now() - started < 8 &&
      (!deadline || deadline.timeRemaining() > 1)
    );
    if (nextCoarse < tiles.length) scheduleCoarse();
  }
  function scheduleCoarse() {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(prepareCoarse, { timeout: 400 });
    else setTimeout(prepareCoarse, 16);
  }
  if (tiles.length) scheduleCoarse();
  terrain.updateWorldMatrix(true, false);
  group.matrixAutoUpdate = false;
  group.matrix.copy(terrain.matrix);
  let overview = source;
  if (included) {
    const count = tiles.reduce((total, { full }) => total + full.index.count, 0);
    const indices = new Uint32Array(count);
    let offset = 0;
    for (const { full } of tiles) {
      indices.set(full.index.array, offset);
      offset += full.index.count;
    }
    overview = geometry(indices, source.boundingBox, source.boundingSphere);
  }
  const renderedTriangles = overview.index.count / 3;
  const whole = new THREE.Mesh(overview, terrain.material);
  whole.name = 'Terrain full-detail overview';
  whole.visible = false;
  group.add(whole);
  parent.add(group);
  terrain.removeFromParent();
  group.updateWorldMatrix(true, true);
  const previous = scene.onBeforeRender;
  scene.onBeforeRender = function (activeRenderer, activeScene, camera, renderTarget) {
    previous.call(this, activeRenderer, activeScene, camera, renderTarget);
    group.visible = terrain.visible;
    const exact =
      terrain.material !== snowMaterial || !camera.isPerspectiveCamera || exactRendering();
    const pixelScale =
      Math.abs(camera.projectionMatrix.elements[5]) * activeRenderer.domElement.height * 0.5;
    const view = camera.matrixWorldInverse.elements;
    frustum.setFromProjectionMatrix(
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    let visibleFullTriangles = 0,
      visibleCoarse = false;
    for (const tile of tiles) {
      tile.mesh.material = terrain.material;
      tile.mesh.receiveShadow = terrain.receiveShadow;
      tile.mesh.castShadow = terrain.castShadow;
      worldSphere.copy(tile.sphere).applyMatrix4(group.matrixWorld);
      const visible = frustum.intersectsSphere(worldSphere);
      let coarse = false;
      if (visible && !exact && tile.coarse) {
        const { x, y, z } = worldSphere.center;
        const depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]) - worldSphere.radius;
        // High detail remains mandatory near the camera. Distant height error
        // is kept below a fraction of one pixel, with hysteresis for small moves.
        coarse = depth > 500 && (1.4 * tile.error * pixelScale) / depth < (tile.low ? 0.65 : 0.5);
      }
      tile.low = coarse;
      tile.mesh.geometry = coarse ? tile.coarse : tile.full;
      if (visible) {
        visibleCoarse ||= coarse;
        visibleFullTriangles += tile.full.index.count / 3;
      }
    }
    // Splitting an already visible exact overview would only add draw calls.
    // Reset both paths on every render, including temporary workbench cameras.
    const useWhole = !visibleCoarse && visibleFullTriangles >= renderedTriangles * 0.97;
    whole.visible = useWhole;
    whole.material = terrain.material;
    whole.receiveShadow = terrain.receiveShadow;
    whole.castShadow = terrain.castShadow;
    for (const { mesh } of tiles) mesh.visible = !useWhole;
  };
  // Direct calls to intersectObject(terrain) still return original indices.
  // Exact tile bounding boxes avoid traversing the entire mountain on hover.
  const rayMesh = new THREE.Mesh(),
    rayHits = [];
  terrain.raycast = function (raycaster, hits) {
    rayMesh.material = this.material;
    rayMesh.matrixWorld.copy(this.matrixWorld);
    for (const { full, width, startX, startZ, faceMap } of tiles) {
      rayMesh.geometry = full;
      rayHits.length = 0;
      rayMesh.raycast(raycaster, rayHits);
      for (const hit of rayHits) {
        if (resortScope && !resortScope.contains(hit.point.x, hit.point.z)) continue;
        const faceIndex = faceMap ? faceMap[hit.faceIndex] : hit.faceIndex;
        const cell = Math.floor(faceIndex / 2);
        const i = startX + (cell % width),
          j = startZ + Math.floor(cell / width);
        hit.faceIndex = 2 * (j * (cols - 1) + i) + (faceIndex % 2);
        hit.object = this;
        hits.push(hit);
      }
    }
  };
  return {
    group,
    tiles,
    whole,
    get prepared() {
      return nextCoarse;
    },
    fullTriangles: renderedTriangles,
  };
}
