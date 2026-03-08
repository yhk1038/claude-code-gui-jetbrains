# Claude Code mit GUI

Die gleiche Claude Code GUI, die Sie in Cursor und VS Code lieben, jetzt auch in JetBrains IDEs verfügbar.

> Dieses Dokument ist eine deutsche Übersetzung der [englischen README](../README.md).

🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | **Deutsch** | [Français](README.fr.md)

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## Übersicht

**Claude Code mit GUI** zielt darauf ab, das gleiche Maß an UI/UX wie das Claude Code Plugin in Cursor und VS Code in JetBrains IDEs zu bringen.

- In JetBrains ist Claude Code nur als Terminal verfügbar. Ich bevorzuge jedoch eine IDE-native Erfahrung gegenüber dem Terminal.
- Andere Claude Code GUI Plugins für JetBrains sind zu weit von der ursprünglichen Claude Code für VS Code UI/UX abgewichen.
- Darüber hinaus ist das Ziel, die sich schnell weiterentwickelnde Claude Code Erfahrung (z. B. Agent Team, Remote Control) als GUI bereitzustellen — damit Entwickler ohne Terminal auf den neuesten Funktionen bleiben können.
- **Was ist mit anderen Modellen als Claude Code?** Es wäre großartig, wenn Benutzer optional andere lokale oder Community-Modelle als optionale Einstellung einbinden könnten.
- **Was ist mit Umgebungen jenseits von JetBrains?** Mit Remote Control im Hinterkopf ist der Client als browserfähige Anwendung gebaut. Ich glaube, dies ist der richtige Weg, um letztendlich die vollständige Claude Code Client-Erfahrung zu unterstützen.

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat-Schnittstelle" width="800" />
</p>

## Funktionen

### Streaming-Chat

- Echtzeit-Markdown-Rendering mit Syntax-Hervorhebung
- Zeigt Claude's Denkprozess bei der Entfaltung an

### Tool-Call-Karten

- Visuelle Karten für Dateizugriffe/Schreibvorgänge, Bash-Befehle und Suchergebnisse
- Konsistente Präsentation, die der Cursor- und VS Code-Erfahrung entspricht

### Diff-Überprüfung

- Inline-Diff-Karten, die genau zeigen, welche Änderungen Claude vorschlägt
- One-Click Apply / Reject Aktionen pro Änderung

### Berechtigungsverwaltung

- Native Dialoge für Datei- und Bash-Operationsberechtigungen
- Flexible Berechtigungsrichtlinienkonfiguration in den Einstellungen

### Mehrere Sitzungen

- Verwalten Sie mehrere Gespräche gleichzeitig mit Registerkarten-Unterstützung
- Sitzungs-Dropdown für schnelles Wechseln zwischen aktiven Sitzungen
- Durchsuchen Sie den vollständigen Sitzungsverlauf

### Einstellungen

- Konfigurieren Sie CLI-Pfad, Design, Schriftgröße, Berechtigungsrichtlinie und Protokollierungsstufe

<details>
<summary>Weitere Screenshots</summary>

| Willkommensbildschirm | Einstellungsbereich |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Willkommensbildschirm" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Einstellungsbereich" width="400" /> |

</details>

## Anforderungen

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0, installiert und authentifiziert
- Node.js >= 18

## Schnellstart

1. Überprüfen Sie, ob `claude` CLI installiert und authentifiziert ist (`claude --version`).
2. Installieren Sie das Plugin aus dem JetBrains Marketplace.
3. Öffnen Sie das Panel über **Tools > Open Claude Code** oder drücken Sie `Ctrl+Shift+C`.
4. Beginnen Sie mit Claude zu programmieren.

| Aktion | Tastenkombination |
|---|---|
| Claude Code Panel öffnen | `Ctrl+Shift+C` |
| Neue Sitzungs-Registerkarte | `Cmd+N` / `Ctrl+N` (Panel fokussiert) |

---

## Änderungsprotokoll

Siehe [CHANGELOG.md](../CHANGELOG.md) für den vollständigen Versionsverlauf.

## Beitragen

Beiträge sind willkommen. Bitte eröffnen Sie zunächst ein Issue, um größere Änderungen zu diskutieren.

## Lizenz

Dieses Projekt ist unter der [GNU Affero General Public License v3.0](../LICENSE) lizenziert.
