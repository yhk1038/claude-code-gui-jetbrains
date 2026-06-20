import { InputBanner } from './InputBanner';

interface Props {
  /** 수락 클릭. */
  onAccept: () => void;
  /** 거부 클릭. */
  onDecline: () => void;
  /** X(닫기) 클릭 — 미응답 상태를 유지한 채 이 세션에서만 숨긴다. */
  onClose: () => void;
}

/**
 * 텔레메트리 사용 통계 수집 동의를 묻는 인풋배너.
 * 거부(텍스트) · 수락(버튼) · X(닫기)로 구성된다. 표시 여부·동의 영속화는
 * 상위(profile 연결)에서 제어한다 — 이 컴포넌트는 표현만 담당한다.
 */
export function TelemetryConsentBanner(props: Props) {
  const { onAccept, onDecline, onClose } = props;
  return (
    <InputBanner
      message={
        <>
          개인을 직접 식별하지 않는 <strong>사용 통계</strong>를 수집해 제품 개선에 사용해도 될까요?
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={onDecline}
            className="rounded px-2 py-1 text-[0.7692rem] font-medium text-text-link hover:bg-accent-primary hover:text-text-primary transition-colors"
          >
            거부
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded bg-surface-base px-3 py-1 text-[0.7692rem] font-medium text-text-link hover:bg-state-info-bg transition-colors"
          >
            수락
          </button>
        </>
      }
      onClose={onClose}
    />
  );
}
