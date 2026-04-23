#!/usr/bin/env node
/**
 * IndexNow Ping Script
 *
 * Notifies IndexNow-compatible search engines (Bing, Yandex, Seznam, Naver,
 * and — via indexing federation — Cloudflare / DuckDuckGo) about URL updates
 * so they crawl new/changed content within minutes rather than days.
 *
 * Protocol: https://www.indexnow.org/documentation
 *
 * How key ownership works:
 *   - Host a file at https://keeply.work/{KEY}.txt whose body is exactly {KEY}
 *   - IndexNow servers fetch that file to verify we control the domain
 *   - We include {KEY} in every POST; they cross-check against the hosted file
 *
 * Usage:
 *   node _dev/ping-indexnow.js              # ping all URLs from sitemap.xml
 *   node _dev/ping-indexnow.js --dry-run    # build payload but do not POST
 *
 * When to run:
 *   - After significant content updates (new pages, major rewrites)
 *   - NOT on every build — IndexNow throttles excessive pings
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const KEY = '65439d009e66d54f18da6c854ec6cb3a';
const HOST = 'keeply.work';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

function extractUrls(sitemapXml) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(sitemapXml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Host': u.hostname
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error(`ERROR: sitemap.xml not found at ${SITEMAP_PATH}`);
    console.error('Hint: run `npm run build:pages` first to regenerate sitemap.');
    process.exit(1);
  }

  const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = extractUrls(sitemap);
  console.log(`Discovered ${urls.length} URLs from sitemap.xml`);

  if (urls.length === 0) {
    console.error('ERROR: no <loc> URLs parsed from sitemap. Aborting.');
    process.exit(1);
  }

  // Verify key file exists locally (sanity: it must be deployed too).
  const keyFilePath = path.join(ROOT, `${KEY}.txt`);
  if (!fs.existsSync(keyFilePath)) {
    console.error(`ERROR: key file ${KEY}.txt missing at site root.`);
    console.error(`Create it with body: ${KEY}`);
    process.exit(1);
  }
  const keyFileBody = fs.readFileSync(keyFilePath, 'utf8').trim();
  if (keyFileBody !== KEY) {
    console.error(`ERROR: key file body mismatch. Expected ${KEY}, got ${keyFileBody.slice(0, 16)}...`);
    process.exit(1);
  }

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls
  };

  console.log(`Payload: ${urls.length} URLs, key ${KEY.slice(0, 8)}..., keyLocation ${KEY_LOCATION}`);

  if (dryRun) {
    console.log('--dry-run: not posting. Payload preview:');
    console.log(JSON.stringify({ ...payload, urlList: urls.slice(0, 3).concat([`... +${urls.length - 3} more`]) }, null, 2));
    return;
  }

  console.log(`POST ${INDEXNOW_ENDPOINT} ...`);
  const resp = await postJson(INDEXNOW_ENDPOINT, payload);

  // IndexNow response codes:
  //   200 = OK (urls submitted)
  //   202 = Accepted (queued; key validation pending since we just deployed the key file)
  //   400 = Bad request
  //   403 = Forbidden (key not valid or not owned)
  //   422 = Unprocessable (URL doesn't belong to host)
  //   429 = Too many requests
  console.log(`Response: HTTP ${resp.status}`);
  if (resp.body) console.log(`Body: ${resp.body.slice(0, 500)}`);

  if (resp.status === 200 || resp.status === 202) {
    console.log('\nOK — IndexNow accepted the submission.');
    console.log('Bing / Yandex / Seznam will fetch the key file, verify ownership,');
    console.log('and crawl the submitted URLs within minutes to hours.');
  } else if (resp.status === 403) {
    console.error('\nFORBIDDEN — ownership verification failed.');
    console.error(`Check that ${KEY_LOCATION} returns exactly: ${KEY}`);
    process.exit(1);
  } else {
    console.error('\nUnexpected response. See body above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
