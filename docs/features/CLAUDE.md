# 기능 문서 색인 (Feature Docs Index)

이 폴더는 사용자를 독자로 한 **기능 설명서**들을 모아둔다. 작성 규칙은 [docs/CLAUDE.md](../CLAUDE.md)를 따른다.

각 기능은 `NNN-feature_name/` 폴더로 관리하며, 폴더 안에 언어별 번역본(`en.md`, `ko.md`, …)을 둔다.

## 색인

- [Editor Context Tag](./001-editor_context_tag/en.md) — 에디터에서 연 파일이나 선택한 코드를 자동으로 채팅 컨텍스트로 첨부하는 토글 태그 ([#122](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/122), [#133](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/133))
- [Multi-Account Management](./002-multi_account_management/en.md) — 여러 Claude 계정을 저장하고 전환하며, 계정별 사용량을 한 화면에서 비교하는 멀티 계정 기능 ([#134](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/134))
- [MCP Server Management](./003-mcp_server_management/en.md) — GUI에서 MCP 서버를 조회·추가·편집·제거·활성화·재연결하는 MCP 서버 관리 패널 ([#136](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/136))
- [Settings Overlay](./004-settings_overlay/en.md) — 설정을 현재 채팅 위 오버레이로 열어 진행 중인 세션을 잃지 않게 하고, 여는 방식(오버레이/새 탭)을 선택할 수 있는 기능 ([#137](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/137))
- [Claude Code CLI Version & Update](./005-cli_version_update/en.md) — 설치된 CLI 버전을 확인하고, 설치 방식(npm/pnpm/yarn/volta/native/homebrew/winget)에 맞는 공식 명령으로 GUI에서 바로 업데이트하는 기능 ([#150](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/150))
- [Effort & Fast Mode](./006-effort_and_fast_mode/en.md) — 모델별로 추론 깊이(Effort 슬라이더·Ultracode)와 빠른 출력(Fast mode)을 조절하는 Model 섹션 컨트롤. 지원하지 않는 모델에서는 숨기지 않고 비활성+툴팁으로 안내 ([#121](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/121), [#152](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/152))
