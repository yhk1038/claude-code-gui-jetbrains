# MCP 서버 관리

> Languages: **한국어** · [English](./en.md)
>
> Related: [PR #135](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/135)

## 새로운 기능

이제 **터미널 없이 GUI에서 MCP 서버를 조회·추가·제거·활성화/비활성화·재연결**할 수 있습니다. 슬래시 커맨드 팔레트에서 `/MCP Servers`를 입력하거나 Customize 섹션의 **MCP Servers** 항목을 클릭하면 패널이 열립니다.

## 기능 상세

### 서버 목록

서버는 scope(Project → Local → User → claude.ai) 순으로 그룹화되고, 각 그룹 내에서 알파벳 순으로 정렬됩니다. 각 카드에는 다음이 표시됩니다.

- **서버 이름** (고정폭 폰트)
- **상태 배지** — solid pill 색상 구분:
  - 초록 "✓ Connected"
  - 빨강 "✗ Failed"
  - 노랑 "Needs auth"
  - 회색 텍스트 "Pending" / "Disabled" (배지 없음)

### 상세 화면

서버 카드를 클릭하면 상세 화면으로 이동합니다.

- **에러 박스** — 연결 실패(Failed) 또는 인증 필요(Needs auth) 상태일 때 서버명 위에 표시됩니다. SSE/HTTP 타입 서버는 GUI가 해당 URL로 직접 연결을 시도해 실제 네트워크 에러(예: "connection refused")를 표시합니다.
- **액션 버튼** (우선순위 순서):
  1. **Authenticate** (파란 CTA 버튼) — OAuth를 지원하는 서버가 실패하거나 인증이 필요할 때 표시됩니다.
  2. **Reconnect** — `claude mcp get <name>`을 재실행해 새로운 연결을 시도합니다. 재연결 중에는 버튼 텍스트가 "Reconnecting"으로 바뀌고 다른 버튼은 비활성화됩니다.
  3. **Clear authentication** — 연결된 OAuth 서버(claude.ai 프록시 제외)에서 인증 정보를 초기화합니다.
  4. **Enable / Disable** — 서버 설정을 제거하지 않고 `disabledMcpServers`에서 토글합니다.
- **Remove server** — 확인 후 `claude mcp remove`를 실행합니다.

### 서버 추가

모달 헤더의 **+** 버튼을 클릭하면 추가 폼이 열립니다. 이름, 전송 타입(stdio / http / sse), 커맨드/URL, 선택적 인수와 환경변수, scope(user / project / local)를 입력하고 제출하면 `claude mcp add-json`으로 등록됩니다.

### 사전 로드 및 캐싱

채팅 페이지가 마운트되는 즉시 서버 목록을 가져옵니다(React Query, `staleTime: 0`, `gcTime: 5분`). 덕분에 모달을 처음 열어도 로딩 스피너 없이 바로 목록이 표시됩니다.

## 구현 노트

- 모든 데이터는 **`claude mcp list`**(상태 확인 + 이름 목록)와 **`claude mcp get <name>`**(서버별 설정 상세)에서 가져옵니다. 비공개 내부 프로토콜은 사용하지 않습니다.
- SSE/HTTP 에러 보강: 서버가 실패 상태일 때 백엔드가 해당 URL로 5초 타임아웃 `fetch` 탐침을 보내, 일반 상태 텍스트 대신 실제 네트워크 에러를 표시합니다.
- Disabled 서버는 `~/.claude.json → disabledMcpServers`에서 읽어옵니다. CLI의 `mcp list`에는 표시되지 않습니다.
- IPC 메시지 타입은 공유 `MessageType` enum에 정의됩니다(`GET_MCP_SERVERS`, `RECONNECT_MCP_SERVER`, `AUTHENTICATE_MCP_SERVER`, `CLEAR_MCP_SERVER_AUTH`, `SET_MCP_SERVER_ENABLED`, `ADD_MCP_SERVER`, `REMOVE_MCP_SERVER`).
