import { QueueListIcon } from '@heroicons/react/24/outline';
import { useWorkflowState } from '@/contexts/WorkflowStateContext';

/**
 * Toggles the Background tasks panel. Hidden until at least one workflow exists
 * this session; shows a running-count badge while workflows are in flight.
 */
export function BackgroundTasksButton() {
    const { tasks, runningTasks, panelOpen, openPanel, closePanel } = useWorkflowState();
    if (tasks.length === 0) return null;

    const runningCount = runningTasks.length;

    return (
        <button
            onClick={() => (panelOpen ? closePanel() : openPanel())}
            className="relative p-1 rounded transition-colors hover:bg-surface-hover"
            title="Background tasks"
        >
            <QueueListIcon
                className={`w-5 h-5 ${
                    runningCount > 0 ? 'text-text-link' : 'text-text-secondary hover:text-text-primary'
                }`}
            />
            {runningCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-text-link text-text-inverse text-[0.6153rem] font-semibold leading-[14px] text-center">
                    {runningCount}
                </span>
            )}
        </button>
    );
}
