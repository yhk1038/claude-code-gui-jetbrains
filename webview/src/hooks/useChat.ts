import { useCallback, useState, useRef, useEffect } from 'react';
import { Message, Context } from '../types';
import { useBridge } from './useBridge';

interface UseChatOptions {
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
  onStreamStart?: (messageId: string) => void;
  onStreamEnd?: (messageId: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  isStopped: boolean;
  streamingMessageId: string | null;
  error: Error | null;
  input: string;
  setInput: (input: string) => void;
  sendMessage: (content: string, context?: Context[]) => void;
  stopGeneration: () => void;
  stop: () => void;
  continue: () => void;
  retry: (messageId: string) => void;
  handleSubmit: (e?: React.FormEvent) => void;
  clearMessages: () => void;
  loadMessages: (loadedMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>) => void;
  appendMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  appendToStreamingMessage: (delta: string) => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onMessage, onStreamStart, onStreamEnd } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [input, setInput] = useState('');

  const streamingContentRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const devModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize bridge
  const { isConnected, send, subscribe } = useBridge();

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Append a new message
  const appendMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
    onMessage?.(message);
  }, [onMessage]);

  // Update an existing message
  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  // Append content to the currently streaming message
  const appendToStreamingMessage = useCallback((delta: string) => {
    if (!streamingMessageId) return;

    streamingContentRef.current += delta;
    setMessages(prev => prev.map(msg =>
      msg.id === streamingMessageId
        ? { ...msg, content: streamingContentRef.current }
        : msg
    ));
  }, [streamingMessageId]);

  // Start streaming a new assistant message
  const startStreaming = useCallback((messageId: string) => {
    setIsStreaming(true);
    setStreamingMessageId(messageId);
    streamingContentRef.current = '';
    onStreamStart?.(messageId);
  }, [onStreamStart]);

  // End streaming
  const endStreaming = useCallback(() => {
    if (streamingMessageId) {
      updateMessage(streamingMessageId, { isStreaming: false });
      onStreamEnd?.(streamingMessageId);
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    streamingContentRef.current = '';
  }, [streamingMessageId, updateMessage, onStreamEnd]);

  // Send a message
  const sendMessage = useCallback((content: string, context?: Context[]) => {
    if (!content.trim() || isStreaming) return;

    setError(null);

    // Create user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      context,
    };
    appendMessage(userMessage);

    // Create placeholder assistant message
    const assistantMessageId = generateMessageId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };
    appendMessage(assistantMessage);
    startStreaming(assistantMessageId);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Send message via bridge
    if (isConnected) {
      // Bridge mode: send to Kotlin
      send('SEND_MESSAGE', {
        content: content.trim(),
        context: context || [],
      }).catch((err) => {
        console.error('[useChat] Error sending message to bridge:', err);
        setError(err);
        endStreaming();
      });
    } else {
      // Dev mode: simulate mock response
      console.log('[useChat] Dev mode: simulating mock response');
      const mockResponse = 'This is a mock response from dev mode. Bridge not connected.';

      // Simulate typing effect with delays
      devModeTimeoutRef.current = setTimeout(() => {
        let charIndex = 0;
        const typeInterval = setInterval(() => {
          if (charIndex < mockResponse.length) {
            appendToStreamingMessage(mockResponse[charIndex]);
            charIndex++;
          } else {
            clearInterval(typeInterval);
            endStreaming();
          }
        }, 30);
      }, 2000);
    }
  }, [isStreaming, isConnected, generateMessageId, appendMessage, startStreaming, send, appendToStreamingMessage, endStreaming]);

  // Stop generation
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    endStreaming();
  }, [endStreaming]);

  // Retry a message
  const retry = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Find the last user message before this message
    let userMessage: Message | null = null;
    for (let i = messageIndex; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (userMessage) {
      // Remove messages from the failed one onwards
      setMessages(prev => prev.slice(0, messageIndex));
      // Resend
      sendMessage(userMessage.content, userMessage.context);
    }
  }, [messages, sendMessage]);

  // Handle form submit
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  }, [input, sendMessage]);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Load messages from a session
  const loadMessages = useCallback((loadedMessages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>) => {
    const convertedMessages: Message[] = loadedMessages.map((msg, index) => ({
      id: `loaded-${index}-${Date.now()}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      isStreaming: false,
    }));
    setMessages(convertedMessages);
    setError(null);
    console.log('[useChat] Loaded messages:', convertedMessages.length);
  }, []);

  // Stop streaming
  const stop = useCallback(() => {
    setIsStopped(true);
    setIsStreaming(false);
  }, []);

  // Continue streaming
  const continueStreaming = useCallback(() => {
    setIsStopped(false);
    // Will be handled by bridge to resume generation
  }, []);

  // Subscribe to bridge messages
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to streaming events
    const unsubscribeStreamStart = subscribe('STREAM_START', () => {
      console.log('[useChat] Received STREAM_START from bridge');
      // Streaming already started when sending message
    });

    const unsubscribeStreamDelta = subscribe('STREAM_DELTA', (message: IPCMessage) => {
      const delta = message.payload?.delta as string;
      if (delta) {
        appendToStreamingMessage(delta);
      }
    });

    const unsubscribeStreamEnd = subscribe('STREAM_END', () => {
      console.log('[useChat] Received STREAM_END from bridge');
      endStreaming();
    });

    const unsubscribeToolUse = subscribe('TOOL_USE', (message: IPCMessage) => {
      console.log('[useChat] Received TOOL_USE from bridge:', message.payload);
      // Tool use handling will be implemented later
    });

    const unsubscribeError = subscribe('SERVICE_ERROR', (message: IPCMessage) => {
      console.error('[useChat] Received SERVICE_ERROR from bridge:', message.payload);
      const errorMessage = message.payload?.error as string || 'Unknown error';
      setError(new Error(errorMessage));
      endStreaming();
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeStreamStart();
      unsubscribeStreamDelta();
      unsubscribeStreamEnd();
      unsubscribeToolUse();
      unsubscribeError();
    };
  }, [isConnected, subscribe, appendToStreamingMessage, endStreaming]);

  // Cleanup dev mode timeout on unmount
  useEffect(() => {
    return () => {
      if (devModeTimeoutRef.current) {
        clearTimeout(devModeTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    isStopped,
    streamingMessageId,
    error,
    input,
    setInput,
    sendMessage,
    stopGeneration,
    stop,
    continue: continueStreaming,
    retry,
    handleSubmit,
    clearMessages,
    loadMessages,
    appendMessage,
    updateMessage,
    appendToStreamingMessage,
  };
}
