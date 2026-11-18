// Main pistes keep their DEM triangles. Artificial hotel earthworks are reference
// data only; a footprint cap and a vertical retaining interface own each core.
// This function is hoisted: finalizeHotelSites calls it before this module runs.
function hotelCoreSurface(site) {
  const polygon = site.structuralFootprint || site.footprint,
    points = polygon.map((p) => new THREE.Vector2(...p)),
    faces = THREE.ShapeUtils.triangulateShape(points, []),
    positions = polygon.flatMap((p) => [p[0], site.top, p[1]]),
    indices = faces.flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      polygon.flatMap(() => [1, 1, 1]),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mat = snowMat.clone();
  mat.userData.displayGroundOwner = true;
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = terrainSurfaceShaderHook;
  mat.customProgramCacheKey = () => terrainSurfaceCacheKey + '-core-owner';
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.receiveShadow = true;
  mesh.userData = { hotelGround: true, owner: site.owner, coreGround: true };
  buildings.add(mesh);
  const wallPositions = [],
    wallIndices = [];
  for (let i = 0; i < polygon.length; i++) {
    if (i === site.openEdge) continue;
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1);
    for (let j = 0; j < n; j++) {
      const p = [lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)],
        q = [lerp(a[0], b[0], (j + 1) / n), lerp(a[1], b[1], (j + 1) / n)],
        k = wallPositions.length / 3;
      wallPositions.push(
        p[0],
        site.top,
        p[1],
        q[0],
        site.top,
        q[1],
        p[0],
        heightAt(...p) - 0.2,
        p[1],
        q[0],
        heightAt(...q) - 0.2,
        q[1],
      );
      wallIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
  walls.setIndex(wallIndices);
  walls.computeVertexNormals();
  const wall = new THREE.Mesh(walls, material('#919f9d', { side: THREE.DoubleSide }));
  wall.userData.retainingCore = site.owner;
  wall.receiveShadow = true;
  buildings.add(wall);
  if (site.flowRestored || site.structuralFootprint) site.retainingWall = wall;
  return mesh;
}

function hotelStationApproachSurface(site) {
  const positions = [],
    indices = [],
    nx = 26,
    nz = Math.ceil((site.end - site.start) * 2),
    sample = (u, v) => {
      const p = site.center.clone().addScaledVector(site.side, u).addScaledVector(site.dir, v);
      return [p.x, site.heightAt(p.x, p.z), p.z];
    };
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      positions.push(...sample(lerp(-6.35, 6.35, i / nx), lerp(site.start, site.end, j / nz)));
      if (i < nx && j < nz) {
        const k = j * (nx + 1) + i;
        indices.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      positions.map(() => 1),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Query the rendered triangles, rather than the pre-tessellation grade.
  site.heightAt = (x, z) => {
    const dx = x - site.center.x,
      dz = z - site.center.z,
      u = clamp((dx * site.side.x + dz * site.side.z + 6.35) / 12.7, 0, 1) * nx,
      v =
        clamp((dx * site.dir.x + dz * site.dir.z - site.start) / (site.end - site.start), 0, 1) *
        nz,
      i = Math.min(nx - 1, Math.floor(u)),
      j = Math.min(nz - 1, Math.floor(v)),
      a = u - i,
      b = v - j,
      k = j * (nx + 1) + i,
      y = (id) => geometry.attributes.position.getY(id);
    return a + b <= 1
      ? y(k) + a * (y(k + 1) - y(k)) + b * (y(k + nx + 1) - y(k))
      : y(k + nx + 2) +
          (1 - a) * (y(k + nx + 1) - y(k + nx + 2)) +
          (1 - b) * (y(k + 1) - y(k + nx + 2));
  };
  const mat = snowMat.clone();
  mat.userData.displayGroundOwner = true;
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = terrainSurfaceShaderHook;
  mat.customProgramCacheKey = () => terrainSurfaceCacheKey + '-core-owner';
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData = { coreGround: true, owner: site.owner, stationApproach: true };
  mesh.receiveShadow = true;
  buildings.add(mesh);
  const wallPositions = [],
    wallIndices = [];
  for (let i = 1; i < site.polygon.length; i++) {
    const a = site.polygon[i],
      b = site.polygon[(i + 1) % site.polygon.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let j = 0; j < n; j++) {
      const p = [lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)],
        q = [lerp(a[0], b[0], (j + 1) / n), lerp(a[1], b[1], (j + 1) / n)],
        k = wallPositions.length / 3;
      wallPositions.push(
        p[0],
        heightAt(...p),
        p[1],
        q[0],
        heightAt(...q),
        q[1],
        p[0],
        site.heightAt(...p),
        p[1],
        q[0],
        site.heightAt(...q),
        q[1],
      );
      wallIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wallPositions, 3));
  walls.setIndex(wallIndices);
  walls.computeVertexNormals();
  const wall = new THREE.Mesh(walls, material('#919f9d', { side: THREE.DoubleSide }));
  wall.receiveShadow = true;
  buildings.add(wall);
}

hotelSnowFlow = (() => {
  // Defer access slabs after the immutable lift geometry has been constructed
  // using its original obstacle inputs. Hidden reference objects retain records.
  buildings.traverse((g) => {
    if (g.userData.estimatedSiteDetail || g.userData.pendingSnowAccess) g.visible = false;
  });
  for (let i = solidVolumes.length - 1; i >= 0; i--)
    if (solidVolumes[i].referenceAccess) solidVolumes.splice(i, 1);
  const sites = hotelDisplaySites.filter((s) => s.flowRestored),
    obstacles = sites.map((s) => ({
      owner: s.owner,
      polygon: s.footprint,
      height: s.top,
      pad: 1.2,
    }));
  // Preserve each terminal deck/support hall footprint; its broad reference apron
  // does not own exterior ski ground. Rope/support/terminal transforms are unchanged.
  for (const r of stationRecords) {
    const rt = lifts.find((l) => l.id === r.liftId).runtime,
      photoBase = [1, 2].includes(r.liftId) && r.t === 0,
      halfX = 6.35,
      halfZ = photoBase
        ? r.liftId === 1
          ? 14.25
          : 13.5
        : r.site.supportMode === 'roof-hall'
          ? 13.7
          : 12.75;
    const polygon = [
      [-halfX, -halfZ],
      [halfX, -halfZ],
      [halfX, halfZ],
      [-halfX, halfZ],
    ].map(([x, z]) => [
      r.center.x + rt.side.x * x + rt.dir.x * z,
      r.center.z + rt.side.z * x + rt.dir.z * z,
    ]);
    const core = {
      owner: 'station-' + r.liftId + '-' + r.t,
      footprint: polygon,
      top: r.groundBase - (r.site.supportMode === 'roof-hall' ? r.site.hallDepth : 0),
      openEdge: photoBase ? 2 : undefined,
    };
    // The boarding structure keeps its fixed level. The outside rim belongs
    // to the shared terrain, just like the adjacent pistes.
    if (r.t === 0)
      core.structuralFootprint = [
        [-5.35, -halfZ],
        [5.35, -halfZ],
        [5.35, halfZ],
        [-5.35, halfZ],
      ].map(([x, z]) => [
        r.center.x + rt.side.x * x + rt.dir.x * z,
        r.center.z + rt.side.z * x + rt.dir.z * z,
      ]);
    hotelCoreSurface(core);
    obstacles.push({
      owner: core.owner,
      polygon,
      height: core.top,
      pad: 1.2,
      structuralFootprint: core.structuralFootprint,
      retainingWall: core.retainingWall,
    });
    if (r.liftId === 6 && r.t === 0) {
      const hallPolygon = [
        [-12.2, -4.5],
        [-7.4, -4.5],
        [-7.4, 4.5],
        [-12.2, 4.5],
      ].map(([x, z]) => [
        r.center.x + rt.side.x * x + rt.dir.x * z,
        r.center.z + rt.side.z * x + rt.dir.z * z,
      ]);
      const hall = { owner: core.owner + '-side-hall', footprint: hallPolygon, top: r.groundBase };
      hotelCoreSurface(hall);
      obstacles.push({ owner: hall.owner, polygon: hallPolygon, height: hall.top, pad: 1.2 });
    }
    if (!photoBase) continue;
    // The existing rope needs its original excavation on the uphill approach.
    // Keep only a 12.7m service corridor, outside the source piste band, ending
    // beyond the original apron feather. This does not flatten any ski surface.
    const approach = {
      owner: core.owner + '-approach',
      center: r.center,
      side: rt.side,
      dir: rt.dir,
      start: halfZ,
      end: 40,
      pad: 1.2,
      heightAt: (x, z) => Math.min(heightAt(x, z), liftSurfaceHeight(x, z)),
    };
    approach.polygon = [
      [-halfX, halfZ],
      [halfX, halfZ],
      [halfX, 40],
      [-halfX, 40],
    ].map(([x, z]) => [
      r.center.x + rt.side.x * x + rt.dir.x * z,
      r.center.z + rt.side.z * x + rt.dir.z * z,
    ]);
    // In the refined build the station court is already part of the terrain.
    // Cutting a second trench here creates two independently sampled edges.
    if (localDemMode) approach.terrainOwned = true;
    else hotelStationApproachSurface(approach);
    obstacles.push(approach);
  }
  // Broad phase for terrain queries / moving skiers. Avoid testing every
  // building edge at every 20 cm skier offset step.
  const obstacleCells = new Map(),
    obstacleCellSize = 60;
  for (const o of obstacles) {
    o.boundsXZ = [
      Math.min(...o.polygon.map((p) => p[0])),
      Math.min(...o.polygon.map((p) => p[1])),
      Math.max(...o.polygon.map((p) => p[0])),
      Math.max(...o.polygon.map((p) => p[1])),
    ];
    const b = o.boundsXZ;
    for (
      let x = Math.floor((b[0] - 8) / obstacleCellSize);
      x <= Math.floor((b[2] + 8) / obstacleCellSize);
      x++
    )
      for (
        let z = Math.floor((b[1] - 8) / obstacleCellSize);
        z <= Math.floor((b[3] + 8) / obstacleCellSize);
        z++
      ) {
        const k = x + ',' + z;
        if (!obstacleCells.has(k)) obstacleCells.set(k, []);
        obstacleCells.get(k).push(o);
      }
  }
  const blocked = (x, z, pad = 0) =>
    (pad <= 8
      ? obstacleCells.get(
          Math.floor(x / obstacleCellSize) + ',' + Math.floor(z / obstacleCellSize),
        ) || []
      : obstacles
    ).some((o) => {
      const b = o.boundsXZ;
      if (x < b[0] - pad || x > b[2] + pad || z < b[1] - pad || z > b[3] + pad) return false;
      return inPolygon(x, z, o.polygon) || (pad > 0 && hotelEdgeDistance(x, z, o.polygon) < pad);
    });
  pisteSurfaceObstacles.push(...obstacles);
  // Geographic polygon tests avoid the several-metre raster cut guard that
  // used to require overlapping hotel meshes. The DEM alone owns the outside.
  const polygonGLSL = (o, index) => {
    let code = 'bool inside' + index + '=false;';
    o.polygon.forEach((a, i) => {
      const b = o.polygon[(i + 1) % o.polygon.length];
      if (Math.abs(a[1] - b[1]) < 1e-8) return;
      code +=
        'if(((flowXZ.y>' +
        a[1].toFixed(8) +
        ')!=(flowXZ.y>' +
        b[1].toFixed(8) +
        '))&&flowXZ.x<(' +
        a[0].toFixed(8) +
        '+(flowXZ.y-(' +
        a[1].toFixed(8) +
        '))*(' +
        ((b[0] - a[0]) / (b[1] - a[1])).toFixed(10) +
        ')))inside' +
        index +
        '=!inside' +
        index +
        ';';
    });
    // Most terrain fragments are nowhere near a building. Reject the bounding
    // rectangle before evaluating exact polygon edges (same clipping result).
    const xs = o.polygon.map((p) => p[0]),
      zs = o.polygon.map((p) => p[1]);
    const loX = (Math.min(...xs) - 0.00001).toFixed(8),
      hiX = (Math.max(...xs) + 0.00001).toFixed(8),
      loZ = (Math.min(...zs) - 0.00001).toFixed(8),
      hiZ = (Math.max(...zs) + 0.00001).toFixed(8);
    return (
      'if(flowXZ.x>=' +
      loX +
      '&&flowXZ.x<=' +
      hiX +
      '&&flowXZ.y>=' +
      loZ +
      '&&flowXZ.y<=' +
      hiZ +
      '){' +
      code +
      'if(inside' +
      index +
      ')discard;}'
    );
  };
  const groundCuts = obstacles
    .filter((o) => !o.terrainOwned)
    .map((o) =>
      localDemMode && o.structuralFootprint ? { ...o, polygon: o.structuralFootprint } : o,
    );
  const previous = snowMat.onBeforeCompile,
    key = snowMat.customProgramCacheKey.call(snowMat),
    cuts = groundCuts.map(polygonGLSL).join('\n');
  snowMat.onBeforeCompile = function (shader) {
    previous.call(this, shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nvec2 flowXZ=vec2(vSurfaceUV.x*' +
        SURFACE_X.toFixed(8) +
        '+(' +
        GEO.extent[0].toFixed(8) +
        '),vSurfaceUV.y*' +
        SURFACE_Z.toFixed(8) +
        '+(' +
        GEO.extent[1].toFixed(8) +
        '));\n' +
        cuts,
    );
  };
  snowMat.customProgramCacheKey = () => key + '-hotel-flow-core-cuts-bounds';
  snowMat.needsUpdate = true;
  const boundaryCorrections = [];
  const park = menglongPark.corridor,
    parkPolygon =
      menglongPark.boundary ||
      [
        [-park.width / 2, -park.length / 2],
        [park.width / 2, -park.length / 2],
        [park.width / 2, park.length / 2],
        [-park.width / 2, park.length / 2],
      ].map(([u, v]) => [
        park.center.x + park.side.x * u + park.dir.x * v,
        park.center.z + park.side.z * u + park.dir.z * v,
      ]);
  for (const t of trails.filter((t) => t.mapped)) {
    const displayObstacles =
      t.id === menglongPark.trailId
        ? obstacles
        : [...obstacles, { owner: 'park-snow-bed', polygon: parkPolygon }];
    const displayBlocked = (x, z, pad) =>
      displayObstacles.some(
        (o) => inPolygon(x, z, o.polygon) || hotelEdgeDistance(x, z, o.polygon) < pad,
      );
    // Densify only the display boundary. Source points, edges and width records
    // are never rewritten. A side ends at the first obstacle, with no snow sliver
    // painted on the far side of a building. Width recovery is limited to .6m/m.
    if (
      !t.points.some((p) =>
        displayObstacles.some((o) => hotelEdgeDistance(p.x, p.z, o.polygon) < 70),
      )
    )
      continue;
    // Authorised display reconstruction: a ski route goes around a terminal,
    // never through its elevated floor. Keep the source centreline separately.
    const sourceS = [0];
    for (let i = 1; i < t.points.length; i++)
      sourceS.push(
        sourceS.at(-1) +
          Math.hypot(t.points[i].x - t.points[i - 1].x, t.points[i].z - t.points[i - 1].z),
      );
    const detours = [];
    for (const obstacle of obstacles) {
      const hit = t.points
        .map((p, i) => ({ p, i, s: sourceS[i] }))
        .filter(
          (q) =>
            inPolygon(q.p.x, q.p.z, obstacle.polygon) ||
            hotelEdgeDistance(q.p.x, q.p.z, obstacle.polygon) < 2,
        );
      if (!hit.length || t.id === menglongPark.trailId) continue;
      const mid = hit[Math.floor(hit.length / 2)].i,
        a = t.points[Math.max(0, mid - 2)],
        b = t.points[Math.min(t.points.length - 1, mid + 2)],
        len = Math.hypot(b.x - a.x, b.z - a.z),
        nx = -(b.z - a.z) / len,
        nz = (b.x - a.x) / len;
      let chosen = null;
      for (const sign of [-1, 1])
        for (let d = 1; d <= 60; d++) {
          if (hit.every((q) => !displayBlocked(q.p.x + nx * d * sign, q.p.z + nz * d * sign, 7))) {
            if (!chosen || d < Math.abs(chosen.offset))
              chosen = {
                nx,
                nz,
                offset: d * sign,
                start: Math.max(0, hit[0].s - 80),
                flatStart: Math.max(1, hit[0].s - 12),
                flatEnd: hit.at(-1).s + 12,
                end: hit.at(-1).s + 80,
                owner: obstacle.owner,
              };
            break;
          }
        }
      if (!chosen)
        throw Error(
          'Cannot create continuous ski passage around ' + obstacle.owner + ' for ' + t.name,
        );
      detours.push(chosen);
    }
    const detourAt = (distance) => {
      let x = 0,
        z = 0;
      for (const d of detours) {
        const ease = (v) => {
          v = clamp(v, 0, 1);
          return v * v * v * (10 + v * (-15 + 6 * v));
        };
        const w =
          ease((distance - d.start) / (d.flatStart - d.start)) *
          ease((d.end - distance) / (d.end - d.flatEnd));
        x += d.nx * d.offset * w;
        z += d.nz * d.offset * w;
      }
      return { x, z };
    };
    t.displayDetours = detours;
    const sections = [];
    let s = 0;
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1],
        b = t.points[i],
        length = Math.hypot(b.x - a.x, b.z - a.z),
        n = Math.ceil(length);
      for (let j = 0; j < n; j++) {
        const f = j / n,
          p = a.clone().lerp(b, f),
          shift = detourAt(s + length * f),
          edges = {},
          widths = {};
        p.x += shift.x;
        p.z += shift.z;
        for (const side of ['minus', 'plus']) {
          const edge = t.edges[i - 1][side].map(
              (v, k) => lerp(v, t.edges[i][side][k], f) + (k ? shift.z : shift.x),
            ),
            d = Math.hypot(edge[0] - p.x, edge[1] - p.z);
          let w = d;
          if (displayObstacles.some((o) => hotelEdgeDistance(p.x, p.z, o.polygon) < d + 2))
            for (let k = 1; k <= Math.ceil(d / 0.2); k++) {
              const u = Math.min(1, (k * 0.2) / d);
              if (displayBlocked(lerp(p.x, edge[0], u), lerp(p.z, edge[1], u), 1.6)) {
                w = Math.max(0, k * 0.2 - 0.2);
                break;
              }
            }
          edges[side] = edge;
          widths[side] = { source: d, value: w < d - 1e-7 ? w : Infinity };
        }
        sections.push({ p, edges, widths, s: s + length * f });
      }
      s += length;
    }
    const last = t.points.length - 1,
      p = t.points[last].clone(),
      lastShift = detourAt(s),
      edges = Object.fromEntries(
        ['minus', 'plus'].map((side) => [
          side,
          t.edges[last][side].map((v, k) => v + (k ? lastShift.z : lastShift.x)),
        ]),
      );
    p.x += lastShift.x;
    p.z += lastShift.z;
    sections.push({
      p,
      edges,
      s,
      widths: Object.fromEntries(
        ['minus', 'plus'].map((side) => {
          const d = Math.hypot(edges[side][0] - p.x, edges[side][1] - p.z);
          return [side, { source: d, value: Infinity }];
        }),
      ),
    });
    for (const side of ['minus', 'plus']) {
      for (let i = 1; i < sections.length; i++)
        sections[i].widths[side].value = Math.min(
          sections[i].widths[side].value,
          sections[i - 1].widths[side].value + (sections[i].s - sections[i - 1].s) * 0.6,
        );
      for (let i = sections.length - 2; i >= 0; i--)
        sections[i].widths[side].value = Math.min(
          sections[i].widths[side].value,
          sections[i + 1].widths[side].value + (sections[i + 1].s - sections[i].s) * 0.6,
        );
    }
    t.displayPoints = sections.map((q) => q.p);
    t.displayEdges = sections.map((q) =>
      Object.fromEntries(
        ['minus', 'plus'].map((side) => {
          const w = q.widths[side];
          w.value = Math.min(w.source, w.value);
          const f = w.value / (w.source || 1);
          if (w.value < w.source - 1e-5)
            boundaryCorrections.push({
              trailId: t.id,
              trail: t.name,
              s: q.s,
              side,
              sourceWidthM: w.source,
              displayWidthM: w.value,
              reason:
                'first core or park edge + 1.6m clearance; .6m/m width recovery; source unchanged',
            });
          return [side, [lerp(q.p.x, q.edges[side][0], f), lerp(q.p.z, q.edges[side][1], f)]];
        }),
      ),
    );
    if (detours.length) {
      t.sourceCurve = t.curve;
      t.curve = polylineCurve(t.displayPoints);
    }
    // Invisible picking geometry follows the same corrected display boundary.
    const positions = [],
      indices = [];
    t.displayEdges.forEach((e, i) => {
      for (const side of ['minus', 'plus']) {
        const [x, z] = e[side];
        positions.push(x, heightAt(x, z) + 0.06, z);
      }
      if (i) {
        const k = i * 2;
        indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    t.mesh.geometry.dispose();
    t.mesh.geometry = geometry;
  }
  pisteFootprintIndex.clear();
  for (const t of trails.filter((t) => t.mapped)) indexTrailFootprint(t);
  for (const junction of reviewedSnowJunctions) indexPistePolygon(junction);
  repaintPistes();
  function limitOffset(center, candidate) {
    const avoidPark = !menglongPark.contains(center.x, center.z, 0),
      distance = center.distanceTo(candidate),
      n = Math.max(1, Math.ceil(distance / 0.2));
    let f = 1;
    for (let j = 1; j <= n; j++) {
      const u = j / n;
      if (
        blocked(lerp(center.x, candidate.x, u), lerp(center.z, candidate.z, u), 2) ||
        (avoidPark &&
          menglongPark.contains(
            lerp(center.x, candidate.x, u),
            lerp(center.z, candidate.z, u),
            1.6,
          ))
      ) {
        f = (j - 1) / n;
        break;
      }
    }
    return candidate.copy(center.clone().lerp(candidate, f));
  }
  return {
    obstacles,
    boundaryCorrections,
    blocked,
    limitOffset,
    contains: (x, z) =>
      blocked(x, z) ||
      sites.some((s) => inPolygon(x, z, s.outer)) ||
      liftStationSites.some(
        (s) =>
          s.terminals.some((t) => [1, 2].includes(t[0]) && t[1] === 0) &&
          Math.abs((x - s.center.x) * s.side.x + (z - s.center.z) * s.side.z) <= s.outerX + 1 &&
          Math.abs((x - s.center.x) * s.dir.x + (z - s.center.z) * s.dir.z - s.midZ) <=
            s.outerZ + 1,
      ),
    heightAt: (x, z) => {
      const o = obstacles.find((o) => inPolygon(x, z, o.polygon));
      if (o?.terrainOwned) return pisteGrading?.field(x, z) ?? liftSurfaceHeight(x, z);
      if (o?.heightAt) return o.heightAt(x, z);
      if (o?.snowFrontage?.some((p) => Math.hypot(x - p.x, z - p.z) < 2.1)) {
        return Math.max(o.height, pisteGrading?.field(x, z) ?? o.height);
      }
      if (o && (!o.structuralFootprint || inPolygon(x, z, o.structuralFootprint))) return o.height;
      return (
        (o?.structuralFootprint ? pisteGrading?.field(x, z) : null) ?? visibleTerrainHeightAt(x, z)
      );
    },
  };
})();
