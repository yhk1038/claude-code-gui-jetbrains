import { XMarkIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';

interface Props {
  /** 좌측 안내 문구. */
  message: ReactNode;
  /** 우측 액션 영역(거부 텍스트·수락 버튼 등). 없으면 미표시. */
  actions?: ReactNode;
  /** X(닫기) 콜백. 없으면 닫기 버튼을 표시하지 않는다. */
  onClose?: () => void;
}

/**
 * 채팅 인풋 바로 위에 뜨는 안내 줄(인풋배너). 화면 최상단의 상단배너(BannerArea)와 구분된다.
 * 좌측 문구 + 우측 액션 + 가장 우측 X 닫기로 구성된 범용 컴포넌트로, 동의/공지 등에 재사용한다.
 */
export function InputBanner(props: Props) {
  const { message, actions, onClose } = props;
  const { t } = useTranslation('chat');
  return (
    <div className="mb-2 flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-[0.8461rem]">
      <div className="min-w-0 flex-1 text-text-primary">{message}</div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('inputBanner.close')}
          className="flex-shrink-0 rounded p-0.5 text-text-tertiary hover:bg-state-info-bg transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
