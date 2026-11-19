# Audit Evidence & Compliance PDF Export for Confluence — MVP + Roadmap

## The Product

A Confluence Forge app (sold on the Atlassian Marketplace) that lets a compliance manager select Confluence pages or a space → export a timestamped, watermarked, hash-verified PDF evidence bundle → download it or attach it to a page. Built on top of the ComplianceSnap screenshot/PDF engine.

**Why this beats every other marketplace bet:**
- Reuses screenshot/PDF code already in this repo
- Atlassian = merchant of record (no India payment/VAT problem)
- 0% revenue share up to $1M lifetime (2026 Forge incentive)
- ~6–8K competing apps vs 178K+ on Chrome, 48K+ on Apify
- Buyers (GRC/security teams) have budget and a real SOC 2 / ISO 27001 job-to-be-done
- Listing doubles as ComplianceSnap top-of-funnel

---

## MVP (v1.0) — "One job done well"

**Done means:** A fresh Confluence Cloud site installs the app, exports a 5-page evidence bundle with valid hashes/timestamps, and the paid gate blocks >5 pages on the free tier.

### In Scope

| # | Item | Notes |
|---|------|-------|
| 1 | **Forge app scaffold** | Forge-only modules (no Connect), OAuth 2.0 scopes `read:page:confluence` + `write:attachment:confluence`, Forge UI Kit. Must pass `forge` "Runs on Atlassian" eligibility CLI check. |
| 2 | **Page/space picker UI** | Multi-select pages OR "entire space" from a Confluence content byline or space-settings panel. |
| 3 | **Capture engine** | Fetch page storage-format HTML via Confluence REST API → render to PDF via this repo's screenshot-api backend (or Forge-compatible PDF lib if Forge egress allows). Spike in Week 1 to decide. |
| 4 | **Evidence stamping** | Each PDF page footer: capture timestamp (UTC), page version number, page URL, capturing user, SHA-256 hash of page content. Watermark: "Captured for audit evidence — [timestamp]". |
| 5 | **Bundle output** | Single `.zip`: one PDF per page + `manifest.json` (page id, title, version, URL, hash, timestamp for each). Download button + optional "attach to this page". |
| 6 | **Free/paid gating** | Free tier: ≤5 pages per export. Paid tier: unlimited pages + whole-space export. Pricing via Atlassian Licensing API ("Paid via Atlassian"). Tier pricing benchmarked against incumbents on Ampin.app. |
| 7 | **Marketplace listing** | Title: "Audit Evidence & Compliance PDF Export for Confluence". SOC 2 / ISO 27001 / evidence keywords. Demo GIF of export flow. Security & data-handling statement. Privacy policy. Link to ComplianceSnap.io. |

### Explicitly Out of MVP
Scheduled/recurring snapshots · Jira support · Vanta/Drata push · Multi-space batches · Custom branding · Retention policies · Audit trails of exports themselves

---

## Roadmap

### Phase 0 — Validate before building (Weekend 0)
- [x] Search Atlassian Marketplace for "compliance export", "audit PDF", "evidence" Confluence apps; record name, reviews, pricing, install count
- [x] Document findings in `docs/competitive-scan.md`
- [x] **Decision gate:** GO — zero direct incumbents in timestamped, SHA-256-verified evidence bundles.

### Phase 1 — MVP build (Weekends 1–3)
- [x] Set up Atlassian Developer account + Forge CLI (`npm install -g @forge/cli`)
- [x] Create Forge app scaffold (`forge-app/` — manifest.yml, resolver, Custom UI)
- [x] Capture-engine spike: **RESOLVED** — pure-JS `pdf-lib` inside Forge runtime with **zero external egress** (qualifies for "Runs on Atlassian", no dependency on `screenshot-api-mcp.fly.dev`)
- [x] Shared export logic extracted to `forge-app/src/evidence.js` (sha256, buildManifestEntry, buildBundle, buildVerificationTxt) — fully testable outside Forge runtime
- [x] Local harness (`forge-app/test/local-harness.mjs`) — 5/5 checks pass
- [x] Page picker UI built (`forge-app/src/frontend/src/index.jsx`) with free/paid tier gate + KVS usage stats panel
- [x] Evidence stamping (timestamp, version, URL, user, SHA-256) + `manifest.json` + `VERIFICATION.txt`
- [x] ZIP bundling via JSZip; attach-to-page option + weekly scheduled trigger (`weekly-evidence-capture`)
- [x] Registered (`ari:cloud:ecosystem::app/b8896340-46d2-4865-990d-4cbd06567591`), deployed to **development (v4)** and **production (v3)**, and installed on `raphy786261.atlassian.net`

### Phase 2 — Launch (In Progress)
- [x] Create listing assets: icon (`icon.png`), 3 screenshots (`screenshot-1..3.png`), listing copy (`docs/marketplace/listing-copy.md`), privacy policy (`docs/privacy.md`), landing page (`docs/audit-evidence/index.html`)
- [x] Initial Marketplace submission (Aug 2026) → **Automatic Rejection: "Not enough details on listing"**
- [ ] **NEXT:** Resubmit as **Free v1** with expanded listing details (highlights, full description, FAQ, plain email support contact `raphy78626@gmail.com`) and reconciled `docs/privacy.md`
- [ ] Update landing page CTA links to the approved Marketplace URL, then publish `docs/launch-posts.md`
- [ ] Once 5–10 active installs are confirmed, enable `app.licensing.enabled: true` in `manifest.yml` and launch Paid via Atlassian tiers

### Phase 3 — Parallel free distribution (Weeks 5–8, runs alongside review)
- [ ] Vanta integration listing: OAuth client + hourly job pushing evidence bundles into customer Vanta tenants as documents (~1 week build, 1–2 weeks review)
- [ ] Drata connector: API-key evidence push (~2–3 days)
- [ ] Zapier connector for ComplianceSnap (appear in "screenshot"/"PDF"/"compliance" automation searches)
- [ ] Cross-link all listings ↔ ComplianceSnap site + Forge app listing

### Phase 4 — v1.1 (Months 2–3, only if installs > 0)
- [ ] Scheduled/recurring snapshots (the #1 expected upsell — weekly/monthly evidence capture)
- [ ] Whole-space + label-based page selection
- [ ] Email/Confluence notification on completed export
- [ ] Export history page (last N exports with re-download)

### Phase 5 — 6-month decision gate
| Signal | Action |
|--------|--------|
| ≥$500–1,000/mo, <2 hrs/wk maintenance | Double down: build Jira audit-trail exporter (second Forge app, compounds toward $1M 0% ceiling) |
| <10 paying instances AND Atlassian ships native evidence export | Sunset app; fold learnings into ComplianceSnap proper |
| Maintenance exceeds 3 hrs/week | Cut scope or kill — it's cannibalizing ComplianceSnap |

---

## Metrics to Instrument From Day 1

| Metric | Why |
|--------|-----|
| Installs | Listing conversion |
| Activation rate (first export) | Onboarding quality |
| Free→paid conversion | Willingness to pay |
| Exports per instance per month | Engagement / stickiness |
| Support tickets per week | Maintenance budget burn |

---

## Key Technical Decisions (spike in Week 1)

1. **Capture engine:** Can Forge async functions make outbound HTTPS calls to this repo's screenshot-api? If yes, reuse as-is. If Forge egress is too restricted, run capture logic in a Forge Remote (Node.js external function on Atlassian's infra).
2. **PDF rendering:** Prefer reusing existing engine. Fallback: `pdf-lib` or `jsPDF` for pure-JS in Forge if no headless browser available in the runtime.
3. **Forge runtime:** Use Forge UI Kit (React subset) for the picker UI — avoids Custom UI complexity while still qualifying for "Runs on Atlassian".

---

## Deploy Checklist (run these yourself — requires Atlassian account)

These steps require interactive auth and cannot be automated. Do them once to go live on a real Confluence Cloud site.

```bash
# 1. Log in to Atlassian (opens browser)
cd forge-app
forge login

# 2. Register the app — sets the real app ID in manifest.yml
forge register
# → copy the printed app ID into manifest.yml under app.id

# 3. Install frontend dependencies
cd src/frontend && npm install && cd ../..

# 4. Deploy to development environment
forge deploy -e development

# 5. Install on your Confluence Cloud site
forge install
# → select "Confluence" → enter your site URL (e.g. your-domain.atlassian.net)

# 6. Open Confluence → Space Settings → Apps → Audit Evidence Exporter
# Golden path QA:
#   - Select 3 pages → Export → verify ZIP downloads with PDFs + manifest.json
#   - Select 6 pages → verify free-tier warning blocks export
#   - Enable "Attach to page" → verify ZIP attachment appears on page
```

**To run the local harness against the deployed fly.dev backend:**
```bash
node forge-app/test/local-harness.mjs
# (uses https://screenshot-api-mcp.fly.dev by default)
```

**To run against local dev server:**
```bash
npm run dev &   # in repo root — starts on port 8080 by default (check .env)
SCREENSHOT_API_URL=http://localhost:3099 node forge-app/test/local-harness.mjs
```

---

## Revenue Model

| Tier | Limit | Pricing (benchmark Ampin first) |
|------|-------|---------------------------------|
| Free | 5 pages/export, manual only | $0 |
| Starter | Unlimited pages + whole-space | ~$3–5/user/month (Confluence user tier) |
| Pro | Starter + scheduled + history | ~$6–10/user/month |

Atlassian's user-tier pricing is automatic — you set price per tier (10 users, 25 users, 50 users, …, Unlimited) and Atlassian handles the math.

---

---

## 3-Model Advisor Review (Nov 2026)

Three independent models (DeepSeek harness, Gemini, ChatGPT) reviewed the repo + docs against four questions: wedge validity, highest-leverage 2-week action, top-3 risks, and repo-split decision. **Gemini and ChatGPT returned empty/no-output** (Gemini DOM break; ChatGPT Cloudflare wall). The consolidated review below is DeepSeek-driven plus the assistant's own doc analysis — not a true 3-model consensus.

### 1. Is the wedge real?

**Yes, but narrow — 12–18 month window before Atlassian ships native evidence export.**

The wedge is the *evidence bundle* (timestamped PDF + SHA-256 + manifest.json + VERIFICATION.txt), not PDF rendering. Native Atlassian PDF export lacks bulk export, SHA-256 hashing, manifest/ZIP output, and audit-log tracking (CONFSERVER-58111 still open). Scroll PDF Exporter (9,284 installs, ~$5/mo) is formatting-only — no compliance metadata. Auditforge is the closest competitor but generates AI narratives, not captured page content.

**Key nuance:** The wedge is *real but time-limited*. Atlassian could add scheduled bulk PDF export natively. The mitigation is keeping v1 narrow and being ready to pivot to a Jira audit-trail exporter if the window closes.

### 2. Highest-leverage 2-week action

**Deploy the Forge app to a real Confluence Cloud site and submit to the Marketplace.**

Not building scheduling, not posting launch content. The single action that validates the entire wedge is: install the dev build on a real site, export actual policy pages, verify SHA-256 passes, and submit the listing. If the Forge app can render real Confluence storage-format pages acceptably via the external PDF API, the wedge holds. If it can't, that's a fatal finding — better to discover it now than after Marketplace approval.

### 3. Top 3 risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | **Atlassian ships native evidence export** | Keep v1 narrow; schedule recurring capture as the #1 upsell; pivot wedge to Jira audit-trail exporter if threatened |
| 2 | **Forge egress can't run headless browser** | Current spike calls `screenshot-api-mcp.fly.dev` — test against real Confluence pages before submission; budget Forge Remote as fallback; `pdf-lib`/`jsPDF` for pure-JS rendering if no headless browser available in the runtime |
| 3 | **Marketplace review rejects compliance language** | Submit with "timestamped PDF bundles with SHA-256 verification" — avoid "compliance," "SOC 2," "tamper-evident" in the listing; add compliance framing only after approval |

### 4. Repo-split decision

**Split the mono-repo.** Two audiences, two distribution channels, two pricing models:

- **`screenshot-api-mcp`** — AI-agent audience (MCP server). Distribute via npm, Smithery, mcp.so. `take_screenshot`, `describe_page`, `capture_pdf` tools. 5-min cache, base64 output. No Confluence dependency.
- **``confluence-audit-evidence-exporter`** — GRC audience (Atlassian Marketplace). Forge app only. Distribute via Atlassian Marketplace. Atlassian = merchant of record, 0% revenue share to $1M.
- **Shared:** `evidence.js` (SHA-256, manifest, bundle logic) + PDF capture engine as an internal npm package.

The split sharpens the story for each audience and avoids the "is this a screenshot tool or a compliance tool?" confusion that kills positioning.

---

## Caveats (stay honest)

- **Median outcome is near-zero.** Treat any revenue as upside; 4 weekends is the max bet.
- **Platform risk:** Atlassian could ship native evidence export. Keep v1 narrow; be ready to pivot wedge.
- **0% incentive is temporary** — minimum 6-month change notice. Model economics on 16–17% Forge rate for durability.
- **Forge-only constraint:** Never add Connect modules — that forfeits the "Runs on Atlassian" badge and 0% incentive.
