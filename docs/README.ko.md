# Claude Code with GUI

Cursor와 VS Code에서 사랑받는 Claude Code GUI를 이제 JetBrains IDE에서도 사용할 수 있습니다.

> 이 문서는 [English](../README.md) README의 한국어 번역입니다.

🌐 [English](../README.md) | **한국어** | [日本語](README.ja.md) | [中文](README.zh.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md)

---

[![JetBrains Marketplace](https://img.shields.io/jetbrains/plugin/v/30313?label=Marketplace)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
[![Downloads](https://img.shields.io/jetbrains/plugin/d/30313?label=Downloads)](https://plugins.jetbrains.com/plugin/30313-claude-code-with-gui)
![JetBrains IDE](https://img.shields.io/badge/JetBrains%20IDE-2024.2%2B-000000?logo=jetbrains)
![Claude Code](https://img.shields.io/badge/Claude%20Code%20CLI-%3E%3D1.0.0-blueviolet)

---

## 개요

**Claude Code with GUI**는 Cursor와 VS Code의 Claude Code 플러그인과 동일한 수준의 UI/UX를 JetBrains IDE에 제공하는 것을 목표로 합니다.

> **이 프로젝트는 다른 프로젝트의 복제품이 아닙니다.** 모든 소스코드는 자체적인 설계를 통해 처음부터 완전히 직접 작성되었습니다.
>
> **이 플러그인은 Claude Code CLI를 spawn하는 래퍼로서 동작합니다.** 이는 공식 Claude Code for VS Code 확장 프로그램과 동일한 방식입니다.
>
> 지금은 서비스를 안정화하는 데 많은 노력을 들이고 있습니다. 오류를 제보해주시면, 평균 1일 이내로 해결하고 있으니 많은 제보 바랍니다.
>
> 이 프로젝트는 글로벌 사용자와 함께 성장하고 싶습니다. 가능한 많은 개발자의 협업 가능성을 위하여, 공식 공용언어로 **영어**를 채택합니다. 그 이외에 특정 국가의 언어에 편향된 생태계를 구성하려는 어떠한 시도도 거절합니다.

- JetBrains에서 Claude Code는 여전히 터미널에서만 사용 가능합니다. 하지만 저는 터미널보다 IDE 네이티브 환경을 선호합니다.
- JetBrains용 다른 Claude Code GUI 플러그인들은 원본 VS Code UI/UX에서 너무 멀어졌습니다.
- 그 외에도, 급속하게 진화하는 Claude Code 경험(예: Agent Team, Remote Control)을 GUI로 제공하여 개발자들이 터미널 없이도 최신 기능을 이용할 수 있도록 하는 것이 목표입니다.
- **Claude Code 이외의 모델은 어떻게 되나요?** 사용자가 선택적으로 다른 로컬 또는 커뮤니티 모델을 플러그인으로 추가할 수 있으면 좋을 것 같습니다.
- **JetBrains 이외의 환경은 어떻게 되나요?** Remote Control을 염두에 두고, 클라이언트는 브라우저 호환 애플리케이션으로 구축되었습니다. 이는 궁극적으로 완전한 Claude Code 클라이언트 경험을 지원하는 올바른 접근 방식이라고 생각합니다.

<p align="center">
  <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-chat.png" alt="Chat interface" width="800" />
</p>

## 기능

### 스트리밍 채팅

- 실시간 Markdown 렌더링 및 문법 강조 표시
- Claude의 사고 과정이 전개되는 과정을 표시

### 도구 호출 카드

- 파일 읽기/쓰기, Bash 명령어, 검색 결과에 대한 시각적 카드
- Cursor와 VS Code 경험과 일치하는 일관된 표현

### Diff 검토

- Claude가 변경하려는 내용을 정확히 보여주는 인라인 Diff 카드
- 변경 사항별 원클릭 적용/거절 작업

### 권한 관리

- 파일 및 Bash 작업 권한에 대한 네이티브 대화상자
- 설정에서 유연한 권한 정책 구성

### 다중 세션

- 탭 지원으로 여러 대화를 동시에 관리
- 활성 세션 간 빠른 전환을 위한 세션 드롭다운
- 전체 세션 히스토리 조회

### 설정

- CLI 경로, 테마, 글꼴 크기, 권한 정책, 로그 수준 구성

<details>
<summary>추가 스크린샷</summary>

| 환영 화면 | 설정 패널 |
|---|---|
| <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-welcome.png" alt="Welcome screen" width="400" /> | <img src="https://raw.githubusercontent.com/yhk1038/claude-code-gui-jetbrains/main/docs/img/screenshot-settings.png" alt="Settings panel" width="400" /> |

</details>

## 요구 사항

- JetBrains IDE 2024.2 — 2025.3
- Claude Code CLI >= 1.0.0 (설치되고 인증됨)
- Node.js >= 18

## 빠른 시작

1. `claude` CLI가 설치되고 인증되었는지 확인합니다 (`claude --version`).
2. JetBrains Marketplace에서 플러그인을 설치합니다.
3. **Tools > Open Claude Code**를 통해 패널을 열거나 `Ctrl+Shift+C`를 누릅니다.
4. Claude와 함께 코딩을 시작합니다.

| 작업 | 단축키 |
|---|---|
| Claude Code 패널 열기 | `Ctrl+Shift+C` |
| 새 세션 탭 | `Cmd+N` / `Ctrl+N` (패널 포커스) |

---

## 변경 로그

전체 버전 이력은 [CHANGELOG.md](../CHANGELOG.md)를 참조하세요.

## 기여

기여는 환영합니다. 더 큰 변경 사항의 경우 먼저 이슈를 열어 논의해 주세요.

## 라이선스

이 프로젝트는 [GNU Affero General Public License v3.0](../LICENSE) 하에 라이선스되었습니다.
