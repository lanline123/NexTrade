const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const oldRoot = 'D:/tigshop/java-b2b2b-pro-v5.8.57/java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome';
const newFile = 'D:/tigshop/java-b2b2b-pro-v5.8.57/rust/web/admin-semi/src/pages/PcDecorateEditor.tsx';

const modules = fs.readdirSync(oldRoot, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('pc-')).map(d => d.name).sort();

function propsFromObject(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  const out = [];
  for (const p of node.properties) {
    if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
      const name = p.name && p.name.getText().replace(/^['"]|['"]$/g, '');
      if (name) out.push(name);
    }
  }
  return out;
}

function oldDefaultsKeys(mod) {
  const f = path.join(oldRoot, mod, 'index.ts');
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let result = null;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText().startsWith('pc') && /Defaults$/.test(node.name.getText()) && node.initializer) {
      const init = node.initializer;
      if (ts.isObjectLiteralExpression(init)) result = propsFromObject(init);
      else if (ts.isAsExpression(init) && ts.isObjectLiteralExpression(init.expression)) result = propsFromObject(init.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return result;
}

const src = fs.readFileSync(newFile, 'utf8');
const sf = ts.createSourceFile(newFile, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const newDefs = {};
function visitNew(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText() === 'NEW_MODULE_DEFS' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    for (const el of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      let type = null;
      let keys = [];
      for (const p of el.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const name = p.name.getText().replace(/^['"]|['"]$/g, '');
        if (name === 'type' && ts.isStringLiteral(p.initializer)) type = p.initializer.text;
        if (name === 'defaults' && ts.isArrowFunction(p.initializer)) {
          let body = p.initializer.body;
          if (ts.isParenthesizedExpression(body)) body = body.expression;
          if (ts.isObjectLiteralExpression(body)) keys = propsFromObject(body);
        }
      }
      if (type) newDefs[type] = keys;
    }
  }
  ts.forEachChild(node, visitNew);
}
visitNew(sf);

for (const mod of modules) {
  const oldKeys = oldDefaultsKeys(mod);
  const newKeys = newDefs[mod];
  if (!newKeys) { console.log(mod, 'NO NEW DEF'); continue; }
  if (!oldKeys) { console.log(mod, 'NO OLD DEFAULT OBJ'); continue; }
  const missing = oldKeys.filter(k => !newKeys.includes(k));
  const extra = newKeys.filter(k => !oldKeys.includes(k));
  console.log(`${mod}: old=${oldKeys.length} new=${newKeys.length}${missing.length ? ' MISSING=' + missing.join(',') : ''}${extra.length ? ' EXTRA=' + extra.join(',') : ''}`);
}
