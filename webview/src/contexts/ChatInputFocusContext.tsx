import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface ChatInputFocusContextType {
  /** Register the textarea ref from ChatInput */
  registerRef: (ref: HTMLTextAreaElement | null) => void;
  /** Focus the ChatInput textarea from anywhere */
  focus: () => void;
}

const ChatInputFocusContext = createContext<ChatInputFocusContextType>({
  registerRef: () => {},
  focus: () => {},
});

export function ChatInputFocusProvider({ children }: { children: ReactNode }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const registerRef = useCallback((ref: HTMLTextAreaElement | null) => {
    textareaRef.current = ref;
  }, []);

  const focus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <ChatInputFocusContext.Provider value={{ registerRef, focus }}>
      {children}
    </ChatInputFocusContext.Provider>
  );
}

export function useChatInputFocus() {
  return useContext(ChatInputFocusContext);
}
