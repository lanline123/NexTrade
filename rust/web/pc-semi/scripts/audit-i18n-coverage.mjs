import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const localePath = path.join(root, 'src/i18n/locales/en_us.json');
const en = JSON.parse(fs.readFileSync(localePath, 'utf8'));
const known = new Set(Object.keys(en));

const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.next', 'i18n'].includes(name)) continue;
      walk(full);
    } else if (/\.(tsx|ts)$/.test(name)) {
      files.push(full);
    }
  }
}
walk(path.join(root, 'app'));
walk(path.join(root, 'src'));

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function normalize(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

const candidates = new Map();
function add(text) {
  const value = normalize(text);
  if (value.length < 2 || value.length > 120) return;
  if (!/[\u4e00-\u9fa5]/.test(value)) return;
  if (/^(https?:)?\/\//.test(value)) return;
  if (/^[\d\s.,%¥$+\-]+/.test(value)) return;
  candidates.set(value, (candidates.get(value) || 0) + 1);
}

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const text = stripComments(raw);

  for (const match of text.matchAll(/>([^<>{}]*[\u4e00-\u9fa5][^<>{}]*)</g)) add(match[1]);
  for (const match of text.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g)) add(match[2]);
  for (const match of text.matchAll(/(?:placeholder|title|aria-label|alt)\s*=\s*(['"])([^'"]+)\1/g)) add(match[2]);
  for (const match of text.matchAll(/(?:Toast|message)\.(?:success|error|info|warning)\(\s*(['"])([^'"]+)\1/g)) add(match[2]);
}

const missing = [...candidates.keys()].filter((key) => !known.has(key));
const total = candidates.size;
const coverage = total ? ((total - missing.length) / total) * 100 : 100;

console.log(`files: ${files.length}`);
console.log(`candidate zh strings: ${total}`);
console.log(`translated keys: ${known.size}`);
console.log(`missing: ${missing.length}`);
console.log(`coverage: ${coverage.toFixed(1)}%`);
console.log('');
console.log('top missing:');
missing
  .sort((a, b) => (candidates.get(b) || 0) - (candidates.get(a) || 0) || b.length - a.length)
  .slice(0, 40)
  .forEach((key) => console.log(`  ${candidates.get(key)}x  ${key}`));

if (process.argv.includes('--fail')) process.exit(missing.length ? 1 : 0);
