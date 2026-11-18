// One asymmetric, variable-width footprint drives painting, picking and clearance.
function trailWidthAt(trail, fraction, applyPondWidth = true) {
  if (applyPondWidth && trail.pondNarrowSpan) {
    const [lo, hi] = trail.pondNarrowSpan,
      d = fraction * trail.planLength,
      weight =
        THREE.MathUtils.smoothstep(d, lo - 40, lo) *
        (1 - THREE.MathUtils.smoothstep(d, hi, hi + 40));
    if (weight > 0) {
      const base = trailWidthAt(trail, fraction, false);
      return { minus: lerp(base.minus, 4, weight), plus: lerp(base.plus, 4, weight) };
    }
  }
  const narrow = trail.reviewedNarrowSamples;
  if (narrow && fraction >= narrow[0].fraction && fraction <= narrow.at(-1).fraction) {
    let i = 1;
    while (i < narrow.length - 1 && fraction > narrow[i].fraction) i++;
    const a = narrow[i - 1],
      b = narrow[i],
      half = lerp(a.width, b.width, (fraction - a.fraction) / (b.fraction - a.fraction)) / 2;
    return { minus: half, plus: half };
  }
  const s = trail.widthRecord.samples;
  let i = 1;
  while (i < s.length - 1 && fraction > s[i].fraction) i++;
  const a = s[i - 1],
    b = s[i],
    f = clamp((fraction - a.fraction) / (b.fraction - a.fraction), 0, 1);
  const base = { minus: lerp(a.minus, b.minus, f), plus: lerp(a.plus, b.plus, f) };
  // Blend into the measured traverse over 15 plan metres on each approach.
  if (narrow && trail.planLength) {
    const edge = fraction < narrow[0].fraction ? narrow[0] : narrow.at(-1),
      gap = Math.abs(fraction - edge.fraction) * trail.planLength;
    if (gap < 15) {
      const t = 1 - gap / 15;
      return {
        minus: lerp(base.minus, edge.width / 2, t),
        plus: lerp(base.plus, edge.width / 2, t),
      };
    }
  }
  return base;
}
function prepareTrailFootprint(trail) {
  const record = TRAIL_WIDTH_DATA.find((r) => r.id === trail.id);
  if (!record?.samples.length) throw Error('Missing independent width record: ' + trail.name);
  trail.widthRecord = record;
  const points = trail.points,
    lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z),
    );
  trail.planLength = lengths.at(-1);
  if (trail.name === '长龙道') {
    const selected = points
      .map((p, i) => ({ p, s: lengths[i] }))
      .filter(({ p }) => p.x >= -1070 && p.x <= -870 && p.z > 790 && p.z < 880);
    if (selected.length) trail.pondNarrowSpan = [selected[0].s, selected.at(-1).s];
  }
  trail.widths = [];
  trail.edges = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      dx = b.x - a.x,
      dz = b.z - a.z,
      n = Math.hypot(dx, dz) || 1,
      w = trailWidthAt(trail, lengths[i] / trail.planLength),
      normal = [-dz / n, dx / n];
    trail.widths.push(w);
    trail.edges.push({
      minus: [p.x - normal[0] * w.minus, p.z - normal[1] * w.minus],
      plus: [p.x + normal[0] * w.plus, p.z + normal[1] * w.plus],
    });
  }
  trail.width =
    record.samples.reduce((sum, s) => sum + s.minus + s.plus, 0) / record.samples.length;
  trail.footprint = trail.edges
    .map((e) => e.minus)
    .concat(trail.edges.map((e) => e.plus).reverse());
}
function trailFootprintPolygon(trail, scale = 1) {
  return trail.edges
    .map((e, i) => [
      lerp(trail.points[i].x, e.minus[0], scale),
      lerp(trail.points[i].z, e.minus[1], scale),
    ])
    .concat(
      trail.edges
        .map((e, i) => [
          lerp(trail.points[i].x, e.plus[0], scale),
          lerp(trail.points[i].z, e.plus[1], scale),
        ])
        .reverse(),
    );
}
function trailRibbon(trail, color, opacity = 1, scale = 1) {
  const mesh = ribbon(trail.points, 1, color, opacity),
    position = mesh.geometry.attributes.position;
  trail.edges.forEach((edge, i) => {
    for (const [j, key] of [
      [0, 'minus'],
      [1, 'plus'],
    ]) {
      const x = lerp(trail.points[i].x, edge[key][0], scale),
        z = lerp(trail.points[i].z, edge[key][1], scale);
      position.setXYZ(i * 2 + j, x, heightAt(x, z) + 2.2, z);
    }
  });
  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  return mesh;
}
const pisteFootprintIndex = new Map(),
  PISTE_FOOTPRINT_CELL = 60;
// Local snow connections traced against the reviewed satellite mosaic.
const reviewedSnowJunctions = [
  {
    trail: '猛龙道',
    polygon: [
      [115.39145619, 40.96699901],
      [115.39167076, 40.96690786],
      [115.39176464, 40.96670531],
      [115.39176464, 40.96656352],
      [115.39169759, 40.96640148],
      [115.39144278, 40.96640148],
      [115.39144278, 40.96676607],
    ].map(projectGeo),
  },
  {
    trail: '游龙道',
    polygon: [
      [115.39900661, 40.96955112],
      [115.39916754, 40.96952073],
      [115.39943576, 40.9694701],
      [115.39947599, 40.9693587],
      [115.39927483, 40.96934857],
      [115.39899319, 40.96943972],
    ].map(projectGeo),
  },
];
function indexPistePolygon(part) {
  const xs = part.polygon.map((p) => p[0]),
    zs = part.polygon.map((p) => p[1]);
  for (
    let x = Math.floor((Math.min(...xs) - 15) / PISTE_FOOTPRINT_CELL);
    x <= Math.floor((Math.max(...xs) + 15) / PISTE_FOOTPRINT_CELL);
    x++
  )
    for (
      let z = Math.floor((Math.min(...zs) - 15) / PISTE_FOOTPRINT_CELL);
      z <= Math.floor((Math.max(...zs) + 15) / PISTE_FOOTPRINT_CELL);
      z++
    ) {
      const key = x + ',' + z;
      if (!pisteFootprintIndex.has(key)) pisteFootprintIndex.set(key, []);
      pisteFootprintIndex.get(key).push(part);
    }
}
function indexTrailFootprint(trail) {
  const displayEdges = trail.displayEdges || trail.edges;
  const points = trail.displayPoints || trail.points;
  for (let i = 1; i < displayEdges.length; i++) {
    const a = displayEdges[i - 1],
      b = displayEdges[i];
    const dx = points[i].x - points[i - 1].x,
      dz = points[i].z - points[i - 1].z,
      length = Math.hypot(dx, dz);
    indexPistePolygon({
      polygon: [a.minus, b.minus, b.plus, a.plus],
      trail: trail.name,
      direction: length > 0.01 ? [dx / length, dz / length] : null,
    });
  }
}
function pisteFootprintClearance(x, z) {
  let clearance = Infinity,
    trail = null;
  for (const part of pisteFootprintIndex.get(
    Math.floor(x / PISTE_FOOTPRINT_CELL) + ',' + Math.floor(z / PISTE_FOOTPRINT_CELL),
  ) || []) {
    const poly = part.polygon;
    let inside = false,
      distance = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j],
        b = poly[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        f = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      distance = Math.min(distance, Math.hypot(x - a[0] - f * dx, z - a[1] - f * dz));
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
        inside = !inside;
    }
    const d = inside ? -distance : distance;
    if (d < clearance) {
      clearance = d;
      trail = part.trail;
    }
  }
  return { clearance, trail };
}

function correctPondSideTrail(trail) {
  if (trail.name !== '长龙道') return;
  for (const p of trail.points) {
    if (p.z < 790 || p.z > 880) continue;
    const weight =
      THREE.MathUtils.smoothstep(p.x, -1110, -1070) *
      (1 - THREE.MathUtils.smoothstep(p.x, -870, -830));
    p.z -= 4 * weight;
    p.y = heightAt(p.x, p.z) + 1.4;
  }
}
