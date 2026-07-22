import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke } from '@forge/bridge';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const styles = {
  wrap: { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', padding: 24, maxWidth: 700 },
  heading: { fontSize: 20, fontWeight: 600, marginBottom: 4 },
  subtext: { color: '#6B778C', fontSize: 14, marginBottom: 16 },
  banner: (color) => ({ background: color, borderRadius: 4, padding: '10px 14px', marginBottom: 14, fontSize: 14 }),
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: 500, marginBottom: 6 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 14, cursor: 'pointer' },
  btn: (primary, disabled) => ({
    background: disabled ? '#DFE1E6' : primary ? '#0052CC' : '#fff',
    color: disabled ? '#A5ADBA' : primary ? '#fff' : '#344563',
    border: primary ? 'none' : '1px solid #DFE1E6',
    borderRadius: 3, padding: '6px 14px', fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500,
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 },
  th: { textAlign: 'left', padding: '6px 10px', background: '#F4F5F7', fontWeight: 600, borderBottom: '1px solid #DFE1E6' },
  td: { padding: '6px 10px', borderBottom: '1px solid #F4F5F7', wordBreak: 'break-all' },
};

function PageList({ pages, selected, onToggle, onSelectAll, onClearAll }) {
  return (
    <div>
      <div style={styles.row}>
        <button style={styles.btn(false, false)} onClick={onSelectAll}>Select all</button>
        <button style={styles.btn(false, false)} onClick={onClearAll}>Clear</button>
        <span style={{ fontSize: 13, color: '#6B778C' }}>{selected.size} / {pages.length} selected</span>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #DFE1E6', borderRadius: 3, padding: '4px 8px' }}>
        {pages.map((page) => (
          <label key={page.id} style={styles.checkRow}>
            <input type="checkbox" checked={selected.has(page.id)} onChange={() => onToggle(page.id)} />
            {page.title} <span style={{ color: '#6B778C' }}>(v{page.version ?? '?'})</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ExportResult({ result, onDownload, onReset, selectedPages, spaceKey, license }) {
  return (
    <div>
      <div style={styles.banner(result.errorCount > 0 ? '#FFFAE6' : '#E3FCEF')}>
        <strong>{result.errorCount > 0 ? `Export complete with ${result.errorCount} error(s)` : 'Export complete ✓'}</strong>
        <div style={{ marginTop: 4 }}>
          {result.pageCount} page{result.pageCount !== 1 ? 's' : ''} captured · {formatBytes(result.zipSizeBytes)} · {formatDate(result.exportedAt)}
        </div>
        {result.attachment?.error && <div style={{ color: '#DE350B', marginTop: 4 }}>Attach failed: {result.attachment.error}</div>}
        {result.attachment && !result.attachment.error && <div style={{ marginTop: 4 }}>Bundle attached to page ✓</div>}
      </div>

      <div style={styles.row}>
        <button style={styles.btn(true, false)} onClick={onDownload}>Download evidence bundle (.zip)</button>
        <button style={styles.btn(false, false)} onClick={onReset}>New export</button>
      </div>

      <SchedulePanel result={result} selectedPages={selectedPages} spaceKey={spaceKey} license={license} />

      {result.manifest?.pages?.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Page</th>
              <th style={styles.th}>Version</th>
              <th style={styles.th}>PDF SHA-256</th>
              <th style={styles.th}>Captured</th>
            </tr>
          </thead>
          <tbody>
            {result.manifest.pages.map((p, i) => (
              <tr key={i}>
                <td style={styles.td}>{p.title || p.pageId}</td>
                <td style={styles.td}>{p.version ?? '—'}</td>
                <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{p.pdfSha256 ? p.pdfSha256.substring(0, 16) + '…' : (p.error || '—')}</td>
                <td style={styles.td}>{p.capturedAt ? formatDate(p.capturedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SchedulePanel({ result, selectedPages, spaceKey, license, onSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [attachPageId, setAttachPageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    invoke('getSchedule').then((r) => setSchedule(r.config)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await invoke('saveSchedule', {
      spaceKey,
      pageIds: Array.from(selectedPages),
      attachToPageId: attachPageId || null,
    });
    setSaving(false);
    if (res.error) { alert(res.error); return; }
    setSaved(true);
    setSchedule({ spaceKey, pageIds: Array.from(selectedPages), attachToPageId: attachPageId || null });
    if (onSaved) onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await invoke('deleteSchedule');
    setSchedule(null);
    setEnabled(false);
    setDeleting(false);
  };

  const isPaid = license?.paid;

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #DFE1E6', paddingTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Weekly automated capture</div>
      {!isPaid ? (
        <div style={{ ...styles.banner('#DEEBFF'), fontSize: 13 }}>
          Scheduling requires the <strong>Pro plan ($25/month)</strong>. Upgrade to capture evidence automatically every week.
        </div>
      ) : schedule ? (
        <div style={styles.banner('#E3FCEF')}>
          <strong>Active schedule</strong> — {schedule.pageIds?.length} page(s) from <code>{schedule.spaceKey}</code> captured weekly
          {schedule.attachToPageId && <span> → attached to page {schedule.attachToPageId}</span>}
          <div style={{ marginTop: 8 }}>
            <button style={{ ...styles.btn(false, deleting), fontSize: 12 }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove schedule'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label style={styles.checkRow}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Capture this selection every week</span>
          </label>
          {enabled && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Attach ZIP to page (optional)</div>
              <div style={styles.row}>
                <input
                  type="text"
                  placeholder="Page ID (leave blank to skip)"
                  value={attachPageId}
                  onChange={(e) => setAttachPageId(e.target.value)}
                  style={{ padding: '5px 8px', fontSize: 13, borderRadius: 3, border: '1px solid #DFE1E6', width: 200 }}
                />
                <button style={styles.btn(true, saving || saved)} onClick={handleSave} disabled={saving || saved}>
                  {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save schedule'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                The app will export these {Array.from(selectedPages).length} page(s) from {spaceKey} every week.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpaceKeyInput({ onPick }) {
  const [key, setKey] = useState('');
  return (
    <div>
      <div style={styles.label}>Enter your space key</div>
      <div style={{ color: '#6B778C', fontSize: 13, marginBottom: 8 }}>
        Find it in your browser URL: <code>/wiki/spaces/<strong>SPACEKEY</strong>/...</code> — e.g. <strong>SD</strong>
      </div>
      <div style={styles.row}>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && key && onPick(key)}
          placeholder="e.g. SD"
          style={{ padding: '6px 10px', fontSize: 14, borderRadius: 3, border: '1px solid #DFE1E6', width: 120 }}
        />
        <button style={styles.btn(true, !key)} disabled={!key} onClick={() => onPick(key)}>
          Load pages
        </button>
      </div>
    </div>
  );
}

function StatsPanel() {
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !stats) invoke('getStats').then(setStats).catch(() => {});
  }, [open]);

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #DFE1E6', paddingTop: 12 }}>
      <button style={{ ...styles.btn(false, false), fontSize: 12 }} onClick={() => setOpen((v) => !v)}>
        {open ? '▲ Hide stats' : '▼ Usage stats'}
      </button>
      {open && stats && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
            <div style={{ background: '#F4F5F7', borderRadius: 5, padding: '10px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.totals.exports}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Total exports</div>
            </div>
            <div style={{ background: '#F4F5F7', borderRadius: 5, padding: '10px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.totals.pages}</div>
              <div style={{ fontSize: 11, color: '#6B778C' }}>Pages captured</div>
            </div>
          </div>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Exports</th>
              <th style={styles.th}>Pages</th>
              <th style={styles.th}>Scheduled</th>
            </tr></thead>
            <tbody>
              {stats.days.map((d) => (
                <tr key={d.date}>
                  <td style={styles.td}>{d.date}</td>
                  <td style={styles.td}>{d.exports}</td>
                  <td style={styles.td}>{d.pages}</td>
                  <td style={styles.td}>{d.scheduled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function App() {
  const [spaces, setSpaces] = useState(null);
  const [pages, setPages] = useState([]);
  const [spaceKey, setSpaceKey] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [license, setLicense] = useState(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([invoke('getSpacePages'), invoke('getLicenseStatus')])
      .then(([pagesRes, licenseRes]) => {
        if (pagesRes.needsSpaceKeyInput || pagesRes.needsSpaceNavigation) {
          setError(null);
          setSpaces('input'); // sentinel — show text input
        } else if (pagesRes.needsSpacePicker) {
          setSpaces(pagesRes.spaces || []);
        } else if (pagesRes.error) {
          setError(pagesRes.error);
        } else {
          setPages(pagesRes.pages || []);
          setSpaceKey(pagesRes.spaceKey);
        }
        setLicense(licenseRes);
        setLoadingPages(false);
      })
      .catch((err) => { setError(err.message); setLoadingPages(false); });
  }, []);

  const loadSpacePages = (key) => {
    setLoadingPages(true);
    setError(null);
    setSpaces(null);
    invoke('getSpacePages', { spaceKey: key })
      .then((res) => {
        if (res.error) setError(res.error);
        else { setPages(res.pages || []); setSpaceKey(res.spaceKey); }
        setLoadingPages(false);
      })
      .catch((err) => { setError(err.message); setLoadingPages(false); });
  };

  const togglePage = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleExport = async () => {
    if (selected.size === 0) { setError('Select at least one page.'); return; }
    if (license && !license.paid && selected.size > license.freePageLimit) {
      setError(`Free tier: max ${license.freePageLimit} pages. Select fewer or upgrade.`);
      return;
    }
    setExporting(true); setError(null); setResult(null);
    try {
      const res = await invoke('exportEvidence', { pageIds: Array.from(selected), attachToPageId: null });
      if (res.error) setError(res.error);
      else setResult(res);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally { setExporting(false); }
  };

  const handleDownload = () => {
    if (!result?.zipBase64) return;
    const binary = atob(result.zipBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-evidence-${new Date().toISOString().substring(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (result) return (
    <div style={styles.wrap}>
      <ExportResult result={result} onDownload={handleDownload} onReset={() => setResult(null)}
        selectedPages={selected} spaceKey={spaceKey} license={license} />
    </div>
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.heading}>Audit Evidence Exporter</div>
      <div style={styles.subtext}>Export Confluence pages as timestamped, SHA-256 verified PDF bundles for SOC 2 / ISO 27001 audits.</div>

      {license && !license.paid && (
        <div style={styles.banner('#DEEBFF')}>
          <strong>Free tier</strong> — up to {license.freePageLimit} pages per export. Upgrade for unlimited pages.
        </div>
      )}

      {error && <div style={styles.banner('#FFEBE6')}><strong>Error:</strong> {error}</div>}

      {loadingPages ? (
        <div style={{ color: '#6B778C' }}>Loading…</div>
      ) : spaces === 'input' ? (
        <SpaceKeyInput onPick={loadSpacePages} />
      ) : spaces ? (
        <SpaceKeyInput onPick={loadSpacePages} />
      ) : pages.length === 0 ? (
        <div style={styles.banner('#FFFAE6')}>No pages found in this space.</div>
      ) : (
        <div>
          <div style={styles.label}>
            Select pages to capture
            {spaceKey && <span style={{ color: '#6B778C', fontWeight: 400, marginLeft: 8 }}>({spaceKey.startsWith('~') ? 'Personal Space' : spaceKey})</span>}
            <button style={{ ...styles.btn(false, false), marginLeft: 12, padding: '2px 8px', fontSize: 12 }}
              onClick={() => { setSpaces('input'); setPages([]); setSelected(new Set()); setSpaceKey(null); }}>
              ↩ Change space
            </button>
          </div>
          <PageList pages={pages} selected={selected} onToggle={togglePage}
            onSelectAll={() => setSelected(new Set(pages.map((p) => p.id)))}
            onClearAll={() => setSelected(new Set())} />
        </div>
      )}

      <div style={{ marginTop: 16, ...styles.row }}>
        <button style={styles.btn(true, selected.size === 0 || loadingPages || exporting)}
          onClick={handleExport} disabled={selected.size === 0 || loadingPages || exporting}>
          {exporting ? 'Capturing…' : `Export ${selected.size > 0 ? selected.size : ''} page${selected.size !== 1 ? 's' : ''}`}
        </button>
        {license && !license.paid && selected.size > license.freePageLimit && (
          <span style={{ color: '#DE350B', fontSize: 13 }}>Exceeds free limit ({license.freePageLimit} pages)</span>
        )}
      </div>

      <div style={{ color: '#6B778C', fontSize: 12, marginTop: 12 }}>
        Each PDF is timestamped and SHA-256 hashed. A manifest.json lists all hashes for auditor verification.
      </div>
      <StatsPanel />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
