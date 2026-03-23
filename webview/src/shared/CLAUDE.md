# shared 폴더 동기화 규칙

이 폴더는 `backend/src/shared/` 와 **완전히 동일한 내용**을 유지해야 한다.

## 규칙

1. 이 폴더의 파일을 수정하면, 반드시 `backend/src/shared/`에도 동일한 수정을 적용한다.
2. 반대로 `backend/src/shared/`가 수정되면, 이 폴더에도 동일하게 반영한다.
3. 파일 목록, 내용, 구조가 항상 1:1로 일치해야 한다.
4. 이 CLAUDE.md 파일 자체도 양쪽에 동일하게 존재한다.

## 목적

backend와 webview가 별도 pnpm workspace이므로, 공유 타입/enum을 양쪽에 동일하게 유지하기 위한 규약.
