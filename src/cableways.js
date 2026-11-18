// Source centrelines stay unchanged. Display-only support adjustments are recorded separately.
const liftRuntimes = [],
  laneWidth = 3;
const liftStationSites = [];
function stationSite(liftId, end) {
  return liftStationSites.find((s) => s.terminals.some((t) => t[0] === liftId && t[1] === end));
}
function stationSiteInfluence(s, x, z) {
  const dx = x - s.center.x,
    dz = z - s.center.z,
    u = dx * s.side.x + dz * s.side.z,
    v = dx * s.dir.x + dz * s.dir.z;
  const smooth = THREE.MathUtils.smoothstep;
  return (
    (1 - smooth(Math.abs(u), s.innerX, s.outerX)) *
    (1 - smooth(Math.abs(v - s.midZ), s.innerZ, s.outerZ))
  );
}
function liftSurfaceHeight(x, z, terrainApproach = false) {
  const source = heightAt(x, z);
  let surface = source,
    summitApplied = false;
  for (const s of orderedLiftStationSites) {
    let w = stationSiteInfluence(s, x, z);
    if (terrainApproach && s.supportMode === 'roof-hall' && source < s.base) {
      if (summitApplied) continue;
      summitApplied = true;
      // One shared raised terrace. Multiplying all four overlapping outer
      // tapers pushes the slope change into an unnecessarily short transition.
      let remaining = 1,
        power = 0;
      for (const terminal of sharedSummitSites) {
        const weight = stationSiteInfluence(terminal, x, z);
        remaining *= 1 - weight;
        power += weight ** 8;
      }
      w = Math.min(1 - remaining, power ** 0.125);
    }
    if (w <= 0) continue;
    const candidate = source + clamp(s.base - source, -6, 6);
    // Compose high terraces first; lower boarding cores retain their datum.
    // At zero weight a newly entering terrace has exactly zero influence.
    surface = lerp(surface, candidate, w);
  }
  return valleyCourt?.heightAt(x, z) ?? surface;
}
// Small, oriented station courts, independent of the immutable DEM and source line.
for (const lift of lifts.filter((l) => l.mapped))
  for (const end of [0, 1]) {
    if (lift.id === 2 && end === 0) continue;
    const a = posAtMap(lift.path[0]),
      b = posAtMap(lift.path[1]),
      dir = b.clone().sub(a);
    dir.y = 0;
    dir.normalize();
    const side = new V(-dir.z, 0, dir.x),
      center = (end ? b : a).clone(),
      pair = lift.id === 1 && end === 0;
    if (pair) center.lerp(posAtMap(lifts.find((l) => l.id === 2).path[0]), 0.5);
    const sideHall = lift.id === 6 && end === 0;
    liftStationSites.push({
      terminals: pair
        ? [
            [1, 0],
            [2, 0],
          ]
        : [[lift.id, end]],
      center,
      dir,
      side,
      base: heightAt(center.x, center.z) + 0.35,
      innerX: pair ? 18 : sideHall ? 13 : 8.5,
      outerX: pair ? 90 : sideHall ? 85 : 80.5,
      midZ: pair ? 5 : 0,
      innerZ: pair ? 21 : 20,
      outerZ: pair ? 93 : 92,
      kind: end ? 'summit-terrace' : 'base-apron',
      supportMode: end && [1, 2, 5, 6].includes(lift.id) ? 'roof-hall' : 'graded-apron',
      hallDepth: 7.2,
    });
  }
// Adjacent summit terminals share a prepared level; avoid competing intersecting cuts.
{
  const summit = liftStationSites.filter(
    (s) => s.terminals[0][1] === 1 && [1, 2, 5, 6].includes(s.terminals[0][0]),
  );
  const level = summit.reduce((v, s) => v + s.base, 0) / summit.length;
  summit.forEach((s) => (s.base = level));
}
const orderedLiftStationSites = liftStationSites.slice().sort((a, b) => b.base - a.base);
const sharedSummitSites = liftStationSites.filter((s) => s.supportMode === 'roof-hall');
// Prepared snow court is shared by ground triangles and every cable clearance
// query. Never lower a terminal against the unmodified DEM obstacle surface.
var valleyCourt = null;
if (localDemMode && window.__LOCAL_TERRAIN_CACHE__) {
  const hotel = hotelDisplaySites.find((s) => s.owner === 'hotel-1'),
    apron = hotel?.regions.find((r) => r.kind === 'snow-apron'),
    station = stationSite(1, 0);
  if (apron && station) {
    const corners = [
      [-29, -30],
      [29, -30],
      [29, 30],
      [-29, 30],
    ].map(([u, v]) => [
      station.center.x + station.side.x * u + station.dir.x * v,
      station.center.z + station.side.z * u + station.dir.z * v,
    ]);
    const polygon = hotelHull([...apron.polygon, ...corners]),
      level = hotel.top,
      feather = 180;
    const bounds = [
      Math.min(...polygon.map((p) => p[0])) - feather,
      Math.min(...polygon.map((p) => p[1])) - feather,
      Math.max(...polygon.map((p) => p[0])) + feather,
      Math.max(...polygon.map((p) => p[1])) + feather,
    ];
    const bytes = Uint8Array.from(atob(window.__LOCAL_TERRAIN_CACHE__.deltaBase64), (c) =>
        c.charCodeAt(0),
      ),
      delta = new Float32Array(bytes.buffer),
      cols = (GEO.cols - 1) * 2 + 1,
      rows = (GEO.rows - 1) * 2 + 1;
    const origin = apron.polygon[0],
      edge = apron.polygon[1],
      len = Math.hypot(edge[0] - origin[0], edge[1] - origin[1]);
    let nx = -(edge[1] - origin[1]) / len,
      nz = (edge[0] - origin[0]) / len;
    if ((station.center.x - origin[0]) * nx + (station.center.z - origin[1]) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const smooth = (t) => {
      t = clamp(t, 0, 1);
      return t * t * t * (10 + t * (-15 + 6 * t));
    };
    const vertices = new Map();
    function vertex(i, j) {
      const k = j * cols + i;
      if (vertices.has(k)) return vertices.get(k);
      const [x, z] = projectGeo([
        lerp(GEO.bounds[2], GEO.bounds[0], i / (cols - 1)),
        lerp(GEO.bounds[1], GEO.bounds[3], j / (rows - 1)),
      ]);
      const raw = Math.fround(heightAt(x, z) + delta[k]),
        d = inPolygon(x, z, polygon) ? 0 : hotelEdgeDistance(x, z, polygon);
      // Feather across the frontage; recover the original arrival-road level behind it.
      const side = (x - origin[0]) * nx + (z - origin[1]) * nz,
        weight = (1 - smooth(d / feather)) * smooth((side + 70) / 70);
      const value = [Math.fround(x), Math.fround(lerp(raw, level, weight)), Math.fround(z)];
      vertices.set(k, value);
      return value;
    }
    function heightAtCourt(x, z) {
      if (x < bounds[0] || z < bounds[1] || x > bounds[2] || z > bounds[3]) return null;
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
        j = Math.min(rows - 2, Math.floor(v));
      const a = vertex(i, j),
        b = vertex(i + 1, j),
        c = vertex(i, j + 1),
        d = vertex(i + 1, j + 1);
      const sample = (a, b, c) => {
        const dx = x - a[0],
          dz = z - a[2],
          bx = b[0] - a[0],
          bz = b[2] - a[2],
          cx = c[0] - a[0],
          cz = c[2] - a[2],
          det = bx * cz - bz * cx,
          p = (dx * cz - dz * cx) / det,
          q = (bx * dz - bz * dx) / det;
        return { sum: p + q, y: a[1] + p * (b[1] - a[1]) + q * (c[1] - a[1]) };
      };
      const first = sample(a, b, c);
      return first.sum <= 1 ? first.y : sample(d, c, b).y;
    }
    valleyCourt = { polygon, level, bounds, heightAt: heightAtCourt };
    station.base = level;
  }
}
// Station structures retain their construction datum. The broad reference apron
// has no display mesh: hotelSnowFlow owns the exact terminal bodies and the
// shared graded terrain owns every exterior point.
function renderLiftSites() {}
const supportSitingRecords = [];
function supportPisteClearance(p) {
  const hit = pisteFootprintClearance(p.x, p.z);
  return { clearance: hit.clearance - 2, trail: hit.trail };
}
function sourceTClose(rt, t, d) {
  return rt.sourceT.some((s) => Math.abs(s - t) * rt.length < d);
}
for (const lift of lifts) {
  if (!lift.mapped) continue;
  const a = posAtMap(lift.path[0]),
    b = posAtMap(lift.path[1]),
    dir = b.clone().sub(a);
  dir.y = 0;
  dir.normalize();
  const side = new V(-dir.z, 0, dir.x),
    sourceLine = lift.geo.map((c) => {
      const [x, z] = projectGeo(c);
      return new V(x, 0, z);
    }),
    groundCurve = polylineCurve(sourceLine),
    length = groundCurve.getLength(),
    sourceLift = GEO.lifts.find((l) => l.osm.includes(lift.geoSource)),
    sourcePylons = sourceLift?.pylons || [];
  function parameterFor(c) {
    const [x, z] = projectGeo(c),
      p = new V(x, 0, z);
    let best = Infinity,
      at = 0,
      cumulative = 0;
    for (let i = 1; i < sourceLine.length; i++) {
      const aa = sourceLine[i - 1],
        bb = sourceLine[i],
        delta = bb.clone().sub(aa),
        len = delta.length(),
        t = clamp(p.clone().sub(aa).dot(delta) / (len * len || 1), 0, 1),
        d = p.distanceTo(aa.clone().lerp(bb, t));
      if (d < best) {
        best = d;
        at = (cumulative + t * len) / length;
      }
      cumulative += len;
    }
    return at;
  }
  const sourceT = sourcePylons.map(parameterFor),
    reviewed = REVIEWED_SUPPORT_LAYOUT.find((r) => r.id === lift.id);
  if (!reviewed) throw Error('Missing reviewed support layout');
  const towerT = reviewed.towerT.slice(),
    towerIds = towerT.map((_, i) => i),
    supportSiting = reviewed.supportSiting.map((r) => ({ ...r }));
  for (const correction of SUPPORT_POSITION_CORRECTIONS.filter((c) => c.liftId === lift.id)) {
    const previous = towerT[correction.index];
    towerT[correction.index] = correction.t;
    const old = supportSiting.findIndex((r) => r.index === correction.index);
    if (old >= 0) supportSiting.splice(old, 1);
    supportSiting.push({
      index: correction.index,
      originalT: previous,
      t: correction.t,
      shiftM: (correction.t - previous) * length,
      sourcePylon: false,
      sourceRetained: false,
      basis: correction.basis,
      beforeClearance: supportPisteClearance(groundCurve.getPoint(previous)).clearance,
      afterClearance: supportPisteClearance(groundCurve.getPoint(correction.t)).clearance,
      userCorrection: true,
    });
  }
  for (const restoration of SUPPORT_LAYOUT_REVIEW.restores.filter((r) => r.liftId === lift.id)) {
    towerT[restoration.index] = restoration.t;
    const record = supportSiting.find((r) => r.index === restoration.index);
    if (record)
      Object.assign(record, {
        t: restoration.t,
        shiftM: 0,
        sourceRetained: true,
        sourceRestoration: true,
        basis: restoration.reason,
        afterClearance: supportPisteClearance(groundCurve.getPoint(restoration.t)).clearance,
      });
  }
  // Remove the support node as well as its mesh: the rope must not kink at a deleted tower.
  const removedIds = new Set(
    SUPPORT_LAYOUT_REVIEW.removals.filter((r) => r.liftId === lift.id).map((r) => r.index),
  );
  for (let i = towerT.length - 1; i >= 0; i--)
    if (removedIds.has(towerIds[i])) {
      towerT.splice(i, 1);
      towerIds.splice(i, 1);
    }
  for (let i = supportSiting.length - 1; i >= 0; i--)
    if (removedIds.has(supportSiting[i].index)) supportSiting.splice(i, 1);
  // A geometric seed from the hanging envelope and adjacent-span sag reserve;
  // terrain/obstacle samples below determine each height separately. These
  // heights are estimates, not surveyed mast dimensions or a tension analysis.
  const towerY = towerT.map((t, i) => {
      const p = groundCurve.getPoint(t),
        adjacent = Math.max(t - (towerT[i - 1] ?? t), (towerT[i + 1] ?? t) - t) * length;
      return (
        liftSurfaceHeight(p.x, p.z) +
        (lift.type === 'gondola' ? 5.35 : 3.84) +
        3.85 +
        Math.min(3.5, adjacent * 0.018)
      );
    }),
    spanSag = [],
    terminalGroups = [],
    terminalProfiles = [];
  // The station return stays level. Its long exit assembly then changes the
  // rope grade continuously; the 16.5 m control is not a second boarding deck.
  const exitRise = (d) => (d <= 8 ? 0 : d < 16 ? ((d - 8) * (d - 8)) / 16 : d - 12);
  const exitGrade = (d) => (d <= 8 ? 0 : d < 16 ? (d - 8) / 8 : 1);
  function rawCable(t) {
    let span = 0;
    while (span < towerT.length - 2 && t > towerT[span + 1]) span++;
    for (const e of terminalProfiles) {
      const d = Math.abs(t - e.end) * length;
      if (d <= e.distance) {
        const delta = towerY[e.index] - e.level,
          scale = exitRise(e.distance);
        return {
          y: e.level + (delta * exitRise(d)) / scale,
          d: ((e.end ? -1 : 1) * length * delta * exitGrade(d)) / scale,
          span,
        };
      }
    }
    const t0 = towerT[span],
      t1 = towerT[span + 1],
      h = t1 - t0 || 1,
      u = (t - t0) / h,
      sag = spanSag[span] || 0;
    return {
      y: lerp(towerY[span], towerY[span + 1], u) - 4 * sag * u * (1 - u),
      d: (towerY[span + 1] - towerY[span] - 4 * sag * (1 - 2 * u)) / h,
      span,
    };
  }
  function cablePoint(t, lane = 0) {
    t = clamp(t, 0, 1);
    const raw = rawCable(t),
      p = groundCurve.getPoint(t);
    let y = raw.y;
    for (const node of [raw.span, raw.span + 1]) {
      if (node <= 0 || node >= towerT.length - 1) continue;
      const r = Math.min(
          2 / length,
          (towerT[node] - towerT[node - 1]) * 0.2,
          (towerT[node + 1] - towerT[node]) * 0.2,
        ),
        at = towerT[node];
      if (Math.abs(t - at) >= r) continue;
      const a = rawCable(at - r),
        b = rawCable(at + r),
        u = (t - at + r) / (2 * r),
        u2 = u * u,
        u3 = u2 * u;
      y =
        (2 * u3 - 3 * u2 + 1) * a.y +
        (u3 - 2 * u2 + u) * 2 * r * a.d +
        (-2 * u3 + 3 * u2) * b.y +
        (u3 - u2) * 2 * r * b.d;
      break;
    }
    return new V(p.x + side.x * lane, y, p.z + side.z * lane);
  }
  // Include both lanes, full vehicle width and DEM ridges between support nodes.
  for (let i = 0; i < towerT.length - 1; i++) {
    const t0 = towerT[i],
      t1 = towerT[i + 1],
      spanLength = (t1 - t0) * length;
    spanSag[i] = Math.min(3.5, spanLength * 0.018);
    let raise = 0;
    const samples = Math.ceil(spanLength / 2);
    for (let j = 0; j <= samples; j++) {
      const u = j / samples,
        t = lerp(t0, t1, u),
        p = groundCurve.getPoint(t),
        cy = lerp(towerY[i], towerY[i + 1], u) - 4 * spanSag[i] * u * (1 - u);
      for (const lane of [-4.8, -3, 0, 3, 4.8]) {
        const x = p.x + side.x * lane,
          z = p.z + side.z * lane;
        raise = Math.max(
          raise,
          (valleyCourt?.heightAt(x, z) ?? heightAt(x, z)) + 9 - cy,
          cabinObstacleTop(x, z) + 8.5 - cy,
        );
      }
    }
    if (raise > 0) {
      towerY[i] += raise;
      towerY[i + 1] += raise;
    }
  }
  // Station platforms need a level landing under the complete return sweep.
  for (const end of [0, 1]) {
    const p = groundCurve.getPoint(end),
      indices = towerT
        .map((t, i) => [t, i])
        .filter(([t]) => Math.abs(t - end) * length < (end ? 23 : 0.01))
        .map(([, i]) => i);
    let high = -Infinity;
    // Actual oriented deck/return footprint instead of a large world-axis square.
    for (let x = -7.8; x <= 7.8; x += 1.3)
      for (let z = -12.5; z <= 12.5; z += 1.25) {
        const q = p.clone().addScaledVector(side, x).addScaledVector(dir, z);
        high = Math.max(high, heightAt(q.x, q.z));
      }
    // The 12m flat approach must also clear terrain under the full cabin footprint.
    for (let d = 0; d <= 12; d += 1.5) {
      const q = groundCurve.getPoint(clamp(end + (end ? -d : d) / length, 0, 1));
      for (const x of [-5, 0, 5])
        high = Math.max(high, heightAt(q.x + side.x * x, q.z + side.z * x));
    }
    const site = stationSite(lift.id, end),
      level = site.base + (lift.type === 'gondola' ? 5.8 : 4.35);
    indices.forEach((i) => (towerY[i] = level));
    terminalGroups.push({ end, indices, initialLevel: level, groundHigh: high });
    const ordered = towerT
        .map((t, i) => ({ index: i, distance: Math.abs(t - end) * length }))
        .sort((a, b) => a.distance - b.distance),
      entry = ordered.find((n) => n.distance >= 23);
    if (!end && entry && entry.distance <= 40)
      terminalProfiles.push({
        end,
        index: entry.index,
        distance: entry.distance,
        level,
        flatDistance: 8,
        transitionEnd: 16,
        reference: 'photo-informed terminal guide; dimensions estimated',
      });
    for (let i = 0; i < spanSag.length; i++)
      if (indices.includes(i) && indices.includes(i + 1)) spanSag[i] = 0;
  }
  // Low approach supports rise gradually from the boarding rope to the line.
  // Terminal guides use the boarding envelope, not the full line reserve.
  for (let i = 1; i < towerT.length - 1; i++) {
    const distance = Math.min(towerT[i], 1 - towerT[i]) * length;
    if (terminalGroups.some((g) => g.indices.includes(i)) || distance >= 100) continue;
    const p = groundCurve.getPoint(towerT[i]),
      drop = lift.type === 'gondola' ? 5.35 : 3.84;
    const end = towerT[i] < 0.5 ? 0 : 1,
      boardingLevel = stationSite(lift.id, end).base + (lift.type === 'gondola' ? 5.8 : 4.35);
    // A roof terminal's ground floor is below its boarding roof. Do not pull
    // the first free rope node down towards that floor and create a sharp dip.
    const approachFloor = boardingLevel - Math.max(0, distance - 16.5) * 0.45;
    const lineReserve = Math.max(drop + 3.85, towerY[i] - liftSurfaceHeight(p.x, p.z));
    towerY[i] = Math.max(
      approachFloor,
      liftSurfaceHeight(p.x, p.z) +
        lerp(
          drop + 0.45,
          lineReserve,
          THREE.MathUtils.smoothstep(distance, end ? 16.5 : 28, end ? 100 : 120),
        ),
    );
  }
  for (let i = 0; i < spanSag.length; i++)
    if (Math.min(towerT[i + 1], 1 - towerT[i]) * length < 55) spanSag[i] = 0;
  function loopPoint(u) {
    u = ((u % 1) + 1) % 1;
    const turn = (Math.PI * laneWidth) / (2 * length + 2 * Math.PI * laneWidth),
      straight = 0.5 - turn;
    let p, tangent;
    if (u < straight) {
      p = cablePoint(u / straight, -laneWidth);
      tangent = dir.clone();
    } else if (u < 0.5) {
      const ang = -Math.PI / 2 + ((u - straight) / turn) * Math.PI;
      p = cablePoint(1);
      p.addScaledVector(side, Math.sin(ang) * laneWidth).addScaledVector(
        dir,
        Math.cos(ang) * laneWidth,
      );
      tangent = dir.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(side, Math.cos(ang));
    } else if (u < 1 - turn) {
      p = cablePoint(1 - (u - 0.5) / straight, laneWidth);
      tangent = dir.clone().negate();
    } else {
      const ang = Math.PI / 2 + ((u - (1 - turn)) / turn) * Math.PI;
      p = cablePoint(0);
      p.addScaledVector(side, Math.sin(ang) * laneWidth).addScaledVector(
        dir,
        Math.cos(ang) * laneWidth,
      );
      tangent = dir.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(side, Math.cos(ang));
    }
    return { p, tangent };
  }
  lift.geometryLength = length;
  const rt = {
    lift,
    a,
    b,
    side,
    dir,
    parts: [],
    count: clamp(Math.floor(length / 40), 12, 48),
    loopPoint,
    cablePoint,
    groundCurve,
    sourcePylons,
    sourceT,
    towerT,
    towerIds,
    towerY,
    terminalGroups,
    terminalProfiles,
    exitRise,
    supportSiting,
    phase: rand(),
    length,
    geometryLength: length,
  };
  lift.runtime = rt;
  liftRuntimes.push(rt);
  supportSitingRecords.push(...supportSiting.map((r) => ({ ...r, liftId: lift.id })));
}
// Vehicle motion is timed independently from the continuously moving rope.
// Detachable terminals slow carriers on their guide circuit; unverified types
// retain constant motion instead of inventing a detachable mechanism.
function prepareLiftMotion(rt) {
  const speed = rt.lift.speed || 3,
    detachable = rt.lift.type === 'gondola' || [2, 6].includes(rt.lift.id),
    stationSpeed = rt.lift.type === 'gondola' ? 0.65 : 1,
    loopLength = 2 * rt.length + 2 * Math.PI * laneWidth,
    turn = (Math.PI * laneWidth) / loopLength,
    straight = 0.5 - turn;
  const speedAt = (u) => {
    if (!detachable) return speed;
    let d = 0;
    if (u < straight) {
      const t = u / straight;
      d = Math.min(t, 1 - t) * rt.length;
    } else if (u >= 0.5 && u < 1 - turn) {
      const t = (u - 0.5) / straight;
      d = Math.min(t, 1 - t) * rt.length;
    }
    return lerp(stationSpeed, speed, THREE.MathUtils.smoothstep(d, 9, 45));
  };
  const n = Math.ceil(loopLength / 0.8),
    times = [0];
  let previous = rt.loopPoint(0).p;
  for (let i = 1; i <= n; i++) {
    const u = i / n,
      p = rt.loopPoint(u).p;
    times.push(times.at(-1) + previous.distanceTo(p) / speedAt((i - 0.5) / n));
    previous = p;
  }
  rt.cycleDuration = times.at(-1);
  rt.mechanism = detachable ? 'detachable-reference' : 'unverified';
  rt.motionSpeeds = { line: speed, station: detachable ? stationSpeed : speed, estimated: true };
  rt.vehicleU = (q) => {
    q = ((q % 1) + 1) % 1;
    const at = q * rt.cycleDuration;
    let lo = 0,
      hi = n;
    while (lo + 1 < hi) {
      const m = (lo + hi) >> 1;
      if (times[m] < at) lo = m;
      else hi = m;
    }
    return (lo + (at - times[lo]) / (times[hi] - times[lo] || 1)) / n;
  };
  rt.vehicleSpeedAt = speedAt;
}
function raiseCableSpan(rt, t, amount) {
  if (amount <= 0) return;
  let k = 0;
  while (k < rt.towerT.length - 2 && t > rt.towerT[k + 1]) k++;
  const entry = rt.terminalProfiles.find((e) => Math.abs(t - e.end) * rt.length <= e.distance);
  if (entry) {
    const ratio = rt.exitRise(Math.abs(t - entry.end) * rt.length) / rt.exitRise(entry.distance);
    if (ratio > 1e-6) rt.towerY[entry.index] += amount / ratio;
    return;
  }
  const ta = rt.towerT[k],
    tb = rt.towerT[k + 1],
    u = clamp((t - ta) / (tb - ta || 1), 0, 1),
    nodes = [k, k + 1];
  const fixed = (i) => rt.terminalGroups.some((g) => g.indices.includes(i));
  // Boarding rope height stays tied to its apron. Solve the adjoining span
  // using its free node, rather than lifting the complete boarding plateau.
  const free = nodes.filter((i) => !fixed(i));
  if (!free.length) return;
  const weight = free.reduce((v, i) => v + (i === k ? 1 - u : u), 0);
  if (weight < 1e-6) return;
  free.forEach((i) => (rt.towerY[i] += amount / weight));
}
// Revalidate the transitions after lowering the terminal plateaus.
for (let pass = 0; pass < 2; pass++)
  for (const rt of liftRuntimes)
    for (let k = 0; k < rt.towerT.length - 1; k++) {
      const ta = rt.towerT[k],
        tb = rt.towerT[k + 1],
        n = Math.max(1, Math.ceil(((tb - ta) * rt.length) / 0.75));
      let raise = 0,
        raiseAt = (ta + tb) / 2;
      for (let i = 0; i <= n; i++) {
        const t = lerp(ta, tb, i / n),
          p = rt.cablePoint(t);
        const distance = Math.min(t, 1 - t) * rt.length,
          { drop, halfWidth, halfLength } = vehicleHangingEnvelope(rt.lift),
          clearance = drop + lerp(0.45, 3.85, THREE.MathUtils.smoothstep(distance, 8, 120));
        // Sample the actual oriented hanging envelope, not an oversized world-axis
        // square. The margin grows over the approach instead of jumping at 23 m.
        for (const lane of [-laneWidth, laneWidth])
          for (const sx of [-halfWidth, 0, halfWidth])
            for (const sz of [-halfLength, 0, halfLength]) {
              const x = p.x + rt.side.x * (lane + sx) + rt.dir.x * sz,
                z = p.z + rt.side.z * (lane + sx) + rt.dir.z * sz,
                needed = Math.max(
                  liftSurfaceHeight(x, z) + clearance - p.y,
                  cabinObstacleTop(x, z) + drop + 0.45 - p.y,
                );
              if (needed > raise) {
                raise = needed;
                raiseAt = t;
              }
            }
      }
      if (raise > 0) raiseCableSpan(rt, raiseAt, raise);
    }
// Crossings prefer lifting the through-route, leaving a nearby low terminal grounded.
// No source centreline is moved. Close terminal/terminal conflicts may still require elevation.
const liftCrossings = [];
for (let a = 0; a < liftRuntimes.length; a++)
  for (let b = a + 1; b < liftRuntimes.length; b++) {
    const ra = liftRuntimes[a],
      rb = liftRuntimes[b],
      na = Math.ceil(ra.length / 6),
      nb = Math.ceil(rb.length / 6);
    for (let i = 0; i <= na; i++) {
      const ta = i / na,
        pa = ra.groundCurve.getPoint(ta),
        ea = Math.min(ta, 1 - ta) * ra.length;
      for (let j = 0; j <= nb; j++) {
        const tb = j / nb,
          pb = rb.groundCurve.getPoint(tb),
          eb = Math.min(tb, 1 - tb) * rb.length,
          nearStation = ea < 22 || eb < 22;
        if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > (nearStation ? 13 : 10.2)) continue;
        const upper =
          ea < 38 && eb >= 38
            ? rb
            : eb < 38 && ea >= 38
              ? ra
              : ra.cablePoint(ta).y >= rb.cablePoint(tb).y
                ? ra
                : rb;
        liftCrossings.push({
          upper,
          lower: upper === ra ? rb : ra,
          ut: upper === ra ? ta : tb,
          lt: upper === ra ? tb : ta,
          gap: nearStation ? 14.5 : 10,
        });
      }
    }
  }
for (let pass = 0; pass < 4; pass++)
  for (const c of liftCrossings)
    raiseCableSpan(c.upper, c.ut, c.lower.cablePoint(c.lt).y + c.gap - c.upper.cablePoint(c.ut).y);
// If a distant terrain constraint lifted the next support, distribute the
// climb across the first free support too. Only raise; never erase clearance.
for (const rt of liftRuntimes)
  for (const e of rt.terminalProfiles) {
    const next = rt.towerT
      .map((t, i) => ({ i, d: Math.abs(t - e.end) * rt.length }))
      .filter((n) => n.d > e.distance && n.d <= 80)
      .sort((a, b) => a.d - b.d)[0];
    if (next)
      rt.towerY[e.index] = Math.max(
        rt.towerY[e.index],
        e.level + ((rt.towerY[next.i] - e.level) * rt.exitRise(e.distance)) / rt.exitRise(next.d),
      );
    for (let i = 0; i < rt.towerT.length; i++) {
      const d = Math.abs(rt.towerT[i] - e.end) * rt.length;
      if (d < e.distance)
        rt.towerY[i] =
          e.level + ((rt.towerY[e.index] - e.level) * rt.exitRise(d)) / rt.exitRise(e.distance);
    }
  }
// The paired lower terminals expose overshoot from the one-way span raising
// above. Refine only their first two free heights with the SAME ground,
// obstacle and crossing constraints. A 2-D linear feasible region makes this
// deterministic: no station raise, ground cut, clearance reduction or angle
// threshold is used. Heights can only decrease from the already feasible seed.
const terminalRefinementRecords = [];
for (const rt of liftRuntimes.filter((r) => [1, 2].includes(r.lift.id))) {
  const e = rt.terminalProfiles[0],
    i = e.index,
    j = i + 1;
  if (!e || rt.towerT[j] * rt.length > 80) continue;
  const original = [rt.towerY[i], rt.towerY[j]],
    limit = rt.towerT[Math.min(j + 1, rt.towerT.length - 1)] * rt.length,
    { drop, halfWidth, halfLength } = vehicleHangingEnvelope(rt.lift),
    groundConstraints = [],
    slopeConstraints = [];
  const coefficients = (t) => {
    const base = rt.cablePoint(t).y;
    rt.towerY[i] = original[0] + 1;
    const a = rt.cablePoint(t).y - base;
    rt.towerY[i] = original[0];
    rt.towerY[j] = original[1] + 1;
    const b = rt.cablePoint(t).y - base;
    rt.towerY[j] = original[1];
    return { base, a, b };
  };
  let previous = null,
    maxBefore = 0;
  for (let d = 0; d <= limit + 0.001; d += 0.5) {
    const t = Math.min(d, limit) / rt.length,
      p = rt.groundCurve.getPoint(t),
      c = coefficients(t),
      margin =
        drop + lerp(0.45, 3.85, THREE.MathUtils.smoothstep(Math.min(t, 1 - t) * rt.length, 8, 120));
    let required = -Infinity;
    for (const lane of [-laneWidth, laneWidth])
      for (const x of [-halfWidth, 0, halfWidth])
        for (const z of [-halfLength, 0, halfLength]) {
          const px = p.x + rt.side.x * (lane + x) + rt.dir.x * z,
            pz = p.z + rt.side.z * (lane + x) + rt.dir.z * z;
          required = Math.max(
            required,
            liftSurfaceHeight(px, pz) + margin,
            cabinObstacleTop(px, pz) + drop + 0.45,
          );
        }
    groundConstraints.push([-c.a, -c.b, c.base - required]);
    if (previous && d <= 100) {
      const da = c.a - previous.a,
        db = c.b - previous.b,
        dy = c.base - previous.base;
      slopeConstraints.push([da, db, dy], [-da, -db, -dy]);
      maxBefore = Math.max(maxBefore, Math.abs(dy) / 0.5);
    }
    previous = c;
  }
  for (const cross of liftCrossings) {
    if (cross.upper === rt) {
      const c = coefficients(cross.ut);
      groundConstraints.push([-c.a, -c.b, c.base - cross.lower.cablePoint(cross.lt).y - cross.gap]);
    } else if (cross.lower === rt) {
      const c = coefficients(cross.lt);
      groundConstraints.push([c.a, c.b, cross.upper.cablePoint(cross.ut).y - cross.gap - c.base]);
    }
  }
  const clip = (poly, a, b, c) => {
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k],
        q = poly[(k + 1) % poly.length],
        vp = a * p[0] + b * p[1] - c,
        vq = a * q[0] + b * q[1] - c;
      if (vp <= 1e-9) out.push(p);
      if ((vp < 0 && vq > 0) || (vp > 0 && vq < 0)) {
        const u = vp / (vp - vq);
        out.push([lerp(p[0], q[0], u), lerp(p[1], q[1], u)]);
      }
    }
    return out;
  };
  const feasible = (grade) => {
    let poly = [
      [-30, -30],
      [0, -30],
      [0, 0],
      [-30, 0],
    ];
    for (const [a, b, c] of groundConstraints) {
      poly = clip(poly, a, b, c);
      if (!poly.length) return poly;
    }
    for (const [a, b, dy] of slopeConstraints) {
      poly = clip(poly, a, b, grade * 0.5 - dy);
      if (!poly.length) return poly;
    }
    return poly;
  };
  let lo = 0,
    hi = maxBefore,
    poly = feasible(hi);
  if (!poly.length) {
    terminalRefinementRecords.push({
      liftId: rt.lift.id,
      applied: false,
      reason: 'existing seed does not satisfy denser unchanged constraints',
    });
    continue;
  }
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2,
      candidate = feasible(mid);
    if (candidate.length) {
      hi = mid;
      poly = candidate;
    } else lo = mid;
  }
  let chosen = poly[0],
    norm = Infinity;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k],
      q = poly[(k + 1) % poly.length],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      u = clamp(-(p[0] * dx + p[1] * dy) / (dx * dx + dy * dy || 1), 0, 1),
      v = [p[0] + u * dx, p[1] + u * dy],
      n = v[0] * v[0] + v[1] * v[1];
    if (n < norm) {
      norm = n;
      chosen = v;
    }
  }
  rt.towerY[i] += chosen[0];
  rt.towerY[j] += chosen[1];
  for (let k = 0; k < i; k++) {
    const d = rt.towerT[k] * rt.length;
    rt.towerY[k] = e.level + ((rt.towerY[i] - e.level) * rt.exitRise(d)) / rt.exitRise(e.distance);
  }
  terminalRefinementRecords.push({
    liftId: rt.lift.id,
    applied: true,
    controls: [rt.towerIds[i], rt.towerIds[j]],
    before: original,
    after: [rt.towerY[i], rt.towerY[j]],
    maxBeforeDegrees: (Math.atan(maxBefore) * 180) / Math.PI,
    maxAfterDegrees: (Math.atan(hi) * 180) / Math.PI,
    clearanceConstraints: groundConstraints.length,
    sampleStepM: 0.5,
    clearanceFormulaUnchanged: true,
  });
}
for (const rt of liftRuntimes) {
  prepareLiftMotion(rt);
  const { lift, side, dir, cablePoint, towerT, towerY } = rt;
  const sampleCount = Math.ceil(rt.length / 3);
  for (const lane of [-laneWidth, laneWidth]) {
    const pp = [];
    for (let i = 0; i <= sampleCount; i++) pp.push(cablePoint(i / sampleCount, lane));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp), cableMat);
    line.userData = { kind: 'lift', id: lift.id };
    liftGroup.add(line);
    pickables.push(line);
  }
  for (let i = 1; i < towerT.length - 1; i++) {
    const stableId = rt.towerIds[i],
      sourced = sourceTClose(rt, towerT[i], 0.2);
    if (
      Math.min(towerT[i], 1 - towerT[i]) * rt.length < 23 ||
      (!sourced &&
        sourceTClose(rt, towerT[i], 10) &&
        !rt.supportSiting.some((r) => r.index === stableId))
    )
      continue;
    const p = cablePoint(towerT[i]),
      foot = new V(p.x, liftSurfaceHeight(p.x, p.z) - 0.4, p.z),
      post = new THREE.Group();
    liftGroup.add(post);
    post.userData = {
      kind: 'pylon',
      liftId: lift.id,
      index: stableId,
      controlIndex: i,
      t: towerT[i],
      piste: supportPisteClearance(p),
    };
    detailPylon(post, rt, p, foot);
    if (post.userData.piste.clearance < 0) {
      const pad = box(2.4, 2.0, 2.4, redMat, foot.x, foot.y + 1.35, foot.z, post);
      pad.rotation.y = Math.atan2(dir.x, dir.z);
      pad.userData.pylonProtection = true;
    }
    registerSolids(post, 'pylon-' + lift.id + '-' + stableId);
  }
  for (const t of [0, 1]) {
    const p = cablePoint(t),
      site = stationSite(lift.id, t),
      g = new THREE.Group();
    g.position.copy(p);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    buildings.add(g);
    const deck =
      (lift.id === 1 || lift.id === 2) && t === 0
        ? detailPhotoBaseStation(g, rt, site.base)
        : detailGroundedStation(g, rt, t, site);
    registerSolids(g, 'station-' + lift.id + '-' + t);
    g.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(g);
    const record = {
      owner: 'station-' + lift.id + '-' + t,
      kind: 'station',
      mode: site.supportMode === 'roof-hall' ? 'roof-supported-terminal' : 'graded-station-apron',
      bounds,
      groundHigh: terrainMaximum(bounds),
      base: deck,
      top: deck,
      demPreserved: true,
      pierFeet: [],
    };
    facilityGrounds.push(record);
    stationRecords.push({
      liftId: lift.id,
      t,
      center: p.clone(),
      platform: deck,
      canopyBottom: p.y + 0.65,
      halfPassage: 4.65,
      groundBase: site.base,
      pierFeet: [],
      mode: site.supportMode === 'roof-hall' ? 'roof-supported-terminal' : 'graded-station-apron',
      rawDEM: heightAt(p.x, p.z),
      wireHeight: p.y,
      site,
      reference: g.userData.referenceStatus,
    });
    const pp = [];
    for (let i = 0; i <= 32; i++) {
      const ang = (t === 1 ? -Math.PI / 2 : Math.PI / 2) + (i / 32) * Math.PI;
      pp.push(
        p
          .clone()
          .addScaledVector(side, Math.sin(ang) * laneWidth)
          .addScaledVector(dir, Math.cos(ang) * laneWidth),
      );
    }
    liftGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp), cableMat));
  }
  const defs = vehicleDefinitions(lift);
  defs.forEach(([geo, mat, y]) => {
    const mesh = new THREE.InstancedMesh(geo, mat, rt.count);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.userData = { kind: 'lift', id: lift.id };
    liftGroup.add(mesh);
    pickables.push(mesh);
    rt.parts.push({ mesh, y });
  });
}

renderLiftSites();

function liftStructureAudit() {
  return {
    surveyed: false,
    terminalRefinements: terminalRefinementRecords,
    stationMechanisms: terminalMechanismRecords,
    lifts: liftRuntimes.map((rt) => ({
      id: rt.lift.id,
      sourcePreserved: true,
      terminalProfiles: rt.terminalProfiles.map((e) => ({ ...e })),
      supports: pylonDetailRecords
        .filter((p) => p.liftId === rt.lift.id)
        .map((p) => ({
          index: p.index,
          kind: p.kind,
          mast: p.mast,
          height: p.height,
          foot: p.foot,
        })),
      heightBasis:
        'vehicle envelope, adjacent span sag and sampled terrain; not measured mast heights',
      profileStatus:
        'geometric clearance illustration; no rope tension or loaded/unloaded line calculation',
    })),
  };
}
