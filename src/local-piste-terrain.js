// Conservative, reversible local earthworks on a conforming 2x DEM subdivision.
function applyLocalPisteTerrain() {
  const started = performance.now(),
    baselineGeometry = terrainGeo.clone(),
    cache = window.__LOCAL_TERRAIN_CACHE__;
  let cachedDelta = null;
  if (cache) {
    const bytes = Uint8Array.from(atob(cache.deltaBase64), (c) => c.charCodeAt(0));
    cachedDelta = new Float32Array(bytes.buffer);
    if (cachedDelta.length !== ((GEO.cols - 1) * 2 + 1) * ((GEO.rows - 1) * 2 + 1))
      throw Error('Local terrain cache topology mismatch');
  }
  const tuning = window.__LOCAL_TERRAIN_TUNING__ || {},
    cap = tuning.cap || 0.75,
    strength = tuning.strength || 0.25,
    smooth = (t) => {
      t = clamp(t, 0, 1);
      return t * t * t * (10 + t * (-15 + 6 * t));
    },
    index = new Map(),
    size = 60;
  const traverseCap = 6,
    maxShoulderWidth = 64;
  const stationCenters = stationDetailRecords
    .filter((r) => r.group)
    .map((r) => r.group.getWorldPosition(new V()));
  const corridors = [];
  if (!cache)
    for (const trail of trails.filter((t) => t.mapped)) {
      const p = trail.displayPoints || trail.points,
        e = trail.displayEdges || trail.edges;
      const chain = [0];
      for (let i = 1; i < p.length; i++)
        chain.push(chain[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z));
      let first = 0,
        last = 0;
      const sections = p.map((point, i) => {
        while (first < i && chain[first + 1] <= chain[i] - 16) first++;
        while (last < p.length - 1 && chain[last] < chain[i] + 16) last++;
        const dx = p[last].x - p[first].x,
          dz = p[last].z - p[first].z,
          length = Math.hypot(dx, dz) || 1;
        const nx = -dz / length,
          nz = dx / length;
        const offset = (edge) => (edge[0] - point.x) * nx + (edge[1] - point.z) * nz;
        const minus = offset(e[i].minus),
          plus = offset(e[i].plus);
        const left = Math.min(-7, minus, plus),
          right = Math.max(7, minus, plus);
        const h = (q) => heightAt(point.x + nx * q, point.z + nz * q);
        const low = h(left),
          high = h(right);
        const cross = (high - low) / (right - left);
        // A steep longitudinal pitch does not justify a sideways bank. Set the
        // transverse target in the route's own frame on every approach.
        const traverse = smooth((Math.abs(cross) - 0.065) / 0.14);
        const level = lerp((h(-4) + 2 * h(0) + h(4)) / 4, (low + high) / 2, 0.6 * traverse);
        return {
          nx,
          nz,
          left,
          right,
          traverse,
          level,
          leftShoulder: clamp(
            13 * Math.min(traverseCap, Math.abs(level - low)),
            28,
            maxShoulderWidth,
          ),
          rightShoulder: clamp(
            13 * Math.min(traverseCap, Math.abs(level - high)),
            28,
            maxShoulderWidth,
          ),
          endWeight: smooth(Math.min(chain[i], chain.at(-1) - chain[i]) / 18),
        };
      });
      const polygon = e.map((q) => q.minus).concat(e.map((q) => q.plus).reverse());
      const corridor = { polygon, segments: [], trail: trail.name, level: trail.level };
      corridors.push(corridor);
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1],
          b = p[i],
          dx = b.x - a.x,
          dz = b.z - a.z,
          length = Math.hypot(dx, dz);
        if (length < 0.01) continue;
        const s = { a, b, dx, dz, length, corridor, start: sections[i - 1], end: sections[i] };
        corridor.segments.push(s);
        const pad =
          Math.max(
            -s.start.left + s.start.leftShoulder,
            s.start.right + s.start.rightShoulder,
            -s.end.left + s.end.leftShoulder,
            s.end.right + s.end.rightShoulder,
          ) + 2;
        for (
          let ix = Math.floor((Math.min(a.x, b.x) - pad) / size);
          ix <= Math.floor((Math.max(a.x, b.x) + pad) / size);
          ix++
        )
          for (
            let iz = Math.floor((Math.min(a.z, b.z) - pad) / size);
            iz <= Math.floor((Math.max(a.z, b.z) + pad) / size);
            iz++
          ) {
            const k = ix + ',' + iz;
            if (!index.has(k)) index.set(k, []);
            index.get(k).push(s);
          }
      }
    }
  function deltaAt(x, z) {
    const candidates = index.get(Math.floor(x / size) + ',' + Math.floor(z / size));
    if (!candidates) return 0;
    if (hotelSnowFlow.blocked(x, z, 20) || menglongPark.contains(x, z, 25)) return 0;
    for (const p of pylonDetailRecords)
      if (p.foot && Math.hypot(x - p.foot[0], z - p.foot[2]) < 20) return 0;
    for (const p of stationCenters) if (Math.hypot(x - p.x, z - p.z) < 45) return 0;
    let protect = 1,
      legacyWeight = 1;
    // These bends defeated the earlier narrow transverse correction. Only
    // suppress that correction here; the wider, level bench handles traverses.
    for (const q of [
      [-660, 906, 55],
      [-1234, 284, 35],
    ])
      legacyWeight = Math.min(legacyWeight, smooth((Math.hypot(x - q[0], z - q[1]) - q[2]) / 35));
    for (const o of hotelSnowFlow.obstacles)
      protect = Math.min(protect, smooth((hotelEdgeDistance(x, z, o.polygon) - 20) / 15));
    for (const p of pylonDetailRecords)
      if (p.foot)
        protect = Math.min(protect, smooth((Math.hypot(x - p.foot[0], z - p.foot[2]) - 20) / 15));
    for (const p of stationCenters)
      protect = Math.min(protect, smooth((Math.hypot(x - p.x, z - p.z) - 45) / 15));
    if (menglongPark.contains(x, z, 40)) {
      let lo = 25,
        hi = 40;
      for (let k = 0; k < 8; k++) {
        const m = (lo + hi) / 2;
        if (menglongPark.contains(x, z, m)) hi = m;
        else lo = m;
      }
      protect = Math.min(protect, smooth((hi - 25) / 15));
    }
    const nearest = new Map();
    for (const s of candidates) {
      const t = clamp(((x - s.a.x) * s.dx + (z - s.a.z) * s.dz) / (s.length * s.length), 0, 1),
        cx = lerp(s.a.x, s.b.x, t),
        cz = lerp(s.a.z, s.b.z, t),
        dist = Math.hypot(x - cx, z - cz);
      if (!nearest.has(s.corridor) || dist < nearest.get(s.corridor).dist)
        nearest.set(s.corridor, { s, t, cx, cz, dist });
    }
    let sum = 0,
      n = 0,
      cover = 0;
    const samples = [];
    for (const [c, { s, t, cx, cz, dist }] of nearest) {
      const at = (key) => lerp(s.start[key], s.end[key], t);
      const side = (x - cx) * at('nx') + (z - cz) * at('nz');
      const edge = side < 0 ? -at('left') : at('right');
      const shoulderWidth = at(side < 0 ? 'leftShoulder' : 'rightShoulder');
      const outside = Math.max(0, dist - edge - 1.5);
      const shoulder = 1 - smooth(outside / shoulderWidth);
      // Fade the cut at the piste edge, rather than extending the level
      // bench through the shoulder and reaching the cap far into the hillside.
      const reach = dist - outside;
      const fraction = dist ? reach / dist : 1;
      const benchWeight = at('traverse') * at('endWeight') * shoulder;
      const inTrail = inPolygon(x, z, c.polygon);
      const depth = inTrail ? hotelEdgeDistance(x, z, c.polygon) : 0;
      const oldWeight = legacyWeight * smooth(depth / 8) * (1 - benchWeight);
      samples.push({ s, cx, cz, benchWeight, oldWeight, depth, level: at('level'), fraction });
    }
    let deepest = 0;
    for (const sample of samples) deepest = Math.max(deepest, sample.depth);
    for (const { s, cx, cz, benchWeight, oldWeight, depth, level, fraction } of samples) {
      if (benchWeight + oldWeight === 0) continue;
      // Follow the centre profile along the piste, with a level cross section.
      // Carry the cut/fill past the marked snow edge before returning to the hillside.
      const benchDelta = benchWeight
        ? clamp(
            level - heightAt(lerp(cx, x, fraction), lerp(cz, z, fraction)),
            -traverseCap,
            traverseCap,
          )
        : 0;
      let oldDelta = 0;
      if (oldWeight) {
        const nx = -s.dz / s.length,
          nz = s.dx / s.length;
        const cross =
          (heightAt(cx + nx * 6, cz + nz * 6) - heightAt(cx - nx * 6, cz - nz * 6)) / 12;
        oldDelta = clamp(
          -((x - cx) * nx + (z - cz) * nz) * (cross - clamp(cross, -0.2, 0.2)) * strength,
          -cap,
          cap,
        );
      }
      // Give an overlapping piste's interior precedence over a neighbour's
      // outer earthworks, with a continuous transition across the snow edge.
      const priority = 1 - 0.9 * smooth((deepest - depth) / 5);
      const w = (oldWeight + benchWeight) * priority;
      sum += (benchDelta * benchWeight + oldDelta * oldWeight) * priority;
      n += w;
      cover = Math.max(cover, w);
    }
    return n ? (sum / n) * protect * cover : 0;
  }
  const cols = (GEO.cols - 1) * 2 + 1,
    rows = (GEO.rows - 1) * 2 + 1,
    count = cols * rows,
    positions = new Float32Array(count * 3),
    colors = new Float32Array(count * 3),
    uv = new Float32Array(count * 2),
    indices = [];
  const siteBaseline = cache ? null : new Float32Array(count);
  const sourceHeights = cache ? null : new Float32Array(count);
  const pisteInfluence = cache ? null : new Uint8Array(count);
  const siteHeight = tuning.skipSite ? (_x, _z, y) => y : buildingGroundRefinement;
  // Sparse millimetre offsets from the preceding checked release. This
  // baseline includes the station and terrain transitions already verified.
  const reference = window.__LOCAL_TERRAIN_CROSS_REFERENCE__;
  let priorDelta = null;
  if (!cache && !tuning.skipPiste && !tuning.skipSite && reference) {
    const bytes = Uint8Array.from(atob(reference), (c) => c.charCodeAt(0));
    const data = new DataView(bytes.buffer);
    priorDelta = new Float32Array(count);
    for (let i = 0; i < data.byteLength; i += 6) {
      const vertex = data.getUint32(i, true);
      if (vertex >= count) throw Error('Crossfall reference topology mismatch');
      priorDelta[vertex] = data.getInt16(i + 4, true) / 1000;
    }
  }
  const changedBounds = [Infinity, Infinity, -Infinity, -Infinity];
  let changed = 0,
    maxDelta = 0,
    sumDelta = 0,
    siteChanged = 0,
    maxSiteDelta = 0;
  const tint = new THREE.Color();
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i,
        [x, z] = projectGeo([
          lerp(GEO.bounds[2], GEO.bounds[0], i / (cols - 1)),
          lerp(GEO.bounds[1], GEO.bounds[3], j / (rows - 1)),
        ]),
        d = cache || tuning.skipPiste ? 0 : deltaAt(x, z);
      const raw = heightAt(x, z);
      if (sourceHeights) sourceHeights[k] = raw;
      const site = cache
        ? raw + cachedDelta[k]
        : priorDelta && !d
          ? raw + priorDelta[k]
          : siteHeight(x, z, raw + d, tuning.previousSite);
      const siteDelta = site - (raw + d);
      if (siteBaseline)
        siteBaseline[k] = priorDelta ? raw + priorDelta[k] : siteHeight(x, z, raw, true);
      if (pisteInfluence) pisteInfluence[k] = Math.abs(d) > 0.001 ? 1 : 0;
      if (Math.abs(siteDelta) > 0.001) {
        siteChanged++;
        maxSiteDelta = Math.max(maxSiteDelta, Math.abs(siteDelta));
      }
      positions.set([x, site, z], k * 3);
      tint.copy(terrainWhite).lerp(terrainCold, 0.1 + 0.08 * Math.sin(x * 0.002 - z * 0.001));
      colors.set([tint.r, tint.g, tint.b], k * 3);
      uv.set([i / (cols - 1), j / (rows - 1)], k * 2);
      if (Math.abs(d) > 0.001) {
        changed++;
        changedBounds[0] = Math.min(changedBounds[0], x);
        changedBounds[1] = Math.min(changedBounds[1], z);
        changedBounds[2] = Math.max(changedBounds[2], x);
        changedBounds[3] = Math.max(changedBounds[3], z);
        maxDelta = Math.max(maxDelta, Math.abs(d));
        sumDelta += Math.abs(d);
      }
      if (i < cols - 1 && j < rows - 1)
        indices.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1);
    }
  // The accepted site before this revision is the common fallback for both
  // station outskirts and piste earthworks. This also audits site-only builds.
  const gradeLimits = !cache
    ? limitPisteGrades(positions, indices, siteBaseline, cols, rows, pisteInfluence, sourceHeights)
    : null;
  let crossSectionLeveling = null,
    edgeLeveling = null;
  if (!cache && !tuning.skipPiste && !tuning.skipSite) {
    const current = Float32Array.from(siteBaseline, (_, i) => positions[i * 3 + 1]);
    const entrances = hotels
      .filter((h) => h.siteAccess?.lobby)
      .map((h) => {
        const [x, z] = h.siteAccess.lobby;
        return h.group.localToWorld(new V(x, 0, z));
      });
    const hotelApron = hotelDisplaySites
      .find((s) => s.owner === 'hotel-1')
      ?.regions.find((r) => r.kind === 'snow-apron');
    const boardingCourts = liftStationSites.filter((s) =>
      s.terminals.some(([id, end]) => [1, 2].includes(id) && end === 0),
    );
    const protectedGround = (x, z) =>
      hotelSnowFlow.blocked(x, z, 7) ||
      entrances.some((p) => Math.hypot(x - p.x, z - p.z) < 15) ||
      (hotelApron &&
        (inPolygon(x, z, hotelApron.polygon) || hotelEdgeDistance(x, z, hotelApron.polygon) < 9)) ||
      boardingCourts.some(
        (s) =>
          Math.abs((x - s.center.x) * s.side.x + (z - s.center.z) * s.side.z) <= s.outerX + 1 &&
          Math.abs((x - s.center.x) * s.dir.x + (z - s.center.z) * s.dir.z - s.midZ) <=
            s.outerZ + 1,
      ) ||
      menglongPark.contains(x, z, 18) ||
      stationCenters.some((p) => Math.hypot(x - p.x, z - p.z) < 20) ||
      pylonDetailRecords.some((p) => p.foot && Math.hypot(x - p.foot[0], z - p.foot[2]) < 10);
    const leveling = preparePisteLeveling(positions, current, cols, rows, protectedGround);
    crossSectionLeveling = {
      ...limitPisteGrades(
        positions,
        indices,
        current,
        cols,
        rows,
        leveling.movable,
        sourceHeights,
        leveling,
      ),
      sectionConstraints: leveling.sections.length,
      profileConstraints: leveling.profiles.length,
      vehicleClearanceConstraints: leveling.clearances.length,
      capM: leveling.cap,
    };
    const leveled = Float32Array.from(current, (_, i) => positions[i * 3 + 1]);
    const edges = preparePisteLeveling(positions, leveled, cols, rows, protectedGround, true);
    edgeLeveling = {
      ...limitPisteGrades(
        positions,
        indices,
        leveled,
        cols,
        rows,
        edges.movable,
        sourceHeights,
        edges,
      ),
      sectionConstraints: edges.sections.length,
      vehicleClearanceConstraints: edges.clearances.length,
      sampleStepM: 1,
      edgeDifferenceLimitM: 0.5,
      capM: edges.cap,
    };
  }
  if (gradeLimits) {
    changed = 0;
    maxDelta = 0;
    sumDelta = 0;
    changedBounds.splice(0, 4, Infinity, Infinity, -Infinity, -Infinity);
    for (let i = 0; i < count; i++) {
      const offset = i * 3,
        d = Math.abs(positions[offset + 1] - siteBaseline[i]);
      if (d <= 0.001) continue;
      changed++;
      sumDelta += d;
      maxDelta = Math.max(maxDelta, d);
      changedBounds[0] = Math.min(changedBounds[0], positions[offset]);
      changedBounds[1] = Math.min(changedBounds[1], positions[offset + 2]);
      changedBounds[2] = Math.max(changedBounds[2], positions[offset]);
      changedBounds[3] = Math.max(changedBounds[3], positions[offset + 2]);
    }
  }
  if (valleyCourt)
    for (let i = 0; i < count; i++) {
      const k = i * 3,
        y = valleyCourt.heightAt(positions[k], positions[k + 2]);
      if (y !== null) positions[k + 1] = y;
    }
  // Offline, jointly constrained correction of the FINAL displayed ground.
  // Refuse stale corrections rather than silently applying them to a new terrain.
  const finalCrossfall = window.__FINAL_CROSSFALL_PATCH__;
  if (finalCrossfall) {
    if (finalCrossfall.vertexCount !== count) throw Error('Crossfall correction topology mismatch');
    for (const [id, before] of finalCrossfall.values)
      if (Math.abs(positions[id * 3 + 1] - before) > 0.002)
        throw Error('Crossfall correction baseline mismatch');
    for (const [id, , after] of finalCrossfall.values) positions[id * 3 + 1] = after;
  }
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  terrainGeo.setIndex(indices);
  terrainGeo.deleteAttribute('normal');
  terrainGeo.computeVertexNormals();
  terrainGeo.computeBoundingSphere();
  function field(x, z) {
    const geo = unprojectGeo(x, z);
    if (
      geo[0] < GEO.bounds[0] ||
      geo[0] > GEO.bounds[2] ||
      geo[1] < GEO.bounds[1] ||
      geo[1] > GEO.bounds[3]
    ) {
      [x, z] = projectGeo([
        clamp(geo[0], GEO.bounds[0], GEO.bounds[2]),
        clamp(geo[1], GEO.bounds[1], GEO.bounds[3]),
      ]);
    }
    const [lon, lat] = unprojectGeo(x, z),
      u = clamp(
        ((GEO.bounds[2] - lon) / (GEO.bounds[2] - GEO.bounds[0])) * (cols - 1),
        0,
        cols - 1,
      ),
      v = clamp(
        ((lat - GEO.bounds[1]) / (GEO.bounds[3] - GEO.bounds[1])) * (rows - 1),
        0,
        rows - 1,
      ),
      i = Math.min(cols - 2, Math.floor(u)),
      j = Math.min(rows - 2, Math.floor(v)),
      k = j * cols + i;
    const sample = (a, b, c) => {
      a *= 3;
      b *= 3;
      c *= 3;
      const dx = x - positions[a],
        dz = z - positions[a + 2],
        bx = positions[b] - positions[a],
        bz = positions[b + 2] - positions[a + 2],
        cx = positions[c] - positions[a],
        cz = positions[c + 2] - positions[a + 2],
        det = bx * cz - bz * cx,
        p = (dx * cz - dz * cx) / det,
        q = (bx * dz - bz * dx) / det;
      return {
        p,
        q,
        y:
          positions[a + 1] +
          p * (positions[b + 1] - positions[a + 1]) +
          q * (positions[c + 1] - positions[a + 1]),
      };
    };
    const first = sample(k, k + 1, k + cols);
    return first.p + first.q <= 1 ? first.y : sample(k + cols + 1, k + cols, k + 1).y;
  }
  const report = {
    mode: 'local-dem',
    cached: false,
    vertices: count,
    changedVertices: changed,
    changedBoundsXZ: changed ? changedBounds : null,
    estimatedChangedAreaM2:
      (changed * Math.abs((GEO.extent[2] - GEO.extent[0]) * (GEO.extent[3] - GEO.extent[1]))) /
      ((cols - 1) * (rows - 1)),
    maxAbsoluteDeltaM: maxDelta,
    meanAbsoluteChangedDeltaM: sumDelta / (changed || 1),
    sourceUnmodified: true,
    siteEarthwork: { changedVertices: siteChanged, maxAbsoluteDeltaM: maxSiteDelta },
    capM: cap,
    traverseCapM: traverseCap,
  };
  const measurements = [];
  for (const c of corridors)
    for (let i = 0; i < c.segments.length; i += 8) {
      const s = c.segments[i],
        x = (s.a.x + s.b.x) / 2,
        z = (s.a.z + s.b.z) / 2,
        nx = -s.dz / s.length,
        nz = s.dx / s.length;
      const slope = (f) => Math.abs((f(x + nx * 3, z + nz * 3) - f(x - nx * 3, z - nz * 3)) / 6);
      const longitudinal = (f) =>
        Math.abs(
          (f(x + (s.dx / s.length) * 3, z + (s.dz / s.length) * 3) -
            f(x - (s.dx / s.length) * 3, z - (s.dz / s.length) * 3)) /
            6,
        );
      const blocked = hotelSnowFlow.blocked(x, z, 2) || menglongPark.contains(x, z, 2),
        snow = pisteFootprintClearance(x, z).clearance <= 0,
        siteDelta =
          typeof buildingGroundRefinement === 'function'
            ? buildingGroundRefinement(x, z, heightAt(x, z)) - heightAt(x, z)
            : 0;
      measurements.push({
        x,
        z,
        trail: c.trail,
        level: c.level,
        blocked,
        snow,
        siteDelta,
        before: slope(heightAt),
        after: slope(field),
        longBefore: longitudinal(heightAt),
        longAfter: longitudinal(field),
      });
    }
  report.crossSlope = {
    samples: measurements.length,
    improved: measurements.filter((q) => q.after < q.before - 0.001).length,
    worsened: measurements.filter((q) => q.after > q.before + 0.001).length,
    residualOver20Percent: measurements.filter((q) => q.after > 0.2).length,
    meanBefore: measurements.reduce((s, q) => s + q.before, 0) / measurements.length,
    meanAfter: measurements.reduce((s, q) => s + q.after, 0) / measurements.length,
  };
  report.worstLongitudinal = measurements
    .slice()
    .sort((a, b) => b.longAfter - b.longBefore - (a.longAfter - a.longBefore))
    .slice(0, 20);
  report.worstCross = measurements
    .slice()
    .sort((a, b) => b.after - b.before - (a.after - a.before))
    .slice(0, 20);
  const ski = measurements.filter((q) => q.snow && !q.blocked);
  report.skiSurface = {
    samples: ski.length,
    improved: ski.filter((q) => q.after < q.before - 0.001).length,
    worsened: ski.filter((q) => q.after > q.before + 0.001).length,
    residualOver20Percent: ski.filter((q) => q.after > 0.2).length,
    maxLongChange: Math.max(0, ...ski.map((q) => Math.abs(q.longAfter - q.longBefore))),
    worstLongitudinal: ski
      .slice()
      .sort((a, b) => b.longAfter - b.longBefore - (a.longAfter - a.longBefore))
      .slice(0, 20),
    worstCross: ski
      .slice()
      .sort((a, b) => b.after - b.before - (a.after - a.before))
      .slice(0, 20),
  };
  report.longitudinalSlope = {
    samples: measurements.length,
    meanBefore: measurements.reduce((s, q) => s + q.longBefore, 0) / measurements.length,
    meanAfter: measurements.reduce((s, q) => s + q.longAfter, 0) / measurements.length,
    maxIncrease: Math.max(0, ...measurements.map((q) => q.longAfter - q.longBefore)),
    maxChange: Math.max(0, ...measurements.map((q) => Math.abs(q.longAfter - q.longBefore))),
  };
  report.gradeLimits = gradeLimits;
  report.crossSectionLeveling = crossSectionLeveling;
  report.edgeLeveling = edgeLeveling;
  if (cache) {
    Object.assign(report, cache.report);
    report.cached = true;
  }
  report.valleyCourt = valleyCourt
    ? { polygon: valleyCourt.polygon, level: valleyCourt.level, bounds: valleyCourt.bounds }
    : null;
  menglongPark.reconcileTerrain?.(field);
  report.buildMilliseconds = performance.now() - started;
  return {
    baselineGeometry,
    field,
    heightAt: (x, z) =>
      hotelSnowFlow.blocked(x, z) || menglongPark.contains(x, z) ? null : field(x, z),
    mesh: terrain,
    report,
    contains: (x, z) => pisteFootprintClearance(x, z).clearance <= 0,
  };
}
