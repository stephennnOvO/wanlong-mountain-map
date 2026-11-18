// Typical detachable-ropeway tower structure; missing source pylon heights are illustrative.
const pylonWheels = new THREE.CylinderGeometry(0.37, 0.37, 0.18, 12),
  pylonWheelMat = material('#4c5a5d', { metalness: 0.65, roughness: 0.55 }),
  pylonGalv = material('#91a3a5', { metalness: 0.5, roughness: 0.65 });
const pylonDetailRecords = [];
function detailPylon(post, rt, p, foot) {
  const { side, dir } = rt;
  let tp = 0,
    best = Infinity;
  for (const t of rt.towerT) {
    const q = rt.cablePoint(t),
      d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < best) {
      best = d;
      tp = t;
    }
  }
  const controlIndex = rt.towerT.reduce(
      (best, t, i) => (Math.abs(t - tp) < Math.abs(rt.towerT[best] - tp) ? i : best),
      0,
    ),
    index = post.userData.index ?? rt.towerIds[controlIndex],
    before = rt.cablePoint(Math.max(0, tp - 5 / rt.length)),
    after = rt.cablePoint(Math.min(1, tp + 5 / rt.length));
  const inAngle = Math.atan2(p.y - before.y, Math.hypot(p.x - before.x, p.z - before.z)),
    outAngle = Math.atan2(after.y - p.y, Math.hypot(after.x - p.x, after.z - p.z)),
    deflection = inAngle - outAngle;
  // Rebuilding a footing after a park move must preserve the existing mast type.
  const reviewed = REVIEWED_SUPPORT_TYPES.find(
    (r) => r.liftId === rt.lift.id && r.index === post.userData.index,
  );
  const kind =
      reviewed?.kind ||
      (Math.abs(deflection) < 0.018 ? 'combined' : deflection > 0 ? 'support' : 'compression'),
    mastHeight = p.y - foot.y + 2.6,
    lattice = reviewed
      ? reviewed.mast === 'lattice'
      : post.userData.mastKind
        ? post.userData.mastKind === 'lattice'
        : (1 - tp) * rt.length < 125 || mastHeight > 28;
  const correction =
    SUPPORT_POSITION_CORRECTIONS.find((r) => r.liftId === rt.lift.id && r.index === index) ||
    reviewed;
  const available =
      Math.min(
        (tp - (rt.towerT[controlIndex - 1] || 0)) * rt.length,
        ((rt.towerT[controlIndex + 1] || 1) - tp) * rt.length,
      ) * 0.36,
    halfTrain =
      correction?.halfTrainM ??
      Math.min(
        clamp((4 + 2 * Math.floor(Math.abs(deflection) / 0.075)) * 0.34, 1.65, 2.4),
        Math.max(1.1, available),
      ),
    wheelCount =
      correction?.wheelCount ?? clamp(2 * Math.floor((halfTrain * 2 - 0.4) / 1.3), 2, 12),
    contacts = [];
  post.userData.supportKind = kind;
  post.userData.mastKind = lattice ? 'lattice' : 'tubular';
  // Each sheave follows the local rope profile, including a slope break at the tower.
  const at = (x, y, z) =>
    rt
      .cablePoint(clamp(tp + z / rt.length, 0, 1))
      .addScaledVector(side, x)
      .add(new V(0, y, 0));
  if (lattice) {
    const levels = Math.ceil(mastHeight / 3.2),
      leg = (x, z, y) =>
        foot
          .clone()
          .addScaledVector(side, x * lerp(1.22, 0.58, y / mastHeight))
          .addScaledVector(dir, z * lerp(1.22, 0.58, y / mastHeight))
          .add(new V(0, y, 0));
    for (const x of [-1, 1])
      for (const z of [-1, 1]) beam(leg(x, z, 0), leg(x, z, mastHeight), 0.115, pylonGalv, post);
    for (let j = 0; j < levels; j++) {
      const ya = (j / levels) * mastHeight,
        yb = ((j + 1) / levels) * mastHeight;
      for (const sign of [-1, 1]) {
        beam(leg(-1, sign, ya), leg(1, sign, ya), 0.065, pylonGalv, post);
        beam(leg(sign, -1, ya), leg(sign, 1, ya), 0.065, pylonGalv, post);
        beam(leg(-1, sign, ya), leg(1, sign, yb), 0.06, pylonGalv, post);
        beam(leg(1, sign, ya), leg(-1, sign, yb), 0.06, pylonGalv, post);
        beam(leg(sign, -1, ya), leg(sign, 1, yb), 0.06, pylonGalv, post);
        beam(leg(sign, 1, ya), leg(sign, -1, yb), 0.06, pylonGalv, post);
      }
    }
  } else {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.84, mastHeight, 10), pylonGalv);
    mast.position.copy(foot).lerp(p.clone().add(new V(0, 2.6, 0)), 0.5);
    mast.castShadow = true;
    post.add(mast);
  }
  // Deep crosshead, diagonal braces and two independent equalising sheave trains.
  beam(at(-5.7, 2.2, 0), at(5.7, 2.2, 0), 0.33, pylonGalv, post);
  for (const sign of [-1, 1]) {
    beam(at(sign * 0.7, -1.6, 0), at(sign * 4.2, 2.2, 0), 0.15, pylonGalv, post);
    beam(at(sign * 3, 2.2, -0.2), at(sign * 3, 1.2, -0.2), 0.14, pylonGalv, post);
    // The rope rests ON support sheaves and runs UNDER compression sheaves.
    // A combined bank has both rows; dimensions and selection are illustrative.
    for (let d = -halfTrain; d < halfTrain - 0.01; d += 0.6)
      beam(
        at(sign * 3, 1.25, d),
        at(sign * 3, 1.25, Math.min(d + 0.6, halfTrain)),
        0.13,
        pylonGalv,
        post,
      );
    const rows = kind === 'combined' ? [-1, 1] : [kind === 'support' ? 1 : -1];
    for (const row of rows)
      for (let k = 0; k < wheelCount; k++) {
        const d = lerp(-halfTrain + 0.3, halfTrain - 0.3, k / (wheelCount - 1)),
          rope = at(sign * 3, 0, d),
          tangent = at(sign * 3, 0, d + 0.05)
            .sub(at(sign * 3, 0, d - 0.05))
            .normalize(),
          down = tangent.clone().cross(side).normalize(),
          q = rope.clone().addScaledVector(down, row * 0.39),
          w = new THREE.Mesh(pylonWheels, pylonWheelMat);
        w.position.copy(q);
        w.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, side, down));
        w.castShadow = true;
        post.add(w);
        const inboard = q.clone().addScaledVector(side, -sign * 0.57);
        beam(at(sign * 2.43, 1.25, d), inboard, 0.055, pylonGalv, post);
        beam(inboard, q, 0.055, pylonGalv, post);
        contacts.push({
          lane: sign * 3,
          rope: rope.toArray(),
          center: q.toArray(),
          row: row === 1 ? 'below' : 'above',
          radius: 0.37,
        });
      }
    // Grated service walkway outside the moving hanger envelope, above rope level.
    const deck = box(1.05, 0.14, 4.9, pylonGalv, 0, 0, 0, post);
    deck.position.copy(at(sign * 4.8, 1.55, 0));
    deck.rotation.y = Math.atan2(dir.x, dir.z);
    for (const d of [-2.2, 0, 2.2])
      beam(at(sign * 5.2, 1.6, d), at(sign * 5.2, 2.7, d), 0.045, pylonGalv, post);
    beam(at(sign * 5.2, 2.7, -2.2), at(sign * 5.2, 2.7, 2.2), 0.045, pylonGalv, post);
  }
  const h = p.y - foot.y + 1.5;
  for (const x of [-0.37, 0.37])
    beam(
      foot.clone().addScaledVector(side, x).addScaledVector(dir, -1.05),
      at(x, 1.5, -1.05),
      0.045,
      pylonGalv,
      post,
    );
  for (let y = 1; y < h; y += 0.52)
    beam(
      foot
        .clone()
        .addScaledVector(side, -0.37)
        .addScaledVector(dir, -1.05)
        .add(new V(0, y, 0)),
      foot
        .clone()
        .addScaledVector(side, 0.37)
        .addScaledVector(dir, -1.05)
        .add(new V(0, y, 0)),
      0.035,
      pylonGalv,
      post,
    );
  box(
    lattice ? 3.5 : 2.8,
    0.75,
    lattice ? 3.5 : 2.8,
    stationMat,
    foot.x,
    foot.y + 0.2,
    foot.z,
    post,
  );
  const record = {
    liftId: rt.lift.id,
    index,
    t: tp,
    kind,
    mast: lattice ? 'lattice' : 'tubular',
    height: mastHeight,
    deflectionRad: deflection,
    wheelCount,
    contacts,
    foot: foot.toArray(),
    basis: 'visible rope profile only; not a load-case or equipment design',
  };
  const old = pylonDetailRecords.findIndex((r) => r.liftId === record.liftId && r.index === index);
  if (old >= 0) pylonDetailRecords[old] = record;
  else pylonDetailRecords.push(record);
}
