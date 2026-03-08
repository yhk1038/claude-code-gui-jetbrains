# Claude Code with GUI

La misma interfaz gráfica de Claude Code que amas en Cursor y VS Code, ahora disponible en IDEs de JetBrains.

> Este documento es una traducción al español del [README en inglés](../README.md).

🌐 [English](../README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [中文](README.zh.md) | **Español** | [Deutsch](README.de.md) | [Français](README.fr.md)

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## Descripción General

**Claude Code with GUI** tiene como objetivo traer el mismo nivel de interfaz de usuario y experiencia de usuario que el plugin Claude Code en Cursor y VS Code a los IDEs de JetBrains.

- En JetBrains, Claude Code sigue siendo solo una terminal. Pero aún prefiero una experiencia nativa del IDE sobre la terminal.
- Otros plugins de Claude Code GUI para JetBrains se han alejado demasiado de la interfaz original de Claude Code para VS Code.
- Más allá de eso, el objetivo es entregar la experiencia de Claude Code en rápida evolución (por ejemplo, Agent Team, Remote Control) como una interfaz gráfica, para que los desarrolladores puedan mantenerse al día con las características más recientes sin necesidad de terminal.
- **¿Qué hay de los modelos diferentes a Claude Code?** Sería genial si los usuarios pudieran opcionalmente conectar otros modelos locales o comunitarios como una configuración de inclusión voluntaria.
- **¿Qué hay de entornos más allá de JetBrains?** Teniendo en cuenta Remote Control, el cliente está construido como una aplicación compatible con navegador. Creo que este es el enfoque correcto para finalmente soportar la experiencia completa del cliente Claude Code.

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat interface" width="800" />
</p>

## Características

### Chat en Tiempo Real

- Renderizado en tiempo real de Markdown con resaltado de sintaxis
- Muestra el proceso de pensamiento de Claude a medida que se desarrolla

### Tarjetas de Llamadas de Herramientas

- Tarjetas visuales para lecturas/escrituras de archivos, comandos bash y resultados de búsqueda
- Presentación consistente que coincide con la experiencia de Cursor y VS Code

### Revisión de Cambios

- Tarjetas de cambios en línea mostrando exactamente lo que Claude propone modificar
- Acciones Aplicar / Rechazar de un clic por cambio

### Gestión de Permisos

- Diálogos nativos para permisos de operaciones de archivo y bash
- Configuración flexible de políticas de permisos en la configuración

### Múltiples Sesiones

- Administra múltiples conversaciones simultáneamente con soporte de pestañas
- Menú desplegable de sesiones para cambiar rápidamente entre sesiones activas
- Examina el historial completo de sesiones

### Configuración

- Configura la ruta de CLI, tema, tamaño de fuente, política de permisos y nivel de registro

<details>
<summary>Más capturas de pantalla</summary>

| Pantalla de bienvenida | Panel de configuración |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Welcome screen" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Settings panel" width="400" /> |

</details>

## Requisitos

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0, instalado y autenticado
- Node.js >= 18

## Inicio Rápido

1. Verifica que la CLI `claude` esté instalada y autenticada (`claude --version`).
2. Instala el plugin desde JetBrains Marketplace.
3. Abre el panel a través de **Tools > Open Claude Code** o presiona `Ctrl+Shift+C`.
4. Comienza a programar con Claude.

| Acción | Atajo |
|---|---|
| Abre el panel de Claude Code | `Ctrl+Shift+C` |
| Nueva pestaña de sesión | `Cmd+N` / `Ctrl+N` (panel enfocado) |

---

## Registro de Cambios

Consulta [CHANGELOG.md](../CHANGELOG.md) para el historial completo de versiones.

## Contribuciones

Las contribuciones son bienvenidas. Por favor abre un issue primero para discutir cambios más grandes.

## Licencia

Este proyecto está bajo licencia de la [GNU Affero General Public License v3.0](../LICENSE).
