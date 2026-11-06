const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const oldRoot = 'D:/tigshop/java-b2b2b-pro-v5.8.57/java-b2b2c-overseas-v5.8.61/view/admin/src/views/decorate/decorate/editor/modules/pcHome';
const newFile = 'D:/tigshop/java-b2b2b-pro-v5.8.57/rust/web/admin-semi/src/pages/PcDecorateEditor.tsx';
const modules = fs.readdirSync(oldRoot, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('pc-')).map(d => d.name).sort();

function oldLabels(mod) {
  const f = path.join(oldRoot, mod, 'Settings.vue');
  if (!fs.existsSync(f)) return [];
  const src = fs.readFileSync(f, 'utf8');
  const labels = [];
  for (const m of src.matchAll(/(?:label|title)\s*:\s*["'`]([^"'`]+)["'`]/g)) labels.push(m[1]);
  for (const m of src.matchAll(/<div class="title">([^<]+)<\/div>/g)) labels.push(m[1].trim());
  for (const m of src.matchAll(/>\s*([\u4e00-\u9fa5][^<>{}]{1,20})\s*</g)) labels.push(m[1].trim());
  return [...new Set(labels)];
}

const src = fs.readFileSync(newFile, 'utf8');
const sf = ts.createSourceFile(newFile, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const newSettings = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText() === 'NEW_MODULE_DEFS' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    for (const el of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      let type = null; let labels = [];
      for (const p of el.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const name = p.name.getText().replace(/^['"]|['"]$/g, '');
        if (name === 'type' && ts.isStringLiteral(p.initializer)) type = p.initializer.text;
        if (name === 'settings' && ts.isArrayLiteralExpression(p.initializer)) {
          for (const s of p.initializer.elements) {
            if (!ts.isObjectLiteralExpression(s)) continue;
            for (const sp of s.properties) {
              if (ts.isPropertyAssignment(sp) && sp.name.getText() === 'label' && ts.isStringLiteral(sp.initializer)) labels.push(sp.initializer.text);
            }
          }
        }
      }
      if (type) newSettings[type] = labels;
    }
  }
  ts.forEachChild(node, visit);
}
visit(sf);

for (const mod of modules) {
  const o = oldLabels(mod);
  const n = newSettings[mod] || [];
  console.log(`\n### ${mod}\nOLD(${o.length}): ${o.join(' | ')}\nNEW(${n.length}): ${n.join(' | ')}`);
}
