import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { SsrfBlockedError } from './ssrf.ts'
import {
  capturePdf,
  captureScreenshot,
  closeBrowser,
  describePage,
} from './capture.ts'

// ── MCP server ─────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'screenshot-api',
  version: '1.0.0',
})

server.registerTool(
  'take_screenshot',
  {
    title: 'Take Screenshot',
    description:
      'Capture a public URL and return it as an image. ' +
      'Use this to visually inspect a live webpage, verify a deployment, ' +
      'check UI layout, or capture evidence of page content.',
    inputSchema: {
      url: z.string().url().describe('The public URL to capture (http/https only)'),
      format: z.enum(['png', 'jpeg']).default('png').describe('Image format'),
      width: z.number().int().min(320).max(3840).default(1280).describe('Viewport width in pixels'),
      full_page: z.boolean().default(false).describe('Capture the full scrollable page, not just the visible viewport'),
    },
  },
  async ({ url, format, width, full_page }) => {
    try {
      const start = Date.now()
      const { data, mime } = await captureScreenshot({
        url,
        format,
        width,
        height: 800,
        fullPage: full_page,
      })
      const elapsed = Date.now() - start

      return {
        content: [
          {
            type: 'image' as const,
            data: data.toString('base64'),
            mimeType: mime,
          },
          {
            type: 'text' as const,
            text: `Captured ${url} in ${elapsed}ms (${width}px wide, full_page=${full_page})`,
          },
        ],
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true }
      }
      throw err
    }
  }
)

server.registerTool(
  'describe_page',
  {
    title: 'Describe Page',
    description:
      'Screenshot a URL and extract key text metadata (title, heading, meta description) ' +
      'in a single call. Returns both the visual screenshot and structured text so you can ' +
      'understand what a page is about without a separate vision pass.',
    inputSchema: {
      url: z.string().url().describe('The public URL to inspect'),
      width: z.number().int().min(320).max(3840).default(1280).describe('Viewport width in pixels'),
    },
  },
  async ({ url, width }) => {
    try {
      const { title, h1, metaDesc, screenshot } = await describePage({ url, width })

      const summary = [
        `URL: ${url}`,
        `Title: ${title || '(none)'}`,
        `H1: ${h1 || '(none)'}`,
        `Meta description: ${metaDesc || '(none)'}`,
      ].join('\n')

      return {
        content: [
          { type: 'text' as const, text: summary },
          { type: 'image' as const, data: screenshot.toString('base64'), mimeType: 'image/png' },
        ],
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true }
      }
      throw err
    }
  }
)

server.registerTool(
  'capture_pdf',
  {
    title: 'Capture Page as PDF',
    description: 'Render a public URL as an A4 PDF. Useful for archiving, reports, or printing.',
    inputSchema: {
      url: z.string().url().describe('The public URL to render as PDF'),
    },
  },
  async ({ url }) => {
    try {
      const { data } = await capturePdf({ url })

      return {
        content: [
          { type: 'text' as const, text: `PDF captured for ${url} (${(data.length / 1024).toFixed(1)} KB)` },
          // PDF returned as base64 resource — agents can save or pass it along
          {
            type: 'resource' as const,
            resource: {
              uri: `data:application/pdf;base64,${data.toString('base64')}`,
              mimeType: 'application/pdf',
              text: `PDF of ${url}`,
            },
          },
        ],
      }
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true }
      }
      throw err
    }
  }
)

// ── Startup ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()

process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0) })
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0) })

await server.connect(transport)
