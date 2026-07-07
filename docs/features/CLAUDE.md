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
- [Native rendering for JetBrains IDE MCP tools](./007-jetbrains_mcp_native_rendering/en.md) — IDE 내장 MCP 도구(`mcp__idea__…` 등) 호출을 raw JSON 대신 전용 채팅 카드로 렌더링하고, `file:line` 이동·인간화된 권한 다이얼로그·중립 declined 상태·프로젝트 확인 칩·정직한 상태 점을 제공하는 기능 ([#147](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/147))
- [Usage breakdown in the account modal](./008-usage_report/en.md) — `/usage`를 사용량 모달로 연결하고, `claude -p "/usage"`의 상세 분석(기간별 요청/세션 수·인사이트·상위 skills/subagents/plugins/MCP)을 커서처럼 UI로 렌더링. 계정 전환에 반응 ([#148](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/148))
- [Interface Language (UI translations)](./009-interface_language_i18n/en.md) — GUI 전체를 10개 언어로 번역하고, Claude 응답 언어(자유 텍스트)와 분리된 "Interface Language" 설정을 신설. 중국어 간체/번체 분리, 현지어 라벨, 컨트리뷰터용 `add-locale` 스킬 포함 ([#141](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/141), [#160](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/160))
- [RTL (right-to-left) language support](./010-rtl_support/en.md) — 설정 → General에 "RTL(Right-to-left) 켜기" 토글을 추가해 화면 전체를 오른쪽 기준으로 미러링하고, 인터페이스 언어에 فارسی(페르시아어)·العربية(아랍어)를 추가. 언어를 RTL 언어로 바꾸면 자동으로 켜지되(그 반대도) 이후엔 수동 조작 가능, 코드/터미널 출력/수식은 항상 LTR로 보존 ([#158](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/158))

