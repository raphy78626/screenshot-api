# Audit Evidence Exporter — Marketplace Listing Copy

## App Name
Audit Evidence Exporter for Confluence

## Tagline (≤ 100 chars)
Export Confluence pages as timestamped, SHA-256 verified PDF bundles.

## Summary (shown above the fold, ≤ 280 chars)
Audit Evidence Exporter captures Confluence pages as tamper-evident PDF bundles for SOC 2, ISO 27001, and compliance audits. Each export includes SHA-256 hashes you can verify with a single terminal command — no trust required.

## Description (full)

### Stop scrambling before audits. Capture evidence in one click.

Compliance auditors ask for documentation snapshots: what your policies said, when, and that nothing changed since. Confluence's native PDF export has no timestamps, no hashes, and no bulk capture. Audit Evidence Exporter fills exactly that gap.

**What you get in every export:**

- **Timestamped PDFs** — each page captured with the exact date and time stamped in the footer
- **SHA-256 hash per PDF** — recorded in `manifest.json`; verify with `shasum -a 256 <file>.pdf`
- **VERIFICATION.txt** — step-by-step commands included in every bundle so your auditor can self-verify without any proprietary tools
- **Structured content** — headings, bullets, tables, and code blocks rendered cleanly, not dumped as plain text

**Runs on Atlassian — your data never leaves your tenant.**
Forge-native with no external servers, no data egress, no third-party accounts required.

---

### Free tier
- Export up to 5 pages per bundle
- Full SHA-256 verification on every export
- Download ZIP immediately

### Paid — $5/month
- Unlimited pages per export
- **Weekly scheduled capture** — the app automatically re-exports your selected pages every week and attaches the ZIP to a Confluence page of your choice
- No manual trigger needed — auditors find evidence waiting for them

---

### Built for
- SOC 2 Type I & II evidence collection
- ISO 27001 document control snapshots
- HIPAA policy page archiving
- Internal audit trails for policy change history

---

## Categories
- Primary: IT Management
- Secondary: Documentation

## Support
raphy78626@gmail.com

## Screenshots (upload in this order)
1. `screenshot-1.png` — Export result UI with hash table
2. `screenshot-2.png` — ZIP contents in Finder (PDFs + manifest + VERIFICATION.txt)
3. `screenshot-3.png` — verify-bundle.sh terminal output, 5/5 PASS

## Icon
`icon.png` — 512×512px, blue rounded square, document + green verified badge
