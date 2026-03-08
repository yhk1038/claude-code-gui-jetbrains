# Claude Code with GUI

Ce document est une traduction française du [README en anglais](../README.md).

🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Deutsch](README.de.md) | **Français**

---

La même interface Claude Code GUI que vous adorez dans Cursor et VS Code, maintenant disponible dans les IDEs JetBrains.

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## Aperçu

**Claude Code with GUI** vise à apporter le même niveau de UI/UX que le plugin Claude Code dans Cursor et VS Code aux IDEs JetBrains.

- Dans JetBrains, Claude Code n'est encore disponible que comme terminal. Mais je préfère toujours une expérience native de l'IDE au terminal.
- D'autres plugins Claude Code GUI pour JetBrains se sont trop éloignés de l'expérience originale de Claude Code pour VS Code UI/UX.
- Au-delà de cela, l'objectif est de livrer l'expérience Claude Code en évolution rapide (par exemple, Agent Team, Remote Control) en tant que GUI — afin que les développeurs puissent rester à jour avec les dernières fonctionnalités sans terminal.
- **Qu'en est-il des modèles autres que Claude Code ?** Il serait formidable que les utilisateurs puissent opter pour injecter d'autres modèles locaux ou communautaires en tant que paramètre opt-in.
- **Qu'en est-il des environnements au-delà de JetBrains ?** En pensant à Remote Control, le client est construit comme une application compatible avec le navigateur. Je crois que c'est la bonne approche pour soutenir finalement l'expérience client Claude Code complète.

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Interface de chat" width="800" />
</p>

## Fonctionnalités

### Chat en temps réel

- Rendu Markdown en temps réel avec coloration syntaxique
- Affiche le processus de réflexion de Claude au fur et à mesure qu'il se déploie

### Cartes d'appels d'outils

- Cartes visuelles pour les lectures/écritures de fichiers, commandes bash et résultats de recherche
- Présentation cohérente correspondant à l'expérience Cursor et VS Code

### Examen des différences

- Cartes de différence en ligne montrant exactement ce que Claude propose de modifier
- Actions Appliquer / Rejeter en un clic par modification

### Gestion des permissions

- Dialogues natifs pour les permissions d'accès aux fichiers et opérations bash
- Configuration flexible de la politique de permissions dans les paramètres

### Sessions multiples

- Gérer plusieurs conversations simultanément avec support des onglets
- Dropdown de session pour basculer rapidement entre les sessions actives
- Parcourir l'historique complet des sessions

### Paramètres

- Configurez le chemin CLI, le thème, la taille de la police, la politique de permissions et le niveau de journalisation

<details>
<summary>Plus de captures d'écran</summary>

| Écran de bienvenue | Panneau des paramètres |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Écran de bienvenue" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Panneau des paramètres" width="400" /> |

</details>

## Prérequis

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0, installé et authentifié
- Node.js >= 18

## Démarrage rapide

1. Vérifiez que le CLI `claude` est installé et authentifié (`claude --version`).
2. Installez le plugin depuis la Marketplace JetBrains.
3. Ouvrez le panneau via **Tools > Open Claude Code** ou appuyez sur `Ctrl+Shift+C`.
4. Commencez à coder avec Claude.

| Action | Raccourci |
|---|---|
| Ouvrir le panneau Claude Code | `Ctrl+Shift+C` |
| Nouvel onglet de session | `Cmd+N` / `Ctrl+N` (panneau en focus) |

---

## Historique des modifications

Consultez [CHANGELOG.md](../CHANGELOG.md) pour l'historique complet des versions.

## Contribution

Les contributions sont bienvenues. Veuillez d'abord ouvrir une issue pour discuter des changements plus importants.

## Licence

Ce projet est concédé sous la [Licence Publique Générale Affero GNU v3.0](../LICENSE).
