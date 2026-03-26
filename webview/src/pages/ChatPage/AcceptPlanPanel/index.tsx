import { useCallback } from 'react';
import { OptionItem } from '../ApprovalPanel/OptionButton';
import { ApprovalPanel } from '../ApprovalPanel';
import { useChatStreamContext } from '../../../contexts/ChatStreamContext';
import { useSessionContext } from '../../../contexts/SessionContext';
import { InputModeValues } from '../../../types/chatInput';
import type { PendingPlanApproval } from '../../../hooks/usePendingPlanApproval';

const options: OptionItem[] = [
  { key: '1', label: 'Yes, and auto-accept' },
  { key: '2', label: 'Yes, and manually approve edits' },
  { key: '3', label: 'No, keep planning' },
];

interface Props {
  pending: PendingPlanApproval;
  onApprove: (controlRequestId: string) => void;
  onDeny: (controlRequestId: string, reason?: string) => void;
}

export function AcceptPlanPanel(props: Props) {
  const { pending, onApprove, onDeny } = props;
  const { stop } = useChatStreamContext();
  const { setInputMode } = useSessionContext();

  const handleOptionSelect = useCallback((index: number) => {
    if (index === 0) {
      onApprove(pending.controlRequestId);
      setInputMode(InputModeValues.AUTO_EDIT);
    } else if (index === 1) {
      onApprove(pending.controlRequestId);
      setInputMode(InputModeValues.ASK_BEFORE_EDIT);
    } else if (index === 2) {
      onDeny(pending.controlRequestId);
      stop();
    }
  }, [pending, onApprove, onDeny, setInputMode, stop]);

  const handleTextSubmit = useCallback((text: string) => {
    onDeny(pending.controlRequestId, text);
  }, [pending, onDeny]);

  const handleCancel = useCallback(() => {
    onDeny(pending.controlRequestId);
    stop();
  }, [pending, onDeny, stop]);

  return (
    <ApprovalPanel
      title="Accept this plan?"
      subtitle="Select text in the preview to add comments"
      options={options}
      onOptionSelect={handleOptionSelect}
      textareaPlaceholder="Tell Claude what to do instead"
      onTextSubmit={handleTextSubmit}
      onCancel={handleCancel}
    />
  );
}
