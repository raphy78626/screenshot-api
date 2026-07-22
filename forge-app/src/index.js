import Resolver from '@forge/resolver';
import { route, storage } from '@forge/api';
import api from '@forge/api';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sha256, sanitizeFilename, buildManifestEntry, buildBundle, buildVerificationTxt } from './evidence.js';

const resolver = new Resolver();

const FREE_TIER_PAGE_LIMIT = 5;

// ── License check (free vs paid) ─────────────────────────────────────────────
async function isPaidUser(context) {
  try {
    const licenseInfo = context.license;
    return licenseInfo?.active === true && licenseInfo?.type !== 'FREE';
  } catch {
    return false;
  }
}

// ── Fetch pages in a space ───────────────────────────────────────────────────
async function getSpacePages(spaceKey, limit = 100) {
  const res = await api
    .asApp()
    .requestConfluence(
      route`/wiki/api/v2/pages?spaceKey=${spaceKey}&limit=${limit}&sort=title`,
    );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch pages: ${res.status} ${txt.substring(0, 120)}`);
  }
  const data = await res.json();
  return data.results || [];
}

// ── Resolve space id → key (cached per invocation) ───────────────────────────
const spaceKeyCache = new Map();
async function getSpaceKey(spaceId) {
  if (!spaceId) return 'unknown';
  if (spaceKeyCache.has(spaceId)) return spaceKeyCache.get(spaceId);
  try {
    const res = await api.asApp().requestConfluence(route`/wiki/api/v2/spaces/${spaceId}`);
    const key = res.ok ? (await res.json()).key ?? String(spaceId) : String(spaceId);
    spaceKeyCache.set(spaceId, key);
    return key;
  } catch {
    return String(spaceId);
  }
}

// ── Resolve accountId → display name ────────────────────────────────────────
const userDisplayCache = new Map();
async function getDisplayName(accountId) {
  if (!accountId) return 'unknown';
  if (userDisplayCache.has(accountId)) return userDisplayCache.get(accountId);
  try {
    const res = await api.asApp().requestConfluence(route`/wiki/rest/api/user?accountId=${accountId}`);
    const name = res.ok ? ((await res.json()).displayName ?? accountId) : accountId;
    userDisplayCache.set(accountId, name);
    return name;
  } catch {
    return accountId;
  }
}

// ── Fetch single page details ────────────────────────────────────────────────
async function getPage(pageId) {
  const res = await api
    .asApp()
    .requestConfluence(
      route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
    );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch page ${pageId}: ${res.status} ${txt.substring(0, 120)}`);
  }
  const data = await res.json();
  const authorName = await getDisplayName(data.version?.authorId);
  return {
    id: data.id,
    title: data.title,
    version: {
      number: data.version?.number,
      when: data.version?.createdAt,
      by: { displayName: authorName },
    },
    space: { key: await getSpaceKey(data.spaceId) },
    body: { storage: { value: data.body?.storage?.value } },
    _links: data._links,
  };
}

// sha256, sanitizeFilename, buildManifestEntry, buildBundle imported from ./evidence.js

// WinAnsi-safe string — strip chars outside printable Latin-1 + ASCII control chars
// WinAnsi encoding rejects: 0x00-0x1F control chars, 0x7F DEL, and 0x81/0x8D/0x8F/0x90/0x9D
function winAnsi(s) {
  return String(s || '')
    .replace(/[^\x00-\xFF]/g, '?')   // non-Latin-1 → ?
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // control chars → space
    .replace(/\x01/g, '');           // strip internal placeholder
}

// ── Block-based HTML → PDF renderer ──────────────────────────────────────────
// Returns an array of block objects: { type, text, level?, indent? }
// Types: heading | paragraph | bullet | code | image | rule | blank
function parseHtmlBlocks(html) {
  const blocks = [];
  const src = (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  function decodeEntities(s) {
    return s
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&[a-z]+;/gi, ' ');
  }
  function stripTags(s) { return decodeEntities(s.replace(/<[^>]+>/g, '')); }

  // Process headings
  let remaining = src.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, level, inner) => {
    const text = winAnsi(stripTags(inner).trim());
    if (text) blocks.push({ type: 'heading', level: parseInt(level, 10), text, _pos: blocks.length });
    return '\x01'; // placeholder
  });

  // Process code/pre blocks
  remaining = remaining.replace(/<(?:pre|code)[^>]*>([\s\S]*?)<\/(?:pre|code)>/gi, (_, inner) => {
    const text = winAnsi(decodeEntities(inner.replace(/<[^>]+>/g, '')).trim());
    if (text) blocks.push({ type: 'code', text, _pos: blocks.length });
    return '\x01';
  });

  // Process images
  remaining = remaining.replace(/<img[^>]*(?:alt="([^"]*)")?[^>]*>/gi, (_, alt) => {
    const label = alt ? `[image: ${winAnsi(alt)}]` : '[image]';
    blocks.push({ type: 'image', text: label, _pos: blocks.length });
    return '\x01';
  });

  // Process table rows: collect th/td cells per row
  remaining = remaining.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, inner) => {
    const cells = [];
    inner.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, (__, cell) => {
      cells.push(winAnsi(stripTags(cell).trim()));
    });
    if (cells.length) {
      const isHeader = /<th/i.test(inner);
      blocks.push({ type: 'tablerow', text: cells.join(' | '), bold: isHeader, _pos: blocks.length });
    }
    return '\x01';
  });

  // Process list items (simple — no deep nesting needed for audit docs)
  remaining = remaining.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = winAnsi(stripTags(inner).trim());
    if (text) blocks.push({ type: 'bullet', text, indent: 16, _pos: blocks.length });
    return '\x01';
  });

  // Process paragraphs
  remaining = remaining.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    const text = winAnsi(stripTags(inner).trim());
    if (text) blocks.push({ type: 'paragraph', text, _pos: blocks.length });
    return '\x01';
  });

  // Leftover text (not in any block tag)
  const leftover = winAnsi(stripTags(remaining).replace(/\x01/g, '').replace(/\n{3,}/g, '\n\n').trim());
  if (leftover) blocks.push({ type: 'paragraph', text: leftover, _pos: blocks.length });

  // Sort by original position so heading/code/img come before para when both matched same region
  blocks.sort((a, b) => a._pos - b._pos);
  return blocks;
}

// ── Generate a PDF using pdf-lib (pure JS, no native deps) ───────────────────
async function generatePdf(page, viewHtml, sourceHash, capturedAt) {
  const pdfDoc = await PDFDocument.create();
  const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono   = await pdfDoc.embedFont(StandardFonts.Courier);

  const W = 595, H = 842, margin = 50, lineH = 14;
  const blue  = rgb(0, 0.32, 0.8);
  const grey  = rgb(0.42, 0.47, 0.55);
  const black = rgb(0.09, 0.17, 0.3);

  // Word-wrap helper
  function wrapText(text, font, size, maxW) {
    const lines = [];
    for (const para of String(text || '').split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function newPage() {
    const p = pdfDoc.addPage([W, H]);
    return { page: p, y: H - margin };
  }

  function drawText(ctx, text, font, size, color, indent = 0) {
    const maxW = W - margin * 2 - indent;
    const wrapped = wrapText(text, font, size, maxW);
    for (const line of wrapped) {
      if (ctx.y < margin + lineH) {
        const next = newPage();
        ctx.page = next.page;
        ctx.y = next.y;
      }
      ctx.page.drawText(line, { x: margin + indent, y: ctx.y, size, font, color });
      ctx.y -= lineH;
    }
  }

  const ctx = newPage();

  // Title
  drawText(ctx, winAnsi(page.title), fontBold, 16, blue);
  ctx.y -= 6;

  // Metadata block
  const baseUrl = page._links?.base ?? '';
  const webui   = page._links?.webui ?? '';
  const meta = [
    ['Space',         page.space?.key ?? '—'],
    ['Version',       String(page.version?.number ?? '—')],
    ['Last modified', page.version?.when ?? '—'],
    ['Captured at',   capturedAt],
    ['Source SHA-256', sourceHash],
    ['URL',           webui ? winAnsi(`${baseUrl}${webui}`) : '—'],
  ];
  for (const [label, value] of meta) {
    if (ctx.y < margin + lineH) { const n = newPage(); ctx.page = n.page; ctx.y = n.y; }
    ctx.page.drawText(`${label}: `, { x: margin, y: ctx.y, size: 9, font: fontBold, color: grey });
    const labelW = fontBold.widthOfTextAtSize(`${label}: `, 9);
    drawText(ctx, value, fontReg, 9, grey, labelW + 2);
    ctx.y -= 2;
  }

  // Divider
  ctx.y -= 6;
  ctx.page.drawLine({ start: { x: margin, y: ctx.y }, end: { x: W - margin, y: ctx.y }, thickness: 0.5, color: grey });
  ctx.y -= 14;

  // Structured body rendering
  const headingSizes = [0, 15, 13.5, 12.5, 12, 11.5, 11];
  const blocks = parseHtmlBlocks(viewHtml);

  if (blocks.length === 0) {
    drawText(ctx, '(no content)', fontReg, 11, grey);
  }

  for (const block of blocks) {
    if (ctx.y < margin + lineH * 2) {
      const n = newPage(); ctx.page = n.page; ctx.y = n.y;
    }
    switch (block.type) {
      case 'heading': {
        ctx.y -= 4;
        const sz = headingSizes[block.level] ?? 11;
        drawText(ctx, block.text, fontBold, sz, black);
        ctx.y -= 2;
        break;
      }
      case 'paragraph':
        drawText(ctx, block.text, fontReg, 11, black);
        ctx.y -= 4;
        break;
      case 'bullet':
        drawText(ctx, `- ${block.text}`, fontReg, 11, black, block.indent ?? 16);
        break;
      case 'code': {
        const codeLines = block.text.split('\n');
        for (const cl of codeLines) {
          drawText(ctx, cl || ' ', fontMono, 9, black);
        }
        ctx.y -= 4;
        break;
      }
      case 'tablerow':
        drawText(ctx, block.text, block.bold ? fontBold : fontReg, 10, black);
        break;
      case 'image':
        drawText(ctx, block.text, fontReg, 10, grey);
        ctx.y -= 2;
        break;
      default:
        break;
    }
  }

  // Audit footer on every page (filled after PDF bytes computed to get pdfSha256)
  // Stamp audit footer — no hash in footer text (hash is computed over final bytes below)
  const allPages = pdfDoc.getPages();
  const footer = `Captured for audit evidence — ${capturedAt}`;
  allPages.forEach((p, i) => {
    p.drawText(footer, { x: margin, y: 30, size: 7, font: fontReg, color: grey });
    p.drawText(`page ${i + 1} of ${allPages.length}`, { x: W - margin - 60, y: 30, size: 7, font: fontReg, color: grey });
  });

  const finalBytes = await pdfDoc.save();
  const finalBuf = Buffer.from(finalBytes);
  // Hash the exact bytes that land in the ZIP — shasum -a 256 <file.pdf> will match this
  const pdfSha256 = sha256(finalBuf);

  return { buffer: finalBuf, pdfSha256 };
}


// ── Attach ZIP to a Confluence page ─────────────────────────────────────────
async function attachZipToPage(pageId, zipBuffer, filename) {
  const formData = new FormData();
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  formData.append('file', blob, filename);
  formData.append('comment', 'Audit evidence bundle — generated by Audit Evidence Exporter');

  // Uses write:confluence-file scope (v2 API); asApp() works in both manual and scheduled contexts
  const res = await api
    .asApp()
    .requestConfluence(route`/wiki/api/v2/pages/${pageId}/attachments`, {
      method: 'POST',
      headers: { 'X-Atlassian-Token': 'no-check' },
      body: formData,
    });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to attach ZIP: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Fetch all spaces ─────────────────────────────────────────────────────────
async function listSpaces(limit = 50) {
  const res = await api
    .asApp()
    .requestConfluence(route`/wiki/rest/api/space?limit=${limit}&type=global&status=current`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Failed to fetch spaces: ${res.status} ${txt.substring(0, 100)}`);
  }
  const data = await res.json();
  return data.results || [];
}

// ── Resolver: list pages in current space (or return spaces for picker) ───────
resolver.define('getSpacePages', async ({ payload, context }) => {
  const spaceKey = payload?.spaceKey || context.extension?.space?.key;

  if (!spaceKey) {
    return { needsSpaceKeyInput: true };
  }

  try {
    const pages = await getSpacePages(spaceKey);
    return {
      pages: pages.map((p) => ({
        id: p.id,
        title: p.title,
        version: p.version?.number,
        lastModified: p.version?.createdAt ?? p.version?.when,
        url: p._links?.webui ?? p._links?.base,
      })),
      spaceKey,
    };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Resolver: export selected pages as evidence bundle ───────────────────────
resolver.define('exportEvidence', async ({ payload, context }) => {
  try {
  const { pageIds, attachToPageId } = payload;
  const paid = await isPaidUser(context);

  if (!pageIds || pageIds.length === 0) {
    return { error: 'No pages selected' };
  }

  // Free tier cap
  if (!paid && pageIds.length > FREE_TIER_PAGE_LIMIT) {
    return {
      error: `Free tier is limited to ${FREE_TIER_PAGE_LIMIT} pages. Upgrade to export unlimited pages.`,
      upgradeRequired: true,
      limit: FREE_TIER_PAGE_LIMIT,
    };
  }

  const capturedAt = new Date().toISOString();
  const manifest = {
    exportedAt: capturedAt,
    exportedBy: await getDisplayName(context.accountId),
    tier: paid ? 'paid' : 'free',
    pages: [],
  };

  const files = [];

  // Process each page
  for (const pageId of pageIds) {
    const safeTitle = `page_${pageId}`;
    let manifestEntry = null;
    try {
      console.log(`[export] fetching page ${pageId}`);
      const page = await getPage(pageId);
      console.log(`[export] got page: ${page.title}`);

      const storageContent = page.body?.storage?.value || '';
      const contentHash = sha256(storageContent);
      console.log(`[export] sha256 done, storage len=${storageContent.length}`);

      // Generate PDF — use storage body as fallback if view fetch fails
      let pdfBuffer;
      let pdfSha256 = null;
      let pdfError = null;
      try {
        const viewRes = await api.asApp().requestConfluence(
          route`/wiki/api/v2/pages/${pageId}?body-format=view`,
        );
        const viewHtml = viewRes.ok ? (await viewRes.json()).body?.view?.value : storageContent;
        console.log(`[export] view html len=${(viewHtml || '').length}`);
        const pdfResult = await generatePdf(page, viewHtml, contentHash, capturedAt);
        pdfBuffer = pdfResult.buffer;
        pdfSha256 = pdfResult.pdfSha256;
        console.log(`[export] pdf bytes=${pdfBuffer.length} sha256=${pdfSha256.substring(0,16)}`);
      } catch (captureErr) {
        pdfError = captureErr.message;
        console.log(`[export] pdf failed: ${captureErr.message}\n${captureErr.stack || ''}`);
        pdfBuffer = Buffer.from(
          `CAPTURE FAILED\nPage: ${page.title}\nError: ${captureErr.message}\nTimestamp: ${capturedAt}`,
          'utf8',
        );
      }

      manifestEntry = buildManifestEntry(page, contentHash, pdfSha256);
      if (pdfError) manifestEntry.captureError = pdfError;
      manifest.pages.push(manifestEntry);
      files.push({ name: manifestEntry.fileName, data: pdfBuffer });
    } catch (err) {
      console.log(`[export] page ${pageId} outer error: ${err.message}\n${err.stack}`);
      manifest.pages.push({
        pageId,
        error: err.message,
        capturedAt,
      });
      // Always push a placeholder so the ZIP is non-empty
      files.push({
        name: `${safeTitle}_ERROR.txt`,
        data: Buffer.from(`ERROR for page ${pageId}:\n${err.message}\n${err.stack || ''}`, 'utf8'),
      });
    }
  }

  // Build manifest JSON + VERIFICATION.txt
  const manifestJson = JSON.stringify(manifest, null, 2);
  files.push({ name: 'manifest.json', data: Buffer.from(manifestJson, 'utf8') });
  const verificationTxt = buildVerificationTxt(manifest.pages);
  files.push({ name: 'VERIFICATION.txt', data: Buffer.from(verificationTxt, 'utf8') });

  console.log(`[export] building zip with ${files.length} files: ${files.map(f => f.name).join(', ')}`);
  const zipBuffer = await buildBundle(files);
  console.log(`[export] zip bytes=${zipBuffer.length}`);

  // Optionally attach to a Confluence page
  let attachmentResult = null;
  if (attachToPageId) {
    const zipFilename = `audit-evidence-${capturedAt.replace(/[:.]/g, '-').substring(0, 19)}.zip`;
    try {
      attachmentResult = await attachZipToPage(attachToPageId, zipBuffer, zipFilename);
    } catch (err) {
      attachmentResult = { error: err.message };
    }
  }

  const successCount = manifest.pages.filter((p) => !p.error).length;
  await recordExport(successCount, false);

  return {
    success: true,
    pageCount: successCount,
    errorCount: manifest.pages.filter((p) => p.error).length,
    exportedAt: capturedAt,
    zipBase64: zipBuffer.toString('base64'),
    zipSizeBytes: zipBuffer.length,
    attachment: attachmentResult,
    manifest,
  };
  } catch (outerErr) {
    console.log(`[export] OUTER ERROR: ${outerErr.message}\n${outerErr.stack}`);
    return { error: outerErr.message };
  }
});

// ── Telemetry: increment daily export counters in Forge KVS ─────────────────
async function recordExport(pageCount, scheduled = false) {
  try {
    const day = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    const key = `stats:${day}`;
    const prev = (await storage.get(key)) ?? { exports: 0, pages: 0, scheduled: 0 };
    await storage.set(key, {
      exports: prev.exports + 1,
      pages: prev.pages + pageCount,
      scheduled: prev.scheduled + (scheduled ? 1 : 0),
    });
    const totals = (await storage.get('stats:totals')) ?? { exports: 0, pages: 0 };
    await storage.set('stats:totals', {
      exports: totals.exports + 1,
      pages: totals.pages + pageCount,
    });
  } catch {
    // non-fatal — never let telemetry break an export
  }
}

// ── Resolver: check license status ───────────────────────────────────────────
resolver.define('getLicenseStatus', async ({ context }) => {
  const paid = await isPaidUser(context);
  return {
    paid,
    freePageLimit: FREE_TIER_PAGE_LIMIT,
    tier: paid ? 'paid' : 'free',
  };
});

// ── Resolver: save/get/delete scheduled capture config ───────────────────────
const SCHEDULE_KEY = 'scheduleConfig';

resolver.define('saveSchedule', async ({ payload, context }) => {
  const paid = await isPaidUser(context);
  if (!paid) return { error: 'Scheduled capture requires a paid plan.' };
  const { spaceKey, pageIds, attachToPageId } = payload;
  if (!spaceKey || !pageIds?.length) return { error: 'spaceKey and pageIds required' };
  await storage.set(SCHEDULE_KEY, { spaceKey, pageIds, attachToPageId: attachToPageId ?? null, savedAt: new Date().toISOString() });
  return { success: true };
});

resolver.define('getSchedule', async () => {
  const config = await storage.get(SCHEDULE_KEY);
  return { config: config ?? null };
});

resolver.define('deleteSchedule', async () => {
  await storage.delete(SCHEDULE_KEY);
  return { success: true };
});

// ── Scheduled trigger: weekly evidence capture ────────────────────────────────
async function runScheduledExport() {
  const config = await storage.get(SCHEDULE_KEY);
  if (!config) {
    console.log('[scheduled] no config saved, skipping');
    return;
  }
  const { spaceKey, pageIds, attachToPageId } = config;
  console.log(`[scheduled] starting export for space=${spaceKey} pages=${pageIds.length}`);

  const capturedAt = new Date().toISOString();
  const manifest = { exportedAt: capturedAt, exportedBy: 'scheduled', tier: 'paid', pages: [] };
  const files = [];

  for (const pageId of pageIds) {
    try {
      const page = await getPage(pageId);
      const storageContent = page.body?.storage?.value || '';
      const contentHash = sha256(storageContent);
      const viewRes = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=view`);
      const viewHtml = viewRes.ok ? (await viewRes.json()).body?.view?.value : storageContent;
      const { buffer: pdfBuffer, pdfSha256 } = await generatePdf(page, viewHtml, contentHash, capturedAt);
      const entry = buildManifestEntry(page, contentHash, pdfSha256);
      manifest.pages.push(entry);
      files.push({ name: entry.fileName, data: pdfBuffer });
    } catch (err) {
      console.log(`[scheduled] page ${pageId} error: ${err.message}`);
      manifest.pages.push({ pageId, error: err.message, capturedAt });
    }
  }

  const manifestJson = JSON.stringify(manifest, null, 2);
  files.push({ name: 'manifest.json', data: Buffer.from(manifestJson, 'utf8') });
  files.push({ name: 'VERIFICATION.txt', data: Buffer.from(buildVerificationTxt(manifest.pages), 'utf8') });

  const zipBuffer = await buildBundle(files);
  const zipFilename = `audit-evidence-scheduled-${capturedAt.replace(/[:.]/g, '-').substring(0, 19)}.zip`;

  const successCount = manifest.pages.filter((p) => !p.error).length;
  await recordExport(successCount, true);

  if (attachToPageId) {
    try {
      await attachZipToPage(attachToPageId, zipBuffer, zipFilename);
      console.log(`[scheduled] attached ${zipFilename} to page ${attachToPageId}`);
    } catch (err) {
      console.log(`[scheduled] attach failed: ${err.message}`);
    }
  } else {
    console.log('[scheduled] no attachToPageId configured — ZIP not attached');
  }
}

// ── Resolver: usage stats ────────────────────────────────────────────────────
resolver.define('getStats', async () => {
  try {
    const totals = (await storage.get('stats:totals')) ?? { exports: 0, pages: 0 };
    // Last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().substring(0, 10);
      const data = (await storage.get(`stats:${day}`)) ?? { exports: 0, pages: 0, scheduled: 0 };
      days.push({ date: day, ...data });
    }
    return { totals, days };
  } catch {
    return { totals: { exports: 0, pages: 0 }, days: [] };
  }
});

export const handler = resolver.getDefinitions();
export async function scheduledExportHandler() {
  await runScheduledExport();
}
