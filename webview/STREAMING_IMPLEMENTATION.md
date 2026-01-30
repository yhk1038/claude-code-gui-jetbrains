# WebView Streaming Response Handler Implementation

## Overview

Phase 1.4 완료: WebView UI에서 Claude의 스트리밍 응답을 표시하는 핸들러 구현

## 구현된 컴포넌트

### 1. hooks/useStreaming.ts
스트리밍 상태 관리 훅

**주요 기능:**
- 스트리밍 상태 추적 (idle, streaming, paused, error)
- 버퍼 관리 및 청크 큐잉
- requestAnimationFrame 기반 스로틀링 (60fps)
- useBridge 훅과 통합하여 IPC 메시지 수신

**API:**
```typescript
const {
  state,              // 현재 스트리밍 상태
  buffer,             // 현재 메시지의 누적 버퍼
  currentMessageId,   // 스트리밍 중인 메시지 ID
  isPaused,           // 일시정지 상태
  pause,              // 일시정지
  resume,             // 재개
  reset,              // 상태 초기화
  getBufferForMessage // 특정 메시지 버퍼 조회
} = useStreaming(options);
```

**성능 최적화:**
- RAF 기반 청크 플러싱으로 렌더 성능 보장
- 최대 버퍼 크기 제한 (기본 100KB)
- 스로틀링으로 불필요한 리렌더 방지

### 2. components/StreamingMessage.tsx
스트리밍 메시지 렌더러

**주요 기능:**
- Streamdown 라이브러리를 사용한 증분 마크다운 렌더링
- 타이핑 애니메이션 효과
- Shiki 기반 코드 블록 구문 하이라이팅
- 불완전한 마크다운 처리 (코드 펜스 미완료 등)

**사용 예시:**
```tsx
<StreamingMessage
  content={messageContent}
  isStreaming={isCurrentlyStreaming}
  className="custom-class"
/>
```

**특징:**
- 다크/라이트 테마 자동 지원 (Shiki)
- 스트리밍 중 시각적 인디케이터 (점 애니메이션)
- 불완전 코드 블록에 커서 표시

### 3. components/MessageList.tsx
메시지 리스트 컨테이너

**주요 기능:**
- 날짜별 메시지 그룹화
- 자동 스크롤 (사용자가 수동으로 스크롤하지 않은 경우)
- 스크롤 앵커 기반 위치 유지
- 재시도/복사 액션 버튼

**사용 예시:**
```tsx
<MessageList
  messages={messages}
  streamingMessageId={currentStreamingId}
  onRetry={handleRetry}
  onCopy={handleCopy}
/>
```

**UX 최적화:**
- 스크롤 위치 감지 및 "맨 아래로" 버튼
- 메시지 호버 시 액션 버튼 표시
- 도구 사용(ToolUse) 상태 표시
- 컨텍스트 정보 표시

### 4. utils/markdownParser.ts
마크다운 유틸리티

**주요 함수:**
- `extractCodeBlocks()` - 코드 블록 추출
- `isMarkdownComplete()` - 마크다운 완성도 검사
- `isInsideCodeBlock()` - 코드 블록 내부 여부 확인
- `escapeHtml()` - HTML 이스케이프
- `formatCode()` - 코드 포맷팅
- `detectLanguage()` - 코드 언어 자동 감지

## 기술 스택

- **React 18** - UI 프레임워크
- **TypeScript** - 타입 안전성
- **Streamdown 2.1** - 스트리밍 마크다운 렌더링
- **Shiki** - 구문 하이라이팅
- **Tailwind CSS** - 스타일링
- **JCEF** - WebView 호스팅 (JetBrains)

## 통합 가이드

### IPC 메시지 프로토콜

Kotlin 브리지에서 다음 메시지를 전송해야 함:

```typescript
// 스트리밍 시작
{
  type: 'stream:start',
  payload: { messageId: string }
}

// 청크 수신
{
  type: 'stream:chunk',
  payload: { messageId: string, delta: string }
}

// 스트리밍 종료
{
  type: 'stream:end',
  payload: { messageId: string }
}

// 에러 발생
{
  type: 'stream:error',
  payload: { error: string }
}
```

### 사용 예시

전체 통합 예시는 `examples/StreamingExample.tsx` 참조:

```tsx
import { useStreaming, useChat } from './hooks';
import { MessageList } from './components';

function ChatPanel() {
  const { messages, isStreaming, streamingMessageId } = useChat();
  const { state, buffer } = useStreaming();

  return (
    <MessageList
      messages={messages}
      streamingMessageId={streamingMessageId}
    />
  );
}
```

## 파일 구조

```
webview/src/
├── hooks/
│   ├── useStreaming.ts          # 스트리밍 상태 관리
│   └── index.ts                 # Export
├── components/
│   ├── StreamingMessage.tsx     # 마크다운 렌더러
│   ├── MessageList.tsx          # 메시지 리스트
│   └── index.ts                 # Export
├── utils/
│   └── markdownParser.ts        # 마크다운 유틸
└── examples/
    └── StreamingExample.tsx     # 통합 예시
```

## 검증 완료

### TypeScript 컴파일
```bash
npm run lint
# ✓ No errors
```

### 프로덕션 빌드
```bash
npm run build
# ✓ Built successfully
# Output: ../src/main/resources/webview/
```

### 번들 크기
- index.js: 612.26 kB (gzipped: 191.58 kB)
- index.css: 18.83 kB (gzipped: 4.37 kB)

## 다음 단계

1. **Phase 1.5** - 툴 사용 권한 다이얼로그 구현
2. **Phase 1.6** - Diff 카드 컴포넌트 구현
3. Kotlin 플러그인과 IPC 메시지 프로토콜 연동
4. 실제 Claude API 스트리밍 응답 테스트

## 참고 자료

- [Streamdown 문서](https://github.com/jjaimealeman/streamdown)
- [Shiki 테마](https://shiki.style/themes)
- [JetBrains Platform UI Guidelines](https://plugins.jetbrains.com/docs/intellij/user-interface-components.html)
