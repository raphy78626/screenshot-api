/**
 * Local end-to-end harness for the evidence-export pipeline.
 * Runs against the local screenshot-api dev server (no Forge runtime needed).
 *
 * Usage:
 *   SCREENSHOT_API_URL=http://localhost:8080 node forge-app/test/local-harness.mjs
 *
 * The dev server must be running: npm run dev (in repo root)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { sha256, buildManifestEntry, buildBundle } from '../src/evidence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.SCREENSHOT_API_URL ?? 'http://localhost:8080';
const OUT_DIR = join(__dirname, '../out');

// ── Mock Confluence page objects (realistic REST API shapes) ─────────────────
const MOCK_PAGES = [
  {
    id: 'p001',
    title: 'Information Security Policy',
    space: { key: 'SEC' },
    version: { number: 7, when: '2026-07-10T14:00:00Z', by: { displayName: 'Rahil Khan' } },
    body: { storage: { value: '<p>1. Purpose: This policy establishes the framework for managing information security...</p>' } },
    _links: { base: 'https://example.atlassian.net', webui: '/spaces/SEC/pages/p001/Information+Security+Policy' },
  },
  {
    id: 'p002',
    title: 'Incident Response Runbook',
    space: { key: 'SEC' },
    version: { number: 12, when: '2026-07-08T09:30:00Z', by: { displayName: 'Priya Mehta' } },
    body: { storage: { value: '<p>Incident Classification: P1 (Critical), P2 (High), P3 (Medium)...</p>' } },
    _links: { base: 'https://example.atlassian.net', webui: '/spaces/SEC/pages/p002/Incident+Response+Runbook' },
  },
  {
    id: 'p003',
    title: 'Access Control Policy',
    space: { key: 'SEC' },
    version: { number: 4, when: '2026-07-01T11:00:00Z', by: { displayName: 'Rahil Khan' } },
    body: { storage: { value: '<p>Access rights shall be granted on a need-to-know basis...</p>' } },
    _links: { base: 'https://example.atlassian.net', webui: '/spaces/SEC/pages/p003/Access+Control+Policy' },
  },
];

// ── Capture a page as PDF via the local screenshot-api ───────────────────────
async function capturePagePdf(pageUrl) {
  const params = new URLSearchParams({
    url: pageUrl,
    format: 'pdf',
    full_page: 'true',
    width: '1280',
    height: '800',
  });
  const res = await fetch(`${API_URL}/screenshot?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Capture failed (${res.status}): ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ── Assertions ────────────────────────────────────────────────────────────────
function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🛡  Audit Evidence Exporter — Local Harness`);
  console.log(`   API: ${API_URL}\n`);

  // 1. Health check
  process.stdout.write('  [1/5] Health check … ');
  const health = await fetch(`${API_URL}/health`).then(r => r.json());
  assert(health.status === 'ok', `API not healthy: ${JSON.stringify(health)}`);
  console.log(`✅  browser connected: ${health.browserConnected}`);

  // 2. Hash content
  process.stdout.write('  [2/5] SHA-256 hashing … ');
  const hashes = MOCK_PAGES.map(p => sha256(p.body.storage.value));
  assert(hashes.every(h => /^[0-9a-f]{64}$/.test(h)), 'Hash not 64-hex');
  console.log(`✅  all ${hashes.length} hashes valid`);

  // 3. Capture PDFs
  process.stdout.write(`  [3/5] Capturing ${MOCK_PAGES.length} pages as PDF … `);
  const files = [];
  const manifestEntries = [];

  for (let i = 0; i < MOCK_PAGES.length; i++) {
    const page = MOCK_PAGES[i];
    const entry = buildManifestEntry(page, hashes[i]);
    // Use the actual Confluence URL from the mock page
    const pdf = await capturePagePdf(entry.pageUrl);
    assert(pdf.slice(0, 4).toString() === '%PDF', `Page "${page.title}": not a valid PDF`);
    files.push({ name: entry.fileName, data: pdf });
    manifestEntries.push(entry);
    process.stdout.write(`${i + 1}…`);
  }
  console.log(` ✅`);

  // 4. Build ZIP bundle
  process.stdout.write('  [4/5] Building ZIP bundle … ');
  const manifest = {
    exportedAt: new Date().toISOString(),
    exportedBy: 'local-harness',
    tier: 'free',
    pages: manifestEntries,
  };
  files.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });
  const zipBuffer = await buildBundle(files);
  assert(zipBuffer.length > 1000, 'ZIP suspiciously small');
  console.log(`✅  ${(zipBuffer.length / 1024).toFixed(1)} KB`);

  // 5. Verify ZIP contents
  process.stdout.write('  [5/5] Verifying ZIP contents … ');
  const zip = await JSZip.loadAsync(zipBuffer);
  const names = Object.keys(zip.files);
  assert(names.includes('manifest.json'), 'manifest.json missing from ZIP');
  assert(
    MOCK_PAGES.every(p => names.some(n => n.includes(p.id) || n.startsWith(p.title.substring(0, 10).replace(/\s/g, '_')))),
    'Not all page PDFs found in ZIP'
  );
  const parsedManifest = JSON.parse(await zip.files['manifest.json'].async('string'));
  assert(parsedManifest.pages.length === MOCK_PAGES.length, 'Wrong page count in manifest');
  assert(
    parsedManifest.pages.every(e => /^[0-9a-f]{64}$/.test(e.contentHash)),
    'Invalid hash in manifest'
  );
  console.log(`✅  ${names.length} files, manifest valid`);

  // Write output for inspection
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'audit-evidence-test.zip');
  await writeFile(outPath, zipBuffer);

  console.log(`\n✅  All checks passed!`);
  console.log(`   Output: ${outPath}`);
  console.log(`   Contents: ${names.join(', ')}\n`);

  console.log('   Manifest entries:');
  for (const e of parsedManifest.pages) {
    console.log(`   • ${e.title} (v${e.version}) — ${e.contentHash.substring(0, 16)}…`);
  }
  console.log();
}

run().catch(err => {
  console.error(`\n❌  ${err.message}\n`);
  process.exit(1);
});
