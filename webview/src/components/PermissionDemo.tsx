import { useState } from 'react';
import { PermissionDialog } from './PermissionDialog';
import { PermissionBanner } from './PermissionBanner';
import { usePermissions } from '../hooks/usePermissions';
import { ToolUse } from '../types';
import { ToolUseStatus } from '../dto/common';

/**
 * Demo component showing Permission Dialog and Banner usage
 *
 * Usage in ChatPanel:
 *
 * ```tsx
 * const { approveToolUse, denyToolUse } = useTools();
 * const { pendingRequests, approvePermission, denyPermission, requestPermission } = usePermissions(approveToolUse, denyToolUse);
 *
 * // When a new tool use comes in that requires permission:
 * useEffect(() => {
 *   const pending = toolUses.filter(t => t.status === 'pending');
 *   pending.forEach(tool => {
 *     if (!hasSessionPermission(tool.name)) {
 *       requestPermission(tool);
 *     } else {
 *       approveToolUse(tool.id);
 *     }
 *   });
 * }, [toolUses]);
 *
 * // In render:
 * {pendingRequests.length > 0 && (
 *   <PermissionDialog
 *     request={pendingRequests[0]}
 *     onApprove={(allowForSession) => approvePermission(pendingRequests[0].toolUse.id, allowForSession)}
 *     onDeny={() => denyPermission(pendingRequests[0].toolUse.id)}
 *   />
 * )}
 * ```
 */
export function PermissionDemo() {
  const [showDialog, setShowDialog] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const mockApprove = (toolId: string) => console.log('Approved:', toolId);
  const mockDeny = (toolId: string) => console.log('Denied:', toolId);

  const { pendingRequests, requestPermission, approvePermission, denyPermission } =
    usePermissions(mockApprove, mockDeny);

  const createMockToolUse = (name: string, input: Record<string, unknown>): ToolUse => ({
    id: `tool-${Date.now()}`,
    name,
    input,
    status: ToolUseStatus.Pending,
  });

  const handleShowDialogDemo = () => {
    const tool = createMockToolUse('bash', { command: 'rm -rf /tmp/old-data' });
    requestPermission(tool);
    setShowDialog(true);
  };

  const handleShowBannerDemo = () => {
    const tool = createMockToolUse('write_file', { path: '/src/components/NewComponent.tsx', content: '...' });
    requestPermission(tool);
    setShowBanner(true);
  };

  return (
    <div className="p-8 space-y-6 bg-zinc-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Permission UI Demo</h1>
        <p className="text-zinc-400 mb-8">
          Test the permission dialog and banner components
        </p>

        <div className="space-y-4">
          <button
            onClick={handleShowDialogDemo}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all duration-150 active:scale-95"
          >
            Show Permission Dialog (High Risk)
          </button>

          <button
            onClick={handleShowBannerDemo}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-all duration-150 active:scale-95"
          >
            Show Permission Banner (Medium Risk)
          </button>
        </div>

        {/* Banner Demo */}
        {showBanner && pendingRequests.length > 0 && (
          <div className="mt-8">
            <PermissionBanner
              request={pendingRequests[0]}
              onApprove={() => {
                approvePermission(pendingRequests[0].toolUse.id);
                setShowBanner(false);
              }}
              onDeny={() => {
                denyPermission(pendingRequests[0].toolUse.id);
                setShowBanner(false);
              }}
              onExpand={() => {
                setShowBanner(false);
                setShowDialog(true);
              }}
            />
          </div>
        )}

        {/* Example Integration Code */}
        <div className="mt-12 p-6 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h2 className="text-lg font-bold text-zinc-200 mb-4">Integration Example</h2>
          <pre className="text-xs text-zinc-400 font-mono overflow-x-auto">
{`// In ChatPanel.tsx or similar:

const { approveToolUse, denyToolUse } = useTools();
const {
  pendingRequests,
  approvePermission,
  denyPermission,
  requestPermission,
  hasSessionPermission,
} = usePermissions(approveToolUse, denyToolUse);

// Auto-request permissions for pending tools
useEffect(() => {
  toolUses
    .filter(t => t.status === 'pending')
    .forEach(tool => {
      if (!hasSessionPermission(tool.name)) {
        requestPermission(tool);
      } else {
        approveToolUse(tool.id);
      }
    });
}, [toolUses]);

// Render permission UI
return (
  <>
    {/* Main chat UI */}

    {/* Permission Dialog (modal) */}
    {pendingRequests.length > 0 && (
      <PermissionDialog
        request={pendingRequests[0]}
        onApprove={(allowForSession) =>
          approvePermission(pendingRequests[0].toolUse.id, allowForSession)
        }
        onDeny={() =>
          denyPermission(pendingRequests[0].toolUse.id)
        }
      />
    )}
  </>
);`}
          </pre>
        </div>
      </div>

      {/* Dialog Demo (renders on top) */}
      {showDialog && pendingRequests.length > 0 && (
        <PermissionDialog
          request={pendingRequests[0]}
          onApprove={(allowForSession) => {
            approvePermission(pendingRequests[0].toolUse.id, allowForSession);
            setShowDialog(false);
          }}
          onDeny={() => {
            denyPermission(pendingRequests[0].toolUse.id);
            setShowDialog(false);
          }}
        />
      )}
    </div>
  );
}
