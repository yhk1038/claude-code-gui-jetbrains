import { useCallback, useMemo } from 'react';
import { ApprovalPanel } from './ApprovalPanel';
import { OptionItem } from './ApprovalPanel/OptionButton';
import { PendingPermission } from '../../hooks/usePendingPermissions';
import { parseWorkflowName } from '@/utils/workflowName';

interface Props {
  permission: PendingPermission;
  onApprove: () => void;
  onApproveForSession: () => void;
  onDeny: (reason?: string) => void;
}

const WORKFLOW_NOTICE =
  'Dynamic workflows run many subagents in parallel and can use a lot of your usage limit. Stop them any time from the tasks panel.';

function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

function generateTitle(toolName: string, input: Record<string, unknown>): string {
  const filePath = (input.file_path as string) || (input.path as string) || '';
  const file = filePath ? basename(filePath) : '';

  switch (toolName) {
    case 'Edit':
      return file ? `Make this edit to ${file}?` : 'Make this edit?';
    case 'Write':
      return file ? `Write to ${file}?` : 'Write this file?';
    case 'Delete':
      return file ? `Delete ${file}?` : 'Delete this file?';
    case 'Bash':
      return 'Run this command?';
    case 'Read':
      return file ? `Read ${file}?` : 'Read this file?';
    case 'NotebookEdit':
      return file ? `Edit notebook ${file}?` : 'Edit this notebook?';
    case 'Workflow':
      return `Allow Claude to run a workflow ${parseWorkflowName(input)}?`;
    default:
      return `Allow ${toolName}?`;
  }
}

function getSessionLabel(toolName: string): string {
  switch (toolName) {
    case 'Edit':
      return 'Yes, allow all edits this session';
    case 'Write':
      return 'Yes, allow all writes this session';
    case 'Bash':
      return 'Yes, allow all commands this session';
    case 'Delete':
      return 'Yes, allow all deletions this session';
    case 'Read':
      return 'Yes, allow all reads this session';
    case 'Workflow':
      return 'Yes, allow all workflows this session';
    default:
      return `Yes, allow all ${toolName} this session`;
  }
}

export function PermissionBanner(props: Props) {
  const { permission, onApprove, onApproveForSession, onDeny } = props;

  const title = useMemo(
    () => generateTitle(permission.toolName, permission.input),
    [permission.toolName, permission.input],
  );

  const isWorkflow = permission.toolName === 'Workflow';
  const subtitle = isWorkflow ? (permission.input.description as string | undefined) : undefined;
  const notice = isWorkflow ? WORKFLOW_NOTICE : undefined;

  const options: OptionItem[] = useMemo(() => [
    { key: '1', label: 'Yes' },
    { key: '2', label: getSessionLabel(permission.toolName) },
    { key: '3', label: 'No' },
  ], [permission.toolName]);

  const handleOptionSelect = useCallback((index: number) => {
    if (index === 0) onApprove();
    else if (index === 1) onApproveForSession();
    else if (index === 2) onDeny();
  }, [onApprove, onApproveForSession, onDeny]);

  return (
    <ApprovalPanel
      title={title}
      subtitle={subtitle}
      notice={notice}
      options={options}
      onOptionSelect={handleOptionSelect}
      textareaPlaceholder="Tell Claude what to do instead"
      onTextSubmit={(text) => onDeny(text)}
      onCancel={onDeny}
    />
  );
}
