import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessageArea } from '../ChatMessageArea';
import type { LoadedMessageDto, ToolUse } from '../../types';
import { LoadedMessageType, MessageRole } from '../../dto/common';

// Mock contexts
const mockSessionContext = {
  workingDirectory: null as string | null,
  setWorkingDirectory: vi.fn(),
};

const mockChatStreamContext = {
  messages: [] as LoadedMessageDto[],
  retry: vi.fn(),
};

vi.mock('../../contexts/SessionContext', () => ({
  useSessionContext: () => mockSessionContext,
}));

vi.mock('../../contexts/ChatStreamContext', () => ({
  useChatStreamContext: () => mockChatStreamContext,
}));

// Mock child components
vi.mock('../MessageBubble', () => ({
  MessageBubble: ({ message }: { message: LoadedMessageDto }) => (
    <div data-testid={`message-bubble-${message.uuid}`}>
      {message.type}: {typeof message.message?.content === 'string' ? message.message.content : 'complex content'}
    </div>
  ),
}));

vi.mock('../ToolCard', () => ({
  ToolCard: ({ toolUse }: { toolUse: ToolUse }) => (
    <div data-testid={`tool-card-${toolUse.id}`}>
      Tool: {toolUse.name} - Status: {toolUse.status}
    </div>
  ),
}));

vi.mock('../ProjectSelector', () => ({
  ProjectSelector: () => <div data-testid="project-selector">Select Project</div>,
}));

describe('ChatMessageArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    // Clear kotlinBridge
    delete (window as any).kotlinBridge;
    // Reset context defaults
    mockSessionContext.workingDirectory = null;
    mockChatStreamContext.messages = [];
  });

  it('shows ProjectSelector when no working directory and no kotlinBridge', () => {
    render(<ChatMessageArea />);

    expect(screen.getByTestId('project-selector')).toBeInTheDocument();
    expect(screen.getByText('Select Project')).toBeInTheDocument();
  });

  it('shows loading message when no working directory with kotlinBridge', () => {
    (window as any).kotlinBridge = {};

    render(<ChatMessageArea />);

    expect(screen.getByText('Loading working directory...')).toBeInTheDocument();
    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
  });

  it('shows empty state message when no messages with working directory', () => {
    mockSessionContext.workingDirectory = '/test/path';

    render(<ChatMessageArea />);

    expect(screen.getByText('Type a message')).toBeInTheDocument();
  });

  it('renders user message correctly', () => {
    mockSessionContext.workingDirectory = '/test/path';
    mockChatStreamContext.messages = [{
      uuid: 'msg1',
      type: LoadedMessageType.User,
      message: { role: MessageRole.User, content: 'Hello, assistant!' },
      timestamp: new Date().toISOString(),
    }];

    render(<ChatMessageArea />);

    expect(screen.getByTestId('message-bubble-msg1')).toBeInTheDocument();
    expect(screen.getByText('user: Hello, assistant!')).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    mockSessionContext.workingDirectory = '/test/path';
    mockChatStreamContext.messages = [{
      uuid: 'msg2',
      type: LoadedMessageType.Assistant,
      message: { role: MessageRole.Assistant, content: 'Hello, user!' },
      timestamp: new Date().toISOString(),
    }];

    render(<ChatMessageArea />);

    expect(screen.getByTestId('message-bubble-msg2')).toBeInTheDocument();
    expect(screen.getByText('assistant: Hello, user!')).toBeInTheDocument();
  });

  it('renders ToolCard for messages with toolUses in content blocks', () => {
    mockSessionContext.workingDirectory = '/test/path';
    mockChatStreamContext.messages = [{
      uuid: 'msg3',
      type: LoadedMessageType.Assistant,
      message: {
        role: MessageRole.Assistant,
        content: [
          { type: 'text', text: 'I need to read a file' },
          { type: 'tool_use', id: 'tool1', name: 'read_file', input: { path: '/test.txt' } },
        ] as any,
      },
      timestamp: new Date().toISOString(),
    }];

    render(<ChatMessageArea />);

    expect(screen.getByTestId('message-bubble-msg3')).toBeInTheDocument();
    expect(screen.getByTestId('tool-card-tool1')).toBeInTheDocument();
    expect(screen.getByText('Tool: read_file - Status: completed')).toBeInTheDocument();
  });

  it('renders multiple messages correctly', () => {
    const now = new Date().toISOString();
    mockSessionContext.workingDirectory = '/test/path';
    mockChatStreamContext.messages = [
      {
        uuid: 'msg1',
        type: LoadedMessageType.User,
        message: { role: MessageRole.User, content: 'First message' },
        timestamp: now,
      },
      {
        uuid: 'msg2',
        type: LoadedMessageType.Assistant,
        message: { role: MessageRole.Assistant, content: 'Second message' },
        timestamp: now,
      },
      {
        uuid: 'msg3',
        type: LoadedMessageType.User,
        message: { role: MessageRole.User, content: 'Third message' },
        timestamp: now,
      },
    ];

    render(<ChatMessageArea />);

    expect(screen.getByTestId('message-bubble-msg1')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble-msg2')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble-msg3')).toBeInTheDocument();
    expect(screen.getByText('user: First message')).toBeInTheDocument();
    expect(screen.getByText('assistant: Second message')).toBeInTheDocument();
    expect(screen.getByText('user: Third message')).toBeInTheDocument();
  });

  it('renders multiple tool uses for a single message', () => {
    mockSessionContext.workingDirectory = '/test/path';
    mockChatStreamContext.messages = [{
      uuid: 'msg4',
      type: LoadedMessageType.Assistant,
      message: {
        role: MessageRole.Assistant,
        content: [
          { type: 'text', text: 'Using multiple tools' },
          { type: 'tool_use', id: 'tool1', name: 'read_file', input: { path: '/test1.txt' } },
          { type: 'tool_use', id: 'tool2', name: 'write_file', input: { path: '/test2.txt' } },
        ] as any,
      },
      timestamp: new Date().toISOString(),
    }];

    render(<ChatMessageArea />);

    expect(screen.getByTestId('tool-card-tool1')).toBeInTheDocument();
    expect(screen.getByTestId('tool-card-tool2')).toBeInTheDocument();
    expect(screen.getByText('Tool: read_file - Status: completed')).toBeInTheDocument();
    expect(screen.getByText('Tool: write_file - Status: completed')).toBeInTheDocument();
  });
});
