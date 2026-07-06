import { InputBanner } from './InputBanner';
import { PRIVACY_POLICY_URL } from '@/config/app';
import { useTranslation } from '@/i18n';

interface Props {
  /** 수락 클릭. */
  onAccept: () => void;
  /** 거부 클릭. */
  onDeny: () => void;
  /** X(닫기) 클릭 — 미응답 상태를 유지한 채 이 세션에서만 숨긴다. */
  onClose: () => void;
}

/**
 * 텔레메트리 사용 통계 수집 동의를 묻는 인풋배너.
 * 제목(1줄) + 뮤트된 보조 설명(2줄) + 거부(텍스트)·수락(버튼)·X(닫기).
 * 문구·버튼은 공용 i18n 시스템(General 설정의 language에 동기화)으로 번역된다.
 * 표시 여부·동의 영속화는 상위(profile 연결)에서 제어 — 이 컴포넌트는 표현만 담당한다.
 */
export function TelemetryConsentBanner(props: Props) {
  const { onAccept, onDeny, onClose } = props;
  const { t } = useTranslation('chat');
  return (
    <InputBanner
      message={
        <div className="flex flex-col gap-0.5">
          <span>{t('telemetry.title')}</span>
          <span className="text-text-tertiary text-[0.7211rem]">
            {t('telemetry.subtitle')}
            {PRIVACY_POLICY_URL ? (
              <>
                {' '}
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-link hover:underline"
                >
                  {t('telemetry.privacyPolicy')}
                </a>
              </>
            ) : null}
          </span>
        </div>
      }
      actions={
        <>
          <button
            type="button"
            onClick={onDeny}
            className="rounded px-2 py-1 text-[0.7692rem] font-medium text-text-tertiary hover:bg-state-info-bg transition-colors"
          >
            {t('telemetry.deny')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded bg-surface-base px-3 py-1 text-[0.7692rem] font-medium text-text-link hover:bg-accent-primary hover:text-text-primary transition-colors"
          >
            {t('telemetry.accept')}
          </button>
        </>
      }
      onClose={onClose}
    />
  );
}
