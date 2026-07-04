import {useSettings} from '@/contexts/SettingsContext';
import {useClaudeSettings} from '@/contexts/ClaudeSettingsContext';
import {useWorkingDir} from '@/contexts/WorkingDirContext';

export function ScopeTabs() {
    const {scope, setScope} = useSettings();
    const {setScope: setClaudeScope} = useClaudeSettings();
    const {workingDirectory} = useWorkingDir();

    const handleScopeChange = (newScope: 'global' | 'project') => {
        setScope(newScope);
        setClaudeScope(newScope);
    };

    return (
        <div className="flex items-center border-b border-border-default pt-2 px-2">
            <button
                onClick={() => handleScopeChange('global')}
                className={`px-3 py-2 text-[0.8461rem] rounded-t-md font-medium transition-colors ${
                    scope === 'global'
                        ? 'text-text-primary bg-surface-tooltip/50'
                        : 'text-text-disabled hover:text-text-secondary'
                }`}
            >
                <span>User<span className="max-xs:hidden"> Settings</span> (Global)</span>
            </button>
            <button
                onClick={() => handleScopeChange('project')}
                disabled={!workingDirectory}
                className={`px-3 py-2 text-[0.8461rem] rounded-t-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    scope === 'project'
                        ? 'text-text-primary bg-surface-tooltip/50'
                        : 'text-text-disabled hover:text-text-secondary'
                }`}
                title={!workingDirectory ? 'Open a project to use project settings' : undefined}
            >
                <span>Project<span className="max-xs:hidden"> Settings</span> (Local)</span>
            </button>
        </div>
    );
}
