import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';
import { LoadedMessageDto, MessageDto } from '../../../types';
import { MessageRole, LoadedMessageType } from '../../../dto/common';

// Mock child renderers to isolate MessageBubble dispatch logic
vi.mock('../message-renderers', () => ({
  UserMessageRenderer: ({ message }: { message: LoadedMessageDto }) => (
    <div data-testid="user-renderer">User: {message.uuid}</div>
  ),
  AssistantMessageRenderer: ({ message, onRetry }: { message: LoadedMessageDto; onRetry?: (id: string) => void }) => (
    <div data-testid="assistant-renderer">
      Assistant: {message.uuid}
      {onRetry && <button onClick={() => onRetry('msg-1')}>Retry</button>}
    </div>
  ),
  SystemMessageRenderer: ({ message }: { message: LoadedMessageDto }) => (
    <div data-testid="system-renderer">System: {message.uuid}</div>
  ),
  SummaryMessageRenderer: ({ message }: { message: LoadedMessageDto }) => (
    <div data-testid="summary-renderer">Summary</div>
  ),
  NotificationMessageRenderer: ({ message }: { message: LoadedMessageDto }) => (
    <div data-testid="notification-renderer">Notification</div>
  ),
}));

function createMessage(type: LoadedMessageType, uuid = 'msg-1'): LoadedMessageDto {
  const msg = new LoadedMessageDto();
  msg.type = type;
  msg.uuid = uuid;
  return msg;
}

describe('MessageBubble', () => {
  it('renders UserMessageRenderer for user type', () => {
    render(<MessageBubble message={createMessage(LoadedMessageType.User)} />);
    expect(screen.getByTestId('user-renderer')).toBeInTheDocument();
  });

  it('renders AssistantMessageRenderer for assistant type', () => {
    render(<MessageBubble message={createMessage(LoadedMessageType.Assistant)} />);
    expect(screen.getByTestId('assistant-renderer')).toBeInTheDocument();
  });

  it('renders SystemMessageRenderer for system type', () => {
    render(<MessageBubble message={createMessage(LoadedMessageType.System)} />);
    expect(screen.getByTestId('system-renderer')).toBeInTheDocument();
  });

  it('renders SummaryMessageRenderer for summary type', () => {
    render(<MessageBubble message={createMessage(LoadedMessageType.Summary)} />);
    expect(screen.getByTestId('summary-renderer')).toBeInTheDocument();
  });

  it('renders NotificationMessageRenderer for notification type', () => {
    render(<MessageBubble message={createMessage(LoadedMessageType.Notification)} />);
    expect(screen.getByTestId('notification-renderer')).toBeInTheDocument();
  });

  it('renders null for unknown message type', () => {
    const { container } = render(
      <MessageBubble message={createMessage('unknown' as LoadedMessageType)} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('passes onRetry callback to AssistantMessageRenderer', () => {
    const onRetry = vi.fn();
    render(
      <MessageBubble
        message={createMessage(LoadedMessageType.Assistant)}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledWith('msg-1');
  });
});
