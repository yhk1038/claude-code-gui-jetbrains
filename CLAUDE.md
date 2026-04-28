# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

JetBrains IDE용 Claude Code GUI 플러그인. Cursor의 Claude Code 확장과 동일한 UX를 JetBrains 환경에서 제공하는 것이 목표.

## 아키텍처

3개 레이어로 구성:

1. **Node.js Backend (유일한 백엔드)** - Claude Code CLI 실행, 세션/설정/파일 I/O, WebSocket 서버
2. **WebView UI** - 채팅/세션/diff 카드 UI, Cursor UX 동일 구현 (WebSocket으로 Node.js와 통신)
3. **Bridge (환경별 어댑터)** - BrowserBridge(브라우저) / KotlinBridge(JetBrains IDE 네이티브 API)

## 참고 저장소

구현 시 `idea-claude-code-gui` (GitHub) 저장소를 1차 기준으로 삼음. 우선순위: Cursor UX > 참고 저장소 > JetBrains 관행

## 기술 제약

- WebView는 JCEF 사용 (Swing UI 사용 금지, 권한 다이얼로그 예외)
- 에이전트 런타임은 IDE 외부 프로세스로 분리
- 이벤트 기반, 스트리밍 우선 설계

## 단일 백엔드 아키텍처

WebView는 클라이언트 실행환경에 관계없이 항상 Node.js 백엔드와 WebSocket으로 통신한다.

| 클라이언트 환경 | 부트스트랩 | 백엔드 | Bridge |
|----------------|-----------|--------|--------|
| 브라우저 | Vite dev server | Node.js WebSocket 서버 | BrowserBridge (no-op 등) |
| JetBrains IDE | Kotlin이 Node.js spawn → localhost:PORT | Node.js WebSocket 서버 | KotlinBridge (IDE API) |

**두 환경 모두 실제 제품이 동작하는 환경이다.** 브라우저 환경은 개발 전용이 아니며, 독립 배포 대상이다.

### 핵심 원칙

- **유일한 백엔드는 Node.js**: 비즈니스 로직(세션, 설정, Claude CLI, 파일 I/O)은 모두 Node.js에서 처리
- **Bridge는 ORM 어댑터**: 환경별로 반드시 달라야 하는 기능(에디터 탭, diff viewer 등)만 Bridge 인터페이스로 추상화
- **Kotlin은 Node.js 뒤에 있는 구현체**: WebView는 Kotlin과 직접 통신하지 않음. Node.js가 IDE 네이티브 기능이 필요할 때 Bridge(Kotlin)를 호출

### 코드 중복 금지

Node.js가 유일한 백엔드이므로, 비즈니스 로직의 듀얼 구현이 불필요하다. Kotlin에 비즈니스 로직을 구현하지 않는다.

## 원본 데이터 보존 원칙

Claude Code CLI가 생성하는 원본 자료구조(JSONL 엔트리, 세션 메타데이터 등)는 **WebView 끝단까지 구조를 그대로 유지**해야 한다.

### 규칙

1. **키/값 리네이밍 금지**: 원본 필드명을 중간 계층에서 다른 이름으로 바꾸지 않는다. (예: `title` → ~~`firstPrompt`~~, `createdAt` → ~~`created`~~)
2. **중간 필터링 금지**: 중간 전달 계층(Node.js 백엔드)이 원본 데이터를 필터링하거나 누락시키지 않는다. 필터링은 최종 소비자인 WebView에서 책임진다.
3. **정보 손실 금지**: 현재 UI에서 쓰지 않는 필드라도 전달 경로에서 제거하지 않는다. 향후 활용 가능성을 보존한다.
4. **데이터 형변환은 허용**: 언어 간 타입 매핑(예: JSON → Kotlin data class → JSON)은 허용하되, 이 과정에서 키 이름이나 구조가 변하면 안 된다.

### 이유

- 프로젝트가 아직 Claude Code의 원본 데이터를 전부 활용하지 못하고 있다. 중간 계층이 정보를 편집하면, 나중에 원본 구조를 다시 파악하는 데 불필요한 비용이 든다.
- **어느 계층에서든 데이터를 보면 "Claude Code 원본이 어떻게 생겼는지"를 알 수 있어야 하고, 그 내용을 신뢰할 수 있어야 한다.**

### 적용 범위

| 계층 | 역할 | 해도 되는 것 | 하면 안 되는 것 |
|------|------|-------------|---------------|
| Node.js 백엔드 (dev-bridge) | 원본 전달 | 타입 변환, 직렬화 | 필드 리네이밍, 필터링, 누락 |
| WebView (React) | 최종 소비 | 필터링, 정렬, 표시용 가공 | — |

## 일관된 작명 원칙 (Consistent Naming)

같은 목적과 같은 행동을 가리키는 이름은, 계층과 언어에 관계없이 **동일한 단어**를 일관되게 사용한다.

### 규칙

1. **하나의 행동에는 하나의 단어.** 메서드명, IPC 메시지 타입, 변수명, RPC 핸들러명 등 모든 곳에서 같은 동작이면 같은 verb를 쓴다. 파이프라인을 따라가며 읽을 때 단어가 바뀌면 다른 동작으로 오해한다. (예: ~~`create()` → `NEW_SESSION`~~ → `create()` → `CREATE_SESSION`)
2. **다른 행동에는 다른 단어.** "현재 탭에서 세션 초기화"와 "새 에디터 탭 열기"처럼 의미가 다른 동작이 같은 이름을 공유하면 안 된다.
3. **verb는 명확한 동사를 사용한다.** CRUD 동사(`create`, `get`, `update`, `delete`) 또는 명확한 행위 동사(`load`, `clear`, `open`, `stop`)를 쓴다. `new`, `change` 같은 모호한 단어는 피한다.

## 상태 머신

Idle → Streaming → Waiting Permission → Has Diff → Error

## UI 용어 정의

| 용어 | 설명 |
|------|------|
| **상단바** | 채팅 화면 상단의 새 탭 버튼과 세션 드롭다운 토글 버튼을 포함하는 영역 요소 |
| **세션 드롭다운 토글 버튼** | 상단바 좌측에 현재 세션의 제목을 표시하는 드롭다운 토글 버튼 |
| **세션 드롭다운** | 세션 드롭다운 토글 버튼을 클릭해 열리는 드롭다운 메뉴 |
| **새 탭 버튼** | 상단바 우측에 있는 플러스 버튼. 클릭 시 IDE에서 새로운 Claude Code 에디터 탭을 열음 |
| **초기화된 세션** | 아직 첫 번째 메시지도 시작하지 않아서 세션이 생성되지 않은 상태 |

## 빌드 명령어

모든 빌드는 `bash ./scripts/build.sh <command>` 를 통해 실행한다. 직접 `cd`, `pnpm`, `./gradlew` 명령을 조합하지 않는다.

> **중요**: `bash ./scripts/build.sh -h` 로 전체 명령 목록을 확인할 수 있다.

### 주요 명령

| 명령 | 용도 |
|------|------|
| `bash ./scripts/build.sh be-build` | 백엔드 빌드 |
| `bash ./scripts/build.sh wv-build` | 웹뷰 빌드 |
| `bash ./scripts/build.sh build` | 플러그인 빌드 |
| `bash ./scripts/build.sh full-build` | 전체 빌드 (be + wv + plugin) |
| `bash ./scripts/build.sh dist` | 배포용 빌드 (be + wv + buildPlugin) |
| `bash ./scripts/build.sh run-ide` | IDE 테스트 실행 |
| `bash ./scripts/build.sh clear-cache` | 빌드 캐시/결과물 초기화 |
| `bash ./scripts/build.sh wv-lint` | WebView TypeScript 체크 |
| `bash ./scripts/build.sh wv-test` | WebView 테스트 |
| `bash ./scripts/build.sh all` | 전체 빌드 + IDE 실행 |

### 에이전트 행동 지침

1. **빌드/테스트 시**: 반드시 `bash ./scripts/build.sh` 사용
2. **cd 금지**: 스크립트가 내부적으로 `pnpm -C`, `gradlew -p` 로 경로 처리
3. **새 명령 필요 시**: `scripts/build.sh`에 case 추가 제안
4. **모든 셸 명령어는 `bash` 를 앞에 붙여서 실행**: 예) `bash ./scripts/build.sh build`, `bash -c "ls -la"` 등

## 로컬 스킬

프로젝트 로컬 스킬은 `.claude/skills/` 에 위치한다. oh-my-claudecode 스킬이 아닌 **프로젝트 로컬 스킬**을 우선 사용한다.

| 스킬 | 파일 경로 | 트리거 키워드 |
|------|-----------|--------------|
| `/deploy` | `.claude/skills/deploy.md` | "배포", "deploy", "릴리즈", "release", "publish", "마켓플레이스 발행" |
| `/build` | `.claude/skills/build.md` | "빌드", "build", "컴파일", "compile" |
| `/precheck` | `.claude/skills/precheck.md` | "프리체크", "precheck", "배포 전 검수" |

## JetBrains SDK API 사용 주의사항

JetBrains Marketplace 배포 시 **Plugin Verifier**가 API 사용을 자동 검증한다.

- **Deprecated API** 사용 → 경고(warning)
- **Internal API** 사용 → 오류(error), 배포 거부 가능
- `EnvironmentUtil` 등 internal/deprecated 가능성이 있는 클래스 주의
- `@ApiStatus.Internal`, `impl` 패키지 내 클래스는 절대 사용 금지
- 배포 전 `bash ./scripts/build.sh dist`로 빌드 후 Plugin Verifier 결과 반드시 확인

## JetBrains Marketplace 승인 가이드라인 (v1.3, 2026-03-31)

배포 시 아래 기준을 모두 충족해야 한다. 위반 시 승인 지연 또는 거부될 수 있다.

### 1. 플러그인 콘텐츠

| 항목 | 요구사항 |
|------|---------|
| **로고** | 기본 IntelliJ 템플릿 로고 사용 금지. JetBrains 제품 로고와 유사 금지. **40x40px SVG** 필수 |
| **이름** | 고유해야 함. 최대 30자. Latin 문자/숫자/기호만 허용. "Plugin", "IntelliJ", "JetBrains" 등 JetBrains 제품명 포함 금지. "A"나 "."로 시작하여 검색 순위 조작 금지. "Support", "Integration" 단독 사용 지양 |
| **벤더** | 벤더 웹사이트와 이메일이 유효해야 함. 사칭/허위 표시 금지 |
| **설명** | 영어 필수(1차 언어). 올바른 포맷/맞춤법/문법. 미디어 정상 표시 필수 |
| **변경 노트** | 플레이스홀더 텍스트("Add change notes here") 금지. 관련 정보만 포함 |
| **링크** | 모든 외부 링크 유효 필수. 플러그인/저자와 관련된 링크만 허용 |
| **자산** | JetBrains 브랜드 자산 침해 금지. 저작권/상표권 침해 금지 |

### 2. 플러그인 기능

| 항목 | 요구사항 |
|------|---------|
| **호환성** | 최소 1개 JetBrains 제품과 호환. 정의된 호환 제품/버전에서 설치 가능해야 함 |
| **Plugin Verifier** | 업로드마다 바이너리 호환성 검증 필수. **Internal API 사용 위반 금지** |
| **보안** | 보안 취약점이나 개인정보 문제 없어야 함 |
| **성능** | JetBrains 제품 성능에 심각한 악영향 금지 |
| **간섭 금지** | JetBrains 제품 기능(라이선싱, 구독, 트라이얼, 업그레이드 플로우 포함) 수정/숨김/가로채기/간섭 금지 |
| **데이터 수집** | 개인/통계/텔레메트리 데이터 처리 시 **명시적 사용자 동의 필수**. 플러그인 비활성 시 데이터 전송 금지 |
| **검색 조작 금지** | 메타데이터/마케팅 자산으로 검색 결과 조작이나 Marketplace 기능 방해 금지 |

### 3. 법적 요구사항

- Developer Agreement 동의 필수
- 모든 플러그인에 Developer EULA 필수
- 오픈소스 라이선스 플러그인은 **소스 코드 링크 필수**
- 개인정보 수집 시 **Privacy Policy 필수**
- EEA 소비자 보호법 관련 trader/non-trader 지위 선언 필수

### 에이전트 체크리스트 (배포 전 확인)

배포(`/deploy`) 실행 전 아래 항목을 점검한다:

- [ ] 로고: 40x40px SVG, JetBrains 로고와 비유사
- [ ] 이름: 30자 이내, JetBrains 제품명 미포함
- [ ] 설명: 영어 우선, 깨진 링크/이미지 없음
- [ ] 변경 노트: 플레이스홀더 아닌 실제 변경사항 기재
- [ ] 모든 외부 링크 유효
- [ ] Plugin Verifier 통과 (Internal API 위반 0건)
- [ ] 개인정보 수집 시 Privacy Policy 링크 존재
- [ ] 소스 코드 링크 존재 (오픈소스)

## 로깅 시스템

[logging.md](./logging.md) 참조.

## 작업 플랜

작업을 시작하기 전에 `ignore/plan.md`를 반드시 읽고, 에이전트 지시문을 따를 것. 대화 중 "플랜 파일"이라 하면 이 파일을 의미한다. 사용자가 다음 작업을 물어본다면 이 플랜 파일을 기반으로 먼저 답변할 것.
