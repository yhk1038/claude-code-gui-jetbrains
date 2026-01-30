import { useCallback, useEffect, useRef, useState } from 'react';
import { useBridge } from './useBridge';

export type StreamingState = 'idle' | 'streaming' | 'paused' | 'error';

interface StreamChunk {
  messageId: string;
  delta: string;
  timestamp: number;
}

interface UseStreamingOptions {
  throttleMs?: number;
  maxBufferSize?: number;
  onChunk?: (chunk: StreamChunk) => void;
  onStateChange?: (state: StreamingState) => void;
  onError?: (error: Error) => void;
}

interface UseStreamingReturn {
  state: StreamingState;
  buffer: string;
  currentMessageId: string | null;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  getBufferForMessage: (messageId: string) => string;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const {
    throttleMs = 16, // ~60fps
    maxBufferSize = 100000, // 100KB
    onChunk,
    onStateChange,
    onError,
  } = options;

  const { subscribe } = useBridge();

  const [state, setState] = useState<StreamingState>('idle');
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Buffer management
  const bufferRef = useRef<Map<string, string>>(new Map());
  const pendingChunksRef = useRef<StreamChunk[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastFlushRef = useRef<number>(0);

  // Get buffer for specific message
  const getBufferForMessage = useCallback((messageId: string): string => {
    return bufferRef.current.get(messageId) || '';
  }, []);

  // Update state with callbacks
  const updateState = useCallback((newState: StreamingState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Flush pending chunks to buffer
  const flushChunks = useCallback(() => {
    if (isPaused || pendingChunksRef.current.length === 0) {
      rafIdRef.current = null;
      return;
    }

    const now = performance.now();
    if (now - lastFlushRef.current < throttleMs) {
      // Schedule next flush
      rafIdRef.current = requestAnimationFrame(flushChunks);
      return;
    }

    lastFlushRef.current = now;

    // Process all pending chunks
    const chunks = [...pendingChunksRef.current];
    pendingChunksRef.current = [];

    chunks.forEach(chunk => {
      const currentBuffer = bufferRef.current.get(chunk.messageId) || '';
      const newBuffer = currentBuffer + chunk.delta;

      // Check buffer size limit
      if (newBuffer.length > maxBufferSize) {
        const error = new Error(`Buffer size exceeded for message ${chunk.messageId}`);
        onError?.(error);
        updateState('error');
        return;
      }

      bufferRef.current.set(chunk.messageId, newBuffer);
      onChunk?.(chunk);
    });

    // Continue flushing if there are more chunks
    if (pendingChunksRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(flushChunks);
    } else {
      rafIdRef.current = null;
    }
  }, [isPaused, throttleMs, maxBufferSize, onChunk, onError, updateState]);

  // Add chunk to pending queue
  const addChunk = useCallback((messageId: string, delta: string) => {
    const chunk: StreamChunk = {
      messageId,
      delta,
      timestamp: Date.now(),
    };

    pendingChunksRef.current.push(chunk);

    // Start flushing if not already running
    if (!rafIdRef.current && !isPaused) {
      rafIdRef.current = requestAnimationFrame(flushChunks);
    }
  }, [isPaused, flushChunks]);

  // Pause streaming
  const pause = useCallback(() => {
    setIsPaused(true);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Resume streaming
  const resume = useCallback(() => {
    setIsPaused(false);
    if (pendingChunksRef.current.length > 0 && !rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(flushChunks);
    }
  }, [flushChunks]);

  // Reset streaming state
  const reset = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingChunksRef.current = [];
    bufferRef.current.clear();
    setCurrentMessageId(null);
    setIsPaused(false);
    updateState('idle');
  }, [updateState]);

  // Subscribe to streaming events
  useEffect(() => {
    const unsubscribeStart = subscribe('stream:start', (message) => {
      const messageId = message.payload?.messageId as string;
      setCurrentMessageId(messageId);
      bufferRef.current.set(messageId, '');
      updateState('streaming');
    });

    const unsubscribeChunk = subscribe('stream:chunk', (message) => {
      const messageId = message.payload?.messageId as string;
      const delta = message.payload?.delta as string;

      if (delta) {
        addChunk(messageId, delta);
      }
    });

    const unsubscribeEnd = subscribe('stream:end', (message) => {
      const messageId = message.payload?.messageId as string;

      // Flush any remaining chunks immediately
      if (pendingChunksRef.current.length > 0) {
        const chunks = [...pendingChunksRef.current];
        pendingChunksRef.current = [];

        chunks.forEach(chunk => {
          if (chunk.messageId === messageId) {
            const currentBuffer = bufferRef.current.get(chunk.messageId) || '';
            bufferRef.current.set(chunk.messageId, currentBuffer + chunk.delta);
            onChunk?.(chunk);
          }
        });
      }

      setCurrentMessageId(null);
      updateState('idle');
    });

    const unsubscribeError = subscribe('stream:error', (message) => {
      const error = new Error(message.payload?.error as string);
      onError?.(error);
      updateState('error');
    });

    return () => {
      unsubscribeStart();
      unsubscribeChunk();
      unsubscribeEnd();
      unsubscribeError();

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [subscribe, addChunk, onChunk, onError, updateState]);

  return {
    state,
    buffer: currentMessageId ? getBufferForMessage(currentMessageId) : '',
    currentMessageId,
    isPaused,
    pause,
    resume,
    reset,
    getBufferForMessage,
  };
}
