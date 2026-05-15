import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const sharedDir = join(root, 'shared', 'rates');
const pythonDir = join(root, 'packages', 'python', 'src', 'ngtaxkit', 'data', 'rates');
const failures = [];

for (const filename of readdirSync(sharedDir).filter((name) => name.endsWith('.json')).sort()) {
  const shared = normalizeJson(join(sharedDir, filename));
  const python = normalizeJson(join(pythonDir, filename));

  if (shared !== python) {
    failures.push(filename);
  }
}

if (failures.length > 0) {
  console.error(`Python packaged rate data is out of sync for: ${failures.join(', ')}`);
  exit(1);
}

console.log('Shared and Python packaged rate data are in sync.');

function normalizeJson(path) {
  return `${JSON.stringify(JSON.parse(readFileSync(path, 'utf8')), null, 2)}\n`;
}
