import { useEffect, useRef } from 'react';
import { MentionResult, MentionItemType } from './hooks/useMention';

interface Props {
  results: MentionResult[];
  selectedIndex: number;
  isLoading: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function MentionDropdown(props: Props) {
  const { results, selectedIndex, isLoading, onSelect, onClose } = props;

  const listRef = useRef<HTMLUListElement>(null);

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement | undefined;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className="w-full bg-[#2d2d30] border border-zinc-700 rounded-md shadow-lg overflow-hidden">
      {isLoading && results.length === 0 ? (
        <div className="px-3 py-2 text-xs text-zinc-500">Searching...</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-2 text-xs text-zinc-500">No matching files</div>
      ) : (
        <ul
          ref={listRef}
          className="overflow-y-auto max-h-[200px]"
        >
          {results.map((result, index) => (
            <li key={result.relativePath}>
              <button
                type="button"
                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 ${
                  index === selectedIndex ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-700/60'
                }`}
                onMouseDown={(e) => {
                  // mousedown에서 처리해야 textarea onBlur보다 먼저 실행됨
                  e.preventDefault();
                  onSelect(index);
                }}
              >
                <span className="flex-shrink-0 text-zinc-400">
                  {result.type === MentionItemType.Directory ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
                    </svg>
                  )}
                </span>
                <span className="truncate text-zinc-300">
                  {result.relativePath}
                  {result.type === MentionItemType.Directory ? '/' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {isLoading && results.length > 0 && (
        <div className="px-3 py-1 text-xs text-zinc-600 border-t border-zinc-700/50">
          Searching...
        </div>
      )}
      <button
        type="button"
        className="sr-only"
        onClick={onClose}
        aria-label="Close mention dropdown"
      />
    </div>
  );
}
