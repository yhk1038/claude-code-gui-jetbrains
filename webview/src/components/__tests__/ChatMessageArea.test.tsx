import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessageArea } from '../ChatMessageArea';
import type { Message, ToolUse } from '../../types';

// Mock child components
vi.mock('../MessageBubble', () => ({
  MessageBubble: ({ message }: { message: Message }) => (
    <div data-testid={`message-bubble-${message.id}`}>
      {message.role}: {typeof message.content === 'string' ? message.content : 'complex content'}
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
  const mockOnSelectProject = vi.fn();
  const mockOnRetry = vi.fn();
  const mockApproveToolUse = vi.fn();
  const mockDenyToolUse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    // Clear kotlinBridge
    delete (window as any).kotlinBridge;
  });

  it('shows ProjectSelector when no working directory and no kotlinBridge', () => {
    render(
      <ChatMessageArea
        messages={[]}
        streamingMessageId={null}
        workingDirectory={null}
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('project-selector')).toBeInTheDocument();
    expect(screen.getByText('Select Project')).toBeInTheDocument();
  });

  it('shows loading message when no working directory with kotlinBridge', () => {
    (window as any).kotlinBridge = {};

    render(
      <ChatMessageArea
        messages={[]}
        streamingMessageId={null}
        workingDirectory={null}
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByText('워킹 디렉토리를 불러오는 중...')).toBeInTheDocument();
    expect(screen.queryByTestId('project-selector')).not.toBeInTheDocument();
  });

  it('shows empty state message when no messages with working directory', () => {
    render(
      <ChatMessageArea
        messages={[]}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByText('메시지를 입력하세요')).toBeInTheDocument();
  });

  it('renders user message correctly', () => {
    const userMessage: Message = {
      id: 'msg1',
      role: 'user',
      content: 'Hello, assistant!',
      timestamp: Date.now(),
    };

    render(
      <ChatMessageArea
        messages={[userMessage]}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('message-bubble-msg1')).toBeInTheDocument();
    expect(screen.getByText('user: Hello, assistant!')).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    const assistantMessage: Message = {
      id: 'msg2',
      role: 'assistant',
      content: 'Hello, user!',
      timestamp: Date.now(),
    };

    render(
      <ChatMessageArea
        messages={[assistantMessage]}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('message-bubble-msg2')).toBeInTheDocument();
    expect(screen.getByText('assistant: Hello, user!')).toBeInTheDocument();
  });

  it('renders ToolCard for messages with toolUses', () => {
    const toolUse: ToolUse = {
      id: 'tool1',
      name: 'read_file',
      input: { path: '/test.txt' },
      status: 'pending',
    };

    const messageWithTool: Message = {
      id: 'msg3',
      role: 'assistant',
      content: 'I need to read a file',
      timestamp: Date.now(),
      toolUses: [toolUse],
    };

    render(
      <ChatMessageArea
        messages={[messageWithTool]}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('message-bubble-msg3')).toBeInTheDocument();
    expect(screen.getByTestId('tool-card-tool1')).toBeInTheDocument();
    expect(screen.getByText('Tool: read_file - Status: pending')).toBeInTheDocument();
  });

  it('renders multiple messages correctly', () => {
    const messages: Message[] = [
      {
        id: 'msg1',
        role: 'user',
        content: 'First message',
        timestamp: Date.now(),
      },
      {
        id: 'msg2',
        role: 'assistant',
        content: 'Second message',
        timestamp: Date.now(),
      },
      {
        id: 'msg3',
        role: 'user',
        content: 'Third message',
        timestamp: Date.now(),
      },
    ];

    render(
      <ChatMessageArea
        messages={messages}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('message-bubble-msg1')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble-msg2')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble-msg3')).toBeInTheDocument();
    expect(screen.getByText('user: First message')).toBeInTheDocument();
    expect(screen.getByText('assistant: Second message')).toBeInTheDocument();
    expect(screen.getByText('user: Third message')).toBeInTheDocument();
  });

  it('renders multiple tool uses for a single message', () => {
    const toolUses: ToolUse[] = [
      {
        id: 'tool1',
        name: 'read_file',
        input: { path: '/test1.txt' },
        status: 'completed',
      },
      {
        id: 'tool2',
        name: 'write_file',
        input: { path: '/test2.txt' },
        status: 'pending',
      },
    ];

    const messageWithTools: Message = {
      id: 'msg4',
      role: 'assistant',
      content: 'Using multiple tools',
      timestamp: Date.now(),
      toolUses,
    };

    render(
      <ChatMessageArea
        messages={[messageWithTools]}
        streamingMessageId={null}
        workingDirectory="/test/path"
        onSelectProject={mockOnSelectProject}
        onRetry={mockOnRetry}
        approveToolUse={mockApproveToolUse}
        denyToolUse={mockDenyToolUse}
      />
    );

    expect(screen.getByTestId('tool-card-tool1')).toBeInTheDocument();
    expect(screen.getByTestId('tool-card-tool2')).toBeInTheDocument();
    expect(screen.getByText('Tool: read_file - Status: completed')).toBeInTheDocument();
    expect(screen.getByText('Tool: write_file - Status: pending')).toBeInTheDocument();
  });
});
