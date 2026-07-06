import Tippy from '@tippyjs/react/headless';
import { Tag } from '@/pages/ChatPage/ChatInput/Tag';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { calculateContextWindowPercent } from '@/utils/contextWindow';
import { useTranslation } from '@/i18n';

interface Props {
  onClick?: () => void;
  disabled?: boolean;
}

export function ContextWindowTag(props: Props) {
  const { onClick, disabled = false } = props;
  const { t } = useTranslation('chat');
  const { contextWindowUsage } = useChatStreamContext();

  if (!contextWindowUsage) return null;

  const { totalTokens, contextWindow, maxOutputTokens } = contextWindowUsage;
  // 실제 contextWindow를 아직 받지 못한 상태(세션 로드 직후, 첫 result 이전)에서는
  // 임의 기준으로 부정확한 사용률을 보이느니 게이지를 그리지 않는다(커서와 동일 동작).
  if (contextWindow <= 0) return null;

  const percent = calculateContextWindowPercent(totalTokens, contextWindow, maxOutputTokens);
  const remaining = 100 - percent;
  const isClickable = !disabled && percent >= 10;

  return (
    <Tippy
      placement="top"
      render={(attrs) => (
        <div
          className="bg-surface-overlay border border-border-default rounded-md px-3 py-2 text-xs text-text-primary shadow-lg max-w-[240px]"
          {...attrs}
        >
          <p>{t('chatInput.contextWindow.remaining', { percent: remaining })}</p>
          <p className="text-text-secondary mt-1 text-[0.7692rem]">
            {t('chatInput.contextWindow.tokensUsed', { tokens: totalTokens.toLocaleString() })}
          </p>
          {isClickable && (
            <p className="text-text-secondary mt-1 text-[0.7692rem]">{t('chatInput.contextWindow.clickToCompact')}</p>
          )}
        </div>
      )}
    >
      <div className="flex items-center max-xs:hidden">
        <Tag onClick={isClickable ? onClick : undefined} disabled={!isClickable}>
          <span>{t('chatInput.contextWindow.used', { percent })}</span>
        </Tag>
      </div>
    </Tippy>
  );
}
