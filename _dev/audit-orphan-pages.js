#!/usr/bin/env node
/**
 * Orphan Page Audit — spec 043 E1
 *
 * 掃所有 production HTML，列出沒從任何主要瀏覽路徑進入的孤立頁面。
 * Constitution 第二十二條（Orphan Page Prohibition）的驗證機制。
 *
 * 每頁檢查是否被以下任一引用：
 *   - sitemap.xml
 *   - _dev/src/components.js（nav + footer markup）
 *   - 任何其他 production HTML 的 <a href>
 *
 * 未被任一引用 → 列為 orphan，exit code = 1（可接 CI gate）。
 *
 * Allowlist：
 *   - naverefd5e23649b008def093b351cb16bcb7.html (Naver verification)
 *   - yandex_f1396b4e752c6afc.html (Yandex verification)
 *   - 404.html（GitHub Pages 自動觸發）
 *
 * Usage:
 *   node _dev/audit-orphan-pages.js          # exit 0 / 1
 *   node _dev/audit-orphan-pages.js --verbose # 每頁印出被誰引用
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

const EXCLUDE_DIRS = new Set([
  '_dev', '_archive', 'specs', 'idea', 'node_modules',
  '.git', '.github', '_full-backup', 'fonts', 'cloudflare', 'docs'
]);

// 不需任何 user-facing 入口的特例（search engine verification、auto-served）
const ALLOWLIST = new Set([
  'naverefd5e23649b008def093b351cb16bcb7.html',
  'yandex_f1396b4e752c6afc.html',
  '404.html'
]);

function walkHtml(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkHtml(full, out);
    else if (stat.isFile() && name.endsWith('.html')) out.push(full);
  }
  return out;
}

// 一個 HTML 檔可能被以下幾種 URL/path 形式引用，全部都算 reachable：
//   - `relative/path/page.html`
//   - `/relative/path/page.html`
//   - `https://keeply.work/relative/path/page.html`
// 對 index.html 還要算 `/foo/` 與 `/foo` 形式
function referenceFormsFor(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  const forms = new Set();
  forms.add(rel);
  forms.add('/' + rel);
  forms.add('https://keeply.work/' + rel);

  // index.html 形式：/foo/index.html → /foo/ 與 /foo
  if (rel.endsWith('/index.html')) {
    const dir = rel.replace(/\/index\.html$/, '/');
    forms.add(dir);
    forms.add('/' + dir);
    forms.add('https://keeply.work/' + dir);
    const dirNoSlash = rel.replace(/\/index\.html$/, '');
    forms.add(dirNoSlash);
    forms.add('/' + dirNoSlash);
  }
  if (rel === 'index.html') {
    forms.add('/');
    forms.add('https://keeply.work/');
  }
  return forms;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 在 source 文字裡找是否有任何 form 出現於合法的 reference 位置
// （以 quote / whitespace / 路徑分隔字元為邊界，避免誤匹配 "/foo" 在 "/foo-bar" 內）
function findReference(content, forms) {
  for (const f of forms) {
    if (!f) continue;
    // 不允許前/後緊鄰字母數字或 -._ — 避免 install.html 被誤認為 reinstall.html 子串
    const re = new RegExp('(^|[^A-Za-z0-9_\\-./])' + escapeRegex(f) + '([^A-Za-z0-9_\\-]|$)');
    if (re.test(content)) return f;
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const htmlFiles = walkHtml(ROOT, []);

// 載入所有可能引用來源（other HTML + components.js + sitemap.xml）
const referenceSources = new Map();
function addSource(file) {
  if (fs.existsSync(file)) {
    referenceSources.set(file, fs.readFileSync(file, 'utf8'));
  }
}
for (const h of htmlFiles) addSource(h);
addSource(path.join(ROOT, '_dev/src/components.js'));
addSource(path.join(ROOT, 'sitemap.xml'));

const orphans = [];
const evidence = new Map();

for (const filePath of htmlFiles) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  if (ALLOWLIST.has(path.basename(rel))) continue;
  if (rel === 'index.html') continue; // root 首頁是隱式入口

  const forms = referenceFormsFor(filePath);
  let foundIn = null;
  let foundForm = null;
  for (const [source, content] of referenceSources) {
    if (source === filePath) continue; // 不算自我引用
    const matched = findReference(content, forms);
    if (matched) {
      foundIn = source;
      foundForm = matched;
      break;
    }
  }
  if (foundIn) {
    if (VERBOSE) evidence.set(rel, { source: path.relative(ROOT, foundIn).split(path.sep).join('/'), form: foundForm });
  } else {
    orphans.push(rel);
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log('Orphan Page Audit');
console.log('=================');
console.log(`Scanned:      ${htmlFiles.length} HTML files`);
console.log(`Allow-listed: ${ALLOWLIST.size} (verification / 404)`);
console.log(`Sources:      ${referenceSources.size} (other HTML + components.js + sitemap.xml)`);
console.log('');

if (VERBOSE) {
  console.log('Reference evidence (first reference found, not exhaustive):');
  for (const [page, ref] of evidence) {
    console.log(`  ${page.padEnd(40)} ← ${ref.source} ("${ref.form}")`);
  }
  console.log('');
}

if (orphans.length === 0) {
  console.log('✓ 0 orphan pages.');
  process.exit(0);
} else {
  console.log(`✗ ${orphans.length} orphan page(s) — 沒被任何 HTML / components.js / sitemap.xml 引用：`);
  orphans.forEach(p => console.log('  - ' + p));
  console.log('');
  console.log('修補：');
  console.log('  - 加入主 nav / footer：改 _dev/src/components.js');
  console.log('  - 加入 homepage section：改 _dev/templates/index.html');
  console.log('  - 加入 sitemap：改 _dev/build.js（PAGES / EXTRA_SITEMAP_PAGES / generate*SitemapEntries）');
  console.log('  - 確為 verification / 自動觸發頁：加入 ALLOWLIST');
  process.exit(1);
}
