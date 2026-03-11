import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarqueeText } from './MarqueeText';
import { useBridgeContext } from '../contexts/BridgeContext';
import { useSessionContext } from '../contexts/SessionContext';
import { withWorkingDir } from '@/router/routes';

interface Project {
  name: string;
  path: string;
  sessionCount: number;
  lastModified: string;
}

export function ProjectSelector() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { send, isConnected, subscribe } = useBridgeContext();
  const { setWorkingDirectory } = useSessionContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const fetchProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Subscribe to PROJECTS_LIST response
        const unsubscribe = subscribe('PROJECTS_LIST', (message) => {
          const projectsList = message.payload?.projects as Project[] || [];
          setProjects(projectsList);
          setIsLoading(false);
          unsubscribe();
        });

        // Request projects list
        await send('GET_PROJECTS', {});
      } catch (err) {
        setError('Failed to load projects');
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [isConnected, send, subscribe]);

  const handleSelectProject = (path: string) => {
    setWorkingDirectory(path);
    navigate(withWorkingDir('/sessions/new', path));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-500 border-t-zinc-300 rounded-full mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-zinc-400 text-xs hover:text-zinc-200 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-center max-w-md px-4">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-zinc-400 text-sm mb-1">No projects available</p>
          <p className="text-zinc-500 text-xs">
            Add <code className="bg-zinc-800 px-1.5 py-0.5 rounded">?workingDir=/path/to/project</code> to URL to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-[#1a1a1a]">
      <div className="w-full max-w-md px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h2 className="text-zinc-200 text-lg font-medium mb-1">Select Project</h2>
          <p className="text-zinc-500 text-sm">Choose a project to work on</p>
        </div>

        {/* Project List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.path}
              onClick={() => handleSelectProject(project.path)}
              className="w-full px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors border-b border-zinc-800 last:border-b-0 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-200 text-sm font-medium truncate">
                  {project.name}
                </span>
                {project.sessionCount > 0 && (
                  <span className="text-zinc-500 text-xs flex-shrink-0">
                    {project.sessionCount} sessions
                  </span>
                )}
              </div>
              <div className="mt-0.5">
                <MarqueeText
                  text={project.path}
                  className="text-[10px] text-zinc-500 group-hover:text-zinc-400"
                />
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-zinc-600 text-xs mt-4">
          Or add ?workingDir=/path parameter to URL
        </p>
      </div>
    </div>
  );
}
