const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process'),
  crypto = require('node:crypto');
const project = path.resolve(__dirname, '..'),
  work = path.join(project, '.build', 'work'),
  dist = path.join(project, 'dist');
if (process.argv.includes('--clean')) {
  for (const dir of [work, dist]) fs.rmSync(dir, { recursive: true, force: true });
}
fs.mkdirSync(work, { recursive: true });
for (const { source, target } of require('./inputs.json')) {
  const to = path.join(work, target);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(project, source), to);
}
fs.cpSync(path.join(__dirname, 'legacy'), path.join(work, 'tools'), { recursive: true });
// Validate the shipped terrain artifact before adapting legacy path-based fingerprints.
const expected = require('../data/terrain/artifact-integrity.json');
for (const [name, hash] of Object.entries(expected)) {
  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(project, name)))
    .digest('hex');
  if (actual !== hash) throw Error('Terrain artifact modified: ' + name);
}
const uncached = process.argv.includes('--uncached');
if (!uncached) {
  const binding = require('../data/terrain/source-integrity.json');
  for (const [name, hash] of Object.entries(binding)) {
    const actual = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(project, name)))
      .digest('hex');
    if (actual !== hash)
      throw Error(
        'Terrain inputs changed: ' +
          name +
          '; run npm run build:uncached to calculate terrain from source.',
      );
  }
}
const cachePath = path.join(work, 'research/restart-20261104/local-terrain-cache.json'),
  cache = JSON.parse(fs.readFileSync(cachePath));
cache.fingerprint = require(path.join(work, 'tools/local-terrain-cache.cjs')).fingerprint();
fs.writeFileSync(cachePath, JSON.stringify(cache));
fs.mkdirSync(path.join(work, 'research/delivery-review'), { recursive: true });
for (const command of ['build.cjs', 'package-delivery.cjs']) {
  const result = cp.spawnSync(process.execPath, [path.join(work, 'tools', command)], {
    cwd: work,
    stdio: 'inherit',
    env: {
      ...process.env,
      WANLONG_INTERNAL: '0',
      WANLONG_BUILD_SUFFIX: '',
      WANLONG_LOCAL_CACHE: uncached ? '0' : '1',
      WANLONG_LOCAL_DEM: '1',
      WANLONG_RAW_DEM: '0',
    },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(work, 'delivery/wanlong-map'), dist, { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('Built dist/index.html');
