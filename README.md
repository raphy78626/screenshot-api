# Screenshot API

Capture any public URL as a **PNG, JPEG, or PDF** via REST API **or MCP tool** for AI agents.
Powered by Playwright (Chromium) + Fastify.

## MCP Server — for AI Agents (Claude, Cursor, Copilot)

The MCP server lets Claude Desktop, Cursor, and any MCP-compatible agent call screenshot tools natively — no API key, no HTTP wiring.

### Tools exposed

| Tool | What it does |
|------|-------------|
| `take_screenshot` | Captures URL → returns image Claude can **see** (base64 PNG/JPEG) |
| `describe_page` | Screenshot + title + H1 + meta description in one call |
| `capture_pdf` | Renders URL as A4 PDF |

### Add to Claude Desktop

1. Open `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add:

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

3. Restart Claude Desktop — the tools appear automatically.

Then ask Claude: *"Take a screenshot of https://example.com"* or *"Describe what's on https://github.com"*

### Add to Cursor

Settings → MCP → Add Server:
```json
{
  "name": "screenshot-api",
  "command": "npx",
  "args": ["-y", "screenshot-api-mcp"]
}
```

### Install via npm

```bash
npm install -g screenshot-api-mcp
```

### Run standalone

```bash
npx screenshot-api-mcp
```

## API

### `GET /screenshot`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | **required** | Public URL to capture (http/https only) |
| `format` | `png` \| `jpeg` \| `pdf` | `png` | Output format |
| `full_page` | `true` \| `false` | `false` | Capture full scrollable page |
| `width` | number | `1280` | Viewport width (320–3840) |
| `height` | number | `800` | Viewport height (200–2160) |

**Response headers:** `Content-Type`, `X-Capture-Ms` (render time in ms)

```bash
curl "http://localhost:3099/screenshot?url=https://example.com&format=png" -o out.png
curl "http://localhost:3099/screenshot?url=https://example.com&format=pdf" -o out.pdf
```

### `GET /health`

Returns `{ "status": "ok", "browserConnected": true }`. Used by Fly health checks.

## Local development

```bash
npm install
npm run dev        # tsx watch — reloads on file changes
```

The demo test page is available at [http://localhost:3099](http://localhost:3099).

## Tests

```bash
npm run typecheck
npm test           # vitest — launches real Chromium; needs ~60s for the capture test
```

Set `SKIP_BROWSER_TESTS=1` to skip the live Chromium test (not yet wired up in the test file, but the capture test can be `.skip`-ped if needed).

## Deploy to Fly.io

### Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) installed and logged in
- Docker installed (for local image verification)

### Steps

```bash
# 1. Create the app (once)
fly launch --no-deploy

# 2. Set the proxy secret (keeps direct callers from bypassing RapidAPI billing)
fly secrets set PROXY_SECRET=$(openssl rand -hex 24)

# 3. Deploy
fly deploy

# 4. Verify
fly checks list         # health check should be passing
curl "https://<your-app>.fly.dev/health"
curl "https://<your-app>.fly.dev/screenshot?url=https://example.com" \
  -H "X-Proxy-Secret: <your-secret>" -o test.png
```

### Memory ⚠️

The Fly default (256 MB) **will OOM Chromium**. `fly.toml` is already set to `1gb`. Do not scale down below 512 MB, and if you use 512 MB set `MAX_CONCURRENCY=1`.

### CI/CD (GitHub Actions)

Add your Fly token as a repo secret:

```bash
fly tokens create deploy
# → paste into GitHub → Settings → Secrets → FLY_API_TOKEN
```

The CI workflow (`.github/workflows/ci.yml`) runs typecheck + tests on every push/PR and auto-deploys `main` to Fly.

## Configuration

All settings are read from environment variables. See [`.env.example`](.env.example) for the full list with defaults and descriptions.

## Listing on RapidAPI

1. Create a [RapidAPI provider](https://rapidapi.com/provider) account
2. Add an API → set the base URL to your Fly app URL
3. Paste the value of `PROXY_SECRET` into the RapidAPI "proxy secret" field
4. Define tiers — screenshot APIs on RapidAPI cluster around:
   - Free: 100 req/mo
   - Basic: $9.99 → 2,500 req/mo
   - Pro: $29.99 → 15,000 req/mo
   - Ultra: $99 → 75,000 req/mo
5. Bump `min_machines_running = 1` in `fly.toml` once listed (cold-start hurts marketplace ratings)

## Roadmap

### Phase 1 — Production hardening *(this release)*
- [x] Rate limiting with RapidAPI-aware key
- [x] Proxy-secret auth (prevents billing bypass)
- [x] Concurrency cap + queue-depth 503
- [x] Structured JSON logging (pino)
- [x] Graceful shutdown (SIGTERM drain)
- [x] `/health` endpoint
- [x] Dockerfile + Fly.io config
- [x] GitHub Actions CI with Playwright container
- [x] Smoke tests (SSRF regression, auth, real capture)

### Phase 2 — Own billing *(after marketplace demand is proven)*
- [ ] API key issuance + auth middleware
- [ ] Usage metering (Postgres or Fly-hosted SQLite)
- [ ] Stripe metered billing + webhooks
- [ ] Minimal customer dashboard (key management, usage graphs)

### Phase 3 — Scale
- [ ] Result caching (S3-compatible, signed URLs)
- [ ] Webhook / async capture (POST → callback URL)
- [ ] Multi-A-record SSRF hardening (resolve all records, not just first)
