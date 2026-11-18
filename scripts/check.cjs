const fs = require('node:fs'),
  path = require('node:path'),
  cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
function scan(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? scan(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const files = ['src', 'scripts', 'tests']
  .flatMap((n) => (fs.existsSync(path.join(root, n)) ? scan(path.join(root, n)) : []))
  .filter((f) => /\.(?:js|cjs)$/.test(f));
for (const file of files) {
  const result = cp.spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('Syntax checked ' + files.length + ' files');
