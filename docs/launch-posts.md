# Launch Posts

---

## 1. Atlassian Community
**URL:** https://community.atlassian.com/t5/Confluence-questions/bd-p/confluence-questions
**Category:** Apps & Integrations > Confluence

**Title:**
I built a free Confluence app for SOC 2 / ISO 27001 evidence collection — SHA-256 verified PDF bundles

**Body:**
Hey Atlassian community,

I've been going through SOC 2 audits and kept running into the same problem: Confluence's native PDF export has no timestamps, no hashes, and no bulk capture. Every audit cycle meant manually exporting pages one by one and hoping the auditor would just trust the files.

So I built **Audit Evidence Exporter for Confluence** — a Forge-native app (no external servers, data never leaves your tenant) that fixes exactly this:

**What it does:**
- Exports any selection of Confluence pages as a ZIP bundle in one click
- Each PDF is timestamped (date + time in the footer) and SHA-256 hashed
- `manifest.json` records the hash of every PDF
- `VERIFICATION.txt` is included with exact `shasum` commands so auditors can independently verify every file — no proprietary tools needed
- Weekly scheduled capture (paid) automatically re-exports and attaches the ZIP to a Confluence page

**Verification looks like this:**
```
❯ ./verify-bundle.sh ~/Downloads/audit-evidence-2026-07-21.zip
  Status: PASS ✓  (Security Policy v3)
  Status: PASS ✓  (Access Control Policy v2)
  Status: PASS ✓  (Incident Response Plan v1)
Results: 3 passed · 0 failed · 0 skipped
```

Free tier: up to 5 pages per export, full verification included.

The app is pending Marketplace approval — if you want to try it in the meantime or give early feedback, drop a comment or email me at raphy78626@gmail.com.

Landing page: https://raphy78626.github.io/screenshot-api/audit-evidence/

Happy to answer any questions about the implementation or the compliance use case.

---

## 2. Reddit — r/confluence
**URL:** https://reddit.com/r/confluence
**Flair:** Apps / Tools

**Title:**
Built a free Confluence app for SOC 2 audits — SHA-256 verified PDF bundles you can verify with a single terminal command

**Body:**
Going through a SOC 2 audit and Confluence's native export has always frustrated me — no timestamps, no hashes, no bulk export.

Built a Forge app to fix it: **Audit Evidence Exporter**

- Select pages → one click → ZIP with timestamped PDFs
- SHA-256 hash per PDF recorded in `manifest.json`
- `VERIFICATION.txt` included with exact `shasum -a 256` commands for the auditor
- Weekly auto-capture on the paid tier

The key thing: the auditor can verify every file independently with standard tools, no black box.

```bash
shasum -a 256 Security_Policy_v3.pdf
# compare against manifest.json — match = tamper-evident
```

Runs entirely on Atlassian (Forge), nothing leaves your tenant.

Free for up to 5 pages. Pending Marketplace approval but you can check out the landing page:
https://raphy78626.github.io/screenshot-api/audit-evidence/

Happy to answer questions or get early feedback from anyone doing compliance work.

---

## 3. LinkedIn
**Format:** Post (no article)

**Body:**
I built something small that's been genuinely useful during our SOC 2 audit prep.

**Audit Evidence Exporter for Confluence** — a Forge-native app that exports Confluence pages as timestamped, SHA-256 verified PDF bundles.

The problem it solves: auditors ask for documentation snapshots — what your policies said, when, and that nothing changed since. Confluence's native export has no timestamps, no hashes, no bulk capture.

What every export produces:
→ Timestamped PDFs (exact capture time in every footer)
→ SHA-256 hash per PDF in manifest.json
→ VERIFICATION.txt with exact commands so auditors can self-verify

The auditor runs one command. Every hash either matches or it doesn't. No trust required.

Built on Atlassian Forge — your data never leaves your tenant. No external servers, no third-party accounts.

Free for up to 5 pages. Weekly automated capture on the paid tier.

Pending Marketplace approval — landing page is live if you want to take a look:
https://raphy78626.github.io/screenshot-api/audit-evidence/

Would love feedback from anyone doing SOC 2, ISO 27001, or HIPAA compliance work in Confluence.

#SOC2 #ISO27001 #Confluence #Atlassian #Compliance #InformationSecurity
