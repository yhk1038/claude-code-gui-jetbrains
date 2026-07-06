import { useMemo, useState } from 'react';
import type { PermissionSpec } from '@/permissions';
import { persistDismissed } from './dismissed';
import { useTranslation } from '@/i18n';

interface Props {
  spec: PermissionSpec;
}

type RowState = 'prompt' | 'denied' | 'hidden';

export const PermissionBannerRow = (props: Props) => {
  const { spec } = props;
  const { t } = useTranslation('chat');

  const initialState: RowState = useMemo(() => {
    const current = spec.getState();
    if (current === 'granted') return 'hidden';
    if (current === 'denied') return 'hidden';
    return 'prompt';
  }, [spec]);

  const [state, setState] = useState<RowState>(initialState);

  if (state === 'hidden') return null;

  const handleAllow = () => {
    spec
      .request()
      .then((next) => {
        if (next === 'granted') {
          setState('hidden');
        } else if (next === 'denied') {
          setState('denied');
        }
      })
      .catch(() => {
        // Keep the row visible; user may retry
      });
  };

  const handleDismiss = () => {
    persistDismissed(spec.id);
    setState('hidden');
  };

  const message =
    state === 'denied' ? t('browserPermission.enableFromSettings') : spec.description;

  return (
    <div className="w-full z-20 border-t border-b border-state-info-border bg-state-info-bg px-4 py-1.5 flex items-center">
      <span className="text-text-primary text-[0.8461rem]">{message}</span>
      <div className="ml-auto flex items-center gap-2">
        {state === 'prompt' && (
          <button
            onClick={handleAllow}
            className="px-3 py-1 rounded text-[0.7692rem] font-medium bg-surface-base text-text-link hover:bg-state-info-bg transition-colors"
          >
            {t('browserPermission.allow')}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="px-3 py-1 rounded text-[0.7692rem] font-medium text-text-link hover:text-text-primary hover:bg-accent-primary transition-colors"
        >
          {t('browserPermission.dismiss')}
        </button>
      </div>
    </div>
  );
};
