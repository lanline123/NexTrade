// 把旧版评分星星雪碧图拷进 public：node scripts/copy-icon-star.mjs
import fs from 'node:fs';
import path from 'node:path';

const legacy = 'D:/tigshop/NexTrade/java-b2b2c-overseas-v5.8.61/view/pc/assets/images/common/icon-star.png';
const target = path.resolve(process.cwd(), 'public/assets/images/common/icon-star.png');

if (!fs.existsSync(legacy)) {
  console.error('旧版雪碧图不存在：', legacy);
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(legacy, target);
console.log('copied ->', target, fs.statSync(target).size, 'B');
