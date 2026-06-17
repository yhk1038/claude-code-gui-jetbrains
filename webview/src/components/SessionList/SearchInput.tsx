import { useEffect, useRef } from 'react';
import { SessionRefresher } from './SessionRefresher';
import { useSessionListScale } from './scale';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput(props: Props) {
  const { value, onChange } = props;
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
          className={`w-full ${scale.searchInput} bg-surface-overlay text-text-secondary rounded outline-none placeholder:text-text-tertiary`}
          placeholder="Search sessions..."
        />
        <SessionRefresher />
      </div>
    </div>
  );
}
