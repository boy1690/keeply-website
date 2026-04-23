#!/usr/bin/env node
/**
 * Keeply SHA-256 Checksum Fetcher (spec 021)
 *
 * Fetches the latest release's asset digests from GitHub and caches them
 * into release-config.json under the `checksums` key. Subsequent build
 * steps substitute these values into `{{SHA256_*}}` placeholders.
 *
 * Resilient to offline/GitHub outages: on any fetch failure, the previous
 * cached checksums in release-config.json are preserved and the script
 * exits 0 so the rest of the build pipeline continues.
 *
 * Run order: this MUST run before `_dev/build.js` (build:pages substitutes
 * the placeholders it produces).
 *
 * Auth: unauthenticated GitHub API calls have a 60 req/hr limit per IP.
 * For CI that is plenty; if we ever hit the ceiling we can pass
 * GITHUB_TOKEN via env.
 *
 * Usage: node _dev/build-checksums.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'release-config.json');

const REPO = 'boy1690/keeply-releases';
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

// Map of asset-filename-pattern → placeholder key.
// Patterns use {{VERSION}} substitution so they match across release versions.
const ASSET_MAP = {
  WIN:     'Keeply_{version}_x64-setup.exe',
  MAC:     'Keeply_{version}_aarch64.dmg',
  MSI:     'Keeply_{version}_x64_en-US.msi',
  APPTAR:  'Keeply_aarch64.app.tar.gz'
};

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'keeply-website-build-checksums',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function main() {
  const cfg = loadConfig();
  const version = cfg.version;
  if (!version) {
    console.error('[build-checksums] release-config.json has no `version` field; aborting');
    process.exit(1);
  }

  // Ensure a checksums object exists so substitute never sees undefined.
  if (!cfg.checksums || typeof cfg.checksums !== 'object') {
    cfg.checksums = { WIN: '', MAC: '', MSI: '', APPTAR: '' };
  }

  let release;
  try {
    console.log(`[build-checksums] fetching ${API}`);
    release = await fetchJson(API);
  } catch (e) {
    console.warn(`[build-checksums] fetch failed (${e.message}) — keeping cached checksums`);
    // Still write config (touches file with any defaults we just added).
    saveConfig(cfg);
    process.exit(0);
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (!assets.length) {
    console.warn('[build-checksums] release has no assets — keeping cached checksums');
    saveConfig(cfg);
    process.exit(0);
  }

  // Build { name → digest-hex } map.
  const byName = {};
  for (const a of assets) {
    if (a && a.name && typeof a.digest === 'string' && a.digest.indexOf('sha256:') === 0) {
      byName[a.name] = a.digest.slice('sha256:'.length);
    }
  }

  // Resolve each placeholder key via its filename pattern.
  const before = JSON.stringify(cfg.checksums);
  for (const [key, pattern] of Object.entries(ASSET_MAP)) {
    const filename = pattern.replace('{version}', version);
    const hash = byName[filename];
    if (hash) {
      cfg.checksums[key] = hash;
    } else {
      console.warn(`[build-checksums] asset not found: ${filename} (keeping previous value "${cfg.checksums[key] || '(empty)'}")`);
    }
  }
  cfg.checksums._releaseTag = release.tag_name || cfg.versionTag;
  cfg.checksums._fetchedAt = new Date().toISOString();

  saveConfig(cfg);
  const changed = JSON.stringify(cfg.checksums) !== before;
  console.log(`[build-checksums] ${changed ? 'updated' : 'no changes'} for release ${release.tag_name}`);
  for (const key of ['WIN', 'MAC', 'MSI', 'APPTAR']) {
    const v = cfg.checksums[key];
    console.log(`  ${key.padEnd(8)} ${v ? v.slice(0, 16) + '…' + v.slice(-8) : '(empty)'}`);
  }
}

main().catch((e) => {
  console.error('[build-checksums] unexpected error:', e);
  // Never block the build on a fetch issue.
  process.exit(0);
});
