# Claude Code with GUI

このドキュメントは[English](../README.md) READMEの日本語訳です。

🌐 [English](../README.md) | [한국어](README.ko.md) | **日本語** | [中文](README.zh.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md)

---

Cursor と VS Code で使っているのと同じ Claude Code GUI が、JetBrains IDE で利用できるようになりました。

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## 概要

**Claude Code with GUI** は、Cursor および VS Code の Claude Code プラグインと同等の UI/UX を JetBrains IDE に提供することを目標としています。

- JetBrains では、Claude Code はまだターミナルでのみ利用可能です。しかし、ターミナルよりも IDE ネイティブな体験の方が優れています。
- JetBrains 用の他の Claude Code GUI プラグインは、元の Claude Code for VS Code UI/UX から大きく外れています。
- さらに、急速に進化している Claude Code 体験（例：Agent Team、Remote Control）を GUI として提供することで、開発者がターミナルなしで最新機能を使い続けられるようにすることが目標です。
- **Claude Code 以外のモデルについては？** ユーザーがオプトインで他のローカルモデルやコミュニティモデルをプラグインできるようにするのは素晴らしいことです。
- **JetBrains 以外の環境については？** Remote Control を視野に入れて、クライアントはブラウザ対応アプリケーションとして構築されています。これが、最終的には Claude Code クライアント体験全体をサポートするための正しいアプローチだと考えています。

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat interface" width="800" />
</p>

## 機能

### ストリーミングチャット

- リアルタイム Markdown レンダリングと構文ハイライト
- Claude の思考プロセスをリアルタイムで表示

### ツール呼び出しカード

- ファイルの読み書き、bash コマンド、検索結果の視覚的カード
- Cursor と VS Code の体験と一致したプレゼンテーション

### Diff レビュー

- Claude が提案した変更内容を正確に示すインラインdiffカード
- 変更ごとの適用/却下アクション（ワンクリック）

### 権限管理

- ファイルと bash オペレーション権限用のネイティブダイアログ
- 設定で柔軟な権限ポリシーを構成

### 複数セッション

- タブサポートで複数の会話を同時に管理
- セッションドロップダウンでアクティブセッション間の高速切り替え
- セッション履歴全体を閲覧

### 設定

- CLI パス、テーマ、フォントサイズ、権限ポリシー、ログレベルを構成

<details>
<summary>その他のスクリーンショット</summary>

| ウェルカムスクリーン | 設定パネル |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Welcome screen" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Settings panel" width="400" /> |

</details>

## 必要な環境

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0、インストール済みで認証済み
- Node.js >= 18

## クイックスタート

1. `claude` CLI がインストールされ、認証されていることを確認してください（`claude --version`）。
2. JetBrains Marketplace からプラグインをインストールします。
3. **Tools > Open Claude Code** からパネルを開くか、`Ctrl+Shift+C` を押します。
4. Claude とコーディングを開始します。

| アクション | ショートカット |
|---|---|
| Claude Code パネルを開く | `Ctrl+Shift+C` |
| 新規セッションタブ | `Cmd+N` / `Ctrl+N`（パネルフォーカス時） |

---

## 変更履歴

完全なバージョン履歴については、[CHANGELOG.md](../CHANGELOG.md) を参照してください。

## 貢献

貢献を歓迎します。大きな変更の場合は、まずイシューを開いて議論してください。

## ライセンス

このプロジェクトは [GNU Affero General Public License v3.0](../LICENSE) の下でライセンスされています。
