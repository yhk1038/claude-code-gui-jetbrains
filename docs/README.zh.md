# Claude Code with GUI

本文档是[English](../README.md)README的中文翻译。

🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | **中文** | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md)

---

在 Cursor 和 VS Code 中您喜爱的 Claude Code GUI，现已在 JetBrains IDE 中推出。

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## 概述

**Claude Code with GUI** 旨在为 JetBrains IDE 提供与 Cursor 和 VS Code 中 Claude Code 插件相同级别的 UI/UX 体验。

- 在 JetBrains 中，Claude Code 仍然只能通过终端使用。但我更倾向于 IDE 原生体验而不是终端。
- 其他用于 JetBrains 的 Claude Code GUI 插件已经偏离了原始 VS Code UI/UX 太远。
- 除此之外，目标是以 GUI 形式提供快速演进的 Claude Code 体验（例如 Agent Team、Remote Control）—— 这样开发者无需使用终端即可保持最新功能。
- **如何处理 Claude Code 之外的模型？** 如果用户可以选择将其他本地或社区模型作为可选设置插入会很不错。
- **超越 JetBrains 的环境呢？** 考虑到 Remote Control，客户端被构建为一个支持浏览器的应用程序。我认为这是最终支持完整 Claude Code 客户端体验的正确方法。

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat interface" width="800" />
</p>

## 功能

### 流式聊天

- 具有语法突出显示的实时 Markdown 渲染
- 显示 Claude 思考过程的实时展现

### 工具调用卡片

- 用于文件读写、bash 命令和搜索结果的可视化卡片
- 与 Cursor 和 VS Code 体验一致的呈现方式

### Diff 审查

- 内联 diff 卡片，准确显示 Claude 提议的变更
- 每个变更支持一键应用 / 拒绝操作

### 权限管理

- 用于文件和 bash 操作权限的原生对话框
- 在设置中灵活配置权限策略

### 多个会话

- 支持标签页同时管理多个对话
- 会话下拉菜单可快速切换活跃会话
- 浏览完整会话历史

### 设置

- 配置 CLI 路径、主题、字体大小、权限策略和日志级别

<details>
<summary>更多截图</summary>

| 欢迎屏幕 | 设置面板 |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Welcome screen" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Settings panel" width="400" /> |

</details>

## 系统要求

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0，已安装并通过身份验证
- Node.js >= 18

## 快速开始

1. 验证 `claude` CLI 已安装并通过身份验证（`claude --version`）。
2. 从 JetBrains Marketplace 安装插件。
3. 通过 **Tools > Open Claude Code** 或按下 `Ctrl+Shift+C` 打开面板。
4. 开始使用 Claude 编码。

| 操作 | 快捷键 |
|---|---|
| 打开 Claude Code 面板 | `Ctrl+Shift+C` |
| 新建会话标签页 | `Cmd+N` / `Ctrl+N`（面板聚焦时） |

---

## 更新日志

完整版本历史请参阅 [CHANGELOG.md](../CHANGELOG.md)。

## 贡献

欢迎贡献。请先提交 issue 讨论较大的更改。

## 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 许可证。
