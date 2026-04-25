#!/usr/bin/env node
/**
 * Keeply build-comparisons — Spec 028
 *
 * Renders template-first comparison pages from JSON data.
 * Produces: /compare/index.html + /compare/{slug}.html (en)
 *           /zh-TW/compare/index.html + /zh-TW/compare/{slug}.html (zh-TW)
 *
 * JSON Schema:
 *   _dev/comparisons/_hub.json         (hub metadata + card cross-references)
 *   _dev/comparisons/{slug}.json       (one per comparison; locales: { en, zh-TW })
 *
 * Template placeholders:
 *   {{VAR}}                    single value (supports dot notation, e.g. {{hero.h1}})
 *   {{#EACH array}}...{{/EACH}} loop; inside, use {{field}} for current item properties
 *
 * Usage: node _dev/build-comparisons.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COMPARISONS_DIR = path.join(ROOT, '_dev', 'comparisons');
const TEMPLATES_DIR = path.join(ROOT, '_dev', 'templates');
const BASE_URL = 'https://keeply.work';

const LOCALES = [
  { code: 'en', lang: 'en', ogLocale: 'en_US', readLink: 'Read comparison →' },
  { code: 'zh-TW', lang: 'zh-Hant', ogLocale: 'zh_TW', readLink: '看對比 →' }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolvePath(obj, dotPath) {
  return dotPath.split('.').reduce(function (acc, key) {
    return acc == null ? undefined : acc[key];
  }, obj);
}

/**
 * Tiny template engine:
 *   1. Resolve {{#EACH arr}}...{{/EACH}} blocks (non-nested).
 *   2. Replace {{var.path}} placeholders with the resolved value.
 */
function renderTemplate(tpl, context) {
  // Resolve EACH blocks first (outer-most single-pass; we do not support nested EACH).
  let out = tpl.replace(/\{\{#EACH\s+([\w.]+)\}\}([\s\S]*?)\{\{\/EACH\}\}/g, function (_, arrPath, inner) {
    const arr = resolvePath(context, arrPath);
    if (!Array.isArray(arr)) return '';
    return arr.map(function (item) {
      // Inside an EACH, bare {{field}} refers to item.field.
      return inner.replace(/\{\{([\w.]+)\}\}/g, function (__, path) {
        const value = resolvePath(item, path);
        return value == null ? '' : String(value);
      });
    }).join('');
  });

  // Replace remaining {{var}} with values from top-level context.
  out = out.replace(/\{\{([\w.]+)\}\}/g, function (_, dotPath) {
    const value = resolvePath(context, dotPath);
    return value == null ? '' : String(value);
  });

  return out;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Pre-clean output dirs so deleted JSONs do not leave orphan HTML.
function cleanOutputs() {
  for (const dir of [path.join(ROOT, 'compare'), path.join(ROOT, 'zh-TW', 'compare')]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

// Minimal schema validation — exit 1 on missing critical fields.
function validateComparison(slug, data) {
  const missing = [];
  if (!data.slug) missing.push('slug');
  if (!data.locales) missing.push('locales');
  for (const loc of ['en', 'zh-TW']) {
    if (!data.locales || !data.locales[loc]) { missing.push(`locales.${loc}`); continue; }
    const L = data.locales[loc];
    for (const sec of ['meta', 'hero', 'what_happened', 'comparison', 'pain_points', 'migration', 'faq']) {
      if (!L[sec]) missing.push(`locales.${loc}.${sec}`);
    }
  }
  if (missing.length) {
    console.error(`[comparisons] ${slug}.json missing: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function validateHub(data) {
  if (!data.order || !Array.isArray(data.order)) {
    console.error('[comparisons] _hub.json missing order array');
    process.exit(1);
  }
  if (!data.cards) {
    console.error('[comparisons] _hub.json missing cards');
    process.exit(1);
  }
}

// ─── Sub-page rendering ──────────────────────────────────────────────────────

function renderSubPage(data, locale, templateText) {
  const L = data.locales[locale.code];
  const slug = data.slug;
  const assetPrefix = locale.code === 'en' ? '../' : '../../';

  // Build comparison rows with bold wrapping based on bold_column.
  const rows = L.comparison.rows.map(function (r) {
    // Bold markdown-like `**...**` in keeply value → <strong>
    const keeplyHtml = String(r.keeply).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return { feature: r.feature, target: r.target, keeply_html: keeplyHtml };
  });

  const canonicalUrl = locale.code === 'en'
    ? `${BASE_URL}/compare/${slug}.html`
    : `${BASE_URL}/zh-TW/compare/${slug}.html`;

  const pricingLabels = locale.code === 'en'
    ? {
        compTitle: 'Feature comparison',
        compSub: 'Based on public product information as of April 2026. Keeply rows reflect shipping v1.0.5.',
        colFeature: 'Feature',
        colKeeplySub: '(recommended)',
        painTitle: 'Why people switch',
        migTitle: 'How to switch to Keeply',
        faqTitle: 'Frequently asked questions',
        finalTitle: 'Ready to stop fighting your tools?',
        finalBody: 'Free download for Windows and macOS. Thirty-second setup. No account required — just install and open your project folder.',
        ctaTertiary: 'Migration guide',
        ctaSeePricing: 'See Founding Member pricing'
      }
    : {
        compTitle: '功能對比',
        compSub: '資料依 2026 年 4 月公開產品資訊整理，Keeply 欄位反映出貨版 v1.0.5。',
        colFeature: '功能',
        colKeeplySub: '（推薦）',
        painTitle: '為什麼要換',
        migTitle: '怎麼換到 Keeply',
        faqTitle: '常見問題',
        finalTitle: '準備好不再跟工具打架了嗎？',
        finalBody: '免費下載支援 Windows 和 macOS。30 秒完成設定，不用帳號——安裝後打開你的專案資料夾就能用。',
        ctaTertiary: '查看遷移指南',
        ctaSeePricing: '查看 Founding Member 定價'
      };

  const ctaHome = locale.code === 'en' ? '/' : '/zh-TW/';
  const ctaBuyUrl = locale.code === 'en' ? '/buy.html' : '/zh-TW/buy.html';

  const context = {
    LANG: locale.lang,
    META_TITLE: L.meta.title,
    META_DESCRIPTION: L.meta.description,
    CANONICAL_URL: canonicalUrl,
    HREF_EN: `${BASE_URL}/compare/${slug}.html`,
    HREF_ZH_TW: `${BASE_URL}/zh-TW/compare/${slug}.html`,
    OG_LOCALE: locale.ogLocale,
    ASSET_PREFIX: assetPrefix,
    PUBLISHED: data.published,
    HERO_BADGE: L.hero.badge || '',
    HERO_H1_HTML: L.hero.h1_html || L.hero.h1,
    HERO_SUB_HTML: L.hero.sub_html || L.hero.sub,
    HERO_TAGLINE: L.hero.tagline || '',
    WHAT_HAPPENED_TITLE: L.what_happened.title,
    WHAT_HAPPENED_BODY_HTML: L.what_happened.body_html,
    WHAT_HAPPENED_SOURCE: L.what_happened.source || '',
    COMPARISON_TITLE: pricingLabels.compTitle,
    COMPARISON_SUB: pricingLabels.compSub,
    COL_FEATURE: pricingLabels.colFeature,
    COL_TARGET_HEADER: L.comparison.target_header || '',
    COL_TARGET_SUB: L.comparison.target_sub || '',
    COL_KEEPLY_SUB: pricingLabels.colKeeplySub,
    comparison: { rows: rows },
    pain_points: L.pain_points,
    migration: L.migration,
    faq: L.faq,
    PAIN_POINTS_TITLE: pricingLabels.painTitle,
    MIGRATION_TITLE: pricingLabels.migTitle,
    FAQ_TITLE: pricingLabels.faqTitle,
    FINAL_CTA_TITLE: pricingLabels.finalTitle,
    FINAL_CTA_BODY: pricingLabels.finalBody,
    CTA_HOME: ctaHome,
    CTA_BUY_URL: ctaBuyUrl,
    CTA_PRIMARY: locale.code === 'en' ? 'Free Download' : '免費下載',
    CTA_SECONDARY: locale.code === 'en' ? 'See comparison' : '看對比',
    CTA_TERTIARY: pricingLabels.ctaTertiary,
    CTA_SEE_PRICING: pricingLabels.ctaSeePricing
  };

  return renderTemplate(templateText, context);
}

// ─── Hub rendering ───────────────────────────────────────────────────────────

function renderHub(hubData, allComparisons, locale, templateText) {
  const L = hubData.locales[locale.code];
  const assetPrefix = locale.code === 'en' ? '../' : '../../';
  const canonicalUrl = locale.code === 'en'
    ? `${BASE_URL}/compare/`
    : `${BASE_URL}/zh-TW/compare/`;

  // Build cards in _hub.json order; resolve per-slug card metadata.
  const cards = hubData.order.map(function (slug) {
    const cardMeta = hubData.cards[slug];
    if (!cardMeta) {
      console.warn(`[comparisons] _hub.json cards missing slug: ${slug}`);
      return null;
    }
    const localeCopy = cardMeta[locale.code] || {};
    const href = locale.code === 'en'
      ? `/compare/${slug}.html`
      : `/zh-TW/compare/${slug}.html`;
    return {
      icon: cardMeta.icon,
      bg: cardMeta.bg,
      href: href,
      title: localeCopy.title || slug,
      hook_html: localeCopy.hook_html || '',
      read_link: locale.readLink
    };
  }).filter(Boolean);

  const ctaHome = locale.code === 'en' ? '/' : '/zh-TW/';

  const context = {
    LANG: locale.lang,
    META_TITLE: L.meta.title,
    META_DESCRIPTION: L.meta.description,
    CANONICAL_URL: canonicalUrl,
    HREF_EN: `${BASE_URL}/compare/`,
    HREF_ZH_TW: `${BASE_URL}/zh-TW/compare/`,
    OG_LOCALE: locale.ogLocale,
    ASSET_PREFIX: assetPrefix,
    HERO_H1_HTML: L.hero.h1_html,
    HERO_SUB: L.hero.sub,
    HERO_SUB2: L.hero.sub2,
    cards: cards,
    WHAT_IS_TITLE: L.cta.what_is,
    WHAT_IS_BODY: L.cta.what_is_body,
    CTA_HOME: ctaHome,
    CTA_PRIMARY: L.cta.primary,
    CTA_SECONDARY: L.cta.secondary
  };

  return renderTemplate(templateText, context);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('=== Keeply Comparison Pages Build ===\n');

  // Pre-clean (T4 avoids orphan HTMLs from deleted JSONs).
  cleanOutputs();

  // Create output dirs.
  ensureDir(path.join(ROOT, 'compare'));
  ensureDir(path.join(ROOT, 'zh-TW', 'compare'));

  // Load templates.
  const subTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'comparison.html'), 'utf8');
  const hubTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'compare-hub.html'), 'utf8');

  // Load hub metadata.
  const hubPath = path.join(COMPARISONS_DIR, '_hub.json');
  const hubData = loadJson(hubPath);
  validateHub(hubData);

  // Load all comparison JSONs.
  const jsonFiles = fs.readdirSync(COMPARISONS_DIR)
    .filter(function (f) { return f.endsWith('.json') && !f.startsWith('_'); });

  const comparisons = jsonFiles.map(function (f) {
    const slug = f.replace(/\.json$/, '');
    const data = loadJson(path.join(COMPARISONS_DIR, f));
    validateComparison(slug, data);
    return data;
  });

  console.log(`Found ${comparisons.length} comparisons: ${comparisons.map(c => c.slug).join(', ')}\n`);

  let subCount = 0;
  for (const locale of LOCALES) {
    // Render hub.
    const hubHtml = renderHub(hubData, comparisons, locale, hubTemplate);
    const hubOutputDir = locale.code === 'en'
      ? path.join(ROOT, 'compare')
      : path.join(ROOT, 'zh-TW', 'compare');
    fs.writeFileSync(path.join(hubOutputDir, 'index.html'), hubHtml, 'utf8');
    console.log(`  ${locale.code}/compare/index.html`);

    // Render each sub-page.
    for (const data of comparisons) {
      const html = renderSubPage(data, locale, subTemplate);
      const outputPath = path.join(hubOutputDir, `${data.slug}.html`);
      fs.writeFileSync(outputPath, html, 'utf8');
      console.log(`  ${locale.code}/compare/${data.slug}.html`);
      subCount++;
    }
  }

  console.log(`\n[comparisons] rendered ${subCount} sub-pages + ${LOCALES.length} hub pages = ${subCount + LOCALES.length} total`);
}

main();
