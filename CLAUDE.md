# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

JetBrains IDE용 Claude Code GUI 플러그인. Cursor의 Claude Code 확장과 동일한 UX를 JetBrains 환경에서 제공하는 것이 목표.

## 아키텍처

3개 레이어로 구성:

1. **IDE Plugin (Kotlin/JVM)** - JetBrains Platform SDK 기반, WebView 호스팅, 파일시스템 연동
2. **WebView UI (JCEF)** - 채팅/세션/diff 카드 UI, Cursor UX 동일 구현
3. **AI Bridge (별도 프로세스)** - Claude Code 에이전트 실행, 스트리밍 파싱, 상태 관리

## 참고 저장소

구현 시 `idea-claude-code-gui` (GitHub) 저장소를 1차 기준으로 삼음. 우선순위: Cursor UX > 참고 저장소 > JetBrains 관행

## 기술 제약

- WebView는 JCEF 사용 (Swing UI 사용 금지, 권한 다이얼로그 예외)
- 에이전트 런타임은 IDE 외부 프로세스로 분리
- 이벤트 기반, 스트리밍 우선 설계

## 상태 머신

Idle → Streaming → Waiting Permission → Has Diff → Error

## UI 용어 정의

| 용어 | 설명 |
|------|------|
| **상단바** | 채팅 화면 상단의 새 세션 버튼과 세션 드롭다운 토글 버튼을 포함하는 영역 요소 |
| **세션 드롭다운 토글 버튼** | 상단바 좌측에 현재 세션의 제목을 표시하는 드롭다운 토글 버튼 |
| **세션 드롭다운** | 세션 드롭다운 토글 버튼을 클릭해 열리는 드롭다운 메뉴 |
| **새 세션 버튼** | 상단바 우측에 있는 플러스 버튼. 현재 세션을 아카이브하고, 화면을 초기화하며, 초기화된 세션을 시작함 |
| **초기화된 세션** | 아직 첫 번째 메시지도 시작하지 않아서 세션이 생성되지 않은 상태 |

## 빌드 명령어 (direnv)

이 프로젝트는 `.envrc`를 통해 빌드 관련 alias를 정의합니다.
터미널에서 `de` 명령으로 로드하거나, 이 디렉토리 진입 시 자동 로드됩니다.

### 에이전트 필수 규칙

> **중요**: 아래 정의된 alias를 반드시 사용하세요. 직접 명령을 구성하지 마세요.

| Alias | 용도 | 금지된 직접 명령 |
|-------|------|-----------------|
| `build` | 전체 빌드 | ~~./gradlew build~~ |
| `run-ide` | IDE 테스트 실행 | ~~./gradlew runIde~~ |
| `build-plugin` | 배포용 ZIP 생성 | ~~./gradlew buildPlugin~~ |
| `clean` | 클린 | ~~./gradlew clean~~ |
| `test` | 테스트 | ~~./gradlew test~~ |
| `watch` | 자동 빌드 | ~~./gradlew build --continuous~~ |
| `wv-dev` | WebView 개발 서버 | ~~cd webview && pnpm dev~~ |
| `wv-build` | WebView 빌드 | ~~cd webview && pnpm build~~ |
| `wv-lint` | TypeScript 체크 | ~~cd webview && pnpm lint~~ |
| `wv-install` | 의존성 설치 | ~~cd webview && pnpm install~~ |
| `full-build` | 전체 빌드 | ~~wv-build && build~~ |
| `dist` | 배포 빌드 | ~~wv-build && build-plugin~~ |
| `ide-log` | IDE 로그 확인 | ~~tail -f build/idea-sandbox/...~~ |

### 에이전트 행동 지침

1. **빌드/테스트 시**: 반드시 위 alias 사용
2. **새 명령 필요 시**: 직접 실행하지 말고 `.envrc`에 추가 제안
3. **경로 하드코딩 금지**: alias에 이미 경로가 포함되어 있음
