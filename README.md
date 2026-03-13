# Claude Code with GUI

The same Claude Code GUI you love in Cursor and VS Code, now available in JetBrains IDEs.

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

🌐 **English** | [한국어](docs/README.ko.md) | [日本語](docs/README.ja.md) | [中文](docs/README.zh.md) | [Español](docs/README.es.md) | [Deutsch](docs/README.de.md) | [Français](docs/README.fr.md)

---

## Overview

**Claude Code with GUI** aims to bring the same level of UI/UX as the Claude Code plugin in Cursor and VS Code to JetBrains IDEs.

> **This project is not a clone of any other project.** All source code was designed and written entirely from scratch.
>
> **This plugin works as a wrapper that spawns the Claude Code CLI** — the same approach used by the official Claude Code for VS Code extension.
>
> We are currently putting significant effort into stabilizing the service. If you report a bug, we typically resolve it within 1 day on average. Your feedback and bug reports are greatly appreciated.
>
> This project aspires to grow alongside a global developer community. We adopt **English as the official common language** to maximize collaboration opportunities with as many developers as possible. We reject any attempt to build an ecosystem biased toward any particular national language.

- In JetBrains, Claude Code is still only available as a terminal. But I still prefer an IDE-native experience over the terminal.
- Other Claude Code GUI plugins for JetBrains have drifted too far from the original Claude Code for VS Code UI/UX.
- Beyond that, the goal is to deliver the rapidly evolving Claude Code experience (e.g., Agent Team, Remote Control) as a GUI — so developers can stay on the latest features without a terminal.
- **What about models other than Claude Code?** It would be great if users could optionally plug in other local or community models as an opt-in setting.
- **What about environments beyond JetBrains?** With Remote Control in mind, the client is built as a browser-capable application. I believe this is the right approach to ultimately support the full Claude Code client-side experience.

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat interface" width="800" />
</p>

## Features

### Streaming Chat

- Real-time Markdown rendering with syntax highlighting
- Displays Claude's thinking process as it unfolds

### Tool Call Cards

- Visual cards for file reads/writes, bash commands, and search results
- Consistent presentation matching the Cursor and VS Code experience

### Diff Review

- Inline diff cards showing exactly what Claude proposes to change
- One-click Apply / Reject actions per change

### Permission Management

- Native dialogs for file and bash operation permissions
- Flexible permission policy configuration in settings

### Multiple Sessions

- Manage multiple conversations simultaneously with tab support
- Session dropdown for fast switching between active sessions
- Browse full session history

### Settings

- Configure CLI path, theme, font size, permission policy, and log level

<details>
<summary>More screenshots</summary>

| Welcome screen | Settings panel |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Welcome screen" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Settings panel" width="400" /> |

</details>

## Requirements

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0, installed and authenticated
- Node.js >= 18

## Quick Start

1. Verify `claude` CLI is installed and authenticated (`claude --version`).
2. Install the plugin from the JetBrains Marketplace.
3. Open the panel via **Tools > Open Claude Code** or press `Ctrl+Shift+C`.
4. Start coding with Claude.

| Action | Shortcut |
|---|---|
| Open Claude Code panel | `Ctrl+Shift+C` |
| New session tab | `Cmd+N` / `Ctrl+N` (panel focused) |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

## Contributing

Contributions are welcome. Please open an issue first to discuss larger changes.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
