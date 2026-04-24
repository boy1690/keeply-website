#!/usr/bin/env node
/**
 * Spec 031 one-shot: extract inline scripts from activate.html + buy.html
 * across all locale folders into external activate-license.js /
 * paddle-checkout.js references. Intended to run ONCE to regenerate the
 * 20+20 locale copies; safe to re-run (idempotent — skips already-patched
 * files).
 *
 * Usage: node _dev/refactor-inline-scripts.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

function candidates(page) {
  return [path.join(ROOT, page), ...LOCALES.map(l => path.join(ROOT, l, page))];
}

function stripInlineBlock(content, markerStart, markerEnd) {
  // Remove from the leading comment/preamble through end of </script>.
  // Pattern: <!-- ... -->\n  <script>...</script>
  const re = new RegExp(
    markerStart + '[\\s\\S]*?<\\/script>\\s*',
    'g'
  );
  return content.replace(re, markerEnd);
}

function patchActivate(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;
  const isSub = path.dirname(filePath) !== ROOT;
  const srcPath = isSub ? '../activate-license.js' : 'activate-license.js';
  const externalTag = `<script src="${srcPath}" defer></script>`;

  // 1) onclick → id for retry button (first occurrence, once).
  content = content.replace(
    /onclick="location\.reload\(\)"/g,
    'id="timeout-retry-btn"'
  );

  // 2) Remove the inline <!-- Activate logic --> block and its <script>.
  content = content.replace(
    /\s*<!--\s*Activate logic\s*-->\s*<script>[\s\S]*?<\/script>\s*/,
    `\n  ${externalTag}\n`
  );

  if (content === before) return { path: filePath, changed: false };
  fs.writeFileSync(filePath, content, 'utf8');
  return { path: filePath, changed: true };
}

function patchBuy(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;
  const isSub = path.dirname(filePath) !== ROOT;
  const srcPath = isSub ? '../paddle-checkout.js' : 'paddle-checkout.js';
  const externalTag = `<script src="${srcPath}" defer></script>`;

  // Remove the inline IIFE <script>...</script> (the one right after Paddle.js
  // CDN tag). Keep the Paddle CDN script.
  content = content.replace(
    /(<script src="https:\/\/cdn\.paddle\.com\/paddle\/v2\/paddle\.js"><\/script>\s*)<script>\s*\(function[\s\S]*?<\/script>\s*/,
    `$1${externalTag}\n`
  );

  if (content === before) return { path: filePath, changed: false };
  fs.writeFileSync(filePath, content, 'utf8');
  return { path: filePath, changed: true };
}

let totalChanged = 0;
let totalSkipped = 0;

for (const file of candidates('activate.html')) {
  if (!fs.existsSync(file)) continue;
  const r = patchActivate(file);
  if (r.changed) { totalChanged++; console.log(`[activate] patched: ${path.relative(ROOT, file)}`); }
  else { totalSkipped++; }
}
for (const file of candidates('buy.html')) {
  if (!fs.existsSync(file)) continue;
  const r = patchBuy(file);
  if (r.changed) { totalChanged++; console.log(`[buy] patched: ${path.relative(ROOT, file)}`); }
  else { totalSkipped++; }
}

console.log(`\nDone: ${totalChanged} patched, ${totalSkipped} already-clean/skipped.`);
