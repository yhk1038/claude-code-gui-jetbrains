# MCP Server Management

> Languages: [한국어](./ko.md) · **English**
>
> Related: [PR #135](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/135)

## What's new

You can now **view, add, remove, enable, disable, and reconnect MCP servers directly from the GUI** — no terminal required. Type `/MCP Servers` in the slash-command palette (or click the **MCP Servers** item under Customize) to open the panel.

## Features

### Server list

Servers are grouped by scope (Project → Local → User → claude.ai) and sorted alphabetically within each group. Each card shows:

- **Server name** (monospace)
- **Status badge** — solid-pill colour coding:
  - Green "✓ Connected"
  - Red "✗ Failed"
  - Yellow "Needs auth"
  - Grey text "Pending" / "Disabled" (no badge)

### Detail view

Click any server card to open its detail screen:

- **Error box** — displayed above the server name when the server is in a failed or auth-required state. For SSE / HTTP servers, the GUI probes the endpoint directly and surfaces the real network error (e.g. "connection refused") instead of the generic "Failed to connect".
- **Action buttons** (in priority order):
  1. **Authenticate** (primary / blue CTA) — visible when the server supports OAuth and is failed or needs-auth.
  2. **Reconnect** — re-runs `claude mcp get <name>` to attempt a fresh connection. While reconnecting the button shows "Reconnecting" and all other buttons are disabled.
  3. **Clear authentication** — visible for connected OAuth servers (except claude.ai proxy).
  4. **Enable / Disable** — toggles the server in `disabledMcpServers` without removing its config.
- **Remove server** — confirms before calling `claude mcp remove`.

### Add server

Click **+** in the modal header to open the add form. Fill in name, transport type (stdio / http / sse), command / URL, optional args and env vars, and scope (user / project / local). Submits via `claude mcp add-json`.

### Pre-fetch & caching

The server list is fetched as soon as the chat page mounts (React Query, `staleTime: 0`, `gcTime: 5 min`), so opening the modal for the first time shows data immediately instead of a loading spinner.

## Implementation notes

- All data comes from **`claude mcp list`** (health-check + name enumeration) and **`claude mcp get <name>`** (full config per server) — no undocumented internal protocols.
- SSE / HTTP error enrichment: when a server is failed, the backend makes a 5-second `fetch` probe to the server URL and replaces the generic status text with the actual network error.
- Disabled servers are sourced from `~/.claude.json → disabledMcpServers`; the CLI does not report them in `mcp list`.
- IPC message types live in the shared `MessageType` enum (`GET_MCP_SERVERS`, `RECONNECT_MCP_SERVER`, `AUTHENTICATE_MCP_SERVER`, `CLEAR_MCP_SERVER_AUTH`, `SET_MCP_SERVER_ENABLED`, `ADD_MCP_SERVER`, `REMOVE_MCP_SERVER`).
