# Audit Evidence Exporter — Marketplace Listing Copy (Resubmission-Ready)

> **Previous rejection reason (Aug 2026):** `Automatic Rejection - Not enough details on listing`
> **Before clicking Resubmit:**
> - Fill in **all** fields below: Tagline, Summary, Full Description, all 3 Highlights (each with screenshot), Documentation URL, Privacy Policy URL, and Support Email.
> - In **Developer Console → Distribution**, enter Support Contact as plain email `raphy78626@gmail.com` (do **not** prefix with `mailto:`).
> - List v1 as **Free** on Marketplace (matches `License: false` in `forge-app/manifest.yml` prod v3). Add Paid-via-Atlassian user tiers after initial installs validate demand.

---

## App Name
Audit Evidence Exporter for Confluence

## Tagline (≤ 100 chars)
Export Confluence pages as timestamped, SHA-256 verified PDF evidence bundles.

## Summary (shown above the fold, ≤ 280 chars)
Capture Confluence policy and procedure pages as timestamped PDF bundles with SHA-256 hashes, `manifest.json`, and self-verification instructions for SOC 2, ISO 27001, and internal audits. Runs 100% on Atlassian Forge with zero external egress.

---

## Key Highlights (3 required cards — pair each with a screenshot)

### Highlight 1 — One-click timestamped PDF bundles (`screenshot-1.png`)
Select individual policy pages or an entire Confluence space and export a single ZIP bundle. Every PDF includes page version, space key, last-modified date, capture timestamp (UTC), source hash, and page numbers in the footer.

### Highlight 2 — Independent SHA-256 verification (`screenshot-2.png`)
Every ZIP includes a `manifest.json` mapping each PDF to its exact SHA-256 digest plus a `VERIFICATION.txt` guide with ready-to-run `shasum -a 256` (macOS/Linux) and `Get-FileHash` (Windows) commands — no proprietary verifier required.

### Highlight 3 — Runs on Atlassian with zero external egress (`screenshot-3.png`)
Built natively on Atlassian Forge (`nodejs22.x`). PDF rendering, SHA-256 hashing, and ZIP bundling all execute inside Atlassian's infrastructure. Your Confluence content never leaves your tenant and is never sent to third-party servers.

---

## Full Description (More details)

### Stop scrambling before audits. Export verifiable Confluence snapshots in one click.

When preparing for SOC 2, ISO 27001, HIPAA, or internal compliance reviews, auditors ask for point-in-time documentation evidence: what a policy page said, which version was active, when it was captured, and proof that the exported file was not altered afterward.

Confluence's native PDF export handles single pages without bulk bundling, cryptographic hashes, or verification manifests. **Audit Evidence Exporter for Confluence** fills that gap directly inside Confluence Cloud.

#### What is included in every ZIP bundle
- **Timestamped PDFs** — structured rendering of headings, paragraphs, bullet lists, tables, and code blocks, stamped with UTC capture time, Confluence version number, space key, source URL, and page numbers.
- **`manifest.json`** — machine-readable metadata for every captured page: page ID, title, version, author display name, last-modified timestamp, capture timestamp, source content SHA-256, and final PDF byte SHA-256.
- **`VERIFICATION.txt`** — plain-text instructions and exact hashes so any auditor can verify file integrity in seconds using standard OS commands (`shasum -a 256` or PowerShell `Get-FileHash`).

#### How it works (3 steps)
1. Open **Audit Evidence Exporter** from your Confluence space sidebar or Apps menu.
2. Pick your space and select the policy or runbook pages you want to capture.
3. Click **Export** to download the `.zip` evidence bundle immediately and view the SHA-256 summary table right in Confluence.

#### Security & Data Handling
- **Runs on Atlassian (Forge-native):** Zero external API calls, zero egress permissions, zero third-party hosting.
- **Minimal scopes:** Reads only the pages, space metadata, and author display names needed to render your export; writes attachments only when you explicitly attach a bundle to a page.
- **No external telemetry:** Export counts shown in the in-app *Usage stats* panel are stored strictly inside your own tenant's Forge KVS and are never transmitted externally.

#### Ideal for
- SOC 2 Type I & Type II policy and runbook evidence collection
- ISO 27001 document snapshot archiving
- Internal audit & change-history verification
- Security, GRC, and engineering compliance teams using Confluence Cloud

#### Frequently Asked Questions
- **Does my Confluence content leave Atlassian?** No. PDF generation, hashing, and ZIP creation all run inside Atlassian Forge with no external egress.
- **How does my auditor verify a PDF?** Unzip the bundle and run `shasum -a 256 <filename>.pdf` (macOS/Linux) or `Get-FileHash <filename>.pdf -Algorithm SHA256` (Windows), then compare against `manifest.json` or `VERIFICATION.txt`.
- **Does it work with complex pages?** Headings, paragraphs, lists, tables, and code blocks are rendered cleanly into structured PDFs. Embedded images are labeled with alt text placeholders so captures remain fast and 100% tenant-local.

---

## Listing Metadata & Links
- **Pricing model (v1):** Free (up to 5 pages per export; paid unlimited + weekly scheduled capture planned via Paid via Atlassian)
- **Primary Category:** IT & Ops (or Documentation)
- **Secondary Category:** Admin tools / Compliance
- **Support Email:** `raphy78626@gmail.com` *(plain email, no `mailto:`)*
- **Documentation / Homepage URL:** `https://raphy78626.github.io/screenshot-api/audit-evidence/`
- **Privacy Policy URL:** `https://raphy78626.github.io/screenshot-api/privacy`
- **Source / Issue Tracker:** `https://github.com/raphy78626/screenshot-api`

## Media Assets (`docs/marketplace/`)
- **App Icon:** `docs/marketplace/icon.png` (512×512px)
- **Screenshot 1:** `docs/marketplace/screenshot-1.png` — Export result UI with SHA-256 hash table
- **Screenshot 2:** `docs/marketplace/screenshot-2.png` — Evidence ZIP bundle contents (`PDFs + manifest.json + VERIFICATION.txt`)
- **Screenshot 3:** `docs/marketplace/screenshot-3.png` — Independent terminal SHA-256 verification output (5/5 PASS)
