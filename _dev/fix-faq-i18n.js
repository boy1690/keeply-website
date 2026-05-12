#!/usr/bin/env node
/**
 * Spec 038: translate homepage FAQ section across 17 non-en non-zh-TW locales.
 * Source translations are in _dev/_tmp_faq_translations_all.json (assembled
 * from 4 parallel translation agents). 15 keys × 17 locales = 255 entries.
 * After running, re-run `npm run build` to regenerate localized HTML.
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'i18n');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, '_tmp_faq_translations_all.json'), 'utf8'));

const KEYS = [
  'index.faq.title',
  'index.faq.1.q', 'index.faq.1.a',
  'index.faq.2.q', 'index.faq.2.a',
  'index.faq.3.q', 'index.faq.3.a',
  'index.faq.4.q', 'index.faq.4.a',
  'index.faq.5.q', 'index.faq.5.a',
  'index.faq.6.q', 'index.faq.6.a',
  'index.faq.7.q', 'index.faq.7.a',
];

function jsonEscape(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Replace existing key in raw JSON; return null if not found.
function replaceKey(raw, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('("' + escapedKey + '":\\s*")((?:\\\\.|[^"\\\\])*)(")', '');
  if (!re.test(raw)) return null;
  return raw.replace(re, '$1' + jsonEscape(value) + '$3');
}

// Append new key:value entries before the closing `}`.
// Handles whether the previous last entry already has a trailing comma.
function appendKeys(raw, entries) {
  // Match the closing brace and any whitespace before it.
  const m = raw.match(/(,?)(\s*)\}\s*$/);
  if (!m) throw new Error('Could not locate closing }');
  const before = raw.slice(0, m.index);
  const lines = entries.map(([k, v]) =>
    '  "' + k + '": "' + jsonEscape(v) + '"'
  ).join(',\n');
  // Add a comma after previous content if it doesn't already end with one.
  const sep = before.replace(/\s+$/, '').endsWith(',') ? '' : ',';
  return before + sep + '\n' + lines + '\n}\n';
}

let totalChanges = 0;
Object.keys(T).forEach((locale) => {
  const filePath = path.join(I18N_DIR, locale + '.json');
  let raw = fs.readFileSync(filePath, 'utf8');
  let replaced = 0;
  const toAppend = [];
  KEYS.forEach((k) => {
    if (T[locale][k] == null) {
      console.warn('  [' + locale + '] missing translation: ' + k);
      return;
    }
    const next = replaceKey(raw, k, T[locale][k]);
    if (next != null) {
      raw = next;
      replaced++;
    } else {
      toAppend.push([k, T[locale][k]]);
    }
  });
  if (toAppend.length > 0) {
    raw = appendKeys(raw, toAppend);
  }
  fs.writeFileSync(filePath, raw, 'utf8');
  console.log(locale + ': ' + replaced + ' replaced, ' + toAppend.length + ' appended');
  totalChanges += replaced + toAppend.length;
});
console.log('\nTotal updates: ' + totalChanges);
