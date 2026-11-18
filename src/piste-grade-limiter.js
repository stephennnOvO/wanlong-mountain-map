// Each goal is a linear combination of the actual terrain mesh heights.
// Sampling the marked ribbon keeps both halves of the piste in the objective.
function preparePisteLeveling(positions, baseline, cols, rows, protectedGround, edgeLevel = false) {
  const movable = new Uint8Array(baseline.length),
    marked = new Uint8Array(baseline.length),
    candidates = [],
    profileGuards = [];
  const priorityBench = new Map(),
    benchCell = 64,
    shoulder = 62;
  const grid = (x, z) => {
    const [lon, lat] = unprojectGeo(x, z);
    const [west, south, east, north] = GEO.bounds;
    return [
      clamp(((east - lon) / (east - west)) * (cols - 1), 0, cols - 1),
      clamp(((lat - south) / (north - south)) * (rows - 1), 0, rows - 1),
    ];
  };
  function sample(x, z) {
    const [u, v] = grid(x, z);
    const i = Math.min(cols - 2, Math.floor(u)),
      j = Math.min(rows - 2, Math.floor(v)),
      k = j * cols + i;
    function triangle(a, b, c) {
      const ax = positions[a * 3],
        az = positions[a * 3 + 2];
      const bx = positions[b * 3] - ax,
        bz = positions[b * 3 + 2] - az,
        cx = positions[c * 3] - ax,
        cz = positions[c * 3 + 2] - az;
      const det = bx * cz - bz * cx;
      const p = ((x - ax) * cz - (z - az) * cx) / det,
        q = (bx * (z - az) - bz * (x - ax)) / det;
      return { inside: p + q <= 1, vertices: [a, b, c], weights: [1 - p - q, p, q], x, z, u, v };
    }
    const first = triangle(k, k + 1, k + cols);
    return first.inside ? first : triangle(k + cols + 1, k + cols, k + 1);
  }
  const dx = Math.abs(positions[3] - positions[0]),
    dz = Math.abs(positions[cols * 3 + 2] - positions[2]);
  const reach = edgeLevel ? 92 : 52,
    spanX = Math.ceil(reach / dx),
    spanZ = Math.ceil(reach / dz);
  function mark({ u, v, x, z }) {
    for (
      let j = Math.max(0, Math.floor(v) - spanZ);
      j <= Math.min(rows - 1, Math.ceil(v) + spanZ);
      j++
    ) {
      for (
        let i = Math.max(0, Math.floor(u) - spanX);
        i <= Math.min(cols - 1, Math.ceil(u) + spanX);
        i++
      ) {
        const k = j * cols + i;
        if (marked[k] || Math.hypot(positions[k * 3] - x, positions[k * 3 + 2] - z) > reach)
          continue;
        marked[k] = 1;
        movable[k] = Number(!protectedGround(positions[k * 3], positions[k * 3 + 2]));
      }
    }
  }
  function sectionRow(points, coefficients) {
    const terms = new Map();
    for (let n = 0; n < points.length; n++) {
      const { vertices, weights } = points[n];
      for (let i = 0; i < 3; i++)
        terms.set(vertices[i], (terms.get(vertices[i]) || 0) + coefficients[n] * weights[i]);
    }
    const vertices = Array.from(terms.keys()),
      weights = Array.from(terms.values());
    const base = weights.reduce((value, w, i) => value + w * baseline[vertices[i]], 0);
    return { vertices, weights, base };
  }
  const elevation = ({ vertices, weights }) =>
    weights.reduce((sum, w, i) => sum + w * baseline[vertices[i]], 0);
  function indexBench(a, b) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    if (length < 0.01) return;
    const reach = Math.max(-a.left, a.right, -b.left, b.right) + shoulder;
    const segment = { a, b, dx: dx / length, dz: dz / length, length };
    for (
      let i = Math.floor((Math.min(a.x, b.x) - reach) / benchCell);
      i <= Math.floor((Math.max(a.x, b.x) + reach) / benchCell);
      i++
    ) {
      for (
        let j = Math.floor((Math.min(a.z, b.z) - reach) / benchCell);
        j <= Math.floor((Math.max(a.z, b.z) + reach) / benchCell);
        j++
      ) {
        const key = i + ',' + j;
        if (!priorityBench.has(key)) priorityBench.set(key, []);
        priorityBench.get(key).push(segment);
      }
    }
  }
  function benchAt(k) {
    const x = positions[k * 3],
      z = positions[k * 3 + 2];
    const segments =
      priorityBench.get(Math.floor(x / benchCell) + ',' + Math.floor(z / benchCell)) || [];
    let best = Infinity,
      change = 0;
    for (const { a, b, dx, dz, length } of segments) {
      const ox = x - a.x,
        oz = z - a.z,
        s = clamp(ox * dx + oz * dz, 0, length),
        f = s / length;
      const distance = Math.hypot(ox - s * dx, oz - s * dz);
      if (distance >= best) continue;
      const side = -ox * dz + oz * dx,
        edge = lerp(a[side < 0 ? 'left' : 'right'], b[side < 0 ? 'left' : 'right'], f);
      const outside = Math.max(0, distance - Math.abs(edge)),
        u = clamp(outside / shoulder, 0, 1);
      const target = lerp(a.height, b.height, f);
      const rim = side < 0 ? 'leftDelta' : 'rightDelta';
      change =
        outside > 0 ? lerp(a[rim], b[rim], f) * (1 - u * u * (3 - 2 * u)) : target - baseline[k];
      best = distance;
    }
    return change;
  }
  function add(a, b, whole) {
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    if (run < 1) return;
    const section = sectionRow([a, b], [-1 / run, 1 / run]),
      base = section.base;
    const target = whole ? 0.045 : 0.075;
    if (Math.abs(base) > (whole ? 0.115 : 0.17)) {
      mark(a);
      mark(b);
    }
    const limit = whole ? 0.2 : 0.3;
    const maxSlope =
      Math.abs(base) < limit
        ? Math.min(limit - 0.001, Math.abs(base) + 0.008)
        : Math.abs(base) + 0.004;
    candidates.push({ ...section, target, bound: Math.max(maxSlope, whole ? 0.085 : 0.13) });
  }
  function addEdgeLevel(samples, priority) {
    const [left, leftInside, center, rightInside, right] = samples;
    const edge = sectionRow([left, right], [-1, 1]);
    const inside = [left, leftInside, rightInside, right].map((p) =>
      sectionRow([center, p], [-1, 1]),
    );
    if (Math.abs(edge.base) > 0.45 || inside.some((row) => Math.abs(row.base) > 0.55)) {
      mark(left);
      mark(right);
    }
    // Equal edges alone can conceal a crown or trough in the middle.
    for (const row of inside)
      candidates.push({
        ...row,
        target: 0.26,
        bound: Math.max(Math.abs(row.base) + 0.1, 0.55),
        pressure: 0.18,
      });
    candidates.push({
      ...edge,
      target: 0.21,
      bound: Math.max(Math.abs(edge.base) + 0.04, 0.47),
      pressure: priority,
    });
  }
  const mapped = trails.filter((t) => t.mapped);
  if (edgeLevel) mapped.sort((a, b) => Number(a.name === '游龙道') - Number(b.name === '游龙道'));
  for (const trail of mapped) {
    const points = trail.displayPoints || trail.points,
      edges = trail.displayEdges || trail.edges,
      chain = [0];
    for (let i = 1; i < points.length; i++)
      chain.push(
        chain.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z),
      );
    const end = chain.at(-1);
    function locate(s, i) {
      while (i > 0 && chain[i] > s) i--;
      while (i < chain.length - 2 && chain[i + 1] < s) i++;
      return i;
    }
    function center(s, i) {
      i = locate(s, i);
      const f = (s - chain[i]) / (chain[i + 1] - chain[i] || 1);
      return [lerp(points[i].x, points[i + 1].x, f), lerp(points[i].z, points[i + 1].z, f)];
    }
    let i = 0,
      station = 0,
      previousBench = null;
    for (let s = 0; ; s = Math.min(end, s + (edgeLevel ? 1 : 3)), station++) {
      i = locate(s, i);
      const f = (s - chain[i]) / (chain[i + 1] - chain[i] || 1);
      const x = lerp(points[i].x, points[i + 1].x, f),
        z = lerp(points[i].z, points[i + 1].z, f);
      const lanes = edgeLevel ? [-1, -0.5, 0, 0.5, 1] : [-0.85, -0.425, 0, 0.425, 0.85];
      const samples = lanes.map((lane) => {
        const side = lane < 0 ? 'minus' : 'plus',
          a = edges[i][side],
          b = edges[i + 1][side];
        return sample(
          lerp(x, lerp(a[0], b[0], f), Math.abs(lane)),
          lerp(z, lerp(a[1], b[1], f), Math.abs(lane)),
        );
      });
      if (
        !samples.some((p) => hotelSnowFlow.blocked(p.x, p.z) || menglongPark.contains(p.x, p.z, 0))
      ) {
        if (edgeLevel) addEdgeLevel(samples, trail.name === '游龙道' ? 0.94 : 0.72);
        else if (station % 2 === 0 || s === end) {
          for (let n = 1; n < samples.length; n++) add(samples[n - 1], samples[n], false);
          add(samples[0], samples.at(-1), true);
        }
        const ahead = center(Math.min(s + 9, end), i),
          behind = center(Math.max(s - 9, 0), i);
        const ax = ahead[0] - behind[0],
          az = ahead[1] - behind[1],
          run = Math.hypot(ax, az);
        if (
          edgeLevel &&
          trail.name === '游龙道' &&
          run >= 0.5 &&
          (station % 4 === 0 || s === end)
        ) {
          const left = samples[0],
            right = samples.at(-1);
          const lateral = (p) => ((p.z - z) * ax - (p.x - x) * az) / run;
          const a = lateral(left),
            b = lateral(right),
            leftY = elevation(left),
            rightY = elevation(right);
          const height = 0.5 * elevation(samples[2]) + 0.25 * (leftY + rightY);
          const bench = {
            x,
            z,
            height,
            left: Math.min(a, b),
            right: Math.max(a, b),
            leftDelta: height - (a < b ? leftY : rightY),
            rightDelta: height - (a < b ? rightY : leftY),
          };
          if (previousBench) indexBench(previousBench, bench);
          previousBench = bench;
        }
        if (run >= 0.5 && (!edgeLevel || station % 3 === 0 || s === end)) {
          const tx = ax / run,
            tz = az / run;
          const along = (d) => sample(x + d * tx, z + d * tz);
          const across = (d) => sample(x - d * tz, z + d * tx);
          // A ribbon average can hide a kink or local steepening at its center.
          // Guard short, physically perpendicular profiles as well as the ribbon.
          for (const [profile, coefficients, allowance] of [
            [[along(-2), along(2)], [-0.25, 0.25], 0.075],
            [[across(-2), across(2)], [-0.25, 0.25], 0.08],
            [[along(-4), samples[2], along(4)], [0.25, -0.5, 0.25], 0.065],
          ]) {
            const row = sectionRow(profile, coefficients);
            const raw = profile.reduce(
              (sum, p, k) => sum + coefficients[k] * heightAt(p.x, p.z),
              0,
            );
            const profileMargin = edgeLevel ? 0.045 : 0.004;
            profileGuards.push({
              ...row,
              bound: Math.max(Math.abs(row.base) + profileMargin, Math.abs(raw) + allowance),
            });
          }
        }
      } else previousBench = null;
      if (s === end) break;
    }
  }
  function movableWeight({ vertices, weights }) {
    return weights.reduce((sum, w, i) => sum + w * w * movable[vertices[i]], 0);
  }
  const sections = candidates.filter((section) => (section.norm = movableWeight(section)) > 1e-8);
  const profiles = profileGuards.filter(
    (section) => (section.norm = movableWeight(section)) > 1e-8,
  );
  const cap = edgeLevel ? 12 : 5,
    clearances = [];
  // Rope geometry is built before piste earthworks. Limit fill under the
  // swept vehicle footprint while still permitting a cut to level the snow.
  for (const lift of lifts.filter((l) => l.runtime)) {
    const rt = lift.runtime,
      vehicle = vehicleHangingEnvelope(lift);
    const phases = Math.max(2400, Math.ceil(rt.length * 2));
    for (let i = 0; i < phases; i++) {
      const { p, tangent } = rt.loopPoint((i + 0.5) / phases);
      const f = tangent.clone().normalize();
      for (const u of [-vehicle.halfWidth, 0, vehicle.halfWidth])
        for (const v of [-vehicle.halfLength, 0, vehicle.halfLength]) {
          const point = sample(p.x - f.z * u + f.x * v, p.z + f.x * u + f.z * v);
          const norm = movableWeight(point);
          if (norm <= 1e-8) continue;
          const ground = point.weights.reduce(
            (sum, w, k) => sum + w * baseline[point.vertices[k]],
            0,
          );
          const gap = p.y - vehicle.drop - ground;
          if (gap >= cap + 0.48) continue;
          clearances.push({
            vertices: point.vertices,
            weights: point.weights,
            norm,
            bound: Math.max(0, gap - 0.48),
          });
        }
    }
  }
  return { movable, sections, profiles, clearances, cap, edgeLevel, benchAt };
}

// Certify the actual triangles against the accepted terrain and its joins.
function limitPisteGrades(
  positions,
  indices,
  baseline,
  cols,
  rows,
  pisteInfluence,
  sourceHeights,
  leveling,
) {
  const count = baseline.length,
    correction = new Float64Array(count),
    active = [];
  const movable = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    correction[i] =
      leveling?.edgeLevel && leveling.movable[i]
        ? leveling.benchAt(i)
        : positions[i * 3 + 1] - baseline[i];
    movable[i] = leveling ? leveling.movable[i] : Number(Math.abs(correction[i]) > 0.001);
    if (!movable[i]) correction[i] = 0;
    else active.push(i);
  }
  const smoothed = correction.slice();
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const k = j * cols + i;
      if (movable[k])
        smoothed[k] =
          (4 * correction[k] +
            correction[k - 1] +
            correction[k + 1] +
            correction[k - cols] +
            correction[k + cols]) /
          8;
    }
  correction.set(smoothed);

  const faces = [],
    bends = [];
  const x = (i) => positions[i * 3],
    z = (i) => positions[i * 3 + 2];
  const dist = (a, b) => Math.hypot(x(a) - x(b), z(a) - z(b));
  for (let k = 0; k < indices.length; k += 3) {
    const a = indices[k],
      b = indices[k + 1],
      c = indices[k + 2];
    if (!(movable[a] || movable[b] || movable[c])) continue;
    const ux = x(b) - x(a),
      uz = z(b) - z(a),
      vx = x(c) - x(a),
      vz = z(c) - z(a),
      det = ux * vz - uz * vx;
    const bx = vz / det,
      bz = -vx / det,
      cx = -uz / det,
      cz = ux / det;
    const baseX = bx * (baseline[b] - baseline[a]) + cx * (baseline[c] - baseline[a]);
    const baseZ = bz * (baseline[b] - baseline[a]) + cz * (baseline[c] - baseline[a]);
    const mx = (x(a) + x(b) + x(c)) / 3,
      mz = (z(a) + z(b) + z(c)) / 3;
    const directions = [],
      headings = [],
      crossGoals = [],
      crossHeadings = [],
      routeNames = new Set();
    const parts =
      pisteFootprintIndex.get(
        Math.floor(mx / PISTE_FOOTPRINT_CELL) + ',' + Math.floor(mz / PISTE_FOOTPRINT_CELL),
      ) || [];
    for (const { polygon, direction, trail } of parts) {
      if (!direction) continue;
      const onPiste = inPolygon(mx, mz, polygon);
      if (!onPiste && (leveling?.edgeLevel || hotelEdgeDistance(mx, mz, polygon) > 6)) continue;
      if (leveling && trail) routeNames.add(trail);
      const [tx, tz] = direction;
      const cross = -baseX * tz + baseZ * tx;
      if (
        !leveling &&
        onPiste &&
        !crossHeadings.some(([hx, hz]) => Math.abs(hx * tx + hz * tz) > 0.97)
      ) {
        crossHeadings.push(direction);
        crossGoals.push({ gb: -bx * tz + bz * tx, gc: -cx * tz + cz * tx, base: cross });
      }
      if (headings.some(([hx, hz]) => Math.abs(hx * tx + hz * tz) > 0.97)) continue;
      headings.push(direction);
      const base = baseX * tx + baseZ * tz;
      const edgeLevel = leveling?.edgeLevel;
      const maxSlope = Math.max(0.16, Math.abs(base) + (edgeLevel ? 0.068 : 0.035));
      const pitchChange = edgeLevel ? 0.22 : 0.12;
      directions.push({
        tx,
        tz,
        min: Math.max(-maxSlope - base, -pitchChange, base > 0.04 ? -0.015 - base : -Infinity),
        max: Math.min(maxSlope - base, pitchChange, base < -0.04 ? 0.015 - base : Infinity),
      });
      const maxCross = Math.max(
        edgeLevel ? 0.2 : 0.09,
        Math.abs(cross) + (edgeLevel ? 0.055 : 0.012),
      );
      directions.push({ tx: -tz, tz: tx, min: -maxCross - cross, max: maxCross - cross });
    }
    if (leveling) {
      const budget = routeNames.size > 1 ? 0.048 : 0.09;
      for (let i = 0; i < directions.length; i += 2) {
        const direction = directions[i];
        if (leveling.edgeLevel) {
          const pitch = baseX * direction.tx + baseZ * direction.tz;
          // A merge may need its descent eased. Steepening still has a tight budget.
          const flattening = routeNames.has('游龙道') ? 0.22 : 0.19;
          direction.min = Math.max(direction.min, -(pitch > 0 ? flattening : budget));
          direction.max = Math.min(direction.max, pitch < 0 ? flattening : budget);
        } else {
          direction.min = Math.max(direction.min, -budget);
          direction.max = Math.min(direction.max, budget);
        }
      }
    }
    const baseGrade = Math.hypot(baseX, baseZ);
    const freeShoulder =
      !directions.length &&
      pisteInfluence[a] &&
      pisteInfluence[b] &&
      pisteInfluence[c] &&
      !hotelSnowFlow.blocked(mx, mz, 32) &&
      !menglongPark.contains(mx, mz, 38);
    // Use part of the unoccupied hillside to recover the cut/fill. Snow
    // corridors keep their tighter gradient budget, including at overlaps.
    const proposedBound = freeShoulder
      ? Math.max(0.42, baseGrade + 0.025, Math.min(0.78, baseGrade + 0.16))
      : Math.max(directions.length ? 0.32 : 0.42, baseGrade + 0.025);
    const rawB = sourceHeights[b] - sourceHeights[a],
      rawC = sourceHeights[c] - sourceHeights[a];
    const rawGrade = Math.hypot(bx * rawB + cx * rawC, bz * rawB + cz * rawC);
    // The preceding release is a feasible fallback. The extra allowance on
    // shoulders must not add a severe face relative to the original hillside.
    const noNewSteep =
      baseGrade < 0.65
        ? Math.max(baseGrade, 0.642)
        : Math.max(baseGrade, Math.min(0.8, baseGrade + 0.08));
    const bound = Math.min(proposedBound, noNewSteep, Math.max(baseGrade, 0.642, rawGrade + 0.188));
    faces.push({ a, b, c, bx, bz, cx, cz, baseX, baseZ, bound, directions, crossGoals });
  }
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const b = j * cols + i;
      for (const offset of [1, cols, cols - 1, cols + 1]) {
        const a = b - offset,
          c = b + offset;
        if (!(movable[a] || movable[b] || movable[c])) continue;
        const left = 1 / dist(a, b),
          right = 1 / dist(b, c);
        const base = (baseline[c] - baseline[b]) * right - (baseline[b] - baseline[a]) * left;
        const bound = Math.max(0.13, Math.abs(base) + 0.035);
        bends.push({ a, b, c, left, right, base, bound });
      }
    }
  function project(a, b, c, gb, gc, excess) {
    const ga = -gb - gc;
    const norm = movable[a] * ga * ga + movable[b] * gb * gb + movable[c] * gc * gc;
    if (!norm) return;
    const step = excess / norm;
    correction[a] -= movable[a] * ga * step;
    correction[b] -= movable[b] * gb * step;
    correction[c] -= movable[c] * gc * step;
  }
  function limitFace(f) {
    const { a, b, c, bx, bz, cx, cz, baseX, baseZ, bound, directions } = f;
    for (const { tx, tz, min, max } of directions) {
      const gb = bx * tx + bz * tz,
        gc = cx * tx + cz * tz;
      const value = gb * (correction[b] - correction[a]) + gc * (correction[c] - correction[a]);
      const excess = value - clamp(value, min, max);
      if (Math.abs(excess) > 0.0005) project(a, b, c, gb, gc, excess);
    }
    const ux = baseX + bx * (correction[b] - correction[a]) + cx * (correction[c] - correction[a]);
    const uz = baseZ + bz * (correction[b] - correction[a]) + cz * (correction[c] - correction[a]);
    const length = Math.hypot(ux, uz);
    if (length > bound + 0.0005)
      project(a, b, c, (bx * ux + bz * uz) / length, (cx * ux + cz * uz) / length, length - bound);
  }
  function sweep(pass) {
    for (const { a, b, c, left, right, base, bound } of bends) {
      const value =
        base + (correction[c] - correction[b]) * right - (correction[b] - correction[a]) * left;
      const excess = value - clamp(value, -bound, bound);
      if (Math.abs(excess) > 0.0005) project(a, b, c, -left - right, right, excess);
    }
    if (pass % 2 === 0) for (const face of faces) limitFace(face);
    else for (let i = faces.length - 1; i >= 0; i--) limitFace(faces[i]);
    if (leveling) {
      for (const section of leveling.sections) projectSection(section, section.bound, 1);
      for (const profile of leveling.profiles) projectSection(profile, profile.bound, 1);
      for (const clearance of leveling.clearances)
        projectSamples(clearance, Math.max(0, sectionChange(clearance) - clearance.bound), 1);
    }
    for (const i of active)
      correction[i] = clamp(correction[i], -(leveling?.cap ?? 6), leveling?.cap ?? 6);
  }
  function sectionChange({ vertices, weights }) {
    let change = 0;
    for (let i = 0; i < vertices.length; i++) change += weights[i] * correction[vertices[i]];
    return change;
  }
  function projectSection(section, target, weight) {
    const slope = section.base + sectionChange(section);
    const excess = slope - clamp(slope, -target, target);
    projectSamples(section, excess, weight);
  }
  function projectSamples({ vertices, weights, norm }, excess, weight) {
    if (Math.abs(excess) < 0.0005) return;
    const step = (weight * excess) / norm;
    for (let i = 0; i < vertices.length; i++)
      if (movable[vertices[i]]) correction[vertices[i]] -= weights[i] * step;
  }
  const passes = leveling?.edgeLevel ? 420 : leveling ? 240 : 144;
  for (let pass = 0; pass < passes; pass++) {
    if (leveling && pass < passes - 36)
      for (const section of leveling.sections)
        projectSection(section, section.target, section.pressure ?? 0.36);
    if (!leveling && pass < 104)
      for (const { a, b, c, crossGoals } of faces) {
        for (const { gb, gc, base } of crossGoals) {
          const slope =
            base + gb * (correction[b] - correction[a]) + gc * (correction[c] - correction[a]);
          const excess = slope - clamp(slope, -0.08, 0.08);
          if (Math.abs(excess) > 0.001)
            project(a, b, c, gb, gc, (excess * 0.28) / crossGoals.length);
        }
      }
    sweep(pass);
  }
  function permit(base, change, min, max) {
    if (change > 0) return (max - base) / change;
    if (change < 0) return (min - base) / change;
    return 1;
  }
  function permittedFaceBlend({ a, b, c, bx, bz, cx, cz, baseX, baseZ, bound, directions }) {
    let blend = 1;
    const dx = bx * (correction[b] - correction[a]) + cx * (correction[c] - correction[a]);
    const dz = bz * (correction[b] - correction[a]) + cz * (correction[c] - correction[a]);
    for (const { tx, tz, min, max } of directions)
      blend = Math.min(blend, permit(0, dx * tx + dz * tz, min - 0.005, max + 0.005));
    const allowed = bound + 0.005;
    if (Math.hypot(baseX + blend * dx, baseZ + blend * dz) <= allowed) return blend;
    let lo = 0,
      hi = blend;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (Math.hypot(baseX + mid * dx, baseZ + mid * dz) <= allowed) lo = mid;
      else hi = mid;
    }
    return lo;
  }
  const permittedBendBlend = ({ a, b, c, left, right, base, bound }) =>
    permit(
      base,
      (correction[c] - correction[b]) * right - (correction[b] - correction[a]) * left,
      -bound - 0.005,
      bound + 0.005,
    );
  const scale = new Float64Array(count);
  let localRetreats = 0;
  // Pull incompatible sections back locally. Extending the retreat to the
  // next ring avoids introducing an edge where the correction is withdrawn.
  for (let pass = 0; pass < (leveling?.edgeLevel ? 60 : 24); pass++) {
    scale.fill(1);
    const retreat = (vertices, factor) => {
      if (factor >= 1) return;
      localRetreats++;
      for (const k of vertices) {
        scale[k] = Math.min(scale[k], factor);
        for (const offset of [-1, 1, -cols, cols])
          if (movable[k + offset]) {
            scale[k + offset] = Math.min(scale[k + offset], (1 + factor) / 2);
          }
      }
    };
    const start = localRetreats;
    for (const f of faces) {
      const factor = permittedFaceBlend(f);
      if (factor < 1) retreat([f.a, f.b, f.c], factor);
    }
    for (const b of bends) {
      const factor = permittedBendBlend(b);
      if (factor < 1) retreat([b.a, b.b, b.c], factor);
    }
    if (leveling)
      for (const point of leveling.clearances) {
        const change = sectionChange(point);
        if (change > point.bound + 0.007) retreat(point.vertices, (point.bound + 0.007) / change);
      }
    if (localRetreats === start) break;
    for (const i of active) correction[i] *= scale[i];
    for (let i = 0; i < 8; i++) sweep(i);
  }
  // Final certification also covers the ring around every local retreat.
  // A common blend toward baseline is feasible for all the convex limits.
  let blend = 1;
  for (const f of faces) blend = Math.min(blend, permittedFaceBlend(f));
  for (const b of bends) blend = Math.min(blend, permittedBendBlend(b));
  if (leveling)
    for (const point of leveling.clearances) {
      const change = sectionChange(point);
      if (change > point.bound + 0.007) blend = Math.min(blend, (point.bound + 0.007) / change);
    }
  for (let i = 0; i < count; i++) positions[i * 3 + 1] = baseline[i] + correction[i] * blend;
  return {
    triangles: faces.length,
    slopeBreaks: bends.length,
    localRetreats,
    certifiedBlend: blend,
  };
}
