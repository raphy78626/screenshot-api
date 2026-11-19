// Pure evidence-bundle logic — no @forge/* imports, fully testable locally.
import JSZip from 'jszip';
import { createHash } from 'crypto';

export function sha256(input) {
  // Accepts string (utf8) or Buffer
  return Buffer.isBuffer(input)
    ? createHash('sha256').update(input).digest('hex')
    : createHash('sha256').update(input, 'utf8').digest('hex');
}

export function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9_\-. ]/gi, '_')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 80);
}

export function buildManifestEntry(page, sourceContentHash, pdfSha256) {
  const spaceKey = page.space?.key ?? 'unknown';
  // v2 API base already ends with /wiki — normalize so we never emit /wiki/wiki/
  const baseUrl = (page._links?.base ?? 'https://your-domain.atlassian.net/wiki').replace(/\/wiki\/?$/, '');
  const webui = page._links?.webui ?? `/spaces/${spaceKey}/pages/${page.id}`;
  return {
    pageId: page.id,
    title: page.title,
    spaceKey,
    version: page.version?.number ?? 0,
    lastModified: page.version?.when ?? null,
    lastModifiedBy: page.version?.by?.displayName ?? 'unknown',
    pageUrl: `${baseUrl}/wiki${webui}`,
    capturedAt: new Date().toISOString(),
    sourceContentSha256: sourceContentHash,
    pdfSha256: pdfSha256 ?? null,
    fileName: `${sanitizeFilename(page.title)}_v${page.version?.number ?? 0}.pdf`,
  };
}

export function buildVerificationTxt(manifestPages) {
  const lines = [
    'AUDIT EVIDENCE BUNDLE — INTEGRITY VERIFICATION',
    '='.repeat(48),
    '',
    'Each PDF in this bundle can be independently verified using SHA-256.',
    '',
    'HOW TO VERIFY (macOS / Linux):',
    '  shasum -a 256 <filename>.pdf',
    '',
    'HOW TO VERIFY (Windows PowerShell):',
    '  Get-FileHash <filename>.pdf -Algorithm SHA256',
    '',
    'Compare the output against pdfSha256 in manifest.json.',
    '',
    'FILES IN THIS BUNDLE:',
    '-'.repeat(48),
  ];
  for (const p of manifestPages) {
    if (p.pdfSha256) {
      lines.push(`  ${p.fileName}`);
      lines.push(`  SHA-256: ${p.pdfSha256}`);
      lines.push('');
    }
  }
  lines.push('-'.repeat(48));
  lines.push(`Bundle generated: ${new Date().toISOString()}`);
  return lines.join('\n');
}

// files: Array<{ name: string, data: Buffer }>
export async function buildBundle(files) {
  const zip = new JSZip();
  for (const { name, data } of files) {
    zip.file(name, data);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
