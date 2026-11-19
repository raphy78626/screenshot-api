# Phase 0: Atlassian Marketplace Competitive Scan
**Date:** July 2026 | **Analyst:** Claude Code

## VERDICT: GO ✅ — with a sharper wedge

The "compliance evidence PDF export for Confluence" niche is **not yet owned**. Zero apps do the specific job of: *select pages → generate timestamped, hashed, audit-stamped evidence bundle → download/attach*. The market is split between generic PDF exporters (polish/formatting focus, no compliance metadata) and document workflow/approval apps (process focus, no bulk capture). **Our wedge is the gap between these two categories.**

---

## Competitive Landscape

### Category 1: Generic PDF Exporters (Indirect Competitors)

These export Confluence pages to pretty PDFs. None target SOC 2 / ISO 27001 evidence collection as a job-to-be-done.

| App | Vendor | Hosting | Reviews | Installs | Pricing (Cloud) | Compliance angle |
|-----|--------|---------|---------|----------|-----------------|-----------------|
| [Scroll PDF Exporter](https://marketplace.atlassian.com/apps/7019/scroll-pdf-exporter-for-confluence) | K15t | Cloud Fortified (Connect) | ~500+ | **9,284** | From $5/mo (10 users) | Mentioned in context but not the focus |
| [Easy PDF Export for Confluence](https://marketplace.atlassian.com/apps/1223109/easy-pdf-export-for-confluence) | Unknown | Cloud | Unknown | Unknown | Unknown | None |
| [PDF Export Tools for Confluence Cloud](https://marketplace.atlassian.com/apps/1220170/pdf-export-tools-for-confluence-cloud) | Unknown | Cloud | Unknown | Unknown | Unknown | None |
| [PDF exporter, HTML and Word exporter](https://marketplace.atlassian.com/apps/1229213/pdf-exporter-html-and-word-exporter-for-confluence-cloud) | Unknown | Cloud | Unknown | Unknown | Unknown | None |
| [PDF Exporter for Confluence](https://marketplace.atlassian.com/apps/726790413/pdf-exporter-for-confluence) (Yamuno) | Yamuno | **Forge** | Very few (launched Apr 2026) | Very low (new) | Unknown | Watermarks, templates — no evidence stamping |
| [PDF Export for Confluence](https://marketplace.atlassian.com/apps/1237410/pdf-export-for-confluence) | Unknown | Cloud | Unknown | Unknown | Unknown | Digital signatures only |

**Key insight on Scroll PDF:** Dominant at 9,284 installs, but it's a Connect (not Forge) app with a template/branding focus. It does not produce audit evidence bundles (no SHA-256 hashes, no manifest, no compliance metadata, no SOC 2 framing). Directly competing on PDF quality would be a mistake — but competing on *compliance evidence capture* is a completely different product category.

### Category 2: Document Workflow / Approval Apps (Tangential Competitors)

These manage document lifecycle (review → approve → sign). Compliance-adjacent but not evidence-capture.

| App | Vendor | Focus | Hosting | Notes |
|-----|--------|-------|---------|-------|
| [Comala Document Management](https://marketplace.atlassian.com/apps/142/comala-document-management) | Appfire | Approval workflows, audit trails | Cloud + DC | Mature, ISO 9001 / FDA 21 CFR Part 11 users. Captures *workflow history*, not page screenshots/PDFs for external evidence submission. |
| [Document Control for Confluence Cloud](https://marketplace.atlassian.com/apps/1217765/document-control-for-confluence-cloud) | Unknown | e-Signatures + FDA 21 CFR Part 11 | Cloud | Highly regulated industries (pharma, medical devices). Overkill for SOC 2 / ISO 27001 teams. Paid only. |
| [Comala Document Control](https://marketplace.atlassian.com/apps/1215729/comala-document-control) | Appfire | Document control workflows | Cloud + DC | Separate product from Comala DM. Same workflow focus. |

**Key insight:** Comala has 100s of reviews and real enterprise adoption, but it solves "did the right people approve this doc?" — not "I need to export timestamped screenshots of my policy pages for my auditor right now." These apps would send you to *them* to collect the audit log; our app creates the deliverable the auditor actually receives.

### Category 3: Audit/Compliance-Specific Apps (Direct Competitors — but different job)

| App | What it does | Threat level |
|-----|-------------|-------------|
| [Auditforge](https://marketplace.atlassian.com/apps/2127001506/auditforge) | AI (Claude) maps Jira tickets + Confluence pages to ISO 27001 / SOC 2 / NIS2 / DORA controls; generates evidence narratives with Anthropic API. Forge-native, no external servers. | **Medium** — Closest direct competitor in spirit. BUT: it generates AI-written narratives, not captured page screenshots/PDFs. Different output format. Also newer, complex to set up (requires own Anthropic API key). Not a screenshot/archive tool. |
| [Event Journal for Confluence](https://marketplace.atlassian.com/apps/4066520418/event-journal-for-confluence-cloud-audit-log-analytics) | Tracks page edits, comments, space changes (activity log) | Low — it's a log viewer, not an exporter |

**Auditforge is worth watching.** It launched recently and targets the same buyer (GRC/compliance team). However it's an *AI narrative generator* not a *page capture tool* — auditors often need the actual page content, not a summary of it. Differentiation: "here is the policy page as it existed on this date, with a tamper-evident hash."

---

## Native Atlassian Threat Assessment

**Confluence has a native PDF export** (single pages, basic formatting). Atlassian launched an improved "New PDF Formatting Experience" in open beta (2026). **Gaps that remain native:**
- No bulk/space export to PDF with evidence metadata
- No SHA-256 hashing or tamper-evidence
- PDF space export is not tracked in the Confluence Audit Log (open bug: [CONFSERVER-58111](https://jira.atlassian.com/browse/CONFSERVER-58111))
- No manifest/ZIP bundle output
- No compliance-framed workflow (select → capture → archive as evidence)

**Risk:** Atlassian *could* add scheduled bulk PDF export natively. Monitor this. But evidence stamping + hashing + SOC 2/ISO 27001 framing is a specialist feature unlikely to land in the Atlassian core product soon.

---

## Pricing Landscape

| Tier | Market range (10-user tier) | Recommendation |
|------|---------------------------|----------------|
| Free | $0 (feature-limited) | ≤5 pages/export |
| Paid entry | $3–$5/month | Unlimited pages + whole-space |
| Paid pro | $8–$15/month | + Scheduling + history |
| Scroll PDF benchmark | $5/month (10 users) → scales | Use as floor for entry tier |

Compliance/workflow apps (Comala, Document Control) charge significantly more ($10–$30+/month) because they target regulated industries. Our app sits between generic PDF exporters (low price) and compliance platforms (high price) — aim for $5–$10/month entry tier.

---

## Differentiation: What Builds the Wedge

Generic PDF exporters miss all of these; document management apps are overkill for all of these:

1. **Timestamped, immutable capture** — not "export now," but "archive the page as evidence at this moment in time"
2. **SHA-256 hash per page + manifest.json** — auditor can verify the PDF matches what was captured
3. **SOC 2 / ISO 27001 framing** — compliance team language, not developer/documentation language
4. **Bulk space capture** — export an entire space's policy pages as a single evidence package
5. **"Attach to page" output** — store evidence in Confluence itself, not just download
6. **Future: scheduled recurring capture** — weekly/monthly evidence snapshots without manual effort

---

## Final Decision

**GO. Proceed to Phase 1 build.** [See also: Advisor Review (Nov 2026) in `confluence-forge-app-roadmap.md` — DeepSeek repo-level review confirmed the wedge is real but narrow (12–18 month window); Gemini and ChatGPT did not return output.]

- Zero direct incumbents in the "timestamped audit evidence bundle" niche
- Auditforge is the closest competitor but generates AI narratives, not page captures
- Scroll PDF has 9K installs but zero compliance-evidence framing — it's a formatting tool
- Native Confluence PDF export is improving but has no evidence-stamping, hashing, or bulk capture
- The community actively asks for this: ["How I Use Atlassian to Keep ISO 27001 Compliance Organised"](https://community.atlassian.com/forums/Trust-Security-discussions/How-I-Use-Atlassian-to-Keep-ISO-27001-Compliance-Organised-and/td-p/3090727) + ["Turning Confluence into ISO 27001 evidence"](https://community.atlassian.com/forums/App-Central-articles/Turning-Confluence-into-ISO-27001-evidence-how-teams-actually-do/ba-p/3247228)

**Recommended v1 positioning:** "The fastest way to export Confluence policy pages as audit evidence for SOC 2 and ISO 27001 — timestamped, hashed, and bundled in one click."

**Watch:** Auditforge adoption (if it adds PDF capture, it becomes a direct competitor). Atlassian native PDF export roadmap.

---

## Sources
- [Scroll PDF Exporter — Atlassian Marketplace](https://marketplace.atlassian.com/apps/7019/scroll-pdf-exporter-for-confluence)
- [PDF Exporter for Confluence (Yamuno) — Atlassian Marketplace](https://marketplace.atlassian.com/apps/726790413/pdf-exporter-for-confluence)
- [Comala Document Management — Atlassian Marketplace](https://marketplace.atlassian.com/apps/142/comala-document-management)
- [Document Control for Confluence Cloud — Atlassian Marketplace](https://marketplace.atlassian.com/apps/1217765/document-control-for-confluence-cloud)
- [Auditforge — Atlassian Marketplace](https://marketplace.atlassian.com/apps/2127001506/auditforge)
- [Event Journal for Confluence — Atlassian Marketplace](https://marketplace.atlassian.com/apps/4066520418/event-journal-for-confluence-cloud-audit-log-analytics)
- [Best Confluence Import/Export Apps Compared 2026 — NGPILOT](https://ngpilot.com/blog/confluence-import-export-comparison)
- [Turning Confluence into ISO 27001 evidence — Atlassian Community](https://community.atlassian.com/forums/App-Central-articles/Turning-Confluence-into-ISO-27001-evidence-how-teams-actually-do/ba-p/3247228)
- [New PDF Formatting Experience in Confluence — Atlassian Community](https://community.atlassian.com/forums/Confluence-Cloud-Admins-articles/Introducing-the-New-PDF-Formatting-Experience-Open-Beta/ba-p/3195494)
- [CONFSERVER-58111: PDF space export not in Audit Log](https://jira.atlassian.com/browse/CONFSERVER-58111)
