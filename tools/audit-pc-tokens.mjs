// 逐页 token 提取：递归解析 import 闭包，抽取中文文本、表单字段、交互动作
// 产出 docs/pc-parity-tokens.json 供子代理复核
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const OLD = path.join(ROOT, 'java-b2b2c-overseas-v5.8.61/view/pc');
const NEW = path.join(ROOT, 'rust/web/pc-semi');

const CN = /[\u4e00-\u9fff]/;

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
function walk(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

// 抽取中文串
function cnTokens(text) {
  const set = new Set();
  // 模板/属性里的中文
  for (const m of text.matchAll(/[\u4e00-\u9fff][\u4e00-\u9fff\s·，。、；：？！（）()\-—\/A-Za-z0-9%]*[\u4e00-\u9fff]/g)) {
    const t = m[0].trim();
    if (t.length >= 2 && t.length <= 40) set.add(t);
  }
  for (const m of text.matchAll(/[\u4e00-\u9fff]/g)) {
    const t = m[0];
    if (t.length >= 2) set.add(t);
  }
  return set;
}

// 抽取表单字段标识
function fieldTokens(text) {
  const set = new Set();
  const pats = [
    /(?:label|title|placeholder|text|description|desc|tip|heading|header|placeholder)\s*[:=]\s*["'`]([^"'`]{1,60})["'`]/gi,
    /v-model(?:\.[A-Za-z_$][\w$]*)*\s*=\s*["']([A-Za-z_$][\w$]*)["']/g,
    /(?:name|prop|field)\s*[:=]\s*["']([A-Za-z_$][\w$.]*)["']/g,
  ];
  for (const p of pats) for (const m of text.matchAll(p)) {
    const v = m[1].trim();
    if (v && !CN.test(v) && v.length <= 50) set.add(v);
  }
  return set;
}

// 抽取交互动作（按钮文案 / 方法名 / 事件）
function actionTokens(text) {
  const set = new Set();
  const pats = [
    /<Button[^>]*>([^<]{1,40})<\/Button>/gi,
    /<button[^>]*>([^<]{1,40})<\/button>/gi,
    /(?:onClick|@click|v-on:click)\s*=\s*["'`]([^"'`]{1,60})["'`]/g,
    /(?:handle[A-Z]\w+|open[A-Z]\w+|show[A-Z]\w+|submit[A-Z]\w+|to[A-Z]\w+|fetch[A-Z]\w+|load[A-Z]\w+)\s*\(/g,
    /@click\.(\w+)/g,
  ];
  for (const p of pats) for (const m of text.matchAll(p)) {
    const v = (m[1] || '').trim().replace(/\s+/g, ' ');
    if (v && v.length <= 60) set.add(v);
  }
  return set;
}

// 解析 import 闭包
function closure(entry, exts, resolveRoots) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f)) continue;
    if (!fs.existsSync(f)) continue;
    seen.add(f);
    const text = readIfExists(f);
    for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const dir = path.dirname(f);
      const abs = path.resolve(dir, spec);
      const cands = [];
      for (const e of exts) cands.push(abs + e);
      for (const e of exts) cands.push(path.join(abs, 'index' + e));
      for (const e of exts) cands.push(path.join(abs, 'src', 'index' + e));
      const hit = cands.find(c => fs.existsSync(c));
      if (hit) stack.push(hit);
    }
  }
  return [...seen];
}

function aggregate(files) {
  const cn = new Set(), fl = new Set(), ac = new Set();
  for (const f of files) {
    const t = readIfExists(f);
    cnTokens(t).forEach(x => cn.add(x));
    fieldTokens(t).forEach(x => fl.add(x));
    actionTokens(t).forEach(x => ac.add(x));
  }
  return { cn: [...cn].sort(), fields: [...fl].sort(), actions: [...ac].sort() };
}

// ---- 旧版：pages 入口 ----
const oldPages = {};
for (const f of walk(path.join(OLD, 'pages'), ['.vue'])) {
  const rel = path.relative(path.join(OLD, 'pages'), f).replace(/\\/g, '/').replace(/\.v1\.vue$/, '.vue').replace(/\.vue$/, '');
  const key = '/' + rel.split('/').filter(s => s !== 'index' && s !== 'Index' && s !== 'src').join('/').toLowerCase();
  const files = closure(f, ['.vue', '.ts', '.js'], OLD);
  oldPages[key] = { entry: path.relative(OLD, f).replace(/\\/g, '/'), closure: files.map(x => path.relative(OLD, x).replace(/\\/g, '/')), ...aggregate(files) };
}

// ---- 新版：app 入口 ----
const newPages = {};
for (const f of walk(path.join(NEW, 'app'), ['.tsx', '.ts'])) {
  if (!/page\.(tsx|ts)$/.test(f)) continue;
  const rel = path.relative(path.join(NEW, 'app'), f).replace(/\\/g, '/').replace(/\/page\.(tsx|ts)$/, '');
  const key = '/' + rel.toLowerCase();
  const files = closure(f, ['.tsx', '.ts', '.jsx', '.js', '.scss'], NEW);
  newPages[key] = { entry: path.relative(NEW, f).replace(/\\/g, '/'), closure: files.map(x => path.relative(NEW, x).replace(/\\/g, '/')), ...aggregate(files) };
}

// ---- 全局组件池 ----
const oldGlobal = aggregate(walk(path.join(OLD, 'components'), ['.vue', '.ts']));
const newGlobal = aggregate(walk(path.join(NEW, 'src/components'), ['.tsx', '.ts']));
const oldDec = aggregate(walk(path.join(OLD, 'decorate/components'), ['.vue']));
const newDec = aggregate(walk(path.join(NEW, 'src/decorate/components'), ['.tsx', '.ts']));

const out = {
  generatedAt: new Date().toISOString(),
  oldPageCount: Object.keys(oldPages).length,
  newPageCount: Object.keys(newPages).length,
  oldPages, newPages,
  global: { old: oldGlobal, new: newGlobal },
  decorate: { old: oldDec, new: newDec },
};
fs.writeFileSync(path.join(ROOT, 'docs', 'pc-parity-tokens.json'), JSON.stringify(out, null, 2));
console.log('old pages', Object.keys(oldPages).length, 'new pages', Object.keys(newPages).length);
console.log('old global cn', oldGlobal.cn.length, 'new global cn', newGlobal.cn.length);
console.log('old decorate cn', oldDec.cn.length, 'new decorate cn', newDec.cn.length);
console.log('written docs/pc-parity-tokens.json');
