---
name: screenshot-api-mcp
description: Give AI coding agents visual inspection, page summaries, and PDF capture of public web pages via the screenshot-api-mcp MCP server (Playwright + stealth + SSRF protection). Use when verifying deployments, checking responsive UI layouts, inspecting JS-rendered SPAs, or archiving pages as A4 PDFs.
---

# Screenshot API MCP — Visual Eyes for AI Agents

Use this skill whenever an agent needs to **see** a live public webpage, inspect a JS-rendered UI, verify a deployment, or archive a URL as a PDF — instead of guessing from raw HTML.

## Prerequisites & MCP Setup

Ensure the `screenshot-api-mcp` server is configured in the user's MCP client:

```json
{
  "mcpServers": {
    "screenshot-api": {
      "command": "npx",
      "args": ["-y", "screenshot-api-mcp"]
    }
  }
}
```

- Requires Node.js and Chromium installed for Playwright (`npx playwright install chromium` if missing on first run).
- Runs locally over stdio — no external API key or third-party account required.

## Choosing the Right Tool

| Goal | Tool | Key Arguments |
|---|---|---|
| Quick visual + text understanding in one round-trip | `describe_page` | `url`, `width` (default `1280`) |
| Visual QA, layout check, or full-page capture | `take_screenshot` | `url`, `format` (`png` \| `jpeg`), `width` (`320`–`3840`), `full_page` (`true` \| `false`) |
| Printable report or compliance/page archive | `capture_pdf` | `url` (renders A4 PDF with `printBackground: true`) |

## Recommended Workflows

### 1. Deployment & Landing Page Visual QA
1. Call `describe_page(url)` first to confirm the page loads, check `<title>`, `<h1>`, and meta description, and inspect the above-the-fold screenshot.
2. Check mobile responsiveness with `take_screenshot(url, width=390, full_page=true)`.
3. Check desktop full-page layout with `take_screenshot(url, width=1440, full_page=true)`.
4. Report concrete visual issues (clipped text, overflow, broken hero contrast, missing elements) rather than generic praise.

### 2. Inspecting JS-Rendered SPAs & Protected Pages
- Prefer `describe_page` or `take_screenshot` over plain HTTP fetch when the target site relies on client-side rendering (React, Next.js, Vue) or blocks naive scrapers.
- The server waits for `networkidle` (20s timeout) and runs `playwright-extra` with stealth evasion.

### 3. Archiving a Page as PDF
1. Call `capture_pdf(url)` to generate an A4 PDF with background styles preserved.
2. The tool returns a base64 `data:application/pdf` resource along with the file size in KB.

## Guardrails & Failure Handling

- **Public URLs only (SSRF protected):** `localhost`, `127.0.0.1`, RFC1918 private IPs (`10.x`, `172.16-31.x`, `192.168.x`), and cloud metadata IPs (`169.254.169.254`) are blocked by design. Do not retry blocked internal URLs; tell the user why.
- **Hard bot walls / timeouts:** If a site blocks headless Chromium or exceeds the 20s navigation timeout, report the exact failure honestly — never fabricate visual observations.
- **Minimize extra captures:** Prefer `describe_page` when you need both text context and a screenshot to avoid two browser navigations.
