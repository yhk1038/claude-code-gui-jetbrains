import { SessionRefresher } from './SessionRefresher';
import { useSessionListScale } from './scale';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput(props: Props) {
  const { value, onChange } = props;
  const scale = useSessionListScale();

  return (
    <div className={scale.searchPad}>
      <div className="relative">
        <input
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
