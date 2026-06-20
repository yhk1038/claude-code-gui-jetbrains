import { InputBanner } from './InputBanner';

// TODO: www web 배포 후 개인정보처리방침 URL로 교체 (예: https://<도메인>/privacy).
// 빈 값이면 링크를 표시하지 않는다.
const PRIVACY_POLICY_URL: string = '';

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
          제품 개선을 위한 사용 통계 수집을 허용하시겠습니까? 소스코드와 개인정보는 보내지 않으며, 설정에서 언제든 끌 수 있습니다.
          {PRIVACY_POLICY_URL ? (
            <>
              {' '}
              <a
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noreferrer"
                className="text-text-link hover:underline"
              >
                개인정보처리방침
              </a>
            </>
          ) : null}
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
