// Spec 015 — add blog link button i18n keys.
// Adds `nav.blog` and `footer.blog` to all 19 locales across .js + .json files.
//
// Idempotent: if keys already exist, the entry is left unchanged (no duplicates, no overwrite).
//
// Usage: node _dev/add-blog-i18n.js
//
// After running, verify with:
//   grep -c '"nav.blog"' i18n/*.{js,json}       # expect 1 per file
//   grep -c '"footer.blog"' i18n/*.{js,json}    # expect 1 per file
//   for f in i18n/*.js; do node --check "$f"; done
//   for f in i18n/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))"; done

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOCALES = [
  'zh-TW', 'zh-CN', 'en', 'ja', 'ko',
  'de', 'fr', 'es', 'pt', 'it',
  'nl', 'pl', 'cs', 'hu', 'tr',
  'fi', 'sv', 'no', 'da'
];

// Native / international-common translations (see spec-lite.md D7).
const TRANSLATIONS = {
  'zh-TW': '部落格',
  'zh-CN': '博客',
  'en':    'Blog',
  'ja':    'ブログ',
  'ko':    '블로그',
  'de':    'Blog',
  'fr':    'Blog',
  'es':    'Blog',
  'pt':    'Blog',
  'it':    'Blog',
  'nl':    'Blog',
  'pl':    'Blog',
  'cs':    'Blog',
  'hu':    'Blog',
  'tr':    'Blog',
  'fi':    'Blogi',
  'sv':    'Blogg',
  'no':    'Blogg',
  'da':    'Blog'
};

const I18N_DIR = path.join(__dirname, '..', 'i18n');

let modifiedCount = 0;
let skippedCount = 0;

function updateJson(locale) {
  const file = path.join(I18N_DIR, `${locale}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  const obj = JSON.parse(raw);
  const text = TRANSLATIONS[locale];

  let changed = false;
  if (!('nav.blog' in obj)) {
    obj['nav.blog'] = text;
    changed = true;
  }
  if (!('footer.blog' in obj)) {
    obj['footer.blog'] = text;
    changed = true;
  }
  if (!changed) {
    skippedCount++;
    return;
  }

  // Preserve original key order by reading the source lines and inserting after `footer.contact`.
  const lines = raw.split('\n');
  const anchor = lines.findIndex(l => l.includes('"footer.contact"'));
  if (anchor < 0) {
    throw new Error(`[${locale}.json] anchor "footer.contact" not found — cannot preserve key order`);
  }
  // Detect trailing comma on the anchor line (it should have one because other keys follow)
  // The anchor line looks like: `  "footer.contact": "...",`
  // We insert two new lines after it with the same indentation.
  const indent = lines[anchor].match(/^(\s*)/)[1];
  const insertions = [];
  if (!raw.includes('"nav.blog"')) {
    insertions.push(`${indent}"nav.blog": ${JSON.stringify(text)},`);
  }
  if (!raw.includes('"footer.blog"')) {
    insertions.push(`${indent}"footer.blog": ${JSON.stringify(text)},`);
  }
  lines.splice(anchor + 1, 0, ...insertions);
  const newRaw = lines.join('\n');
  // Validate JSON parses
  JSON.parse(newRaw);
  fs.writeFileSync(file, newRaw);
  modifiedCount++;
}

function updateJs(locale) {
  const file = path.join(I18N_DIR, `${locale}.js`);
  const raw = fs.readFileSync(file, 'utf8');
  const text = TRANSLATIONS[locale];

  const hasNav = /"nav\.blog"\s*:/.test(raw);
  const hasFooter = /"footer\.blog"\s*:/.test(raw);
  if (hasNav && hasFooter) {
    skippedCount++;
    return;
  }

  const lines = raw.split('\n');
  const anchor = lines.findIndex(l => l.includes('"footer.contact"'));
  if (anchor < 0) {
    throw new Error(`[${locale}.js] anchor "footer.contact" not found — cannot preserve key order`);
  }
  const indent = lines[anchor].match(/^(\s*)/)[1];
  const insertions = [];
  if (!hasNav) {
    insertions.push(`${indent}"nav.blog": ${JSON.stringify(text)},`);
  }
  if (!hasFooter) {
    insertions.push(`${indent}"footer.blog": ${JSON.stringify(text)},`);
  }
  lines.splice(anchor + 1, 0, ...insertions);
  const newRaw = lines.join('\n');
  fs.writeFileSync(file, newRaw);

  // Validate with `node --check` (syntax only — .js references `window` which doesn't exist in Node)
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`[${locale}.js] syntax error after insertion: ${e.stderr?.toString() || e.message}`);
  }
  modifiedCount++;
}

function main() {
  for (const locale of LOCALES) {
    if (!(locale in TRANSLATIONS)) {
      throw new Error(`Translation missing for locale ${locale}`);
    }
    updateJson(locale);
    updateJs(locale);
  }

  console.log(`Done. Modified: ${modifiedCount} file(s). Skipped (already had keys): ${skippedCount} file(s).`);
  console.log(`Expected total files processed: ${LOCALES.length * 2} = ${LOCALES.length} .js + ${LOCALES.length} .json.`);
}

try {
  main();
} catch (e) {
  console.error('FAILED:', e.message);
  process.exit(1);
}
