# 채팅에서 컨텍스트 사용량 표시

> Languages: [English](./en.md) · **한국어**
>
> 관련: [#196](https://github.com/yhk1038/claude-code-gui-jetbrains/issues/196), [#198](https://github.com/yhk1038/claude-code-gui-jetbrains/pull/198)

## 새로운 점

`/context`를 입력하면 채팅에 아무것도 표시되지 않았습니다 — 응답이 도착과 렌더 사이
어딘가에서 사라졌거든요(이슈 #196). 이제 명령이 정상 작동하며, **컨텍스트 사용량 카드**를
보여줍니다. 터미널에서 `claude -p "/context"`로 얻는 TUI와 똑같은 토큰 예산 시각화입니다.

## 화면에서 보이는 것

`/context`를 입력해 보내면 채팅에 다음이 표시됩니다:

- **요약 줄**: 모델명, 사용한 예산(예: "28.2k / 1m tokens (3%)")
- **카테고리 격자**: 컬러 코딩된 분류 — System prompt, System tools, Custom agents, Memory
  files, Skills, Messages, Free space — 각 바는 토큰 깊이에 따라 색상 구분
- **색상 범례**: 각 카테고리의 토큰 수와 백분율
- **상세 테이블**(있으면): Custom Agents, Memory, Skills, 기존과 동일

각 셀에 마우스를 올리면 해당 카테고리가 표시되며, 원본 텍스트를 읽는 것보다 훨씬 빨리 파악할 수 있습니다.

## 동작 방식

- `/context`는 로컬 명령 핸들러를 열어(CLI로 전송하지 않음) 백엔드에서 공식 명령
  `claude --no-session-persistence -p "/context"`를 실행합니다.
- 원본 응답(마크다운 테이블 포함)이 UI로 스트리밍됩니다. 명령이 갑자기 종료될 때 응답
  렌더링이 미완인 작은 버그가 고쳐져 전체 출력이 도착합니다.
- UI가 마크다운 테이블을 파싱해 컬러 코딩된 격자로 렌더링합니다. 파싱이 실패하면 원본
  마크다운이 그대로 표시되는 폴백이 있습니다.
- 카드는 당신의 테마(라이트 / 다크)를 따르고 여러 창 너비에 맞춰집니다.

이는 `/context`를 GUI의 자체 컨텍스트 인식과 연결해, CLI 도구의 개방성을 따릅니다
— 완전한 CLI 동등 기능으로 한 발 더 나아갑니다.
