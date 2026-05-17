#!/usr/bin/env node
/**
 * Cloudflare cache purge for keeply.work zone.
 *
 * Ported from keeply-blog/_dev/seo/cf-purge.js (spec 047 A). The script is
 * site-agnostic — only env values change between the two repos. keeply.work
 * and blog.keeply.work share the same Cloudflare zone (apex `keeply.work`),
 * so a single CF_ZONE_ID covers both subdomains.
 *
 * Usage:
 *   node _dev/seo/cf-purge.js <url> [<url> ...]
 *   node _dev/seo/cf-purge.js --all          # purge entire zone
 *   node _dev/seo/cf-purge.js --robots       # shortcut for robots.txt + sitemap.xml
 *   node _dev/seo/cf-purge.js --dry-run …    # print payload, don't call API
 *
 * Env: CF_PURGE_TOKEN, CF_ZONE_ID
 *   Read from _dev/seo/.env (gitignored) OR from process.env (CI).
 *   See .env.example for the expected schema.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const TOKEN = process.env.CF_PURGE_TOKEN;
const ZONE = process.env.CF_ZONE_ID;
if (!TOKEN || !ZONE) {
  console.error('ERROR: missing CF_PURGE_TOKEN or CF_ZONE_ID');
  console.error('       set them in _dev/seo/.env (see .env.example) or as env vars');
  process.exit(1);
}

let args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
args = args.filter(a => a !== '--dry-run');

if (!args.length) {
  console.error('Usage: node cf-purge.js <url> [<url> ...]');
  console.error('       node cf-purge.js --all       (purge entire zone)');
  console.error('       node cf-purge.js --robots    (robots.txt + sitemap.xml)');
  console.error('       prepend --dry-run to print the payload without calling the API');
  process.exit(1);
}

let body;
let label;
if (args[0] === '--all') {
  body = { purge_everything: true };
  label = 'ENTIRE ZONE';
} else if (args[0] === '--robots') {
  body = { files: ['https://keeply.work/robots.txt', 'https://keeply.work/sitemap.xml'] };
  label = body.files.join(', ');
} else {
  body = { files: args };
  label = args.join(', ');
}

if (dryRun) {
  console.log('[dry-run] zone:', ZONE);
  console.log('[dry-run] body:', JSON.stringify(body, null, 2));
  process.exit(0);
}

(async () => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!json.success) {
    console.error('Purge failed:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  console.log('Purged:', label);
  console.log('id:', json.result.id);
})();
