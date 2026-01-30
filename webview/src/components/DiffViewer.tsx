import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';

interface DiffViewerProps {
  filePath: string;
  diffText: string;
}

export function DiffViewer({ diffText }: DiffViewerProps) {
  try {
    const files = parseDiff(diffText);
    const file = files[0];

    if (!file) {
      return (
        <div className="text-zinc-500 text-sm py-4">
          No diff available
        </div>
      );
    }

    return (
      <div className="diff-viewer overflow-x-auto">
        <Diff
          viewType="unified"
          diffType={file.type}
          hunks={file.hunks || []}
        >
          {(hunks) =>
            hunks.map((hunk) => (
              <Hunk
                key={`${hunk.oldStart}-${hunk.newStart}-${hunk.content}`}
                hunk={hunk}
              />
            ))
          }
        </Diff>
      </div>
    );
  } catch (error) {
    return (
      <div className="text-red-400 text-sm py-4">
        Failed to parse diff: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }
}
