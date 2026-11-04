import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oldPages = path.resolve(root, '../../../java-b2b2c-overseas-v5.8.61/view/pc/pages');
const appDir = path.resolve(root, 'app');

function walk(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full, filter));
    else if (filter(entry.name)) result.push(full);
  }
  return result;
}

function nuxtRoute(file) {
  let route = path.relative(oldPages, file).replace(/\\/g, '/').replace(/\.vue$/, '');
  route = route.replace(/\/index$/, '');
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  if (route === 'index') route = '';
  return `/${route}`;
}

function nextRoute(file) {
  let route = path.relative(appDir, file).replace(/\\/g, '/').replace(/\/page\.tsx$/, '').replace(/page\.tsx$/, '');
  route = route.replace(/\[([^\]]+)\]/g, ':$1');
  return `/${route}`.replace(/\/$/, '') || '/';
}

function normalize(route) {
  return route
    .toLowerCase()
    .replace(/\/list$/, '')
    .replace(/\/info$/, '')
    .replace(/\/index$/, '');
}

const oldRoutes = walk(oldPages, (name) => name.endsWith('.vue')).map(nuxtRoute);
const newRoutes = walk(appDir, (name) => name === 'page.tsx').map(nextRoute);
const newSet = new Set(newRoutes.map(normalize));
const missing = [...new Set(oldRoutes)]
  .filter((route) => !route.includes('/src/') && !route.includes('/components/'))
  .filter((route) => !newSet.has(normalize(route)))
  .sort();
const extra = [...new Set(newRoutes)].filter((route) => !oldRoutes.some((oldRoute) => normalize(oldRoute) === normalize(route))).sort();

console.log(`old page files: ${oldRoutes.length}`);
console.log(`new routes:     ${newRoutes.length}`);
console.log(`old routes:     ${new Set(oldRoutes).size}`);
console.log(`business missing: ${missing.length} (excluding src/ and components/)`);
console.log('\nMissing old routes (first 120):');
for (const route of missing.slice(0, 120)) console.log(`  ${route}`);
console.log('\nExtra new routes:');
for (const route of extra) console.log(`  ${route}`);
