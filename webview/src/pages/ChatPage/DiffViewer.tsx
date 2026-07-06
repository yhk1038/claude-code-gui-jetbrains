import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { useTranslation } from '@/i18n';

interface DiffViewerProps {
  filePath: string;
  diffText: string;
}

export function DiffViewer({ diffText }: DiffViewerProps) {
  const { t } = useTranslation('chat');
  try {
    const files = parseDiff(diffText);
    const file = files[0];

    if (!file) {
      return (
        <div className="text-text-tertiary text-sm py-4">
          {t('diffViewer.noDiff')}
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
    const message = error instanceof Error ? error.message : t('diffViewer.unknownError');
    return (
      <div className="text-state-error-fg text-sm py-4">
        {t('diffViewer.parseError', { message })}
      </div>
    );
  }
}
