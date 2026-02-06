import { ActiveFile } from '../../types/chatInput';

interface FileTagProps {
  file: ActiveFile;
  onClick?: (path: string) => void;
}

export function FileTag({ file, onClick }: FileTagProps) {
  return (
    <button
      type="button"
      className={`
        inline-flex items-center gap-1 text-xs
        transition-opacity hover:opacity-70 cursor-pointer
        ${file.isSelected ? 'text-blue-400' : 'text-zinc-500'}
      `}
      onClick={() => onClick?.(file.path)}
      title={file.path}
    >
      <span className="text-zinc-600">&lt;/&gt;</span>
      <span className="truncate max-w-[120px]">{file.fileName}</span>
    </button>
  );
}
