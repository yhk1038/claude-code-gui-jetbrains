# Context usage in chat

> Languages: **English** · [한국어](./ko.md)
>
> Related: [#196](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/196), [#198](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/198)

## What's new

Typing `/context` used to show nothing in the chat — the response was lost
somewhere between arrival and render (issue #196). Now the command works, and
you get the **context usage card**: a visual breakdown of your token budget,
exactly like the terminal TUI you'd see from `claude -p "/context"`.

## What you see

When you type `/context` and press send, the chat displays:

- **Summary line**: model name, budget used (e.g., "28.2k / 1m tokens (3%)")
- **Category grid**: a color-coded breakdown by category — System prompt, System tools, Custom agents, Memory files, Skills, Messages, Free space — each bar colored by token depth
- **Color legend**: token count and percentage for each category
- **Detailed tables** (if present): Custom Agents, Memory, Skills, as before

Each cell shows its category on hover, and the grid scans much faster than reading raw text.

## How it works

- `/context` opens a local command handler (not sent to the CLI), which runs the
  official `claude --no-session-persistence -p "/context"` in the backend.
- The raw response (Markdown text with a table) is streamed to the UI. A small
  bug — incomplete response rendering when a command finishes abruptly — was
  fixed so the full output arrives.
- The UI parses the Markdown table and renders it as a color-coded grid. If
  parsing fails for any reason, the original Markdown falls back as-is.
- The card respects your theme (light / dark) and adapts to different window
  widths.

This ties `/context` into the GUI's own context awareness, matching the CLI
tool's openness — a step towards full CLI-equivalent functionality.
