// PC 新旧版路由/组件/接口覆盖比对
// 旧：java-b2b2c-overseas-v5.8.61/view/pc (Nuxt3)
// 新：rust/web/pc-semi (Next.js App Router)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const OLD = path.join(ROOT, 'java-b2b2c-overseas-v5.8.61/view/pc');
const NEW = path.join(ROOT, 'rust/web/pc-semi');

function walk(dir, exts, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, exts, base));
    else if (exts.some(x => e.name.endsWith(x))) out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

// ---------- 路由 ----------
function nuxtRoutes() {
  const out = new Map(); // route -> file
  const files = walk(path.join(OLD, 'pages'), ['.vue']);
  for (const rel of files) {
    let r = rel.replace(/\.v1\.vue$/, '.vue').replace(/\.vue$/, '');
    const parts = r.split('/');
    // Nuxt: 文件名首字母大写 / index 视为 index 段
    const segs = [];
    for (const p of parts) {
      if (p === 'index' || p === 'Index') { if (segs.length) segs[segs.length - 1] = segs[segs.length - 1]; }
      else if (/^\[.*\]$/.test(p)) segs.push(p);
      else if (p === 'src') continue;
      else segs.push(p.toLowerCase());
    }
    // 上面的 index 处理不严谨，改用重新解析
    const clean = [];
    for (const p of parts) {
      if (p === 'src') continue;
      if (p === 'index' || p === 'Index') continue;
      if (/^\[.*\]$/.test(p)) { clean.push(p.toLowerCase()); continue; }
      clean.push(p.toLowerCase());
    }
    let route = '/' + clean.join('/');
    route = route.replace(/\/$/, '') || '/';
    out.set(route.toLowerCase(), rel);
  }
  return out;
}

function nextRoutes() {
  const out = new Map();
  const files = walk(path.join(NEW, 'app'), ['page.tsx', 'page.ts']);
  for (const rel of files) {
    const clean = rel.replace(/\/page\.(tsx|ts)$/, '');
    let route = clean === '' ? '/' : '/' + clean;
    route = route.replace(/\/$/, '') || '/';
    out.set(route.toLowerCase(), rel);
  }
  return out;
}

// 动态段归一化：[id] / [...slug] / [id]/[sn] -> :param
function dyn(r) {
  return r.replace(/\[\.\.\.(\w+)\]/g, ':*').replace(/\[(\w+)\]/g, ':p');
}

const oldR = nuxtRoutes();
const newR = nextRoutes();
const oldDyn = new Map([...oldR].map(([k, v]) => [dyn(k), v]));
const newDyn = new Map([...newR].map(([k, v]) => [dyn(k), v]));

const missing = [];
for (const [k, v] of oldDyn) if (!newDyn.has(k)) missing.push([k, v]);
const added = [];
for (const [k, v] of newDyn) if (!oldDyn.has(k)) added.push([k, v]);

// ---------- 组件 ----------
const oldComp = walk(path.join(OLD, 'components'), ['.vue']).filter(f => !f.includes('/src/'));
const oldDecorate = walk(path.join(OLD, 'decorate/components'), ['.vue']);
const newComp = walk(path.join(NEW, 'src/components'), ['.tsx', '.ts']);
const newDecorate = walk(path.join(NEW, 'src/decorate/components'), ['.tsx', '.ts']);

const base = p => p.split('/').pop().replace(/\.(vue|tsx|ts)$/, '').replace(/\.v1$/, '').toLowerCase();
const oldCompNames = new Map(oldComp.map(f => [base(f), f]));
const newCompNames = new Map(newComp.map(f => [base(f), f]));
const oldDecNames = new Map(oldDecorate.map(f => [base(f), f]));
const newDecNames = new Map(newDecorate.map(f => [base(f), f]));

// ---------- API ----------
function apiCalls(dir) {
  const s = new Set();
  for (const f of walk(dir, ['.vue', '.ts', '.tsx'])) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of t.matchAll(/['"`](\/api\/[A-Za-z0-9_\-/{}.]+)/g)) s.add(m[1]);
  }
  return s;
}
const oldApi = apiCalls(path.join(OLD, 'api'));
const newApi = apiCalls(NEW);

const report = {
  routes: {
    oldCount: oldR.size, newCount: newR.size,
    missing: missing.map(([k, v]) => ({ route: k, file: v })),
    added: added.map(([k, v]) => ({ route: k, file: v })),
  },
  components: {
    oldCount: oldComp.length, newCount: newComp.length,
    missing: oldComp.filter(f => !newCompNames.has(base(f))).map(f => ({ file: f, name: base(f) })),
    added: newComp.filter(f => !oldCompNames.has(base(f))).map(f => ({ file: f, name: base(f) })),
  },
  decorate: {
    oldCount: oldDecorate.length, newCount: newDecorate.length,
    missing: oldDecorate.filter(f => !newDecNames.has(base(f))).map(f => ({ file: f, name: base(f) })),
    added: newDecorate.filter(f => !oldDecNames.has(base(f))).map(f => ({ file: f, name: base(f) })),
  },
  api: {
    oldCount: oldApi.size, newCount: newApi.size,
    missing: [...oldApi].filter(a => ![...newApi].some(n => n.replace(/\/[^/]*$/, '') === a.replace(/\/[^/]*$/, '') && (n.includes(a.split('/').pop()) || a.includes(n.split('/').pop())))).sort(),
  },
};
fs.writeFileSync(path.join(ROOT, 'docs', 'pc-parity-diff.json'), JSON.stringify(report, null, 2));

console.log('== 路由 ==');
console.log('old', oldR.size, 'new', newR.size, '缺', missing.length, '增', added.length);
console.log('\n[缺路由]');
missing.forEach(([k, v]) => console.log('  ', k, ' <- ', v));
console.log('\n[新增路由]');
added.forEach(([k, v]) => console.log('  ', k, ' <- ', v));
console.log('\n== 组件 ==');
console.log('old', oldComp.length, 'new', newComp.length, '缺', report.components.missing.length);
report.components.missing.forEach(x => console.log('  ', x.file));
console.log('\n== 装修组件 ==');
console.log('old', oldDecorate.length, 'new', newDecorate.length, '缺', report.decorate.missing.length);
report.decorate.missing.forEach(x => console.log('  ', x.file));
console.log('\n== API 路径缺失候选 ==');
report.api.missing.forEach(x => console.log('  ', x));
