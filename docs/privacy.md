# Privacy Policy — Audit Evidence Exporter for Confluence

**Effective date:** 2026-07-21
**Contact:** raphy78626@gmail.com

---

## What this app does

Audit Evidence Exporter for Confluence exports Confluence pages as timestamped, SHA-256 verified PDF bundles for compliance audits (SOC 2, ISO 27001, HIPAA, and similar).

---

## Data we access

The app reads the following data from your Confluence instance to generate export bundles:

| Data | Purpose |
|---|---|
| Page content (title, body, version) | Generate the PDF |
| Space key | Include in the bundle manifest |
| Author display name | Record in the bundle manifest |

This data is accessed at the time of export and is never transmitted to any server outside your Atlassian tenant.

---

## Data we store

The app stores one configuration record per site using Atlassian Forge KVS (key-value storage):

- Space key
- List of selected page IDs
- Optional: the ID of a Confluence page to attach exports to

This record is stored only when you enable the weekly scheduled capture feature. It contains no personal information and no page content.

You can delete this record at any time from the app's UI by removing the schedule.

---

## Data we do NOT collect

- We do not collect, transmit, or store page content on any external server.
- We do not collect analytics, usage statistics, or telemetry.
- We do not store user names, email addresses, or account IDs beyond the duration of a single export invocation.
- We do not use cookies or tracking technologies.

---

## Where data is processed

The app runs entirely on **Atlassian Forge** — Atlassian's serverless platform. All processing happens within Atlassian's infrastructure. No data leaves your Atlassian tenant.

For details on Atlassian's own data handling, see [Atlassian's Privacy Policy](https://www.atlassian.com/legal/privacy-policy).

---

## Third parties

This app does not share any data with third parties. There are no third-party integrations, analytics services, or external API calls.

---

## Your rights

Because we store no personal data outside Atlassian's own infrastructure, there is nothing to request, export, or delete beyond what Atlassian already provides. To remove all app data: uninstall the app from your Confluence site.

---

## Changes to this policy

If this policy changes materially, the effective date above will be updated. Continued use of the app after a policy update constitutes acceptance of the revised policy.

---

## Contact

Questions about this privacy policy: **raphy78626@gmail.com**
