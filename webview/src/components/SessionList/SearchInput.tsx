import { useEffect, useRef, KeyboardEvent } from 'react';
import { SessionRefresher } from './SessionRefresher';
import { useSessionListScale } from './scale';
import { useTranslation } from '@/i18n';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function SearchInput(props: Props) {
  const { value, onChange, onKeyDown } = props;
  const { t } = useTranslation('common');
  const scale = useSessionListScale();
  const inputRef = useRef<HTMLInputElement>(null);

  // The dropdown mounts SearchInput only while open, so focusing on mount puts
  // the caret in the search box every time the dropdown opens (including via
  // the `/resume` slash command). Issue #28.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className={scale.searchPad}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={`w-full ${scale.searchInput} bg-surface-overlay text-text-secondary rounded outline-none placeholder:text-text-tertiary`}
          placeholder={t('sessionList.searchPlaceholder')}
        />
        <SessionRefresher />
      </div>
    </div>
  );
}
