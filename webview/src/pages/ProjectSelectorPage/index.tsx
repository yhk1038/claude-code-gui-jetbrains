import {useEffect, useState} from 'react';
import {MarqueeText} from './MarqueeText';
import {useBridgeContext} from '../../contexts/BridgeContext';
import {useWorkingDir} from "@/contexts";
import { MessageType } from '@/shared';
import { useTranslation } from '@/i18n';

interface Project {
  name: string;
  path: string;
  sessionCount: number;
  lastModified: string;
}

export function ProjectSelectorPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { send, isConnected, subscribe } = useBridgeContext();
  const { setWorkingDirectory } = useWorkingDir();
  const { t } = useTranslation('projectSelector');

  const handleOpenFolderDialog = () => {
    const unsubscribe = subscribe(MessageType.FOLDER_SELECTED, (message) => {
      const selectedPath = message.payload?.path as string | null;
      unsubscribe();
      if (selectedPath) {
        setWorkingDirectory(selectedPath, { replace: false });
      }
    });
    send(MessageType.OPEN_FOLDER_DIALOG, {});
  };

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Subscribe to PROJECTS_LIST response
        const unsubscribe = subscribe(MessageType.PROJECTS_LIST, (message) => {
          const projectsList = message.payload?.projects as Project[] || [];
          setProjects(projectsList);
          setIsLoading(false);
          unsubscribe();
        });

        // Request projects list
        await send(MessageType.GET_PROJECTS, {});
      } catch (err) {
        setError(t('errors.loadFailed'));
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [isConnected, send, subscribe]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-border-strong border-t-text-secondary rounded-full mx-auto mb-3" />
          <p className="text-text-tertiary text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <p className="text-state-error-fg text-sm mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-text-secondary text-xs hover:text-text-primary underline"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base">
        <div className="text-center max-w-md px-4 w-full">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-overlay flex items-center justify-center">
            <svg className="w-6 h-6 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm mb-4">{t('empty')}</p>
          <button
            onClick={handleOpenFolderDialog}
            className="w-full border border-dashed border-border-default hover:border-border-strong rounded-lg py-2.5 text-text-tertiary hover:text-text-secondary text-sm transition-colors"
          >
            + {t('addProject')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface-base">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-overlay flex items-center justify-center">
            <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h2 className="text-text-primary text-lg font-medium mb-1">{t('select.title')}</h2>
          <p className="text-text-tertiary text-sm">{t('select.subtitle')}</p>
        </div>

        {/* Project List */}
        <div className="bg-surface-raised border border-border-default rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.path}
              onClick={() => setWorkingDirectory(project.path, { replace: false })}
              className="w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border-default last:border-b-0 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-primary text-sm font-medium truncate">
                  {project.name}
                </span>
                {project.sessionCount > 0 && (
                  <span className="text-text-tertiary text-xs flex-shrink-0">
                    {t('sessionCount', { count: project.sessionCount })}
                  </span>
                )}
              </div>
              <div className="mt-0.5">
                <MarqueeText
                  text={project.path}
                  className="text-[0.7692rem] text-text-tertiary group-hover:text-text-secondary"
                />
              </div>
            </button>
          ))}
        </div>

        {/* Add Project */}
        <button
          onClick={handleOpenFolderDialog}
          className="w-full mt-3 border border-dashed border-border-default hover:border-border-strong rounded-lg py-2.5 text-text-disabled hover:text-text-secondary text-sm transition-colors"
        >
          + {t('addProject')}
        </button>
      </div>
    </div>
  );
}
