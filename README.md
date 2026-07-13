# Screenshot API for AI Agents

> Give your AI agent eyes. One MCP tool call returns a screenshot your agent can actually *see*.

**→ [Join the early access waitlist](https://raphy78626.github.io/screenshot-api)** · Free tier included · Hosted API coming soon

---

## What it does

AI agents can't see web pages — they get raw HTML, which is noisy, incomplete (no JS-rendered content), and full of boilerplate. This MCP server gives Claude, Cursor, and any MCP-compatible agent three native tools:

| Tool | What it returns |
|------|----------------|
| `take_screenshot` | URL → base64 PNG/JPEG your agent can look at directly |
| `describe_page` | Screenshot + title + H1 + meta description in one call |
| `capture_pdf` | URL → A4 PDF |

`describe_page` is the key differentiator: most agents need a screenshot *and* some text context. This saves a round-trip.

---

## Quick start (self-hosted, free)

### Claude Desktop

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "screenshot-api": {
      "command": "npx",
      "args": ["-y", "screenshot-api-mcp"]
    }
  }
}
```

Restart Claude Desktop. Then ask:
> *"Take a screenshot of https://news.ycombinator.com and summarise the top 5 stories"*

### Cursor

Settings → MCP → Add Server:

```json
{
  "name": "screenshot-api",
  "command": "npx",
  "args": ["-y", "screenshot-api-mcp"]
}
```

### Python (LangChain / CrewAI)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "screenshot": {
        "command": "npx",
        "args": ["-y", "screenshot-api-mcp"],
        "transport": "stdio",
    }
})

tools = await client.get_tools()
# → [take_screenshot, describe_page, capture_pdf]
```

---

## Why not just use the HTML?

- **JS-rendered content** — SPAs, lazy-loaded sections, and canvas elements are invisible to scrapers. Playwright renders everything.
- **Stealth mode** — ~40% of real URLs return bot-block pages to naive scrapers. Evasion is built in.
- **Response cache** — same URL twice in a loop? Second call is instant (5-min TTL, no double-billing).
- **MCP-native** — structured outputs designed for agent loops, not bolted-on HTTP wrappers.

---

## Hosted API (coming soon)

The self-hosted version requires Node.js + a local Playwright/Chromium install (~300MB). The hosted API has none of that — your agent hits an endpoint, gets back the image.

**[Join the waitlist](https://raphy78626.github.io/screenshot-api)** — early access gets 3 months at 40% off.

Planned tiers:
| Plan | Price | Screenshots/mo |
|------|-------|---------------|
| Free trial | $0 | 100 (7 days) |
| Starter | $19/mo | 2,000 |
| Pro | $49/mo | 10,000 |

---

## HTTP API (self-hosted)

### `GET /screenshot`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | **required** | Public URL (http/https only) |
| `format` | `png` \| `jpeg` \| `pdf` | `png` | Output format |
| `full_page` | `true` \| `false` | `false` | Full scrollable page |
| `width` | number | `1280` | Viewport width (320–3840) |
| `height` | number | `800` | Viewport height (200–2160) |

```bash
curl "http://localhost:3099/screenshot?url=https://example.com" -o out.png
```

### `GET /health`

```json
{ "status": "ok", "browserConnected": true }
```

---

## Local development

```bash
npm install
npm run dev        # tsx watch
npm test           # vitest + real Chromium (~60s)
npm run typecheck
```

---

## Deploy to Fly.io (self-host at scale)

```bash
export PATH="$HOME/.fly/bin:$PATH"
flyctl auth login
flyctl launch --no-deploy --copy-config
flyctl secrets set PROXY_SECRET=$(openssl rand -hex 24)
flyctl deploy
flyctl checks list   # /health should be green
```

> **Memory:** Fly's default 256MB **will OOM Chromium**. `fly.toml` is pre-set to 1GB. Don't scale below 512MB.

Add `FLY_API_TOKEN` to GitHub repo secrets to enable auto-deploy on push to `main`.

---

## Configuration

All settings via environment variables. See [`.env.example`](.env.example).

Key vars: `PORT` (3099), `MAX_CONCURRENCY` (2), `PROXY_SECRET` (empty = auth off locally), `NAV_TIMEOUT_MS` (20000).

---

## Roadmap

### Phase A — Validation *(now)*
- [x] MCP server with 3 tools
- [x] Stealth / Cloudflare bypass
- [x] Response cache (5-min TTL)
- [x] Landing page + waitlist
- [ ] npm publish (`screenshot-api-mcp`)
- [ ] Smithery + mcp.so + Glama listings
- [ ] 20 waitlist signups ← **gate to Phase B**

### Phase B — Hosted API *(if gate passed)*
- [ ] Lemon Squeezy billing (usage tiers)
- [ ] API key issuance + metering
- [ ] Fly.io deploy (1GB VM, `min_machines_running=1`)
- [ ] First paying customer

### Phase C — Growth
- [ ] SEO content ("how to give Claude screenshots")
- [ ] Zapier integration
- [ ] LangChain / CrewAI tool package
